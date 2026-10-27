"""
Audio Detection Module - Energy-Based Speech Detection (Aggressive Ringtone Rejection)
"""
import numpy as np
import librosa
import io
import tensorflow as tf
from fastapi import UploadFile, HTTPException


# ============== CONFIGURATION ==============
AUDIO_MODEL_PATH = "SpecRNet_model.h5"
SAMPLE_RATE = 16000
MAX_SECONDS = 4.0
MAX_LEN = int(SAMPLE_RATE * MAX_SECONDS)
N_MELS = 128
HOP_LENGTH = 512
N_FFT = 2048
FMIN = 0
FMAX = 8000


# ============== LOAD MODEL ==============
audio_model = None


def load_audio_model():
    """Load audio detection model"""
    global audio_model

    try:
        audio_model = tf.keras.models.load_model(AUDIO_MODEL_PATH, compile=False)
        print("Audio model loaded from: " + AUDIO_MODEL_PATH)
    except Exception as e:
        print("Audio model not found: " + str(e))


# ============== PREPROCESSING ==============
def extract_mel_spectrogram(audio_data: bytes):
    """Extract mel spectrogram from audio bytes"""
    try:
        audio, sr = librosa.load(io.BytesIO(audio_data), sr=SAMPLE_RATE, mono=True)

        if len(audio) > MAX_LEN:
            audio = audio[:MAX_LEN]
        else:
            audio = np.pad(audio, (0, MAX_LEN - len(audio)), mode='constant')

        mel_spec = librosa.feature.melspectrogram(
            y=audio,
            sr=SAMPLE_RATE,
            n_mels=N_MELS,
            n_fft=N_FFT,
            hop_length=HOP_LENGTH,
            fmin=FMIN,
            fmax=FMAX,
            power=2.0
        )

        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

        spec_min = mel_spec_db.min()
        spec_max = mel_spec_db.max()

        if spec_max > spec_min:
            mel_normalized = (mel_spec_db - spec_min) / (spec_max - spec_min)
        else:
            mel_normalized = np.zeros_like(mel_spec_db)

        mel_normalized = np.clip(mel_normalized, 0.0, 1.0)

        return mel_normalized.astype(np.float32)

    except Exception as e:
        raise ValueError("Error processing audio: " + str(e))


def preprocess_audio(audio_bytes: bytes):
    """Preprocess audio for model prediction"""
    mel_spec = extract_mel_spectrogram(audio_bytes)
    mel_spec = np.expand_dims(mel_spec, axis=-1)
    mel_spec = np.expand_dims(mel_spec, axis=0)
    return mel_spec


# ============== AUDIO ACTIVITY DETECTION ==============
def has_audio_activity(audio_data: bytes):
    """Check if audio has meaningful activity"""
    try:
        audio, sr = librosa.load(io.BytesIO(audio_data), sr=SAMPLE_RATE, mono=True)

        rms = np.sqrt(np.mean(audio ** 2))
        has_activity = rms > 0.001

        return has_activity, float(rms)

    except Exception as e:
        print("Audio activity detection error: " + str(e))
        return True, 0.5


# ============== AGGRESSIVE SPEECH DETECTION ==============
def contains_speech(audio_data: bytes):
    """
    Aggressive speech detection: Reject ringtones, tones, and music.
    Works by analyzing energy distribution and MFCC stability.
    """
    try:
        audio, sr = librosa.load(io.BytesIO(audio_data), sr=SAMPLE_RATE, mono=True)

        # --- ENERGY DISTRIBUTION ANALYSIS ---
        # Speech has peaks and valleys (words, pauses)
        # Ringtones/tones are flat or smooth
        
        # Get frame energy using short-time window
        frame_length = 2048
        hop_length = 512
        frames = librosa.util.frame(audio, frame_length=frame_length, hop_length=hop_length)
        frame_energy = np.sqrt(np.mean(frames ** 2, axis=0))
        
        # Normalize
        if np.max(frame_energy) > 0:
            frame_energy = frame_energy / np.max(frame_energy)
        
        # Calculate energy statistics
        energy_variance = float(np.var(frame_energy))
        energy_mean = float(np.mean(frame_energy))
        energy_std = float(np.std(frame_energy))
        
        # Count energy peaks and valleys (natural speech characteristic)
        energy_diff = np.abs(np.diff(frame_energy))
        num_transitions = np.sum(energy_diff > 0.05)
        
        # REJECTION CRITERIA: Ringtones have extremely flat or smooth energy
        if energy_variance < 0.01:
            return False, "Extremely flat energy profile - likely ringtone or tone"
        
        if energy_std < 0.05:
            return False, "No energy variation - pure tone detected"
        
        if num_transitions < 5:
            return False, "Almost no energy transitions - non-speech signal"
        
        
        # --- MFCC STABILITY ANALYSIS ---
        # Speech MFCCs change constantly
        # Ringtones/tones have stable MFCC
        
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
        
        # MFCC variance across time (should be high for speech)
        mfcc_time_variance = float(np.mean(np.var(mfcc, axis=1)))
        
        # MFCC stability (how much MFCC changes frame-to-frame)
        mfcc_consecutive_diff = np.abs(np.diff(mfcc, axis=1))
        mfcc_instability = float(np.mean(mfcc_consecutive_diff))
        
        # REJECTION: MFCC is too stable (ringtone hallmark)
        if mfcc_time_variance < 2:
            return False, "MFCC is extremely stable - pure tone or ringtone"
        
        if mfcc_instability < 0.3:
            return False, "MFCC does not change - non-speech audio"
        
        
        # --- SPECTRAL ENTROPY ---
        # Speech has moderate entropy
        # Pure tones have very low entropy
        
        spec = np.abs(librosa.stft(audio))
        spec_norm = spec / (np.sum(spec, axis=0, keepdims=True) + 1e-10)
        
        # Shannon entropy per frame
        entropy = -np.sum(spec_norm * np.log(spec_norm + 1e-10), axis=0)
        mean_entropy = float(np.mean(entropy))
        
        # REJECTION: Spectral entropy too low = pure tone
        if mean_entropy < 2.0:
            return False, "Very low spectral entropy - pure tone detected"
        
        
        # --- ACCEPTANCE CRITERIA ---
        speech_score = 0
        
        # High energy variance = speech
        if energy_variance > 0.02:
            speech_score += 2
        
        # Multiple energy transitions = speech
        if num_transitions > 10:
            speech_score += 2
        
        # MFCC varies over time = speech
        if mfcc_time_variance > 3:
            speech_score += 2
        
        # MFCC is unstable = speech
        if mfcc_instability > 0.5:
            speech_score += 1
        
        # Moderate spectral entropy = speech
        if mean_entropy > 3.0:
            speech_score += 1
        
        # Need at least 5 points
        has_speech = speech_score >= 5
        
        if has_speech:
            return True, "Speech detected (confidence: " + str(speech_score) + "/7)"
        else:
            return False, "Insufficient speech characteristics (score: " + str(speech_score) + "/7)"

    except Exception as e:
        print("Speech detection error: " + str(e))
        return True, "Detection error, proceeding"


# ============== PREDICTION ==============
async def predict_audio(file: UploadFile):
    """Predict if an audio file is a deepfake"""
    try:
        if audio_model is None:
            raise HTTPException(status_code=503, detail="Audio model not available")

        contents = await file.read()

        # Step 1: Check if audio has activity
        has_activity, energy_level = has_audio_activity(contents)

        if not has_activity:
            return {
                "success": True,
                "file_type": "audio",
                "filename": file.filename,
                "analyzed": False,
                "message": "This audio is not analyzed because it appears to be silent or has no meaningful audio content.",
                "prediction": None,
                "confidence": None,
                "is_fake": None
            }

        # Step 2: Check if audio contains speech
        has_speech, speech_reason = contains_speech(contents)

        if not has_speech:
            return {
                "success": True,
                "file_type": "audio",
                "filename": file.filename,
                "analyzed": False,
                "message": "This audio does not contain human speech (" + speech_reason + "). DeepGuard only analyzes speech audio.",
                "prediction": None,
                "confidence": None,
                "is_fake": None
            }

        # Step 3: Run deepfake detection model
        processed_audio = preprocess_audio(contents)
        prediction = audio_model.predict(processed_audio, verbose=0)[0][0]

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
            "success": True,
            "file_type": "audio",
            "filename": file.filename,
            "analyzed": True,
            "prediction": predicted_class,
            "confidence": round(float(confidence) * 100, 2),
            "confidence_level": confidence_level,
            "is_fake": not is_real,
            "raw_score": round(float(prediction), 6),
            "interpretation": interpretation,
            "probabilities": {
                "Real": round(float(prediction) * 100, 2),
                "Fake": round((1 - float(prediction)) * 100, 2)
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="Audio processing error: " + str(e))