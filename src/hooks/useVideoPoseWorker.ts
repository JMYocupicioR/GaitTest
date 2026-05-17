import { useCallback, useMemo } from 'react';
import {
  extractPoseFramesFromVideoBlob,
  type ExtractVideoPoseResult,
} from '../lib/videoPoseProcessing.ts';

interface UseVideoPoseWorkerOptions {
  sampleFps: number;
}

interface RunExtractionOptions {
  onProgress?: (progress: number) => void;
}

type WorkerMessage =
  | { type: 'progress'; payload?: { progress?: number } }
  | { type: 'result'; payload?: ExtractVideoPoseResult }
  | { type: 'error'; payload?: { message?: string } };

export const useVideoPoseWorker = ({ sampleFps }: UseVideoPoseWorkerOptions) => {
  const supportsWorkers = useMemo(() => typeof Worker !== 'undefined', []);

  const runExtraction = useCallback(
    async (blob: Blob, options: RunExtractionOptions = {}): Promise<ExtractVideoPoseResult> => {
      if (!supportsWorkers) {
        return extractPoseFramesFromVideoBlob(blob, {
          sampleFps,
          onProgress: options.onProgress,
        });
      }

      const tryWorker = (): Promise<ExtractVideoPoseResult> =>
        new Promise((resolve, reject) => {
          const worker = new Worker(
            new URL('../workers/videoPose.worker.ts', import.meta.url),
            { type: 'module' },
          );

          const cleanup = () => {
            worker.onmessage = null;
            worker.onerror = null;
            worker.terminate();
          };

          worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const message = event.data;
            if (!message) return;
            if (message.type === 'progress') {
              options.onProgress?.(message.payload?.progress ?? 0);
              return;
            }
            if (message.type === 'result' && message.payload) {
              cleanup();
              resolve(message.payload);
              return;
            }
            if (message.type === 'error') {
              cleanup();
              reject(new Error(message.payload?.message ?? 'Worker extraction failed'));
            }
          };

          worker.onerror = (event) => {
            cleanup();
            reject(new Error(event.message || 'Worker error'));
          };

          worker.postMessage({
            type: 'extract',
            payload: {
              blob,
              sampleFps,
            },
          });
        });

      try {
        return await tryWorker();
      } catch {
        return extractPoseFramesFromVideoBlob(blob, {
          sampleFps,
          onProgress: options.onProgress,
        });
      }
    },
    [sampleFps, supportsWorkers],
  );

  return { runExtraction };
};
