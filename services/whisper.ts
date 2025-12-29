
import { pipeline, env } from '@xenova/transformers';
import { getSettings } from './storage';

// Configuration to load models from CDN instead of local filesystem
// This is required for browser-based execution via ESM
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton to hold the pipeline instance
let transcriber: any = null;

export type LoadProgressCallback = (data: { status: string; file?: string; progress?: number }) => void;

// Loads the Whisper model into the browser.
// Uses 'Xenova/whisper-tiny' for performance on 8GB RAM devices.
export const loadWhisperModel = async (onProgress?: LoadProgressCallback) => {
  if (transcriber) return transcriber;

  try {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      progress_callback: onProgress,
    });
    return transcriber;
  } catch (err) {
    console.error("Failed to load Whisper model:", err);
    throw err;
  }
};

// Converts a Blob to an AudioBuffer, resamples to 16kHz, and returns the Float32Array
// required by the Whisper model.
const convertBlobToAudioData = async (blob: Blob): Promise<Float32Array> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Whisper expects mono audio
  let audioData = audioBuffer.getChannelData(0);

  // If stereo, we might want to mix down, but grabbing channel 0 is usually fine for speech
  return audioData;
};

// Transcribe audio using the local in-browser model.
export const localTranscribe = async (audioBlob: Blob): Promise<string> => {
  const settings = getSettings();
  if (settings.local_transcription_endpoint) {
      const form = new FormData();
      form.append('file', audioBlob, 'audio.webm');
      const resp = await fetch(settings.local_transcription_endpoint, {
          method: 'POST',
          headers: {
            ...(settings.local_api_key ? { Authorization: `Bearer ${settings.local_api_key}` } : {})
          },
          body: form
      });

      if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          if (data.text) return data.text;
      }
  }

  if (!transcriber) {
    // Attempt auto-load if not ready
    await loadWhisperModel();
  }

  if (!transcriber) {
      throw new Error("Local Whisper model failed to initialize.");
  }

  // 1. Convert Blob to raw audio data (16kHz)
  const audioData = await convertBlobToAudioData(audioBlob);

  // 2. Run inference
  // chunk_length_s: 30 is standard for Whisper
  const output = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    language: 'english',
    task: 'transcribe',
    return_timestamps: false,
  });

  // 3. Extract text
  return Array.isArray(output) ? output[0].text : output.text;
};
