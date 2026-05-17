import { Pose, type Results } from '@mediapipe/pose';

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseFrame {
  timestamp: number;
  landmarks: PoseLandmark[];
  leftAnkle: PoseLandmark;
  rightAnkle: PoseLandmark;
  leftKnee: PoseLandmark;
  rightKnee: PoseLandmark;
  leftHip: PoseLandmark;
  rightHip: PoseLandmark;
  leftHeel: PoseLandmark;
  rightHeel: PoseLandmark;
  leftFootIndex: PoseLandmark;
  rightFootIndex: PoseLandmark;
  leftShoulder: PoseLandmark;
  rightShoulder: PoseLandmark;
}

export interface HeelStrikeEvent {
  foot: 'L' | 'R';
  timestamp: number;
  confidence: number;
  source: 'pose_estimation';
}

export class PoseGaitAnalyzer {
  private pose: Pose;
  private liveVideoElement: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private loopRunning = false;
  private isDisposed = false;
  private isProcessing = false;
  private frameBuffer: PoseFrame[] = [];
  private pendingFrameTimestamp: number | null = null;
  /** Segundos desde el inicio del clip / grabación (p. ej. video.currentTime o tiempo de grabación). */
  private liveTimestampProvider: (() => number | null) | null = null;
  private onHeelStrike?: (event: HeelStrikeEvent) => void;
  private onPoseDetected?: (frame: PoseFrame) => void;

  constructor() {
    this.pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.pose.onResults(this.onPoseResults.bind(this));
  }

  public setLiveVideoElement(videoElement: HTMLVideoElement | null): void {
    this.liveVideoElement = videoElement;
  }

  public startAnalysis(): void {
    if (this.loopRunning || this.isDisposed) {
      return;
    }
    this.loopRunning = true;

    const tick = () => {
      if (!this.loopRunning || this.isDisposed) {
        return;
      }

      const videoElement = this.liveVideoElement;
      if (
        videoElement &&
        videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !this.isProcessing
      ) {
        this.isProcessing = true;
        void this.pose
          .send({ image: videoElement })
          .catch((error) => {
            console.warn('Pose live frame processing failed:', error);
          })
          .finally(() => {
            this.isProcessing = false;
          });
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  public stopAnalysis(): void {
    this.loopRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isProcessing = false;
    this.pendingFrameTimestamp = null;
    this.frameBuffer = [];
  }

  public async processImage(image: HTMLVideoElement | HTMLCanvasElement, timestampSeconds?: number): Promise<void> {
    if (this.isProcessing || this.isDisposed) return;
    this.isProcessing = true;
    this.pendingFrameTimestamp = Number.isFinite(timestampSeconds) ? timestampSeconds ?? null : null;
    try {
      await this.pose.send({ image });
    } finally {
      this.pendingFrameTimestamp = null;
      this.isProcessing = false;
    }
  }

  public setHeelStrikeCallback(callback: (event: HeelStrikeEvent) => void): void {
    this.onHeelStrike = callback;
  }

  public setPoseCallback(callback: (frame: PoseFrame) => void): void {
    this.onPoseDetected = callback;
  }

  /**
   * En cámara en vivo, alinear timestamps con el reproductor o con el tiempo transcurrido de grabación.
   */
  public setLiveTimestampProvider(provider: (() => number | null) | null): void {
    this.liveTimestampProvider = provider;
  }

  private onPoseResults(results: Results): void {
    if (this.isDisposed) return;
    if (!results.poseLandmarks) return;

    const fromProvider = this.liveTimestampProvider?.();
    const timestamp =
      this.pendingFrameTimestamp ??
      (fromProvider != null && Number.isFinite(fromProvider) ? Math.max(0, fromProvider) : performance.now() / 1000);

    const normalizedLandmarks = results.poseLandmarks.map(lm => ({
      ...lm,
      visibility: lm.visibility ?? 0,
    }));

    const frame: PoseFrame = {
      timestamp,
      landmarks: normalizedLandmarks,
      leftAnkle: normalizedLandmarks[27], // LEFT_ANKLE
      rightAnkle: normalizedLandmarks[28], // RIGHT_ANKLE
      leftKnee: normalizedLandmarks[25], // LEFT_KNEE
      rightKnee: normalizedLandmarks[26], // RIGHT_KNEE
      leftHip: normalizedLandmarks[23], // LEFT_HIP
      rightHip: normalizedLandmarks[24], // RIGHT_HIP
      leftHeel: normalizedLandmarks[29], // LEFT_HEEL
      rightHeel: normalizedLandmarks[30], // RIGHT_HEEL
      leftFootIndex: normalizedLandmarks[31], // LEFT_FOOT_INDEX
      rightFootIndex: normalizedLandmarks[32], // RIGHT_FOOT_INDEX
      leftShoulder: normalizedLandmarks[11], // LEFT_SHOULDER
      rightShoulder: normalizedLandmarks[12], // RIGHT_SHOULDER
    };

    this.frameBuffer.push(frame);

    // Keep only last 10 frames for analysis
    if (this.frameBuffer.length > 10) {
      this.frameBuffer.shift();
    }

    // Detect heel strikes
    this.detectHeelStrikes();

    // Notify pose detected
    if (this.onPoseDetected) {
      this.onPoseDetected(frame);
    }
  }

  private detectHeelStrikes(): void {
    if (this.frameBuffer.length < 5) return;

    const currentFrame = this.frameBuffer[this.frameBuffer.length - 1];
    const previousFrame = this.frameBuffer[this.frameBuffer.length - 3];

    // Detect left heel strike
    const leftHeelStrike = this.isHeelStrike(
      previousFrame.leftAnkle,
      currentFrame.leftAnkle,
      previousFrame.leftKnee,
      currentFrame.leftKnee
    );

    if (leftHeelStrike.detected && this.onHeelStrike) {
      this.onHeelStrike({
        foot: 'L',
        timestamp: currentFrame.timestamp,
        confidence: leftHeelStrike.confidence,
        source: 'pose_estimation'
      });
    }

    // Detect right heel strike
    const rightHeelStrike = this.isHeelStrike(
      previousFrame.rightAnkle,
      currentFrame.rightAnkle,
      previousFrame.rightKnee,
      currentFrame.rightKnee
    );

    if (rightHeelStrike.detected && this.onHeelStrike) {
      this.onHeelStrike({
        foot: 'R',
        timestamp: currentFrame.timestamp,
        confidence: rightHeelStrike.confidence,
        source: 'pose_estimation'
      });
    }
  }

  private isHeelStrike(
    prevAnkle: PoseLandmark,
    currAnkle: PoseLandmark,
    _prevKnee: PoseLandmark,
    currKnee: PoseLandmark
  ): { detected: boolean; confidence: number } {
    // Check if ankle stopped moving downward (y velocity near zero)
    const ankleVelocityY = currAnkle.y - prevAnkle.y;

    // Check if ankle is at lowest point relative to knee
    const ankleBelowKnee = currAnkle.y > currKnee.y;

    // Check if movement velocity decreased significantly
    const velocityThreshold = 0.005;
    const stoppedMoving = Math.abs(ankleVelocityY) < velocityThreshold;

    // Check landmark visibility
    const goodVisibility = currAnkle.visibility > 0.7 && currKnee.visibility > 0.7;

    const detected = stoppedMoving && ankleBelowKnee && goodVisibility;
    const confidence = goodVisibility ? Math.min(0.9, currAnkle.visibility + currKnee.visibility) / 2 : 0.3;

    return { detected, confidence };
  }

  public getJointTrajectories(): {
    leftAnkle: PoseLandmark[];
    rightAnkle: PoseLandmark[];
    leftKnee: PoseLandmark[];
    rightKnee: PoseLandmark[];
    leftHip: PoseLandmark[];
    rightHip: PoseLandmark[];
  } {
    return {
      leftAnkle: this.frameBuffer.map(f => f.leftAnkle),
      rightAnkle: this.frameBuffer.map(f => f.rightAnkle),
      leftKnee: this.frameBuffer.map(f => f.leftKnee),
      rightKnee: this.frameBuffer.map(f => f.rightKnee),
      leftHip: this.frameBuffer.map(f => f.leftHip),
      rightHip: this.frameBuffer.map(f => f.rightHip)
    };
  }

  public calculateJointAngles(frame: PoseFrame): {
    leftKneeAngle: number;
    rightKneeAngle: number;
    leftHipAngle: number;
    rightHipAngle: number;
  } {
    return {
      leftKneeAngle: this.calculateAngle(frame.leftHip, frame.leftKnee, frame.leftAnkle),
      rightKneeAngle: this.calculateAngle(frame.rightHip, frame.rightKnee, frame.rightAnkle),
      leftHipAngle: this.calculateAngle(
        { x: frame.leftHip.x, y: frame.leftHip.y - 0.1, z: frame.leftHip.z, visibility: 1 },
        frame.leftHip,
        frame.leftKnee
      ),
      rightHipAngle: this.calculateAngle(
        { x: frame.rightHip.x, y: frame.rightHip.y - 0.1, z: frame.rightHip.z, visibility: 1 },
        frame.rightHip,
        frame.rightKnee
      )
    };
  }

  private calculateAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
      angle = 360 - angle;
    }

    return angle;
  }

  public async dispose(): Promise<void> {
    this.stopAnalysis();
    this.liveVideoElement = null;
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    await this.pose.close();
  }
}
