import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: any = null;

export type LoadProgressCallback = (data: { status: string; file?: string; progress?: number }) => void;

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

const convertBlobToAudioData = async (blob: Blob): Promise<Float32Array> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
};

export interface WhisperSegment {
  text: string;
  timestamp: [number, number];
}

export interface WhisperOutput {
  text: string;
  chunks: WhisperSegment[];
}

export const localTranscribe = async (audioBlob: Blob): Promise<WhisperOutput> => {
  if (!transcriber) await loadWhisperModel();
  if (!transcriber) throw new Error("Local Whisper model failed to initialize.");

  const audioData = await convertBlobToAudioData(audioBlob);

  const output = await transcriber(audioData, {
    chunk_length_s: 30,
    stride_length_s: 5,
    language: 'english',
    task: 'transcribe',
    return_timestamps: true, // CRITICAL: This enables local segmenting
  });

  return {
    text: output.text,
    chunks: output.chunks || []
  };
};