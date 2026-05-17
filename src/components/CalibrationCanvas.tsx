import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeManualPxPerMeter,
  computePxPerMeter,
  detectCalibrationObjectFromImageData,
  type CalibrationCorners,
  type CalibrationObjectType,
} from '../lib/calibrationDetector.ts';

interface CalibrationCanvasProps {
  imageUrl: string | null;
  mode: 'auto' | 'manual';
  manualDistanceMeters: number;
  onAutoDetected: (data: {
    pxPerMeter: number;
    objectType: CalibrationObjectType;
    confidence: number;
    corners: CalibrationCorners;
  } | null) => void;
  onManualMeasured: (pxPerMeter: number | null, points: { a: { x: number; y: number }; b: { x: number; y: number } } | null) => void;
}

export const CalibrationCanvas = ({
  imageUrl,
  mode,
  manualDistanceMeters,
  onAutoDetected,
  onManualMeasured,
}: CalibrationCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [manualPoints, setManualPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [autoResult, setAutoResult] = useState<{
    pxPerMeter: number;
    objectType: CalibrationObjectType;
    confidence: number;
    corners: CalibrationCorners;
  } | null>(null);

  useEffect(() => {
    setManualPoints([]);
    setAutoResult(null);
    onAutoDetected(null);
    onManualMeasured(null, null);
  }, [imageUrl, onAutoDetected, onManualMeasured]);

  useEffect(() => {
    if (!imageUrl) {
      setImageEl(null);
      return;
    }
    const img = new Image();
    img.onload = () => setImageEl(img);
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!imageEl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = imageEl.naturalWidth;
    canvas.height = imageEl.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imageEl, 0, 0);

    if (mode === 'auto') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const detected = detectCalibrationObjectFromImageData(imageData);
      if (!detected) {
        setAutoResult(null);
        onAutoDetected(null);
        return;
      }
      const pxPerMeter = computePxPerMeter(detected.corners, detected.objectType);
      const result = { ...detected, pxPerMeter };
      setAutoResult(result);
      onAutoDetected(result);
    }
  }, [imageEl, mode, onAutoDetected]);

  const manualResult = useMemo(() => {
    if (manualPoints.length !== 2) return null;
    const pxPerMeter = computeManualPxPerMeter(manualPoints[0], manualPoints[1], manualDistanceMeters);
    if (!pxPerMeter) return null;
    return { pxPerMeter, a: manualPoints[0], b: manualPoints[1] };
  }, [manualDistanceMeters, manualPoints]);

  useEffect(() => {
    if (mode !== 'manual') return;
    if (!manualResult) {
      onManualMeasured(null, null);
      return;
    }
    onManualMeasured(manualResult.pxPerMeter, { a: manualResult.a, b: manualResult.b });
  }, [mode, manualResult, onManualMeasured]);

  useEffect(() => {
    if (!imageEl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageEl, 0, 0);

    if (mode === 'auto' && autoResult) {
      const { corners, confidence, objectType } = autoResult;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(corners.topLeft.x, corners.topLeft.y);
      ctx.lineTo(corners.topRight.x, corners.topRight.y);
      ctx.lineTo(corners.bottomRight.x, corners.bottomRight.y);
      ctx.lineTo(corners.bottomLeft.x, corners.bottomLeft.y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
      ctx.fill();

      ctx.fillStyle = '#111827';
      ctx.font = '600 20px system-ui';
      ctx.fillText(`${objectType.toUpperCase()} · conf ${(confidence * 100).toFixed(0)}%`, corners.topLeft.x + 8, Math.max(26, corners.topLeft.y - 8));
    }

    if (mode === 'manual' && manualPoints.length > 0) {
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      for (const p of manualPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (manualPoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(manualPoints[0].x, manualPoints[0].y);
        ctx.lineTo(manualPoints[1].x, manualPoints[1].y);
        ctx.stroke();
      }
    }
  }, [autoResult, imageEl, manualPoints, mode]);

  const handleCanvasClick: React.MouseEventHandler<HTMLCanvasElement> = (event) => {
    if (mode !== 'manual') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    setManualPoints((prev) => (prev.length >= 2 ? [{ x, y }] : [...prev, { x, y }]));
  };

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '0.75rem',
          border: '1px solid #cbd5e1',
          cursor: mode === 'manual' ? 'crosshair' : 'default',
        }}
      />
      {mode === 'manual' && (
        <p className="helper-text">
          Selecciona dos puntos de referencia en la imagen. Si haces un tercer clic, reinicia la selección.
        </p>
      )}
    </div>
  );
};
