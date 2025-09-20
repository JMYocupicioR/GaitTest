import type { PoseFrame } from './poseEstimation.ts';
import type { EventType, FootSide } from '../types/session.ts';

export interface DetectedGaitEvent {
  type: EventType;
  foot: FootSide;
  timestamp: number;
  confidence: number;
  frame: PoseFrame;
  source: 'pose_estimation';
}

export interface GaitCyclePhase {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  percentOfCycle: number;
}

export interface GaitCycle {
  foot: FootSide;
  startTime: number;
  endTime: number;
  duration: number;
  phases: {
    initialContact: GaitCyclePhase;
    loadingResponse: GaitCyclePhase;
    midStance: GaitCyclePhase;
    terminalStance: GaitCyclePhase;
    preSwing: GaitCyclePhase;
    initialSwing: GaitCyclePhase;
    midSwing: GaitCyclePhase;
    terminalSwing: GaitCyclePhase;
  };
  events: DetectedGaitEvent[];
}

export class AdvancedEventDetector {
  private frameBuffer: PoseFrame[] = [];
  private detectedEvents: DetectedGaitEvent[] = [];
  private onEventDetected?: (event: DetectedGaitEvent) => void;

  constructor() {}

  public setEventCallback(callback: (event: DetectedGaitEvent) => void): void {
    this.onEventDetected = callback;
  }

  public processFrame(frame: PoseFrame): void {
    this.frameBuffer.push(frame);

    // Keep only last 20 frames for analysis
    if (this.frameBuffer.length > 20) {
      this.frameBuffer.shift();
    }

    // Need at least 5 frames for event detection
    if (this.frameBuffer.length < 5) return;

    // Detect all gait events
    this.detectHeelStrike(frame);
    this.detectToeOff(frame);
    this.detectFootFlat(frame);
    this.detectHeelOff(frame);
    this.detectMaxKneeFlexion(frame);
    this.detectMaxHipExtension(frame);
  }

  private detectHeelStrike(currentFrame: PoseFrame): void {
    if (this.frameBuffer.length < 5) return;

    const previousFrame = this.frameBuffer[this.frameBuffer.length - 3];

    // Left heel strike
    const leftEvent = this.analyzeHeelStrike(
      previousFrame.leftAnkle,
      currentFrame.leftAnkle,
      previousFrame.leftKnee,
      currentFrame.leftKnee,
      'L'
    );

    if (leftEvent && this.onEventDetected) {
      this.onEventDetected({
        ...leftEvent,
        confidence: leftEvent.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }

    // Right heel strike
    const rightEvent = this.analyzeHeelStrike(
      previousFrame.rightAnkle,
      currentFrame.rightAnkle,
      previousFrame.rightKnee,
      currentFrame.rightKnee,
      'R'
    );

    if (rightEvent && this.onEventDetected) {
      this.onEventDetected({
        ...rightEvent,
        confidence: rightEvent.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }
  }

  private detectToeOff(currentFrame: PoseFrame): void {
    if (this.frameBuffer.length < 5) return;

    const previousFrame = this.frameBuffer[this.frameBuffer.length - 3];

    // Left toe-off
    const leftToeOff = this.analyzeToeOff(
      previousFrame.leftAnkle,
      currentFrame.leftAnkle,
      previousFrame.leftKnee,
      currentFrame.leftKnee,
      'L'
    );

    if (leftToeOff && this.onEventDetected) {
      this.onEventDetected({
        ...leftToeOff,
        confidence: leftToeOff.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }

    // Right toe-off
    const rightToeOff = this.analyzeToeOff(
      previousFrame.rightAnkle,
      currentFrame.rightAnkle,
      previousFrame.rightKnee,
      currentFrame.rightKnee,
      'R'
    );

    if (rightToeOff && this.onEventDetected) {
      this.onEventDetected({
        ...rightToeOff,
        confidence: rightToeOff.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }
  }

  private detectFootFlat(currentFrame: PoseFrame): void {
    if (this.frameBuffer.length < 10) return;

    // Analyze foot angle relative to ground
    const leftFootFlat = this.analyzeFootFlat(currentFrame.leftAnkle, currentFrame.leftKnee, 'L');
    const rightFootFlat = this.analyzeFootFlat(currentFrame.rightAnkle, currentFrame.rightKnee, 'R');

    if (leftFootFlat && this.onEventDetected) {
      this.onEventDetected({
        ...leftFootFlat,
        confidence: leftFootFlat.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }

    if (rightFootFlat && this.onEventDetected) {
      this.onEventDetected({
        ...rightFootFlat,
        confidence: rightFootFlat.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }
  }

  private detectHeelOff(currentFrame: PoseFrame): void {
    if (this.frameBuffer.length < 5) return;

    const previousFrame = this.frameBuffer[this.frameBuffer.length - 3];

    // Heel-off occurs when ankle starts moving upward after foot-flat
    const leftHeelOff = this.analyzeHeelOff(
      previousFrame.leftAnkle,
      currentFrame.leftAnkle,
      'L'
    );

    const rightHeelOff = this.analyzeHeelOff(
      previousFrame.rightAnkle,
      currentFrame.rightAnkle,
      'R'
    );

    if (leftHeelOff && this.onEventDetected) {
      this.onEventDetected({
        ...leftHeelOff,
        confidence: leftHeelOff.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }

    if (rightHeelOff && this.onEventDetected) {
      this.onEventDetected({
        ...rightHeelOff,
        confidence: rightHeelOff.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }
  }

  private detectMaxKneeFlexion(currentFrame: PoseFrame): void {
    if (this.frameBuffer.length < 7) return;

    // Find local maxima in knee flexion during swing phase
    const leftMaxFlex = this.analyzeMaxKneeFlexion(currentFrame.leftHip, currentFrame.leftKnee, currentFrame.leftAnkle, 'L');
    const rightMaxFlex = this.analyzeMaxKneeFlexion(currentFrame.rightHip, currentFrame.rightKnee, currentFrame.rightAnkle, 'R');

    if (leftMaxFlex && this.onEventDetected) {
      this.onEventDetected({
        ...leftMaxFlex,
        confidence: leftMaxFlex.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }

    if (rightMaxFlex && this.onEventDetected) {
      this.onEventDetected({
        ...rightMaxFlex,
        confidence: rightMaxFlex.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }
  }

  private detectMaxHipExtension(currentFrame: PoseFrame): void {
    if (this.frameBuffer.length < 7) return;

    // Hip extension maximum occurs at terminal stance
    const leftMaxExt = this.analyzeMaxHipExtension(currentFrame.leftHip, currentFrame.leftKnee, 'L');
    const rightMaxExt = this.analyzeMaxHipExtension(currentFrame.rightHip, currentFrame.rightKnee, 'R');

    if (leftMaxExt && this.onEventDetected) {
      this.onEventDetected({
        ...leftMaxExt,
        confidence: leftMaxExt.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }

    if (rightMaxExt && this.onEventDetected) {
      this.onEventDetected({
        ...rightMaxExt,
        confidence: rightMaxExt.confidence ?? 0,
        timestamp: currentFrame.timestamp,
        frame: currentFrame,
        source: 'pose_estimation'
      });
    }
  }

  private analyzeHeelStrike(prevAnkle: any, currAnkle: any, prevKnee: any, currKnee: any, foot: FootSide): Partial<DetectedGaitEvent> | null {
    // Heel strike: ankle stops moving downward and is at lowest point
    const ankleVelocityY = currAnkle.y - prevAnkle.y;
    const ankleBelowKnee = currAnkle.y > currKnee.y;
    const stoppedMoving = Math.abs(ankleVelocityY) < 0.005;
    const goodVisibility = currAnkle.visibility > 0.7 && currKnee.visibility > 0.7;

    if (stoppedMoving && ankleBelowKnee && goodVisibility) {
      return {
        type: 'heel_strike',
        foot,
        confidence: Math.min(0.9, (currAnkle.visibility + currKnee.visibility) / 2)
      };
    }

    return null;
  }

  private analyzeToeOff(prevAnkle: any, currAnkle: any, prevKnee: any, currKnee: any, foot: FootSide): Partial<DetectedGaitEvent> | null {
    // Toe-off: ankle starts moving upward rapidly, beginning of swing phase
    const ankleVelocityY = currAnkle.y - prevAnkle.y;
    const ankleMovingUp = ankleVelocityY < -0.008; // Moving upward
    const kneeStartingToFlex = currKnee.y < prevKnee.y; // Knee moving up (flexing)
    const goodVisibility = currAnkle.visibility > 0.7 && currKnee.visibility > 0.7;

    if (ankleMovingUp && kneeStartingToFlex && goodVisibility) {
      return {
        type: 'toe_off',
        foot,
        confidence: Math.min(0.85, (currAnkle.visibility + currKnee.visibility) / 2)
      };
    }

    return null;
  }

  private analyzeFootFlat(ankle: any, knee: any, foot: FootSide): Partial<DetectedGaitEvent> | null {
    // Foot flat: ankle and knee at similar vertical level, minimal movement
    const ankleKneeRatio = Math.abs(ankle.y - knee.y) / Math.abs(knee.y);
    const relativelyFlat = ankleKneeRatio > 0.1 && ankleKneeRatio < 0.3;
    const goodVisibility = ankle.visibility > 0.7 && knee.visibility > 0.7;

    // Check if this is during stance phase (ankle relatively stable)
    if (this.frameBuffer.length >= 5) {
      const recentFrames = this.frameBuffer.slice(-5);
      const ankleStability = this.calculatePositionStability(recentFrames, foot === 'L' ? 'leftAnkle' : 'rightAnkle');

      if (relativelyFlat && goodVisibility && ankleStability < 0.01) {
        return {
          type: 'foot_flat',
          foot,
          confidence: Math.min(0.8, ankle.visibility)
        };
      }
    }

    return null;
  }

  private analyzeHeelOff(prevAnkle: any, currAnkle: any, foot: FootSide): Partial<DetectedGaitEvent> | null {
    // Heel-off: ankle starts moving upward after being stable
    const ankleVelocityY = currAnkle.y - prevAnkle.y;
    const ankleMovingUp = ankleVelocityY < -0.003;
    const goodVisibility = currAnkle.visibility > 0.7;

    if (ankleMovingUp && goodVisibility) {
      return {
        type: 'heel_off',
        foot,
        confidence: Math.min(0.75, currAnkle.visibility)
      };
    }

    return null;
  }

  private analyzeMaxKneeFlexion(hip: any, knee: any, ankle: any, foot: FootSide): Partial<DetectedGaitEvent> | null {
    // Maximum knee flexion during swing phase
    if (this.frameBuffer.length < 7) return null;

    const currentKneeAngle = this.calculateKneeAngle(hip, knee, ankle);
    const recentAngles = this.frameBuffer.slice(-7).map(frame => {
      const f = foot === 'L' ? frame.leftKnee : frame.rightKnee;
      const h = foot === 'L' ? frame.leftHip : frame.rightHip;
      const a = foot === 'L' ? frame.leftAnkle : frame.rightAnkle;
      return this.calculateKneeAngle(h, f, a);
    });

    // Check if current angle is a local maximum
    const isLocalMaximum = recentAngles.every(angle => currentKneeAngle >= angle);
    const significantFlexion = currentKneeAngle > 110; // Degrees
    const goodVisibility = hip.visibility > 0.7 && knee.visibility > 0.7 && ankle.visibility > 0.7;

    if (isLocalMaximum && significantFlexion && goodVisibility) {
      return {
        type: 'max_knee_flexion',
        foot,
        confidence: Math.min(0.8, (hip.visibility + knee.visibility + ankle.visibility) / 3)
      };
    }

    return null;
  }

  private analyzeMaxHipExtension(hip: any, knee: any, foot: FootSide): Partial<DetectedGaitEvent> | null {
    // Maximum hip extension at terminal stance
    if (this.frameBuffer.length < 7) return null;

    // Calculate hip extension angle (simplified)
    const hipExtensionAngle = this.calculateHipExtensionAngle(hip, knee);
    const recentAngles = this.frameBuffer.slice(-7).map(frame => {
      const h = foot === 'L' ? frame.leftHip : frame.rightHip;
      const k = foot === 'L' ? frame.leftKnee : frame.rightKnee;
      return this.calculateHipExtensionAngle(h, k);
    });

    const isLocalMaximum = recentAngles.every(angle => hipExtensionAngle >= angle);
    const significantExtension = hipExtensionAngle > 160; // Degrees
    const goodVisibility = hip.visibility > 0.7 && knee.visibility > 0.7;

    if (isLocalMaximum && significantExtension && goodVisibility) {
      return {
        type: 'max_hip_extension',
        foot,
        confidence: Math.min(0.75, (hip.visibility + knee.visibility) / 2)
      };
    }

    return null;
  }

  private calculateKneeAngle(hip: any, knee: any, ankle: any): number {
    if (!hip || !knee || !ankle) return 0;

    const radians = Math.atan2(ankle.y - knee.y, ankle.x - knee.x) -
                   Math.atan2(hip.y - knee.y, hip.x - knee.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
      angle = 360 - angle;
    }

    return angle;
  }

  private calculateHipExtensionAngle(hip: any, knee: any): number {
    if (!hip || !knee) return 0;

    // Reference vertical line
    const verticalRef = { x: hip.x, y: hip.y - 0.1 };

    const radians = Math.atan2(knee.y - hip.y, knee.x - hip.x) -
                   Math.atan2(verticalRef.y - hip.y, verticalRef.x - hip.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);

    if (angle > 180.0) {
      angle = 360 - angle;
    }

    return angle;
  }

  private calculatePositionStability(frames: PoseFrame[], jointName: string): number {
    if (frames.length < 3) return 1.0;

    const positions = frames.map(frame => {
      const joint = (frame as any)[jointName];
      return { x: joint.x, y: joint.y };
    });

    // Calculate variance in position
    const meanX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const meanY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

    const varianceX = positions.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2), 0) / positions.length;
    const varianceY = positions.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0) / positions.length;

    return Math.sqrt(varianceX + varianceY);
  }

  public generateGaitCycles(events: DetectedGaitEvent[]): GaitCycle[] {
    const cycles: GaitCycle[] = [];

    // Group events by foot
    const leftEvents = events.filter(e => e.foot === 'L').sort((a, b) => a.timestamp - b.timestamp);
    const rightEvents = events.filter(e => e.foot === 'R').sort((a, b) => a.timestamp - b.timestamp);

    // Generate cycles for each foot
    cycles.push(...this.generateCyclesForFoot(leftEvents, 'L'));
    cycles.push(...this.generateCyclesForFoot(rightEvents, 'R'));

    return cycles.sort((a, b) => a.startTime - b.startTime);
  }

  private generateCyclesForFoot(events: DetectedGaitEvent[], foot: FootSide): GaitCycle[] {
    const cycles: GaitCycle[] = [];
    const heelStrikes = events.filter(e => e.type === 'heel_strike');

    for (let i = 0; i < heelStrikes.length - 1; i++) {
      const cycleStart = heelStrikes[i];
      const cycleEnd = heelStrikes[i + 1];

      const cycleEvents = events.filter(e =>
        e.timestamp >= cycleStart.timestamp &&
        e.timestamp < cycleEnd.timestamp &&
        e.foot === foot
      );

      const cycle = this.createGaitCycle(cycleStart, cycleEnd, cycleEvents, foot);
      if (cycle) {
        cycles.push(cycle);
      }
    }

    return cycles;
  }

  private createGaitCycle(start: DetectedGaitEvent, end: DetectedGaitEvent, events: DetectedGaitEvent[], foot: FootSide): GaitCycle | null {
    const duration = end.timestamp - start.timestamp;

    // A valid gait cycle should be between 0.8 and 2.0 seconds
    if (duration < 0.8 || duration > 2.0) {
      return null;
    }

    // Calculate phase percentages based on typical gait cycle
    const phases = {
      initialContact: this.createPhase('Initial Contact', start.timestamp, start.timestamp + duration * 0.02, duration),
      loadingResponse: this.createPhase('Loading Response', start.timestamp + duration * 0.02, start.timestamp + duration * 0.12, duration),
      midStance: this.createPhase('Mid Stance', start.timestamp + duration * 0.12, start.timestamp + duration * 0.31, duration),
      terminalStance: this.createPhase('Terminal Stance', start.timestamp + duration * 0.31, start.timestamp + duration * 0.50, duration),
      preSwing: this.createPhase('Pre Swing', start.timestamp + duration * 0.50, start.timestamp + duration * 0.62, duration),
      initialSwing: this.createPhase('Initial Swing', start.timestamp + duration * 0.62, start.timestamp + duration * 0.75, duration),
      midSwing: this.createPhase('Mid Swing', start.timestamp + duration * 0.75, start.timestamp + duration * 0.87, duration),
      terminalSwing: this.createPhase('Terminal Swing', start.timestamp + duration * 0.87, end.timestamp, duration)
    };

    return {
      foot,
      startTime: start.timestamp,
      endTime: end.timestamp,
      duration,
      phases,
      events
    };
  }

  private createPhase(name: string, startTime: number, endTime: number, totalDuration: number): GaitCyclePhase {
    const duration = endTime - startTime;
    return {
      name,
      startTime,
      endTime,
      duration,
      percentOfCycle: (duration / totalDuration) * 100
    };
  }

  public clearBuffer(): void {
    this.frameBuffer = [];
    this.detectedEvents = [];
  }

  public getDetectedEvents(): DetectedGaitEvent[] {
    return [...this.detectedEvents];
  }
}