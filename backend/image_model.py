
import numpy as np
from PIL import Image
import cv2
import tensorflow as tf
from fastapi import UploadFile, HTTPException
import io
import base64
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============== CONFIGURATION ==============
IMAGE_MODEL_PATH = "deepfake_model.h5"
IMAGE_CLASS_NAMES = [
    "FaceSwap",      # 0
    "Real",          # 1
    "Face2Face",     # 2
    "NeuralTextures",# 3
    "FaceShifter",   # 4
    "Deepfakes"      # 5
]

# ============== LOAD MODEL ==============
image_model = None
face_cascade = None

def load_image_model():
    """Load image detection model and face cascade"""
    global image_model, face_cascade
    
    try:
        image_model = tf.keras.models.load_model(IMAGE_MODEL_PATH, compile=False)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        logger.info(f"Image model loaded from: {IMAGE_MODEL_PATH}")
    except Exception as e:
        logger.error(f"Failed to load image model: {e}")


# ============== HELPER FUNCTIONS ==============
def numpy_to_base64(image_array):
    """Convert numpy array to base64 data URL"""
    try:
        if image_array.dtype != np.uint8:
            image_array = image_array.astype(np.uint8)
        
        pil_image = Image.fromarray(image_array)
        buffered = io.BytesIO()
        pil_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"
    except Exception as e:
        logger.error(f"Base64 conversion error: {e}")
        return None


# ============== FEATURE ANALYSIS ==============
def analyze_image_features(image):
    """Analyze image quality features"""
    try:
        if image.dtype != np.uint8:
            image = image.astype(np.uint8)
        
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Face Symmetry
        h, w = gray.shape
        left_half = gray[:, :w//2]
        right_half_flipped = cv2.flip(gray[:, w//2:], 1)
        min_w = min(left_half.shape[1], right_half_flipped.shape[1])
        left_half = left_half[:, :min_w]
        right_half_flipped = right_half_flipped[:, :min_w]
        symmetry_diff = np.mean(np.abs(left_half.astype(float) - right_half_flipped.astype(float)))
        symmetry_score = max(0, 100 - (symmetry_diff / 2.55))
        
        # Texture Consistency
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        texture_score = min(100, np.var(laplacian) / 5)
        
        # Edge Artifacts
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        edge_score = max(0, min(100, 100 - (edge_density * 500)))
        
        # Color Distribution
        hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
        color_score = 100 - min(100, (np.std(hsv[:, :, 0]) + np.std(hsv[:, :, 1]) + np.std(hsv[:, :, 2])) / 3)
        
        # Pixel Patterns
        dct = cv2.dct(np.float32(gray))
        h, w = dct.shape
        high_freq_mean = np.mean(np.abs(dct[h//2:, w//2:]))
        pattern_score = 100 - min(100, high_freq_mean / 2)
        
        return {
            'Face Symmetry': round(float(symmetry_score), 2),
            'Texture Consistency': round(float(texture_score), 2),
            'Edge Artifacts': round(float(edge_score), 2),
            'Color Distribution': round(float(color_score), 2),
            'Pixel Patterns': round(float(pattern_score), 2)
        }
    except Exception as e:
        logger.error(f"Feature analysis error: {e}")
        return {
            'Face Symmetry': 50.0,
            'Texture Consistency': 50.0,
            'Edge Artifacts': 50.0,
            'Color Distribution': 50.0,
            'Pixel Patterns': 50.0
        }


# ============== PREPROCESSING ==============
def extract_face(image_array):
    """Extract face using Haar Cascade. Returns (face, face_detected)"""
    gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    if len(faces) == 0:
        # No face detected - return resized image but mark as not detected
        return cv2.resize(image_array, (224, 224)), False
    
    # Get largest face
    x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
    
    # Add margin
    margin = int(0.1 * w)
    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(image_array.shape[1], x + w + margin)
    y2 = min(image_array.shape[0], y + h + margin)
    
    face = image_array[y1:y2, x1:x2]
    return cv2.resize(face, (224, 224)), True


def preprocess_image(pil_image):
    """Preprocess image for model. Returns (face_batch, face_uint8, face_detected)"""
    image_array = np.array(pil_image, dtype=np.uint8)
    face, face_detected = extract_face(image_array)
    
    face_uint8 = face.copy()
    face_float = face.astype(np.float32)
    face_batch = np.expand_dims(face_float, axis=0)
    
    return face_batch, face_uint8, face_detected


# ============== PREDICTION ==============
async def predict_image(file: UploadFile):
    """Predict if image is deepfake"""
    try:
        if image_model is None:
            raise HTTPException(status_code=503, detail="Image model not available")
        
        # Read and preprocess
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        face_batch, face_uint8, face_detected = preprocess_image(image)
        
        # Check if face was detected
        if not face_detected:
            logger.warning(f"No face detected in image: {file.filename}")
            return {
                "success": True,
                "file_type": "image",
                "filename": file.filename,
                "analyzed": False,
                "message": "This image is not analyzed because it doesn't contain any face. DeepGuard only detects and analyzes faces.",
                "prediction": None,
                "confidence": None,
                "is_fake": None,
                "all_probabilities": None,
                "feature_quality": None,
                "face_image": None
            }
        
        # Predict
        predictions = image_model.predict(face_batch, verbose=0)[0]
        class_idx = np.argmax(predictions)
        confidence = float(predictions[class_idx]) * 100
        predicted_class = IMAGE_CLASS_NAMES[class_idx]
        
        # All probabilities
        all_probs = {
            IMAGE_CLASS_NAMES[i]: round(float(predictions[i]) * 100, 2) 
            for i in range(len(IMAGE_CLASS_NAMES))
        }
        
        # Feature analysis
        feature_quality = analyze_image_features(face_uint8)
        
        # Convert face to base64 for frontend
        face_image_base64 = numpy_to_base64(face_uint8)
        
        logger.info(f"Processed {file.filename}: {predicted_class} ({confidence:.2f}%)")
        
        return {
            "success": True,
            "file_type": "image",
            "filename": file.filename,
            "analyzed": True,
            "prediction": predicted_class,
            "confidence": round(confidence, 2),
            "is_fake": predicted_class.lower() != "real",
            "allProbabilities": all_probs,
            "featureQuality": feature_quality,
            "faceImage": face_image_base64
        }
    
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")