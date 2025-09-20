import type { PoseFrame } from './poseEstimation.ts';
import type {
  ViewMode,
  KinematicData,
  BilateralKinematicData,
  AxialKinematicData,
  SideKinematicData,
  KinematicJointSummary,
  KinematicValueMoment,
  JointAngleTimeSeries,
  DetailedKinematics,
  AngleAggregate,
  SingleAngleAggregate,
  KinematicSummary,
  KinematicDeviation
} from '../types/session.ts';

interface Vector2D {
  x: number;
  y: number;
}

interface AngleStats {
  max: number;
  min: number;
  maxIndex: number;
  minIndex: number;
  mean: number;
  stdDev: number;
  rom: number;
}

const RAD_TO_DEG = 180 / Math.PI;

interface Point2D {
  x: number;
  y: number;
}

export function calculateAngle2D(p1: Point2D, p2: Point2D, p3: Point2D): number {
  const angleRad = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angleDeg = (angleRad * 180) / Math.PI;
  angleDeg = angleDeg < 0 ? angleDeg + 360 : angleDeg;
  if (angleDeg > 180) {
    angleDeg = 360 - angleDeg;
  }
  return angleDeg;
}

interface FrameKinematics {
  timestamp: number;
  frameIndex: number;
  sagittal: {
    hipFlexion: { left: number | null; right: number | null };
    kneeFlexion: { left: number | null; right: number | null };
    ankleFlexion: { left: number | null; right: number | null };
    trunkFlexion: number | null;
    pelvisTilt: number | null;
  };
  frontal: {
    hipAbduction: { left: number | null; right: number | null } | null;
    pelvicObliquity: number | null;
    trunkLateralFlexion: number | null;
  };
}

export class KinematicAnalyzer {
  private frameHistory: PoseFrame[] = [];
  private viewMode: ViewMode = 'lateral';
  private forwardDirection = 1;

  private createEmptySeries(): JointAngleTimeSeries {
    return {
      timestamps: [],
      angles: [],
      frameIndices: [],
      velocity: [],
      acceleration: []
    };
  }

  private buildSeries(
    timestamps: number[],
    angles: number[],
    indices: number[]
  ): JointAngleTimeSeries {
    if (timestamps.length === 0) {
      return this.createEmptySeries();
    }
    const velocity = this.calculateVelocity(angles, timestamps);
    return {
      timestamps,
      angles,
      frameIndices: indices,
      velocity: velocity,
      acceleration: this.calculateAcceleration(velocity, timestamps)
    };
  }

  private static readonly VISIBILITY_THRESHOLD = 0.6;

  private static readonly NORMAL_RANGES = {
    ankle: {
      dorsiflexion: { min: 10, max: 20 },
      plantarflexion: { min: 15, max: 25 }
    },
    knee: {
      flexion: { min: 60, max: 70 },
      extension: { min: -5, max: 5 }
    },
    hip: {
      flexion: { min: 25, max: 35 },
      extension: { min: 10, max: 20 }
    },
    pelvis: {
      tilt: { min: -5, max: 5 },
      obliquity: { min: -3, max: 3 },
      rotation: { min: -8, max: 8 }
    }
  };

  private static readonly FRONTAL_NORMAL_RANGES = {
    hipAbduction: { min: -10, max: 10 },
    kneeAbduction: { min: -5, max: 5 },
    ankleInversion: { min: -8, max: 8 },
    pelvisObliquity: { min: -3, max: 3 },
    trunkLateralFlexion: { min: -8, max: 8 }
  };

  constructor(viewMode: ViewMode = 'lateral') {
    this.viewMode = viewMode;
  }

  public processFrame(frame: PoseFrame): void {
    this.frameHistory.push(frame);
    if (this.frameHistory.length > 300) {
      this.frameHistory.shift();
    }
  }

  public calculateKinematicsForFrame(frame: PoseFrame, frameIndex = 0): FrameKinematics {
    const includeFrontal = this.viewMode === 'frontal' || this.viewMode === 'dual';

    const getPoint = (landmark: PoseFrame['leftHip']): Point2D => ({ x: landmark.x, y: landmark.y });

    const leftShoulder = frame.leftShoulder;
    const rightShoulder = frame.rightShoulder;
    const leftHip = frame.leftHip;
    const rightHip = frame.rightHip;
    const leftKnee = frame.leftKnee;
    const rightKnee = frame.rightKnee;
    const leftAnkle = frame.leftAnkle;
    const rightAnkle = frame.rightAnkle;
    const leftHeel = frame.leftHeel;
    const rightHeel = frame.rightHeel;

    const leftHipFlexion = this.hasVisibility(leftShoulder, leftHip, leftKnee)
      ? this.applySagittalSign(calculateAngle2D(getPoint(leftShoulder), getPoint(leftHip), getPoint(leftKnee)), leftHip, leftKnee)
      : null;
    const rightHipFlexion = this.hasVisibility(rightShoulder, rightHip, rightKnee)
      ? this.applySagittalSign(calculateAngle2D(getPoint(rightShoulder), getPoint(rightHip), getPoint(rightKnee)), rightHip, rightKnee)
      : null;
    const leftKneeFlexion = this.hasVisibility(leftHip, leftKnee, leftAnkle)
      ? this.applySagittalSign(calculateAngle2D(getPoint(leftHip), getPoint(leftKnee), getPoint(leftAnkle)), leftKnee, leftAnkle)
      : null;
    const rightKneeFlexion = this.hasVisibility(rightHip, rightKnee, rightAnkle)
      ? this.applySagittalSign(calculateAngle2D(getPoint(rightHip), getPoint(rightKnee), getPoint(rightAnkle)), rightKnee, rightAnkle)
      : null;
    const leftAnkleFlexion = this.hasVisibility(leftKnee, leftAnkle, leftHeel)
      ? this.applySagittalSign(calculateAngle2D(getPoint(leftKnee), getPoint(leftAnkle), getPoint(leftHeel)), leftAnkle, leftHeel)
      : null;
    const rightAnkleFlexion = this.hasVisibility(rightKnee, rightAnkle, rightHeel)
      ? this.applySagittalSign(calculateAngle2D(getPoint(rightKnee), getPoint(rightAnkle), getPoint(rightHeel)), rightAnkle, rightHeel)
      : null;

    const shoulderCenter = this.getShoulderCenter(frame);
    const pelvisCenter = this.getPelvisCenter(frame);

    const trunkFlexion = shoulderCenter
      ? this.computeTrunkFlexionAngle(shoulderCenter, pelvisCenter)
      : null;
    const pelvisTilt = shoulderCenter
      ? this.computePelvisTiltAngle(shoulderCenter, pelvisCenter)
      : null;

    let hipAbduction: { left: number | null; right: number | null } | null = null;
    let pelvicObliquity: number | null = null;
    let trunkLateralFlexion: number | null = null;

    if (includeFrontal) {
      hipAbduction = {
        left: this.hasVisibility(leftShoulder, leftHip, leftKnee)
          ? this.applyFrontalSign(calculateAngle2D(getPoint(leftShoulder), getPoint(leftHip), getPoint(leftKnee)), 'left', leftHip, leftKnee)
          : null,
        right: this.hasVisibility(rightShoulder, rightHip, rightKnee)
          ? this.applyFrontalSign(calculateAngle2D(getPoint(rightShoulder), getPoint(rightHip), getPoint(rightKnee)), 'right', rightHip, rightKnee)
          : null
      };
      pelvicObliquity = this.computePelvicObliquity(leftHip, rightHip);
      trunkLateralFlexion = shoulderCenter
        ? this.computeTrunkLateralAngle(shoulderCenter, pelvisCenter)
        : null;
    }

    return {
      timestamp: frame.timestamp,
      frameIndex,
      sagittal: {
        hipFlexion: { left: leftHipFlexion, right: rightHipFlexion },
        kneeFlexion: { left: leftKneeFlexion, right: rightKneeFlexion },
        ankleFlexion: { left: leftAnkleFlexion, right: rightAnkleFlexion },
        trunkFlexion,
        pelvisTilt
      },
      frontal: {
        hipAbduction,
        pelvicObliquity,
        trunkLateralFlexion
      }
    };
  }

  public calculateDetailedKinematics(): DetailedKinematics {
    if (this.frameHistory.length < 10) {
      return this.getEmptyKinematics();
    }

    this.forwardDirection = this.estimateForwardDirection();
    const includeSagittal = this.viewMode === 'lateral' || this.viewMode === 'dual';
    const includeFrontal = this.viewMode === 'frontal' || this.viewMode === 'dual';

    const createMutableSeries = () => ({
      timestamps: [] as number[],
      angles: [] as number[],
      frameIndices: [] as number[]
    });

    const sagittalSeries = {
      leftHip: createMutableSeries(),
      rightHip: createMutableSeries(),
      leftKnee: createMutableSeries(),
      rightKnee: createMutableSeries(),
      leftAnkle: createMutableSeries(),
      rightAnkle: createMutableSeries(),
      pelvisTilt: createMutableSeries(),
      trunkFlexion: createMutableSeries()
    };

    const frontalSeries = {
      leftHip: createMutableSeries(),
      rightHip: createMutableSeries(),
      pelvisObliquity: createMutableSeries(),
      trunkLateralFlexion: createMutableSeries()
    };

    this.frameHistory.forEach((frame, index) => {
      const frameAngles = this.calculateKinematicsForFrame(frame, index);
      const timestamp = frame.timestamp;

      if (includeSagittal) {
        this.pushValue(sagittalSeries.leftHip, frameAngles.sagittal.hipFlexion.left, timestamp, index);
        this.pushValue(sagittalSeries.rightHip, frameAngles.sagittal.hipFlexion.right, timestamp, index);
        this.pushValue(sagittalSeries.leftKnee, frameAngles.sagittal.kneeFlexion.left, timestamp, index);
        this.pushValue(sagittalSeries.rightKnee, frameAngles.sagittal.kneeFlexion.right, timestamp, index);
        this.pushValue(sagittalSeries.leftAnkle, frameAngles.sagittal.ankleFlexion.left, timestamp, index);
        this.pushValue(sagittalSeries.rightAnkle, frameAngles.sagittal.ankleFlexion.right, timestamp, index);
        this.pushValue(sagittalSeries.pelvisTilt, frameAngles.sagittal.pelvisTilt, timestamp, index);
        this.pushValue(sagittalSeries.trunkFlexion, frameAngles.sagittal.trunkFlexion, timestamp, index);
      }

      if (includeFrontal && frameAngles.frontal.hipAbduction) {
        this.pushValue(frontalSeries.leftHip, frameAngles.frontal.hipAbduction.left, timestamp, index);
        this.pushValue(frontalSeries.rightHip, frameAngles.frontal.hipAbduction.right, timestamp, index);
        this.pushValue(frontalSeries.pelvisObliquity, frameAngles.frontal.pelvicObliquity, timestamp, index);
        this.pushValue(frontalSeries.trunkLateralFlexion, frameAngles.frontal.trunkLateralFlexion, timestamp, index);
      }
    });

    const finalize = (series: { timestamps: number[]; angles: number[]; frameIndices: number[] }) =>
      series.angles.length > 0
        ? this.buildSeries(series.timestamps, series.angles, series.frameIndices)
        : this.createEmptySeries();

    const finalizeOrNull = (series: { timestamps: number[]; angles: number[]; frameIndices: number[] }) =>
      series.angles.length > 0 ? this.buildSeries(series.timestamps, series.angles, series.frameIndices) : null;

    return {
      ankle: {
        left: {
          dorsiplantarflexion: includeSagittal ? finalize(sagittalSeries.leftAnkle) : this.createEmptySeries(),
          inversionEversion: null
        },
        right: {
          dorsiplantarflexion: includeSagittal ? finalize(sagittalSeries.rightAnkle) : this.createEmptySeries(),
          inversionEversion: null
        }
      },
      knee: {
        left: {
          flexionExtension: includeSagittal ? finalize(sagittalSeries.leftKnee) : this.createEmptySeries(),
          abductionAdduction: null,
          rotation: null
        },
        right: {
          flexionExtension: includeSagittal ? finalize(sagittalSeries.rightKnee) : this.createEmptySeries(),
          abductionAdduction: null,
          rotation: null
        }
      },
      hip: {
        left: {
          flexionExtension: includeSagittal ? finalize(sagittalSeries.leftHip) : this.createEmptySeries(),
          abductionAdduction: includeFrontal ? finalizeOrNull(frontalSeries.leftHip) : null,
          rotation: null
        },
        right: {
          flexionExtension: includeSagittal ? finalize(sagittalSeries.rightHip) : this.createEmptySeries(),
          abductionAdduction: includeFrontal ? finalizeOrNull(frontalSeries.rightHip) : null,
          rotation: null
        }
      },
      pelvis: {
        tilt: includeSagittal ? finalizeOrNull(sagittalSeries.pelvisTilt) : null,
        obliquity: includeFrontal ? finalizeOrNull(frontalSeries.pelvisObliquity) : null,
        rotation: null
      },
      trunk: {
        flexionExtension: includeSagittal ? finalizeOrNull(sagittalSeries.trunkFlexion) : null,
        lateralFlexion: includeFrontal ? finalizeOrNull(frontalSeries.trunkLateralFlexion) : null,
        rotation: null
      }
    };
  }
  public generateKinematicSummary(kinematics: DetailedKinematics): KinematicSummary {
    const ankleStats = {
      left: this.getAngleStats(kinematics.ankle.left.dorsiplantarflexion),
      right: this.getAngleStats(kinematics.ankle.right.dorsiplantarflexion)
    };
    const kneeStats = {
      left: this.getAngleStats(kinematics.knee.left.flexionExtension),
      right: this.getAngleStats(kinematics.knee.right.flexionExtension)
    };
    const hipStats = {
      left: this.getAngleStats(kinematics.hip.left.flexionExtension),
      right: this.getAngleStats(kinematics.hip.right.flexionExtension)
    };

    const hipAbductionStats = kinematics.hip.left.abductionAdduction && kinematics.hip.right.abductionAdduction
      ? {
          left: this.getAngleStats(kinematics.hip.left.abductionAdduction),
          right: this.getAngleStats(kinematics.hip.right.abductionAdduction)
        }
      : null;

    const trunkStats = kinematics.trunk.flexionExtension
      ? this.getAngleStats(kinematics.trunk.flexionExtension)
      : null;

    const pelvisObliquityStats = kinematics.pelvis.obliquity
      ? this.getAngleStats(kinematics.pelvis.obliquity)
      : null;

    const ankleROM = {
      left: {
        dorsiflexion: Math.max(0, ankleStats.left.max),
        plantarflexion: Math.abs(Math.min(0, ankleStats.left.min))
      },
      right: {
        dorsiflexion: Math.max(0, ankleStats.right.max),
        plantarflexion: Math.abs(Math.min(0, ankleStats.right.min))
      }
    };

    const kneeROM = {
      left: {
        flexion: Math.max(0, kneeStats.left.max),
        extension: Math.abs(Math.min(0, kneeStats.left.min))
      },
      right: {
        flexion: Math.max(0, kneeStats.right.max),
        extension: Math.abs(Math.min(0, kneeStats.right.min))
      }
    };

    const hipROM = {
      left: {
        flexion: Math.max(0, hipStats.left.max),
        extension: Math.abs(Math.min(0, hipStats.left.min))
      },
      right: {
        flexion: Math.max(0, hipStats.right.max),
        extension: Math.abs(Math.min(0, hipStats.right.min))
      }
    };

    const peakValues = {
      maxAnkleDF: { left: ankleStats.left.max, right: ankleStats.right.max },
      maxAnklePF: { left: Math.abs(ankleStats.left.min), right: Math.abs(ankleStats.right.min) },
      maxKneeFlex: { left: kneeStats.left.max, right: kneeStats.right.max },
      maxHipExt: { left: Math.abs(hipStats.left.min), right: Math.abs(hipStats.right.min) },
      maxHipFlex: { left: hipStats.left.max, right: hipStats.right.max }
    };

    const peakTiming = {
      maxAnkleDFTiming: {
        left: this.calculatePeakTiming(kinematics.ankle.left.dorsiplantarflexion, ankleStats.left.maxIndex),
        right: this.calculatePeakTiming(kinematics.ankle.right.dorsiplantarflexion, ankleStats.right.maxIndex)
      },
      maxKneeFlexTiming: {
        left: this.calculatePeakTiming(kinematics.knee.left.flexionExtension, kneeStats.left.maxIndex),
        right: this.calculatePeakTiming(kinematics.knee.right.flexionExtension, kneeStats.right.maxIndex)
      },
      maxHipExtTiming: {
        left: this.calculatePeakTiming(kinematics.hip.left.flexionExtension, hipStats.left.minIndex),
        right: this.calculatePeakTiming(kinematics.hip.right.flexionExtension, hipStats.right.minIndex)
      }
    };

    const angleAggregates = {
      hipFlexion: this.buildAngleAggregate(hipStats),
      kneeFlexion: this.buildAngleAggregate(kneeStats),
      ankleFlexion: this.buildAngleAggregate(ankleStats),
      hipAbduction: hipAbductionStats ? this.buildAngleAggregate(hipAbductionStats) : null,
      trunkFlexion: trunkStats ? this.buildSingleAggregate(trunkStats) : null,
      pelvicObliquity: pelvisObliquityStats ? this.buildSingleAggregate(pelvisObliquityStats) : null
    };

    const kinematicData = this.buildKinematicData(kinematics);
    const deviations = this.identifyKinematicDeviations(ankleStats, kneeStats, hipStats, kinematicData);
    const kinematicQualityScore = this.calculateKinematicQualityScore(deviations);

    return {
      ankleROM,
      kneeROM,
      hipROM,
      peakValues,
      peakTiming,
      angleAggregates,
      deviations,
      kinematicQualityScore,
      kinematicData
    };
  }

  public generateKinematicReport(summary: KinematicSummary): string {
    let report = '## Analisis Cinematico Detallado\\n\\n';
    report += `**Puntuacion Cinematica Global:** ${summary.kinematicQualityScore}/100\\n\\n`;
    report += '### Rangos de Movimiento (ROM)\\n';
    report += `**Tobillo Izquierdo:** DF ${summary.ankleROM.left.dorsiflexion.toFixed(1)} deg / PF ${summary.ankleROM.left.plantarflexion.toFixed(1)} deg\\n`;
    report += `**Tobillo Derecho:** DF ${summary.ankleROM.right.dorsiflexion.toFixed(1)} deg / PF ${summary.ankleROM.right.plantarflexion.toFixed(1)} deg\\n`;
    report += `**Rodilla Izquierda:** Flexion ${summary.kneeROM.left.flexion.toFixed(1)} deg\\n`;
    report += `**Rodilla Derecha:** Flexion ${summary.kneeROM.right.flexion.toFixed(1)} deg\\n`;
    report += `**Cadera Izquierda:** Flexion ${summary.hipROM.left.flexion.toFixed(1)} deg / Extension ${summary.hipROM.left.extension.toFixed(1)} deg\\n`;
    report += `**Cadera Derecha:** Flexion ${summary.hipROM.right.flexion.toFixed(1)} deg / Extension ${summary.hipROM.right.extension.toFixed(1)} deg\\n\\n`;
    report += '### Valores Pico\\n';
    report += `**Flexion maxima de rodilla:** Izq ${summary.peakValues.maxKneeFlex.left.toFixed(1)} deg / Der ${summary.peakValues.maxKneeFlex.right.toFixed(1)} deg\\n`;
    report += `**Extension maxima de cadera:** Izq ${summary.peakValues.maxHipExt.left.toFixed(1)} deg / Der ${summary.peakValues.maxHipExt.right.toFixed(1)} deg\\n`;
    report += `**Dorsiflexion maxima:** Izq ${summary.peakValues.maxAnkleDF.left.toFixed(1)} deg / Der ${summary.peakValues.maxAnkleDF.right.toFixed(1)} deg\\n\\n`;
    if (summary.deviations.length > 0) {
      report += '### Desviaciones Cinematicas\\n';
      summary.deviations.forEach(deviation => {
        report += `- **${deviation.joint.toUpperCase()} ${deviation.side.toUpperCase()}:** ${deviation.deviation} (${deviation.severity})\\n`;
        report += `  ${deviation.description}\\n`;
        report += `  *${deviation.clinicalImplication}*\\n\\n`;
      });
    }
    return report;
  }

  private pushValue(series: { timestamps: number[]; angles: number[]; frameIndices: number[] }, value: number | null, timestamp: number, index: number): void {
    if (value === null || !Number.isFinite(value)) {
      return;
    }
    series.timestamps.push(timestamp);
    series.angles.push(value);
    series.frameIndices.push(index);
  }

  private buildAngleAggregate(stats: { left: AngleStats; right: AngleStats }): AngleAggregate {
    return {
      left: {
        peak: stats.left.max,
        mean: stats.left.mean,
        rom: stats.left.rom
      },
      right: {
        peak: stats.right.max,
        mean: stats.right.mean,
        rom: stats.right.rom
      }
    };
  }

  private buildSingleAggregate(stats: AngleStats): SingleAngleAggregate {
    return {
      peak: stats.max,
      mean: stats.mean,
      rom: stats.rom
    };
  }

  public clearHistory(): void {
    this.frameHistory = [];
    this.forwardDirection = 1;
  }

  private applySagittalSign(angle: number, proximal: PoseFrame['leftHip'], distal: PoseFrame['leftHip']): number {
    const sign = (distal.x - proximal.x) * this.forwardDirection >= 0 ? 1 : -1;
    return angle * sign;
  }

  private applyFrontalSign(angle: number, side: 'left' | 'right', hip: PoseFrame['leftHip'], knee: PoseFrame['leftHip']): number {
    const lateral = side === 'left' ? hip.x - knee.x : knee.x - hip.x;
    const sign = lateral >= 0 ? 1 : -1;
    return angle * sign;
  }

  private computePelvicObliquity(leftHip: PoseFrame['leftHip'], rightHip: PoseFrame['leftHip']): number | null {
    if (!this.hasVisibility(leftHip, rightHip)) {
      return null;
    }
    const angleRad = Math.atan2(leftHip.y - rightHip.y, leftHip.x - rightHip.x);
    return this.normalizeDegrees(angleRad * RAD_TO_DEG);
  }

  private computeTrunkFlexionAngle(shoulder: Vector2D, pelvis: Vector2D): number {
    const verticalRef: Vector2D = { x: 0, y: -1 };
    const trunk: Vector2D = { x: shoulder.x - pelvis.x, y: shoulder.y - pelvis.y };
    const angle = this.signedAngle(verticalRef, trunk) * RAD_TO_DEG;
    return -angle;
  }

  private computeTrunkLateralAngle(shoulder: Vector2D, pelvis: Vector2D): number {
    const verticalRef: Vector2D = { x: 0, y: -1 };
    const trunk: Vector2D = { x: shoulder.x - pelvis.x, y: shoulder.y - pelvis.y };
    return this.signedAngle(verticalRef, trunk) * RAD_TO_DEG;
  }

  private computePelvisTiltAngle(shoulder: Vector2D, pelvis: Vector2D): number {
    const verticalRef: Vector2D = { x: 0, y: -1 };
    const pelvisVector: Vector2D = { x: shoulder.x - pelvis.x, y: shoulder.y - pelvis.y };
    const angle = this.signedAngle(verticalRef, pelvisVector) * RAD_TO_DEG;
    return -angle;
  }

  private estimateForwardDirection(): number {
    if (this.frameHistory.length < 2) {
      return this.forwardDirection || 1;
    }
    const first = this.frameHistory[0];
    const last = this.frameHistory[this.frameHistory.length - 1];
    const start = this.getPelvisCenter(first).x;
    const end = this.getPelvisCenter(last).x;
    const delta = end - start;
    if (Math.abs(delta) < 0.005) {
      return this.forwardDirection || 1;
    }
    return delta >= 0 ? 1 : -1;
  }


  private calculateVelocity(angles: number[], timestamps: number[]): number[] {
    if (angles.length === 0) {
      return [];
    }
    const velocity = new Array(angles.length).fill(0);
    for (let i = 1; i < angles.length; i++) {
      const dt = timestamps[i] - timestamps[i - 1];
      if (dt > 0) {
        velocity[i] = (angles[i] - angles[i - 1]) / dt;
      } else {
        velocity[i] = velocity[i - 1];
      }
    }
    return velocity;
  }

  private calculateAcceleration(velocity: number[], timestamps: number[]): number[] {
    if (velocity.length === 0) {
      return [];
    }
    const acceleration = new Array(velocity.length).fill(0);
    for (let i = 1; i < velocity.length; i++) {
      const dt = timestamps[i] - timestamps[i - 1];
      if (dt > 0) {
        acceleration[i] = (velocity[i] - velocity[i - 1]) / dt;
      } else {
        acceleration[i] = acceleration[i - 1];
      }
    }
    return acceleration;
  }

  private getAngleStats(series: JointAngleTimeSeries): AngleStats {
    if (series.angles.length === 0) {
      return { max: 0, min: 0, maxIndex: 0, minIndex: 0, mean: 0, stdDev: 0, rom: 0 };
    }
    let max = -Infinity;
    let min = Infinity;
    let sum = 0;
    let maxIndex = 0;
    let minIndex = 0;
    series.angles.forEach((value, index) => {
      if (value > max) {
        max = value;
        maxIndex = index;
      }
      if (value < min) {
        min = value;
        minIndex = index;
      }
      sum += value;
    });
    const mean = sum / series.angles.length;
    const variance = series.angles.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / series.angles.length;
    const stdDev = Math.sqrt(variance);
    return { max, min, maxIndex, minIndex, mean, stdDev, rom: max - min };
  }

  private calculatePeakTiming(series: JointAngleTimeSeries, index: number): number {
    if (series.angles.length === 0 || series.angles.length === 1) {
      return 0;
    }
    const clamped = Math.max(0, Math.min(index, series.angles.length - 1));
    return (clamped / (series.angles.length - 1)) * 100;
  }
  private buildKinematicData(kinematics: DetailedKinematics): KinematicData {
    const sagittal = {
      hipFlexion: this.buildBilateralKinematics(
        kinematics.hip.left.flexionExtension,
        kinematics.hip.right.flexionExtension,
        KinematicAnalyzer.NORMAL_RANGES.hip.flexion
      ),
      kneeFlexion: this.buildBilateralKinematics(
        kinematics.knee.left.flexionExtension,
        kinematics.knee.right.flexionExtension,
        KinematicAnalyzer.NORMAL_RANGES.knee.flexion
      ),
      ankleFlexion: this.buildBilateralKinematics(
        kinematics.ankle.left.dorsiplantarflexion,
        kinematics.ankle.right.dorsiplantarflexion,
        KinematicAnalyzer.NORMAL_RANGES.ankle.dorsiflexion
      ),
      pelvisTilt: this.buildAxialKinematics(kinematics.pelvis.tilt, KinematicAnalyzer.NORMAL_RANGES.pelvis.tilt),
      trunkFlexion: this.buildAxialKinematics(kinematics.trunk.flexionExtension, null)
    };
    const frontal = {
      hipAbduction: this.buildBilateralKinematics(
        kinematics.hip.left.abductionAdduction,
        kinematics.hip.right.abductionAdduction,
        KinematicAnalyzer.FRONTAL_NORMAL_RANGES.hipAbduction
      ),
      kneeAbduction: this.buildBilateralKinematics(
        kinematics.knee.left.abductionAdduction,
        kinematics.knee.right.abductionAdduction,
        KinematicAnalyzer.FRONTAL_NORMAL_RANGES.kneeAbduction
      ),
      ankleInversion: this.buildBilateralKinematics(
        kinematics.ankle.left.inversionEversion,
        kinematics.ankle.right.inversionEversion,
        KinematicAnalyzer.FRONTAL_NORMAL_RANGES.ankleInversion
      ),
      pelvisObliquity: this.buildAxialKinematics(kinematics.pelvis.obliquity, KinematicAnalyzer.FRONTAL_NORMAL_RANGES.pelvisObliquity),
      trunkLateralFlexion: this.buildAxialKinematics(kinematics.trunk.lateralFlexion, KinematicAnalyzer.FRONTAL_NORMAL_RANGES.trunkLateralFlexion)
    };
    return { sagittal, frontal };
  }

  private buildBilateralKinematics(
    leftSeries: JointAngleTimeSeries | null,
    rightSeries: JointAngleTimeSeries | null,
    normalRange: { min: number; max: number } | null
  ): BilateralKinematicData {
    const left = this.buildSideKinematics(leftSeries, 'left', normalRange);
    const right = this.buildSideKinematics(rightSeries, 'right', normalRange);
    const asymmetry = left.summary && right.summary
      ? Math.abs((left.summary.peak?.value ?? 0) - (right.summary.peak?.value ?? 0))
      : null;
    return { left, right, asymmetry };
  }

  private buildSideKinematics(
    series: JointAngleTimeSeries | null,
    side: 'left' | 'right',
    normalRange: { min: number; max: number } | null
  ): SideKinematicData {
    if (!series || series.angles.length === 0) {
      return { series: null, summary: null };
    }
    const stats = this.getAngleStats(series);
    const summary: KinematicJointSummary = {
      peak: this.createMoment(series, stats.maxIndex, stats.max, side),
      minimum: this.createMoment(series, stats.minIndex, stats.min, side),
      maximum: this.createMoment(series, stats.maxIndex, stats.max, side),
      rom: stats.rom,
      mean: stats.mean,
      standardDeviation: stats.stdDev,
      normalRange
    };
    return {
      series: this.toKinematicTimeSeries(series),
      summary
    };
  }

  private buildAxialKinematics(
    series: JointAngleTimeSeries | null,
    normalRange: { min: number; max: number } | null
  ): AxialKinematicData | null {
    if (!series || series.angles.length === 0) {
      return null;
    }
    const stats = this.getAngleStats(series);
    const summary: KinematicJointSummary = {
      peak: this.createMoment(series, stats.maxIndex, stats.max, 'bilateral'),
      minimum: this.createMoment(series, stats.minIndex, stats.min, 'bilateral'),
      maximum: this.createMoment(series, stats.maxIndex, stats.max, 'bilateral'),
      rom: stats.rom,
      mean: stats.mean,
      standardDeviation: stats.stdDev,
      normalRange
    };
    return {
      series: this.toKinematicTimeSeries(series),
      summary
    };
  }

  private toKinematicTimeSeries(series: JointAngleTimeSeries): JointAngleTimeSeries {
    return {
      timestamps: [...series.timestamps],
      angles: [...series.angles],
      frameIndices: [...series.frameIndices],
      velocity: [...series.velocity],
      acceleration: [...series.acceleration]
    };
  }

  private createMoment(
    series: JointAngleTimeSeries,
    index: number,
    value: number,
    side: 'left' | 'right' | 'bilateral'
  ): KinematicValueMoment {
    const clamped = Math.max(0, Math.min(index, series.timestamps.length - 1));
    return {
      value,
      timestamp: series.timestamps[clamped] ?? null,
      frameIndex: series.frameIndices[clamped] ?? null,
      side
    };
  }
  private identifyKinematicDeviations(
    ankleStats: { left: AngleStats; right: AngleStats },
    kneeStats: { left: AngleStats; right: AngleStats },
    hipStats: { left: AngleStats; right: AngleStats },
    kinematicData: KinematicData
  ): KinematicDeviation[] {
    const deviations: KinematicDeviation[] = [];

    const ankleRange = KinematicAnalyzer.NORMAL_RANGES.ankle.dorsiflexion;
    if (ankleStats.left.max < ankleRange.min) {
      deviations.push({
        joint: 'ankle',
        side: 'left',
        plane: 'sagittal',
        deviation: 'Limited dorsiflexion',
        severity: ankleStats.left.max < 5 ? 'severe' : 'moderate',
        description: `Dorsiflexion limitada: ${ankleStats.left.max.toFixed(1)} deg`,
        clinicalImplication: 'Puede indicar contractura o debilidad del tibial anterior',
        normalRange: ankleRange,
        observedValue: ankleStats.left.max
      });
    }
    if (ankleStats.right.max < ankleRange.min) {
      deviations.push({
        joint: 'ankle',
        side: 'right',
        plane: 'sagittal',
        deviation: 'Limited dorsiflexion',
        severity: ankleStats.right.max < 5 ? 'severe' : 'moderate',
        description: `Dorsiflexion limitada: ${ankleStats.right.max.toFixed(1)} deg`,
        clinicalImplication: 'Puede indicar contractura o debilidad del tibial anterior',
        normalRange: ankleRange,
        observedValue: ankleStats.right.max
      });
    }

    const kneeRange = KinematicAnalyzer.NORMAL_RANGES.knee.flexion;
    if (kneeStats.left.max < kneeRange.min) {
      deviations.push({
        joint: 'knee',
        side: 'left',
        plane: 'sagittal',
        deviation: 'Reduced knee flexion',
        severity: kneeStats.left.max < 45 ? 'severe' : 'moderate',
        description: `Flexion reducida de rodilla: ${kneeStats.left.max.toFixed(1)} deg`,
        clinicalImplication: 'Puede indicar rigidez articular o patron de marcha en extension',
        normalRange: kneeRange,
        observedValue: kneeStats.left.max
      });
    }
    if (kneeStats.right.max < kneeRange.min) {
      deviations.push({
        joint: 'knee',
        side: 'right',
        plane: 'sagittal',
        deviation: 'Reduced knee flexion',
        severity: kneeStats.right.max < 45 ? 'severe' : 'moderate',
        description: `Flexion reducida de rodilla: ${kneeStats.right.max.toFixed(1)} deg`,
        clinicalImplication: 'Puede indicar rigidez articular o patron de marcha en extension',
        normalRange: kneeRange,
        observedValue: kneeStats.right.max
      });
    }

    const hipExtRange = KinematicAnalyzer.NORMAL_RANGES.hip.extension;
    if (Math.abs(hipStats.left.min) < hipExtRange.min) {
      deviations.push({
        joint: 'hip',
        side: 'left',
        plane: 'sagittal',
        deviation: 'Limited hip extension',
        severity: Math.abs(hipStats.left.min) < 5 ? 'severe' : 'moderate',
        description: `Extension limitada de cadera: ${Math.abs(hipStats.left.min).toFixed(1)} deg`,
        clinicalImplication: 'Puede indicar contractura en flexion o debilidad de gluteos',
        normalRange: hipExtRange,
        observedValue: Math.abs(hipStats.left.min)
      });
    }
    if (Math.abs(hipStats.right.min) < hipExtRange.min) {
      deviations.push({
        joint: 'hip',
        side: 'right',
        plane: 'sagittal',
        deviation: 'Limited hip extension',
        severity: Math.abs(hipStats.right.min) < 5 ? 'severe' : 'moderate',
        description: `Extension limitada de cadera: ${Math.abs(hipStats.right.min).toFixed(1)} deg`,
        clinicalImplication: 'Puede indicar contractura en flexion o debilidad de gluteos',
        normalRange: hipExtRange,
        observedValue: Math.abs(hipStats.right.min)
      });
    }

    const frontalData = kinematicData.frontal.hipAbduction;
    if (frontalData?.left?.summary && Math.abs(frontalData.left.summary.peak?.value ?? 0) > KinematicAnalyzer.FRONTAL_NORMAL_RANGES.hipAbduction.max) {
      deviations.push({
        joint: 'hip',
        side: 'left',
        plane: 'frontal',
        deviation: 'Exceso de abduccion/adduccion',
        severity: Math.abs(frontalData.left.summary.peak?.value ?? 0) > 15 ? 'severe' : 'moderate',
        description: `Alteracion frontal de cadera: ${(frontalData.left.summary.peak?.value ?? 0).toFixed(1)} deg`,
        clinicalImplication: 'Puede asociarse a patron de Trendelenburg o a marcha en tijera',
        normalRange: KinematicAnalyzer.FRONTAL_NORMAL_RANGES.hipAbduction,
        observedValue: frontalData.left.summary.peak?.value ?? 0
      });
    }
    if (frontalData?.right?.summary && Math.abs(frontalData.right.summary.peak?.value ?? 0) > KinematicAnalyzer.FRONTAL_NORMAL_RANGES.hipAbduction.max) {
      deviations.push({
        joint: 'hip',
        side: 'right',
        plane: 'frontal',
        deviation: 'Exceso de abduccion/adduccion',
        severity: Math.abs(frontalData.right.summary.peak?.value ?? 0) > 15 ? 'severe' : 'moderate',
        description: `Alteracion frontal de cadera: ${(frontalData.right.summary.peak?.value ?? 0).toFixed(1)} deg`,
        clinicalImplication: 'Puede asociarse a patron de Trendelenburg o a marcha en tijera',
        normalRange: KinematicAnalyzer.FRONTAL_NORMAL_RANGES.hipAbduction,
        observedValue: frontalData.right.summary.peak?.value ?? 0
      });
    }

    return deviations;
  }

  private calculateKinematicQualityScore(deviations: KinematicDeviation[]): number {
    let score = 100;
    deviations.forEach(deviation => {
      if (deviation.severity === 'mild') {
        score -= 5;
      } else if (deviation.severity === 'moderate') {
        score -= 15;
      } else {
        score -= 25;
      }
    });
    return Math.max(0, score);
  }
  private hasVisibility(...landmarks: PoseFrame['leftHip'][]): boolean {
    return landmarks.every(landmark => landmark.visibility >= KinematicAnalyzer.VISIBILITY_THRESHOLD);
  }

  private signedAngle(a: Vector2D, b: Vector2D): number {
    const dot = a.x * b.x + a.y * b.y;
    const det = a.x * b.y - a.y * b.x;
    return Math.atan2(det, dot);
  }

  private normalizeDegrees(angle: number): number {
    let normalized = angle;
    while (normalized > 180) {
      normalized -= 360;
    }
    while (normalized < -180) {
      normalized += 360;
    }
    return normalized;
  }

  private getPelvisCenter(frame: PoseFrame): Vector2D {
    return {
      x: (frame.leftHip.x + frame.rightHip.x) / 2,
      y: (frame.leftHip.y + frame.rightHip.y) / 2
    };
  }

  private getShoulderCenter(frame: PoseFrame): Vector2D | null {
    if (!this.hasVisibility(frame.leftShoulder, frame.rightShoulder)) {
      return null;
    }
    return {
      x: (frame.leftShoulder.x + frame.rightShoulder.x) / 2,
      y: (frame.leftShoulder.y + frame.rightShoulder.y) / 2
    };
  }

  private getEmptyKinematics(): DetailedKinematics {
    const emptySeries = this.createEmptySeries();
    return {
      ankle: {
        left: { dorsiplantarflexion: emptySeries, inversionEversion: null },
        right: { dorsiplantarflexion: emptySeries, inversionEversion: null }
      },
      knee: {
        left: { flexionExtension: emptySeries, abductionAdduction: null, rotation: null },
        right: { flexionExtension: emptySeries, abductionAdduction: null, rotation: null }
      },
      hip: {
        left: { flexionExtension: emptySeries, abductionAdduction: null, rotation: null },
        right: { flexionExtension: emptySeries, abductionAdduction: null, rotation: null }
      },
      pelvis: { tilt: null, obliquity: null, rotation: null },
      trunk: { flexionExtension: null, lateralFlexion: null, rotation: null }
    };
  }
}

