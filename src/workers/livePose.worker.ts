interface LivePoseRequest {
  type: 'init' | 'start' | 'stop' | 'frame';
  payload?: unknown;
}

self.onmessage = async (event: MessageEvent<LivePoseRequest>) => {
  const request = event.data;
  if (!request) return;
  // Worker scaffold for future off-main-thread live pose processing.
  // Current implementation intentionally reports unsupported so the hook
  // falls back to main-thread processing.
  if (request.type === 'init') {
    self.postMessage({ type: 'unsupported' });
  }
};
