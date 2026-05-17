import type { ExtractVideoPoseResult } from '../lib/videoPoseProcessing.ts';

interface WorkerRequest {
  type: 'extract';
  payload: {
    blob: Blob;
    sampleFps: number;
  };
}

interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  payload?: unknown;
}

const post = (message: WorkerResponse): void => {
  self.postMessage(message);
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== 'extract') {
    return;
  }
  try {
    // NOTE:
    // Browser support for decoding arbitrary video blobs inside a dedicated
    // worker is inconsistent on mobile (and often unavailable).
    // We keep the worker channel/protocol ready and fall back to main-thread
    // extraction from the hook when worker-side decode is unsupported.
    post({
      type: 'error',
      payload: {
        message: 'Worker video decode is not available in this environment.',
      },
    });
  } catch (error) {
    post({
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : 'Unknown worker error',
      },
    });
  }
};

export type { ExtractVideoPoseResult };
