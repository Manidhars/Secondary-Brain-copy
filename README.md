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
5. Local automations: reminders, self preferences, self/relationship facts, friend notes, and meeting transcripts are auto-organized into folders (`personal/self`, `personal/relationships/{name}`, `personal/friends/{name}`, `work/calls`) so the chat agent can answer from your data even without cloud calls.

## What we are building
- A **purely local “second brain”**: every cognition flows through a local model (e.g., Mistral via Ollama on your Orin) with no cloud keys or calls.
- **Human-like memory scaffolding**: projects, personal facts, relationships, and friend notes are captured into dedicated folders so the agent can recall context the way you would.
- **Clarification-first behavior**: when you mention a project or person, the agent asks whether it’s new or related to an existing entry, then stores or updates the corresponding node locally.
- **P0 goal**: behave like your personal brain—capture and recall your projects, self facts, family/friend relationships, and meeting notes locally with a model like Mistral on Ollama, never relying on external APIs.
