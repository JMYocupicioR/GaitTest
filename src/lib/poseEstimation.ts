import { Pose, type Results } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

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
  private camera: Camera | null = null;
  private isProcessing = false;
  private frameBuffer: PoseFrame[] = [];
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

  public async initializeCamera(videoElement: HTMLVideoElement): Promise<void> {
    this.camera = new Camera(videoElement, {
      onFrame: async () => {
        if (this.isProcessing) return;
        this.isProcessing = true;
        await this.pose.send({ image: videoElement });
        this.isProcessing = false;
      },
      width: 640,
      height: 480
    });
  }

  public startAnalysis(): void {
    if (this.camera) {
      this.camera.start();
    }
  }

  public stopAnalysis(): void {
    if (this.camera) {
      this.camera.stop();
    }
    this.frameBuffer = [];
  }

  public setHeelStrikeCallback(callback: (event: HeelStrikeEvent) => void): void {
    this.onHeelStrike = callback;
  }

  public setPoseCallback(callback: (frame: PoseFrame) => void): void {
    this.onPoseDetected = callback;
  }

  private onPoseResults(results: Results): void {
    if (!results.poseLandmarks) return;

    const timestamp = performance.now() / 1000; // Convert to seconds

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
}
