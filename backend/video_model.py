"""
Video Deepfake Detection Module
Extracts frames from video and uses the existing image model for prediction.
Also extracts audio from video and uses the audio model for prediction.
"""

import numpy as np
from PIL import Image
import cv2
import tensorflow as tf
from fastapi import UploadFile, HTTPException
import io
import base64
import logging
import tempfile
import os
import subprocess
import shutil
from typing import List, Dict, Tuple, Optional
from collections import Counter

# Import the existing image and audio model functions
import image_model
import audio_model as audio_module

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============== CONFIGURATION ==============
NUM_FRAMES_TO_EXTRACT = 16       # Number of frames to analyze per video
MIN_VALID_FRAMES = 5             # Minimum frames needed for reliable prediction
AGGREGATION_METHOD = 'mean'      # Options: 'mean', 'median', 'voting', 'max'
SKIP_EDGE_FRAMES = True          # Skip first/last 10% of video (often black or transitions)
AUDIO_EXTRACTION_FORMAT = 'wav'  # Format for extracted audio (wav recommended for librosa)


# ============== AUDIO EXTRACTION ==============

def _find_ffmpeg() -> Optional[str]:
    """
    Locate the ffmpeg executable on the system.
    Checks PATH first, then common Windows install locations.
    Returns the full path string or None if not found.
    """
    # 1. Check PATH via shutil
    path = shutil.which("ffmpeg")
    if path:
        return path

    # 2. Common Windows locations
    windows_candidates = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
        os.path.join(os.environ.get("USERPROFILE", ""), "ffmpeg", "bin", "ffmpeg.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "ffmpeg", "bin", "ffmpeg.exe"),
    ]
    for candidate in windows_candidates:
        if os.path.isfile(candidate):
            return candidate

    return None


def _find_ffprobe() -> Optional[str]:
    """Locate ffprobe next to ffmpeg, or on PATH."""
    path = shutil.which("ffprobe")
    if path:
        return path

    ffmpeg_path = _find_ffmpeg()
    if ffmpeg_path:
        probe = os.path.join(os.path.dirname(ffmpeg_path), "ffprobe.exe")
        if os.path.isfile(probe):
            return probe
        probe = os.path.join(os.path.dirname(ffmpeg_path), "ffprobe")
        if os.path.isfile(probe):
            return probe

    return None


def _extract_audio_via_ffmpeg(video_path: str, ffmpeg_bin: str) -> Optional[bytes]:
    """Use ffmpeg subprocess to extract 16 kHz mono WAV bytes."""
    temp_audio_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            temp_audio_path = tmp.name

        cmd = [
            ffmpeg_bin, '-y',
            '-i', video_path,
            '-vn',
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            temp_audio_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode != 0:
            logger.error(f"ffmpeg extraction failed: {result.stderr[-500:]}")
            return None

        with open(temp_audio_path, 'rb') as f:
            data = f.read()

        logger.info(f"ffmpeg extracted {len(data)} bytes of audio")
        return data

    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timed out")
        return None
    except Exception as e:
        logger.error(f"ffmpeg error: {e}")
        return None
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except Exception:
                pass


def _extract_audio_via_moviepy(video_path: str) -> Optional[bytes]:
    """
    Fallback: use moviepy (pure Python) to extract audio.
    moviepy uses imageio_ffmpeg which ships its own ffmpeg binary,
    so it works even when ffmpeg is not on the system PATH.
    Supports both moviepy 1.x (moviepy.editor) and 2.x (moviepy).
    """
    temp_audio_path = None
    try:
        # moviepy 2.x import path
        try:
            from moviepy import VideoFileClip
            logger.info("Using moviepy 2.x")
        except ImportError:
            # moviepy 1.x import path
            from moviepy.editor import VideoFileClip
            logger.info("Using moviepy 1.x")

        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            temp_audio_path = tmp.name

        with VideoFileClip(video_path) as clip:
            if clip.audio is None:
                logger.info("moviepy: video has no audio track")
                return None

            logger.info(f"moviepy: audio duration={clip.audio.duration:.1f}s, fps={clip.audio.fps}")

            # moviepy 2.x write_audiofile signature changed slightly
            try:
                clip.audio.write_audiofile(
                    temp_audio_path,
                    fps=16000,
                    nbytes=2,
                    codec='pcm_s16le',
                    ffmpeg_params=['-ac', '1'],
                    logger=None
                )
            except TypeError:
                # older moviepy 1.x may not accept logger=None
                clip.audio.write_audiofile(
                    temp_audio_path,
                    fps=16000,
                    nbytes=2,
                    codec='pcm_s16le',
                    ffmpeg_params=['-ac', '1'],
                    verbose=False
                )

        with open(temp_audio_path, 'rb') as f:
            data = f.read()

        logger.info(f"moviepy extracted {len(data)} bytes of audio")
        return data

    except ImportError:
        logger.warning("moviepy not installed — skipping moviepy fallback")
        return None
    except Exception as e:
        logger.error(f"moviepy extraction error: {e}")
        return None
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except Exception:
                pass


def _video_has_audio_stream(video_path: str) -> bool:
    """
    Quick check: does the video container report an audio stream?
    Uses ffprobe if available, otherwise falls back to OpenCV audio-channel heuristic.
    """
    # Try ffprobe first
    ffprobe_bin = _find_ffprobe()
    if ffprobe_bin:
        try:
            result = subprocess.run(
                [
                    ffprobe_bin, '-v', 'error',
                    '-select_streams', 'a',
                    '-show_entries', 'stream=codec_type',
                    '-of', 'default=noprint_wrappers=1:nokey=1',
                    video_path
                ],
                capture_output=True, text=True, timeout=15
            )
            has = 'audio' in result.stdout.lower()
            logger.info(f"ffprobe audio check: {'found' if has else 'not found'}")
            return has
        except Exception as e:
            logger.warning(f"ffprobe check failed: {e} — assuming audio may exist")

    # No ffprobe: assume audio exists and let the extractor decide
    logger.info("No ffprobe available — assuming audio stream may exist, attempting extraction")
    return True


def extract_audio_from_video(video_path: str) -> Optional[bytes]:
    """
    Extract audio track from video file.

    Tries in order:
      1. ffmpeg subprocess  (if ffmpeg is found on PATH or common install dirs)
      2. moviepy            (if installed — uses its own ffmpeg binary)

    Args:
        video_path: Path to the video file

    Returns:
        Audio bytes in WAV format (16 kHz, mono, 16-bit PCM),
        or None if no audio track found or all methods fail.
    """
    # ── Step 1: quick audio-stream presence check ──────────────────────────
    if not _video_has_audio_stream(video_path):
        logger.info("No audio stream detected in video — skipping audio analysis")
        return None

    # ── Step 2: try ffmpeg via subprocess ─────────────────────────────────
    ffmpeg_bin = _find_ffmpeg()
    if ffmpeg_bin:
        logger.info(f"Using ffmpeg at: {ffmpeg_bin}")
        audio_bytes = _extract_audio_via_ffmpeg(video_path, ffmpeg_bin)
        if audio_bytes and len(audio_bytes) > 44:   # 44 = WAV header only = empty
            return audio_bytes
        logger.warning("ffmpeg extraction returned empty/invalid audio — trying moviepy")
    else:
        logger.warning("ffmpeg not found on PATH or common locations — trying moviepy fallback")

    # ── Step 3: moviepy fallback ───────────────────────────────────────────
    audio_bytes = _extract_audio_via_moviepy(video_path)
    if audio_bytes and len(audio_bytes) > 44:
        return audio_bytes

    logger.error(
        "All audio extraction methods failed. "
        "Install ffmpeg (https://ffmpeg.org/download.html) and add it to your PATH, "
        "or run: pip install moviepy"
    )
    return None


# ============== AUDIO PREDICTION ==============
def predict_audio_from_bytes(audio_bytes: bytes, filename: str = "extracted_audio.wav") -> Dict:
    """
    Run deepfake detection on raw audio bytes.
    Reuses audio_model preprocessing and prediction logic exactly.

    Args:
        audio_bytes: Raw WAV audio bytes
        filename: Label for logging/result metadata

    Returns:
        Dictionary with audio prediction results
    """
    try:
        if audio_module.audio_model is None:
            return {
                'success': False,
                'error': 'Audio model not available',
                'skipped': True
            }

        # Preprocess using the exact same pipeline as audio_model
        processed_audio = audio_module.preprocess_audio(audio_bytes)

        # Predict
        prediction = audio_module.audio_model.predict(processed_audio, verbose=0)[0][0]

        # Interpret results (mirrors audio_model.predict_audio logic)
        is_real = prediction >= 0.5
        confidence = prediction if is_real else (1 - prediction)
        predicted_class = "Real" if is_real else "Fake"

        if confidence >= 0.95:
            confidence_level = "Very High"
        elif confidence >= 0.85:
            confidence_level = "High"
        elif confidence >= 0.70:
            confidence_level = "Medium"
        elif confidence >= 0.55:
            confidence_level = "Low"
        else:
            confidence_level = "Very Low (Uncertain)"

        if 0.45 <= prediction <= 0.55:
            interpretation = "Uncertain - Score too close to threshold"
        elif prediction >= 0.85:
            interpretation = "Strong indicators of REAL audio"
        elif prediction <= 0.15:
            interpretation = "Strong indicators of FAKE audio"
        elif is_real:
            interpretation = "Likely real, but with moderate confidence"
        else:
            interpretation = "Likely fake, but with moderate confidence"

        return {
            'success': True,
            'skipped': False,
            'file_type': 'audio',
            'filename': filename,
            'prediction': predicted_class,
            'confidence': round(float(confidence) * 100, 2),
            'confidence_level': confidence_level,
            'is_fake': not is_real,
            'raw_score': round(float(prediction), 6),
            'interpretation': interpretation,
            'probabilities': {
                'Real': round(float(prediction) * 100, 2),
                'Fake': round((1 - float(prediction)) * 100, 2)
            }
        }

    except Exception as e:
        logger.error(f"Audio prediction error: {e}")
        return {
            'success': False,
            'skipped': False,
            'error': str(e)
        }


# ============== FRAME EXTRACTION ==============
def extract_frames_from_video(video_path: str, num_frames: int = NUM_FRAMES_TO_EXTRACT) -> List[np.ndarray]:
    """
    Extract evenly spaced frames from video.

    Args:
        video_path: Path to video file
        num_frames: Number of frames to extract

    Returns:
        List of frames as numpy arrays (RGB format)
    """
    cap = cv2.VideoCapture(video_path)
    frames = []

    if not cap.isOpened():
        logger.error(f"Failed to open video: {video_path}")
        return frames

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps if fps > 0 else 0

    logger.info(f"Video: {total_frames} frames @ {fps:.2f} fps ({duration:.1f}s)")

    if total_frames == 0:
        cap.release()
        return frames

    if SKIP_EDGE_FRAMES and total_frames > num_frames * 2:
        start_frame = int(total_frames * 0.1)
        end_frame = int(total_frames * 0.9)
    else:
        start_frame = 0
        end_frame = total_frames - 1

    if end_frame - start_frame < num_frames:
        indices = list(range(start_frame, end_frame + 1))
    else:
        indices = np.linspace(start_frame, end_frame, num_frames, dtype=int)

    logger.info(f"Extracting {len(indices)} frames from range [{start_frame}, {end_frame}]")

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()

        if ret and frame is not None:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame_rgb)

    cap.release()
    logger.info(f"Successfully extracted {len(frames)} frames")

    return frames


# ============== FRAME PROCESSING ==============
def process_frame_for_prediction(frame: np.ndarray) -> Tuple[np.ndarray, np.ndarray, bool, bool]:
    """
    Process a single frame using the SAME preprocessing as image model.

    Args:
        frame: RGB frame as numpy array

    Returns:
        Tuple of (processed_face_batch, face_uint8, is_valid, face_detected)
    """
    try:
        if image_model.face_cascade is None:
            logger.warning("Face cascade not loaded")
            return None, None, False, False

        pil_image = Image.fromarray(frame.astype(np.uint8))
        face_batch, face_uint8, face_detected = image_model.preprocess_image(pil_image)

        return face_batch, face_uint8, True, face_detected

    except Exception as e:
        logger.error(f"Frame processing error: {e}")
        return None, None, False, False


# ============== VIDEO FRAME PREDICTION ==============
def predict_video_frames(frames: List[np.ndarray]) -> Dict:
    """
    Predict deepfake for each frame and aggregate results.

    Args:
        frames: List of RGB frames

    Returns:
        Dictionary with aggregated predictions and details
    """
    if image_model.image_model is None:
        raise HTTPException(status_code=503, detail="Image model not available")

    if len(frames) == 0:
        return {
            'error': 'No frames extracted',
            'valid_frames': 0,
            'total_frames': 0
        }

    frame_predictions = []
    frame_details = []
    valid_faces = []
    frames_with_faces = 0

    logger.info(f"Processing {len(frames)} frames...")

    for frame_idx, frame in enumerate(frames):
        face_batch, face_uint8, is_valid, face_detected = process_frame_for_prediction(frame)

        if not is_valid or face_batch is None:
            logger.info(f"  Frame {frame_idx:2d}: ❌ Failed to extract face")
            frame_details.append({
                'frame_idx': frame_idx,
                'status': 'Failed',
                'prediction': None,
                'class': None
            })
            continue
        
        # Check if face was actually detected in this frame
        if not face_detected:
            logger.info(f"  Frame {frame_idx:2d}: ⚠️  No face detected in frame")
            frame_details.append({
                'frame_idx': frame_idx,
                'status': 'No Face',
                'prediction': None,
                'class': None
            })
            continue
        
        frames_with_faces += 1

        try:
            predictions = image_model.image_model.predict(face_batch, verbose=0)[0]
            class_idx = np.argmax(predictions)
            confidence = float(predictions[class_idx]) * 100
            predicted_class = image_model.IMAGE_CLASS_NAMES[class_idx]

            frame_predictions.append({
                'class_idx': class_idx,
                'class_name': predicted_class,
                'confidence': confidence,
                'is_fake': predicted_class.lower() != 'real',
                'probabilities': predictions
            })

            valid_faces.append(face_uint8)

            logger.info(f"  Frame {frame_idx:2d}: ✓ {predicted_class} ({confidence:.2f}%)")

            frame_details.append({
                'frame_idx': frame_idx,
                'status': 'Success',
                'prediction': predicted_class,
                'confidence': round(confidence, 2),
                'is_fake': predicted_class.lower() != 'real'
            })

        except Exception as e:
            logger.error(f"Prediction error on frame {frame_idx}: {e}")
            frame_details.append({
                'frame_idx': frame_idx,
                'status': 'Error',
                'prediction': None,
                'error': str(e)
            })

    if frames_with_faces == 0:
        return {
            'success': True,
            'analyzed': False,
            'message': 'This video is not analyzed because it doesn\'t contain any face. DeepGuard only detects and analyzes faces.',
            'valid_frames': 0,
            'total_frames': len(frames),
            'frames_with_faces': 0,
            'frame_details': frame_details
        }
    
    if len(frame_predictions) < MIN_VALID_FRAMES:
        return {
            'success': True,
            'analyzed': False,
            'message': f'This video is not fully analyzed. Only {len(frame_predictions)} frames with detected faces found (minimum {MIN_VALID_FRAMES} required). DeepGuard only detects and analyzes frames containing faces.',
            'valid_frames': len(frame_predictions),
            'total_frames': len(frames),
            'frames_with_faces': frames_with_faces,
            'frame_details': frame_details
        }

    aggregated_result = aggregate_predictions(frame_predictions)
    aggregated_result['success'] = True
    aggregated_result['analyzed'] = True
    aggregated_result['valid_frames'] = len(frame_predictions)
    aggregated_result['total_frames'] = len(frames)
    aggregated_result['frames_with_faces'] = frames_with_faces
    aggregated_result['frame_details'] = frame_details
    aggregated_result['sample_faces'] = get_sample_faces(valid_faces, num_samples=4)

    return aggregated_result


# ============== AGGREGATION METHODS ==============
def aggregate_predictions(frame_predictions: List[Dict]) -> Dict:
    """
    Aggregate frame-level predictions into video-level prediction.

    Args:
        frame_predictions: List of prediction dictionaries for each frame

    Returns:
        Aggregated prediction dictionary
    """
    if len(frame_predictions) == 0:
        return {'error': 'No valid predictions'}

    class_names = [pred['class_name'] for pred in frame_predictions]
    confidences = [pred['confidence'] for pred in frame_predictions]
    is_fake_list = [pred['is_fake'] for pred in frame_predictions]
    all_probabilities = np.array([pred['probabilities'] for pred in frame_predictions])

    # Method 1: Majority Voting
    class_counter = Counter(class_names)
    most_common_class, vote_count = class_counter.most_common(1)[0]
    voting_confidence = (vote_count / len(class_names)) * 100

    # Method 2: Average Probabilities
    avg_probabilities = np.mean(all_probabilities, axis=0)
    avg_class_idx = np.argmax(avg_probabilities)
    avg_predicted_class = image_model.IMAGE_CLASS_NAMES[avg_class_idx]
    avg_confidence = float(avg_probabilities[avg_class_idx]) * 100

    # Method 3: Weighted Average (by confidence)
    weighted_probs = np.average(all_probabilities, axis=0, weights=confidences)
    weighted_class_idx = np.argmax(weighted_probs)
    weighted_predicted_class = image_model.IMAGE_CLASS_NAMES[weighted_class_idx]
    weighted_confidence = float(weighted_probs[weighted_class_idx]) * 100

    # Method 4: Binary stats
    fake_count = sum(is_fake_list)
    real_count = len(is_fake_list) - fake_count
    fake_ratio = fake_count / len(is_fake_list)

    if AGGREGATION_METHOD == 'voting':
        final_class = most_common_class
        final_confidence = voting_confidence
    elif AGGREGATION_METHOD == 'mean':
        final_class = avg_predicted_class
        final_confidence = avg_confidence
    elif AGGREGATION_METHOD == 'weighted':
        final_class = weighted_predicted_class
        final_confidence = weighted_confidence
    else:
        final_class = avg_predicted_class
        final_confidence = avg_confidence

    is_fake = final_class.lower() != 'real'

    all_probs = {
        image_model.IMAGE_CLASS_NAMES[i]: round(float(avg_probabilities[i]) * 100, 2)
        for i in range(len(image_model.IMAGE_CLASS_NAMES))
    }

    confidence_score = abs(fake_ratio - 0.5) * 2

    logger.info(f"Aggregated Result: {final_class} ({final_confidence:.2f}%)")
    logger.info(f"Fake frames: {fake_count}/{len(is_fake_list)} ({fake_ratio*100:.1f}%)")

    return {
        'prediction': final_class,
        'confidence': round(final_confidence, 2),
        'is_fake': is_fake,
        'all_probabilities': all_probs,

        'statistics': {
            'fake_frame_count': fake_count,
            'real_frame_count': real_count,
            'fake_ratio': round(fake_ratio * 100, 2),
            'confidence_score': round(confidence_score * 100, 2),
            'avg_frame_confidence': round(np.mean(confidences), 2),
            'min_frame_confidence': round(np.min(confidences), 2),
            'max_frame_confidence': round(np.max(confidences), 2)
        },

        'voting_results': {
            'most_common_class': most_common_class,
            'vote_count': vote_count,
            'voting_confidence': round(voting_confidence, 2),
            'class_distribution': dict(class_counter)
        },

        'method_comparison': {
            'voting': {'class': most_common_class, 'confidence': round(voting_confidence, 2)},
            'average': {'class': avg_predicted_class, 'confidence': round(avg_confidence, 2)},
            'weighted': {'class': weighted_predicted_class, 'confidence': round(weighted_confidence, 2)}
        }
    }


# ============== HELPER FUNCTIONS ==============
def get_sample_faces(faces: List[np.ndarray], num_samples: int = 4) -> List[str]:
    """
    Convert sample faces to base64 for frontend display.

    Args:
        faces: List of face images
        num_samples: Number of samples to return

    Returns:
        List of base64-encoded images
    """
    if len(faces) == 0:
        return []

    if len(faces) <= num_samples:
        sample_indices = list(range(len(faces)))
    else:
        sample_indices = np.linspace(0, len(faces) - 1, num_samples, dtype=int)

    sample_faces_base64 = []
    for idx in sample_indices:
        base64_img = image_model.numpy_to_base64(faces[idx])
        if base64_img:
            sample_faces_base64.append(base64_img)

    return sample_faces_base64


# ============== MAIN PREDICTION FUNCTION ==============
async def predict_video(file: UploadFile) -> Dict:
    """
    Main function to predict if video is deepfake.
    Runs both visual (frame-level) and audio analysis in parallel.

    Args:
        file: Uploaded video file

    Returns:
        Dictionary with:
          - video_analysis: frame-level deepfake results
          - audio_analysis: audio deepfake results (or skipped notice)
          - overall_summary: combined verdict
    """
    temp_video_path = None

    try:
        if image_model.image_model is None:
            raise HTTPException(status_code=503, detail="Image model not available")

        if image_model.face_cascade is None:
            raise HTTPException(status_code=503, detail="Face detector not available")

        logger.info(f"Processing video: {file.filename}")

        # Save uploaded video to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            contents = await file.read()
            temp_file.write(contents)
            temp_video_path = temp_file.name

        logger.info(f"Video saved to: {temp_video_path}")

        # ── 1. VIDEO (visual) analysis ─────────────────────────────────────
        logger.info("=== Starting Visual Analysis ===")
        frames = extract_frames_from_video(temp_video_path, NUM_FRAMES_TO_EXTRACT)

        if len(frames) == 0:
            raise HTTPException(status_code=400, detail="Failed to extract frames from video")

        video_result = predict_video_frames(frames)

        if 'analyzed' in video_result and not video_result['analyzed']:
            # Video not analyzed (no faces detected) - return informational response
            return {
                'success': True,
                'file_type': 'video',
                'filename': file.filename,
                'analyzed': False,
                'message': video_result['message'],
                'video_analysis': video_result,
                'audio_analysis': None,
                'overall_summary': None
            }

        # ── 2. AUDIO analysis ──────────────────────────────────────────────
        logger.info("=== Starting Audio Analysis ===")
        audio_bytes = extract_audio_from_video(temp_video_path)

        if audio_bytes is not None:
            audio_result = predict_audio_from_bytes(
                audio_bytes,
                filename=f"{file.filename}_extracted_audio.wav"
            )
        else:
            # Check if the video likely had audio that we couldn't extract
            ffmpeg_available = _find_ffmpeg() is not None
            try:
                import moviepy  # noqa  -- works for both 1.x and 2.x
                moviepy_available = True
            except ImportError:
                moviepy_available = False

            if not ffmpeg_available and not moviepy_available:
                reason = (
                    "Audio extraction requires ffmpeg or moviepy. "
                    "Fix: add ffmpeg to PATH (https://ffmpeg.org/download.html) "
                    "or run: pip install moviepy"
                )
            else:
                reason = "No audio track found in video or audio extraction failed"

            audio_result = {
                'success': False,
                'skipped': True,
                'reason': reason
            }

        # ── 3. Overall summary ─────────────────────────────────────────────
        overall_summary = build_overall_summary(video_result, audio_result)

        # ── 4. Compose final response ──────────────────────────────────────
        result = {
            'success': True,
            'file_type': 'video',
            'filename': file.filename,

            # Top-level overall verdict
            'overall_summary': overall_summary,

            # Detailed visual analysis
            'video_analysis': {
                'prediction': video_result['prediction'],
                'confidence': video_result['confidence'],
                'is_fake': video_result['is_fake'],
                'all_probabilities': video_result.get('all_probabilities', {}),
                'valid_frames': video_result['valid_frames'],
                'total_frames': video_result['total_frames'],
                'statistics': video_result.get('statistics', {}),
                'voting_results': video_result.get('voting_results', {}),
                'method_comparison': video_result.get('method_comparison', {}),
                'frame_details': video_result.get('frame_details', []),
                'sample_faces': video_result.get('sample_faces', [])
            },

            # Detailed audio analysis
            'audio_analysis': audio_result
        }

        # Low-confidence warning for visual analysis
        if video_result.get('statistics', {}).get('confidence_score', 100) < 30:
            result['warning'] = 'Low visual confidence — manual review recommended'

        logger.info(f"Video processing complete: {file.filename}")
        logger.info(f"Visual: {video_result['prediction']} ({video_result['confidence']:.2f}%)")
        if audio_result.get('success'):
            logger.info(f"Audio:  {audio_result['prediction']} ({audio_result['confidence']:.2f}%)")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Video processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Video processing error: {str(e)}")

    finally:
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.unlink(temp_video_path)
                logger.info(f"Cleaned up temporary file: {temp_video_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file: {e}")


# ============== OVERALL SUMMARY BUILDER ==============
def build_overall_summary(video_result: Dict, audio_result: Dict) -> Dict:
    """
    Combine visual and audio predictions into a single overall verdict.

    Strategy:
      - If only one modality is available, use it exclusively.
      - If both are available, flag as FAKE if either is fake (conservative approach),
        and report weighted confidence (video 60% / audio 40%).

    Args:
        video_result: Output of predict_video_frames / aggregate_predictions
        audio_result: Output of predict_audio_from_bytes

    Returns:
        Dictionary with combined verdict
    """
    video_is_fake = video_result.get('is_fake', False)
    video_confidence = video_result.get('confidence', 0.0)

    audio_available = audio_result.get('success', False) and not audio_result.get('skipped', False)
    audio_is_fake = audio_result.get('is_fake', False) if audio_available else None
    audio_confidence = audio_result.get('confidence', 0.0) if audio_available else None

    if audio_available:
        # Conservative: fake if either modality says fake
        overall_is_fake = video_is_fake or audio_is_fake

        # Weighted confidence: 60% video, 40% audio
        overall_confidence = round(video_confidence * 0.6 + audio_confidence * 0.4, 2)

        # Determine agreement
        if video_is_fake == audio_is_fake:
            agreement = 'Both modalities agree'
            reliability = 'High'
        else:
            agreement = 'Modalities disagree — review recommended'
            reliability = 'Low'

        modalities_used = ['video', 'audio']
    else:
        overall_is_fake = video_is_fake
        overall_confidence = round(video_confidence, 2)
        agreement = 'Audio not available — visual only'
        reliability = 'Medium'
        modalities_used = ['video']

    overall_prediction = 'Fake' if overall_is_fake else 'Real'

    return {
        'prediction': overall_prediction,
        'is_fake': overall_is_fake,
        'confidence': overall_confidence,
        'modalities_used': modalities_used,
        'agreement': agreement,
        'reliability': reliability,
        'details': {
            'video_verdict': 'Fake' if video_is_fake else 'Real',
            'video_confidence': round(video_confidence, 2),
            'audio_verdict': ('Fake' if audio_is_fake else 'Real') if audio_available else 'N/A',
            'audio_confidence': round(audio_confidence, 2) if audio_available else 'N/A'
        }
    }


# ============== FEATURE ANALYSIS FOR VIDEO ==============
def analyze_video_features(frames: List[np.ndarray]) -> Dict:
    """
    Analyze video-specific features (temporal consistency, etc.)

    Args:
        frames: List of RGB frames

    Returns:
        Dictionary of video feature scores
    """
    try:
        if len(frames) < 2:
            return {}

        frame_diffs = []
        for i in range(len(frames) - 1):
            diff = np.mean(np.abs(frames[i].astype(float) - frames[i+1].astype(float)))
            frame_diffs.append(diff)

        temporal_consistency = 100 - min(100, np.mean(frame_diffs) / 2.55)
        motion_smoothness = 100 - min(100, np.std(frame_diffs) * 5)

        color_means = [np.mean(frame) for frame in frames]
        color_consistency = 100 - min(100, np.std(color_means) * 2)

        return {
            'Temporal Consistency': round(float(temporal_consistency), 2),
            'Motion Smoothness': round(float(motion_smoothness), 2),
            'Color Consistency': round(float(color_consistency), 2)
        }
    except Exception as e:
        logger.error(f"Video feature analysis error: {e}")
        return {}


# ============== BATCH VIDEO PROCESSING ==============
async def predict_video_batch(files: List[UploadFile]) -> List[Dict]:
    """
    Process multiple videos in batch.

    Args:
        files: List of uploaded video files

    Returns:
        List of prediction results
    """
    results = []

    for idx, file in enumerate(files, 1):
        logger.info(f"Processing video {idx}/{len(files)}: {file.filename}")

        try:
            result = await predict_video(file)
            results.append(result)
        except Exception as e:
            logger.error(f"Error processing {file.filename}: {e}")
            results.append({
                'success': False,
                'filename': file.filename,
                'error': str(e)
            })

    return results


# ============== CONFIGURATION ENDPOINTS ==============
def get_video_config() -> Dict:
    """Get current video detection configuration"""
    return {
        'num_frames': NUM_FRAMES_TO_EXTRACT,
        'min_valid_frames': MIN_VALID_FRAMES,
        'aggregation_method': AGGREGATION_METHOD,
        'skip_edge_frames': SKIP_EDGE_FRAMES,
        'audio_extraction_format': AUDIO_EXTRACTION_FORMAT,
        'supported_formats': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    }


def set_video_config(config: Dict):
    """Update video detection configuration"""
    global NUM_FRAMES_TO_EXTRACT, MIN_VALID_FRAMES, AGGREGATION_METHOD, SKIP_EDGE_FRAMES, AUDIO_EXTRACTION_FORMAT

    if 'num_frames' in config:
        NUM_FRAMES_TO_EXTRACT = config['num_frames']
    if 'min_valid_frames' in config:
        MIN_VALID_FRAMES = config['min_valid_frames']
    if 'aggregation_method' in config:
        AGGREGATION_METHOD = config['aggregation_method']
    if 'skip_edge_frames' in config:
        SKIP_EDGE_FRAMES = config['skip_edge_frames']
    if 'audio_extraction_format' in config:
        AUDIO_EXTRACTION_FORMAT = config['audio_extraction_format']

    logger.info(f"Video config updated: {config}")