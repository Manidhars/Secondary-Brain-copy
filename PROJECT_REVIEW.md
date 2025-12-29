# Project Review

After running `npm run build`, the project successfully compiles but surfaces a couple of concerns:

- **Large client bundle**: The production build outputs a ~1.5 MB JS bundle, triggering Rollup's chunk-size warning. Consider code-splitting heavier views (e.g., Timeline, Memories) or lazy-loading rarely used components to improve initial load performance.
- **Third-party eval usage**: `onnxruntime-web` emits a warning about `eval`. While it's in a dependency, double-check deployment CSP settings and whether a non-eval build or alternative package is feasible to tighten security.
- **Operational polish**: The boot sequence, health HUD, and safe-mode banner make the experience feel robust. Documenting how storage and queue health are derived (see `services/storage.ts`) in the README would help contributors reason about anomalies and safe-mode behavior.

Overall, the app feels like a rich “secondary brain” dashboard with strong visual feedback loops. Tackling the bundle size and clarifying the operational model would make it production-friendlier.

## Local deployment context (Nvidia Orin + Whisper + Mistral 3B)

If you are running the project as a local “secondary brain” on an Nvidia Orin with Whisper for speech-to-text and Mistral 3B for generation, the frontend build feedback above still applies. Additional local notes:

- **Model-serving interface**: Document the endpoints (paths, auth, expected payloads) exposed by your local Whisper and Mistral runtimes so the UI’s services can target them without Gemini credentials.
- **Hardware tuning**: Confirm GPU-accelerated builds of Whisper and Mistral are in use and that quantization settings are captured in docs or scripts to keep latency predictable on Orin.
- **Audio + text pathways**: Make sure transcription and chat flows are wired to your local endpoints and that failure states (e.g., model not warmed up) surface clearly in the safe-mode UI.

## Reliability gaps and edge cases for a private home assistant

Given the plan to run this privately (home automation, digital frame control, meeting transcription/recording, local Whisper + Mistral stack), expect the following risk areas to need hardening:

- **Mic/recorder states**: Handle missing permissions, hotplugged devices, and long-running recordings by surfacing UI prompts, time limits, and clear retries when `MediaRecorder` or Web Audio APIs fail.
- **Transcription backlog**: Add back-pressure to the transcription queue; reject or pause new recordings when storage/queue thresholds are exceeded, and persist partial audio to avoid total loss on crash.
- **Local-model availability**: Health-check the Whisper and Mistral endpoints on load and before each request; if a model is cold or offline, route to a user-visible degraded state instead of silent failure.
- **Connectivity toggles**: Make online/offline intent explicit in settings, and gate any cloud calls (telemetry, model fallbacks) so private/offline operation never leaks data.
- **Memory growth**: Bound memory/item sizes, implement eviction for stale embeddings, and surface when storage pressure triggers pruning to avoid slowdowns or data loss.
- **Task automation safety**: For home-automation commands, require confirmation or allow dry-runs before executing device-changing actions; log and show audit trails for voice-triggered commands.
- **Digital frame updates**: Validate image sources and file sizes before pushing to the photo frame service; include timeouts and retries so the frame does not stall on bad assets.
- **Meeting-mode UX**: Provide a “recording in progress” indicator, quick abort, and post-recording status (transcribing/waiting/ready). Queue meeting transcripts separately from casual chat so long jobs do not block short queries.

Short term, you can prototype this by stubbing endpoint health checks, adding queue limits in `services/storage.ts`, and expanding the settings view to include “local-only” and “automation confirmation” toggles.
