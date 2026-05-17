import type { GaitEvent } from '../types/session.ts';

export interface EventThumbnail {
  eventType: GaitEvent['type'];
  foot: GaitEvent['foot'];
  timestampSec: number;
  blob: Blob;
}

const seekTo = (video: HTMLVideoElement, timestamp: number) =>
  new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Could not seek video to timestamp'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = Math.max(0, timestamp);
  });

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to render thumbnail blob'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.7,
    );
  });

export const extractEventThumbnails = async (
  videoBlob: Blob,
  events: GaitEvent[],
  maxThumbnails = 12,
): Promise<EventThumbnail[]> => {
  if (!events.length) {
    return [];
  }

  const url = URL.createObjectURL(videoBlob);
  const video = document.createElement('video');
  video.src = url;
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Failed to load video for thumbnails'));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    });

    const sourceWidth = Math.max(1, video.videoWidth || 320);
    const sourceHeight = Math.max(1, video.videoHeight || 240);
    const targetWidth = 320;
    const targetHeight = Math.max(180, Math.round((sourceHeight / sourceWidth) * targetWidth));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return [];
    }

    const limitedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp).slice(0, maxThumbnails);
    const output: EventThumbnail[] = [];

    for (const event of limitedEvents) {
      await seekTo(video, event.timestamp);
      context.drawImage(video, 0, 0, targetWidth, targetHeight);
      const blob = await canvasToBlob(canvas);
      output.push({
        eventType: event.type,
        foot: event.foot,
        timestampSec: Number(event.timestamp.toFixed(3)),
        blob,
      });
    }

    return output;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
};
