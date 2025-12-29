<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1xbQTfFLX1fMGrqcNRk39-c3wFDx0Cml4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

**Running on NVIDIA Orin with local models?** See `ORIN_SETUP.md` for wiring Mistral/Whisper endpoints and bridging an Arduino photo frame without cloud calls.

## Audio / speaker detection
The built-in transcription flow does **not** do speaker diarization or automatic speaker labeling. To identify who is speaking, run transcription through a backend that supports diarization (e.g., pyannote, NVIDIA Riva, or a Whisper pipeline that emits speaker tags) and return speaker-tagged text to the client.
