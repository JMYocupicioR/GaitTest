import { PoseGaitAnalyzer } from './poseEstimation.ts';
import type { HeelStrikeEvent, PoseFrame } from './poseEstimation.ts';

export interface ExtractVideoPoseOptions {
  sampleFps?: number;
  onProgress?: (progress: number) => void;
  onHeelStrike?: (event: HeelStrikeEvent) => void;
}

export interface ExtractVideoPoseResult {
  frames: PoseFrame[];
  heelStrikes: HeelStrikeEvent[];
  durationSeconds: number;
  sampledFrames: number;
}

const waitForMetadata = (video: HTMLVideoElement): Promise<void> =>
  new Promise((resolve, reject) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }

    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Failed to load video metadata for offline pose processing.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });

const seekVideo = (video: HTMLVideoElement, time: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const target = Math.max(0, time);
    if (Math.abs(video.currentTime - target) < 1e-3) {
      resolve();
      return;
    }

    let timeout: number | null = null;
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Failed while seeking video for offline pose processing.'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      if (timeout !== null) window.clearTimeout(timeout);
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, 2000);
    video.currentTime = target;
  });

export const extractPoseFramesFromVideoBlob = async (
  videoBlob: Blob,
  options: ExtractVideoPoseOptions = {},
): Promise<ExtractVideoPoseResult> => {
  const sampleFps = Math.max(5, Math.min(60, options.sampleFps ?? 30));
  const analyzer = new PoseGaitAnalyzer();
  const frames: PoseFrame[] = [];
  const heelStrikes: HeelStrikeEvent[] = [];
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: false });

  if (!context) {
    throw new Error('Unable to create canvas context for offline pose processing.');
  }

  analyzer.setPoseCallback((frame) => {
    frames.push(frame);
  });
  analyzer.setHeelStrikeCallback((event) => {
    heelStrikes.push(event);
    options.onHeelStrike?.(event);
  });

  const url = URL.createObjectURL(videoBlob);
  try {
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    await waitForMetadata(video);
    const duration = Number.isFinite(video.duration) ? Math.max(video.duration, 0) : 0;
    if (!duration) {
      throw new Error('Video duration is not available for offline pose processing.');
    }

    canvas.width = Math.max(1, video.videoWidth || 640);
    canvas.height = Math.max(1, video.videoHeight || 480);

    const step = 1 / sampleFps;
    const sampleTimes: number[] = [];
    for (let t = 0; t <= duration; t += step) {
      sampleTimes.push(Math.min(duration, t));
    }
    if (sampleTimes[sampleTimes.length - 1] < duration) {
      sampleTimes.push(duration);
    }

    for (let index = 0; index < sampleTimes.length; index += 1) {
      const sampleTime = sampleTimes[index];
      await seekVideo(video, sampleTime);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      await analyzer.processImage(canvas, sampleTime);
      options.onProgress?.((index + 1) / sampleTimes.length);
    }

    return {
      frames,
      heelStrikes,
      durationSeconds: duration,
      sampledFrames: sampleTimes.length,
    };
  } finally {
    URL.revokeObjectURL(url);
    await analyzer.dispose();
  }
};
