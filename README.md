# DeepGuard: Multi-Modal Deepfake Detection

DeepGuard detects manipulated **images, audio and video** and explains each verdict in a web interface. It was built as a Final Year Project (BS Software Engineering, COMSATS University Islamabad, Lahore, 2026) by a team of three.

## Results

| Component | Model | Result |
|---|---|---|
| Image | EfficientNet-B0, fine-tuned on FaceForensics++ (6 classes) | **92.27% test accuracy, 0.923 macro F1** |
| Audio | SpecRNet-style classifier on mel spectrograms | AUC 0.9752 |
| Video | 16 sampled frames through the image model, plus the audio track through the audio model | Combined verdict (see below) |

**Image classes:** Real, Deepfakes, Face2Face, FaceSwap, FaceShifter, NeuralTextures.

**Model comparison (image task):** VGG16 overfit; XceptionNet reached 72.76%; DenseNet121 reached 87.33%; EfficientNet-B0 was selected at 92.27%.

**Training setup (image model):** Adam, learning rate 0.001, 20 epochs, batch size 32, dropout 0.6, ReduceLROnPlateau, class weighting, 64/16/20 train/validation/test split.

## How it works

```
React + Tailwind frontend  --upload-->  FastAPI backend
                                          |-- image:  Haar-cascade face crop -> EfficientNet-B0 -> class + probabilities
                                          |-- audio:  mel spectrogram -> audio model -> real/fake
                                          |-- video:  16 frames -> image model (aggregated) + extracted audio -> audio model
                                          |-- chatbot: Groq-hosted LLM for deepfake-awareness Q&A
```

- Faces are detected with OpenCV's Haar cascade; images without a detectable face are not analysed.
- Video verdict: frame predictions are averaged. If audio is present, the overall verdict is Fake when **either** modality says Fake, and the reported confidence is weighted 60% video / 40% audio.
- Each image result includes simple feature-quality indicators (symmetry, texture, edge, colour, frequency patterns) alongside the model output.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/predict` | Auto-detects file type and routes it |
| POST | `/predict/image`, `/predict/audio`, `/predict/video` | Modality-specific prediction |
| POST | `/predict/video/batch` | Several videos at once |
| GET/POST | `/config/video` | Read or update frame sampling and aggregation settings |
| POST | `/chatbot` | Deepfake-awareness assistant |
| GET | `/health` | Model status |

Interactive docs are available at `http://localhost:8000/docs` once the backend is running.

## Run it locally

**Backend** (Python 3.13 was used; TensorFlow/Keras required)

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env             # then add your GROQ_API_KEY
# place deepfake_model.h5 and SpecRNet_model.h5 in this folder (see models/README.md)
python main.py                   # http://localhost:8000
```

For video audio extraction, install **ffmpeg** and make sure it is on your PATH.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

## Tech stack

Python, TensorFlow/Keras, OpenCV, librosa, FastAPI, React, Tailwind CSS, Vite, Groq API.

## Project structure

```
backend/    FastAPI service and the image, audio and video modules
frontend/   React interface (upload pages, results, chatbot)
models/     Where to get the trained weights
```

## Limitations

- Trained on FaceForensics++ manipulation types; accuracy on other deepfake generators is untested.
- Detection is face-based and relies on a Haar cascade, which can miss faces at extreme angles or low resolution.
- The audio model analyses the first 4 seconds of speech.
- The API currently allows all CORS origins and has no authentication, so it is intended for local demonstration, not public deployment.

## Team

Final Year Project team of three, COMSATS University Islamabad, Lahore Campus.
- Aniya Amjad: [describe your part here]
- [Teammate name]: [their part]
- [Teammate name]: [their part]
