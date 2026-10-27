"""
Multi-Modal Deepfake Detection API
Main application file with VIDEO SUPPORT
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List

# Import from separate model files
import image_model
import audio_model
import video_model  # NEW: Video detection module

# ========= Chatbot Imports =========
import os
import requests
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()


# ============== CREATE APP ==============
app = FastAPI(title="Multi-Modal Deepfake Detection API")

# ============== CORS ==============
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== LOAD MODELS ON STARTUP ==============
@app.on_event("startup")
async def startup_event():
    """Load all models when the application starts"""
    print("="*60)
    print("Loading models...")
    print("="*60)
    image_model.load_image_model()  # This also loads face detector needed for video
    audio_model.load_audio_model()
    print("✓ Video detection ready (uses image model)")
    print("="*60)


# ============== FILE TYPE DETECTION ==============
def detect_file_type(file: UploadFile) -> str:
    """Detect file type from MIME type and filename"""
    mime_type = file.content_type.lower() if file.content_type else ""
    filename = file.filename.lower() if file.filename else ""
    
    if mime_type.startswith('image/'):
        return 'image'
    elif mime_type.startswith('audio/'):
        return 'audio'
    elif mime_type.startswith('video/'):
        return 'video'
    
    if filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')):
        return 'image'
    elif filename.endswith(('.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac')):
        return 'audio'
    elif filename.endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm')):
        return 'video'
    
    return 'unknown'


# ============== API ROUTES ==============
@app.get("/")
def root():
    """Root endpoint - API information"""
    return {
        "status": "✅ Multi-Modal Deepfake Detection API is running",
        "models": {
            "image": "active" if image_model.image_model else "unavailable",
            "audio": "active" if audio_model.audio_model else "unavailable",
            "video": "active (uses image model)" if image_model.image_model else "unavailable"
        },
        "endpoints": {
            "auto_detect": "/predict",
            "image_only": "/predict/image",
            "audio_only": "/predict/audio",
            "video_only": "/predict/video",
            "video_batch": "/predict/video/batch",
            "video_config": "/config/video",
            "chatbot": "/chatbot",
            "health": "/health"
        },
        "video_info": {
            "frames_per_video": video_model.NUM_FRAMES_TO_EXTRACT,
            "aggregation_method": video_model.AGGREGATION_METHOD,
            "supported_formats": [".mp4", ".avi", ".mov", ".mkv", ".webm"]
        }
    }


@app.post("/predict")
async def predict_auto(file: UploadFile = File(...)):
    """Auto-detect file type and route to appropriate model"""
    try:
        file_type = detect_file_type(file)
        
        if file_type == 'image':
            return await image_model.predict_image(file)
        elif file_type == 'audio':
            return await audio_model.predict_audio(file)
        elif file_type == 'video':
            return await video_model.predict_video(file)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")


@app.post("/predict/image")
async def predict_image_endpoint(file: UploadFile = File(...)):
    """Image-only prediction endpoint"""
    file_type = detect_file_type(file)
    if file_type != 'image':
        raise HTTPException(status_code=400, detail="File must be an image")
    
    return await image_model.predict_image(file)


@app.post("/predict/audio")
async def predict_audio_endpoint(file: UploadFile = File(...)):
    """Audio-only prediction endpoint"""
    file_type = detect_file_type(file)
    if file_type != 'audio':
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    return await audio_model.predict_audio(file)


@app.post("/predict/video")
async def predict_video_endpoint(file: UploadFile = File(...)):
    """
    Video prediction endpoint
    Extracts frames and uses image model for detection
    """
    file_type = detect_file_type(file)
    if file_type != 'video':
        raise HTTPException(status_code=400, detail="File must be a video")
    
    return await video_model.predict_video(file)


@app.post("/predict/video/batch")
async def predict_video_batch_endpoint(files: List[UploadFile] = File(...)):
    """
    Batch video prediction endpoint
    Process multiple videos at once
    """
    # Validate all files are videos
    for file in files:
        file_type = detect_file_type(file)
        if file_type != 'video':
            raise HTTPException(
                status_code=400, 
                detail=f"All files must be videos. {file.filename} is not a video."
            )
    
    return await video_model.predict_video_batch(files)


@app.get("/config/video")
def get_video_configuration():
    """Get current video detection configuration"""
    return video_model.get_video_config()


@app.post("/config/video")
def update_video_configuration(config: dict):
    """
    Update video detection configuration
    
    Example:
    {
        "num_frames": 20,
        "min_valid_frames": 8,
        "aggregation_method": "voting",
        "skip_edge_frames": true
    }
    """
    try:
        video_model.set_video_config(config)
        return {
            "success": True,
            "message": "Configuration updated",
            "new_config": video_model.get_video_config()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Configuration error: {str(e)}")


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": {
            "image": image_model.image_model is not None,
            "audio": audio_model.audio_model is not None,
            "video": image_model.image_model is not None  # Video uses image model
        },
        "dependencies": {
            "face_detector": image_model.face_cascade is not None
        }
    }


# ============== CHATBOT ==============
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class ChatRequest(BaseModel):
    message: str

@app.post("/chatbot")
def chatbot_api(request: ChatRequest):
    """Chatbot endpoint using FREE Groq API"""

    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY missing in .env")

    # Groq API endpoint - FREE and FAST
    GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

    # Check if question is deepfake-related
    user_msg = request.message.lower()
    deepfake_keywords = ['deepfake', 'fake', 'detect', 'audio', 'image', 'video', 'ai', 
                         'generated', 'synthetic', 'authenticity', 'verify', 'real', 
                         'spot', 'tell', 'check', 'identify', 'media', 'voice', 'face']
    
    is_relevant = any(keyword in user_msg for keyword in deepfake_keywords)
    
    # Block completely off-topic questions
    if not is_relevant and len(user_msg.split()) > 3:
        return {
            "reply": "I'm DeepGuard AI, specialized in deepfake detection only. Please ask me about detecting fake images, audio, videos, or AI-generated content."
        }

    # System message to constrain responses
    messages = [
        {
            "role": "system",
            "content": """You are DeepGuard AI, an expert assistant specialized ONLY in deepfake detection and media authenticity.

Your expertise:
- Detecting fake images, audio, and videos
- Explaining how deepfakes are created
- Tips to identify AI-generated content
- Media authenticity verification techniques

Rules:
- Keep responses SHORT (2-4 sentences maximum)
- Be helpful and practical
- Only discuss deepfake-related topics
- If asked about other topics, say: "I only help with deepfake detection."
"""
        },
        {
            "role": "user",
            "content": request.message
        }
    ]

    payload = {
        "model": "llama-3.3-70b-versatile",  # Fast and free model
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 200,
        "top_p": 0.9
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(GROQ_URL, json=payload, headers=headers, timeout=30)
        
        print(f"Groq Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Groq Error: {response.text}")
            return {"reply": "I'm having trouble right now. Please try again in a moment!"}

        data = response.json()
        print(f"Groq Response: {data}")

        # Extract the AI's reply
        reply = data["choices"][0]["message"]["content"].strip()

        print(f"AI Reply: {reply}")

        if not reply or len(reply) < 5:
            return {"reply": "I can help detect deepfakes! Ask me: 'How do I spot fake videos?'"}

        return {"reply": reply}

    except requests.exceptions.Timeout:
        return {"reply": "Request timed out. Please try again!"}
    except Exception as e:
        print(f"Error: {str(e)}")
        return {"reply": "An error occurred. Please try again!"}


# ============== RUN ==============
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)