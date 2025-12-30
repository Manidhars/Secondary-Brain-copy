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
2. No API keys are required—everything runs locally by default.
3. Run the app:
   `npm run dev`
4. Choose your provider in **Settings → LLM Provider** (Adaptive Local or Local Only). Cloud calls are disabled.
5. Local automations: reminders, self preferences, friend facts, and meeting transcripts are auto-organized into folders (`personal/self`, `personal/friends/{name}`, `work/calls`) so the chat agent can answer from your data even without cloud calls.
