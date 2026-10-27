# Model files

Trained weights are not stored in this repository (GitHub's 100 MB file limit).

| File | Used by | Purpose |
|---|---|---|
| `deepfake_model.h5` | `backend/image_model.py` | EfficientNet-B0 image classifier (6 classes) |
| `SpecRNet_model.h5` | `backend/audio_model.py` | Audio deepfake classifier (mel-spectrogram input) |

Download both files from: **[add your Google Drive / Hugging Face link here]**
and place them inside the `backend/` folder (next to `main.py`).
