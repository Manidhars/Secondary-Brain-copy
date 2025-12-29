# Local NVIDIA Orin + Arduino photo frame

Run the dashboard fully on an 8GB Orin using local Whisper and Mistral endpoints, and optionally drive an Arduino-powered photo frame.

## Runtime targets
- **Local LLM**: expose a POST `/generate` endpoint on the Orin (TensorRT-LLM, vLLM, or Triton). Expected JSON body: `{ prompt, history, context, model, mode }` returning `{ reply, explanation?, citations?, assumptions? }`.
- **Local transcription**: expose a POST `/transcribe` endpoint that accepts `file` form-data and responds with `{ text }`. Useful if you already run a GPU Whisper container.

## Dashboard settings
1. Open **Settings → NVIDIA Orin / Local Models**.
2. Choose **Local Only** to disable Gemini.
3. Fill in:
   - **Local LLM Endpoint**: e.g., `http://orin:8000/generate`
   - **Local Model Name**: e.g., `mistral-3b-instruct`
   - **Local Whisper Endpoint**: e.g., `http://orin:8000/transcribe`
   - Optional bearer **Local API Key** if your gateway enforces auth.
4. Save; chats and transcription now call the Orin endpoints first.

## Suggested Orin stack
- Flash JetPack, enable CUDA, and install TensorRT + cuDNN.
- Run Mistral 3B via **TensorRT-LLM** or **vLLM**; pin the context length to avoid OOM on 8GB.
- Run Whisper (medium or small) via **NVIDIA Triton** or **faster-whisper** with GPU backend.
- Provide lightweight health endpoints (e.g., `/healthz`) and wire them into a process manager like `systemd` so the dashboard can reconnect after restarts.

### Speaker attribution
- The default dashboard UI does **not** diarize speakers. If you need who-spoke-when, configure your `/transcribe` endpoint to run diarization (e.g., pyannote or Riva) and return speaker labels alongside text so the client can render them.

## Arduino photo-frame bridge
- Flash the Arduino with a simple sketch that listens for serial commands like `SET_IMAGE <base64>` or `NEXT`.
- On the Orin, expose a small HTTP service that translates `/frame/next` and `/frame/show` calls to the serial port.
- Point the dashboard or automations at that HTTP bridge so photo changes stay local without exposing the Arduino to the network.

## Troubleshooting
- If the UI shows "Local LLM unreachable", check the Orin service logs and ensure the endpoint matches the configured port.
- If transcription falls back to Xenova Whisper, verify the `/transcribe` endpoint is reachable and returns JSON `{ text }`.
