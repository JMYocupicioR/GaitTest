import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PoseFrame } from '../lib/poseEstimation.ts';
import {
  CLINICAL_COLORS,
  drawClinicalSkeleton,
  findPoseFrameAt,
} from '../lib/poseRenderer.ts';

interface BaseProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  showLabels?: boolean;
  visible?: boolean;
  className?: string;
}

interface LiveProps extends BaseProps {
  mode: 'live';
  liveFrame?: PoseFrame | null;
  frames?: undefined;
}

interface PlaybackProps extends BaseProps {
  mode: 'playback';
  frames: readonly PoseFrame[];
  liveFrame?: undefined;
}

export type PoseOverlayProps = LiveProps | PlaybackProps;

const DEFAULT_CANVAS_WIDTH = 640;
const DEFAULT_CANVAS_HEIGHT = 480;

function syncCanvasSize(canvas: HTMLCanvasElement, video: HTMLVideoElement | null): void {
  const targetWidth =
    video && video.videoWidth > 0 ? video.videoWidth : canvas.clientWidth || DEFAULT_CANVAS_WIDTH;
  const targetHeight =
    video && video.videoHeight > 0
      ? video.videoHeight
      : canvas.clientHeight || DEFAULT_CANVAS_HEIGHT;
  if (canvas.width !== targetWidth) canvas.width = targetWidth;
  if (canvas.height !== targetHeight) canvas.height = targetHeight;
}

function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export const PoseOverlay = (props: PoseOverlayProps) => {
  const { videoRef, showLabels = false, visible = true, className } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [meanVisibility, setMeanVisibility] = useState<number | null>(null);

  const updateVisibility = (frame: PoseFrame | null | undefined) => {
    if (!frame?.landmarks?.length) {
      setMeanVisibility(null);
      return;
    }
    const key = [11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    const vals = key
      .map((idx) => frame.landmarks[idx]?.visibility ?? 0)
      .filter((v) => Number.isFinite(v));
    if (!vals.length) {
      setMeanVisibility(null);
      return;
    }
    setMeanVisibility(vals.reduce((sum, v) => sum + v, 0) / vals.length);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const video = videoRef.current;

    syncCanvasSize(canvas, video);

    const handleMetadata = () => {
      if (canvasRef.current) syncCanvasSize(canvasRef.current, videoRef.current);
    };
    video?.addEventListener('loadedmetadata', handleMetadata);
    video?.addEventListener('resize', handleMetadata);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && video) {
      resizeObserver = new ResizeObserver(() => {
        if (canvasRef.current) syncCanvasSize(canvasRef.current, videoRef.current);
      });
      resizeObserver.observe(video);
    }

    return () => {
      video?.removeEventListener('loadedmetadata', handleMetadata);
      video?.removeEventListener('resize', handleMetadata);
      resizeObserver?.disconnect();
    };
  }, [videoRef]);

  useEffect(() => {
    if (props.mode !== 'live') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!visible) {
      clearCanvas(canvas);
      setMeanVisibility(null);
      return;
    }
    syncCanvasSize(canvas, videoRef.current);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawClinicalSkeleton(ctx, props.liveFrame?.landmarks ?? null, { showLabels });
    updateVisibility(props.liveFrame ?? null);
  }, [props, visible, showLabels, videoRef]);

  useEffect(() => {
    if (props.mode !== 'playback') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const video = videoRef.current;
    if (!visible) {
      clearCanvas(canvas);
      setMeanVisibility(null);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTimestamp = -1;

    const tick = () => {
      const v = videoRef.current;
      if (!v) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      syncCanvasSize(canvas, v);
      const time = v.currentTime;
      if (time !== lastTimestamp) {
        lastTimestamp = time;
        const frame = findPoseFrameAt(props.frames, time, 0.12);
        drawClinicalSkeleton(ctx, frame?.landmarks ?? null, { showLabels });
        updateVisibility(frame);
      }
      rafId = requestAnimationFrame(tick);
    };

    const renderFrameAtCurrentTime = () => {
      const v = videoRef.current;
      if (!v) return;
      syncCanvasSize(canvas, v);
      const frame = findPoseFrameAt(props.frames, v.currentTime, 0.12);
      drawClinicalSkeleton(ctx, frame?.landmarks ?? null, { showLabels });
      updateVisibility(frame);
    };

    renderFrameAtCurrentTime();
    rafId = requestAnimationFrame(tick);

    video?.addEventListener('seeked', renderFrameAtCurrentTime);

    return () => {
      cancelAnimationFrame(rafId);
      video?.removeEventListener('seeked', renderFrameAtCurrentTime);
    };
  }, [props, visible, showLabels, videoRef]);

  const confidenceColor =
    meanVisibility == null ? '#94a3b8' : meanVisibility >= 0.8 ? '#22c55e' : meanVisibility >= 0.5 ? '#f59e0b' : '#ef4444';
  const confidenceLabel =
    meanVisibility == null ? '—' : `${Math.round(meanVisibility * 100)}%`;

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className ?? 'pose-overlay'}
        aria-hidden="true"
      />
      {visible && (
        <div
          className="pose-confidence"
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            padding: '0.2rem 0.45rem',
            borderRadius: 6,
            background: 'rgba(15,23,42,0.75)',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 600,
            border: `1px solid ${confidenceColor}`,
            pointerEvents: 'none',
          }}
        >
          Confianza pose: <span style={{ color: confidenceColor }}>{confidenceLabel}</span>
        </div>
      )}
    </>
  );
};

export const PoseLegend = () => (
  <div className="pose-legend" aria-label="Leyenda de puntos corporales">
    <span>
      <span className="swatch" style={{ background: CLINICAL_COLORS.left }} />
      Pierna / brazo izquierdo
    </span>
    <span>
      <span className="swatch" style={{ background: CLINICAL_COLORS.right }} />
      Pierna / brazo derecho
    </span>
    <span>
      <span className="swatch" style={{ background: CLINICAL_COLORS.midline }} />
      Tronco
    </span>
    <span>
      <span className="swatch" style={{ background: CLINICAL_COLORS.face }} />
      Cara
    </span>
    <span style={{ opacity: 0.85 }}>
      Puntos críticos: caderas, rodillas, tobillos, talones y puntas de pie.
    </span>
  </div>
);
