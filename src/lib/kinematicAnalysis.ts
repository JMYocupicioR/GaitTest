import type { PoseFrame } from './poseEstimation.ts';
import type { ViewMode } from '../types/session.ts';

export interface JointAngleTimeSeries {
  timestamps: number[];
  angles: number[];
  velocity: number[];
  acceleration: number[];
}

export interface DetailedKinematics {
  // Ankle kinematics
  ankle: {
    left: {
      dorsiplantarflexion: JointAngleTimeSeries;
      inversionEversion: JointAngleTimeSeries | null; // Only available in frontal view
    };
    right: {
      dorsiplantarflexion: JointAngleTimeSeries;
      inversionEversion: JointAngleTimeSeries | null;
    };
  };

  // Knee kinematics
  knee: {
    left: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null; // Frontal view
      rotation: JointAngleTimeSeries | null; // Complex calculation
    };
    right: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null;
      rotation: JointAngleTimeSeries | null;
    };
  };

  // Hip kinematics
  hip: {
    left: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null;
      rotation: JointAngleTimeSeries | null;
    };
    right: {
      flexionExtension: JointAngleTimeSeries;
      abductionAdduction: JointAngleTimeSeries | null;
      rotation: JointAngleTimeSeries | null;
    };
  };

  // Pelvis kinematics (frontal view primarily)
  pelvis: {
    tilt: JointAngleTimeSeries | null;
    obliquity: JointAngleTimeSeries | null;
    rotation: JointAngleTimeSeries | null;
  };

  // Trunk kinematics
  trunk: {
    flexionExtension: JointAngleTimeSeries | null;
    lateralFlexion: JointAngleTimeSeries | null;
    rotation: JointAngleTimeSeries | null;
  };
}

export interface KinematicSummary {
  // Range of motion (ROM) analysis
  ankleROM: {
    left: { dorsiflexion: number; plantarflexion: number };
    right: { dorsiflexion: number; plantarflexion: number };
  };
  kneeROM: {
    left: { flexion: number; extension: number };
    right: { flexion: number; extension: number };
  };
  hipROM: {
    left: { flexion: number; extension: number };
    right: { flexion: number; extension: number };
  };

  // Peak values during gait cycle
  peakValues: {
    maxAnkleDF: { left: number; right: number };
    maxAnklePF: { left: number; right: number };
    maxKneeFlex: { left: number; right: number };
    maxHipExt: { left: number; right: number };
    maxHipFlex: { left: number; right: number };
  };

  // Timing of peak values (% of gait cycle)
  peakTiming: {
    maxAnkleDFTiming: { left: number; right: number };
    maxKneeFlexTiming: { left: number; right: number };
    maxHipExtTiming: { left: number; right: number };
  };

  // Kinematic deviations
  deviations: KinematicDeviation[];

  // Overall kinematic quality score
  kinematicQualityScore: number;
}

export interface KinematicDeviation {
  joint: 'ankle' | 'knee' | 'hip' | 'pelvis' | 'trunk';
  side: 'left' | 'right' | 'bilateral';
  plane: 'sagittal' | 'frontal' | 'transverse';
  deviation: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  clinicalImplication: string;
  normalRange: { min: number; max: number };
  observedValue: number;
}

export class KinematicAnalyzer {
  private frameHistory: PoseFrame[] = [];
  private viewMode: ViewMode = 'lateral';

  // Clinical reference ranges (Perry & Burnfield, 2010)
  private static readonly NORMAL_RANGES = {
    ankle: {
      dorsiflexion: { min: 10, max: 20 }, // degrees
      plantarflexion: { min: 15, max: 25 }
    },
    knee: {
      flexion: { min: 60, max: 70 }, // peak during swing
      extension: { min: -5, max: 5 } // near full extension at heel strike
    },
    hip: {
      flexion: { min: 25, max: 35 }, // peak during swing
      extension: { min: 10, max: 20 } // peak during stance
    },
    pelvis: {
      tilt: { min: -5, max: 5 }, // degrees anterior/posterior
      obliquity: { min: -3, max: 3 }, // degrees up/down
      rotation: { min: -8, max: 8 } // degrees internal/external
    }
  };

  constructor(viewMode: ViewMode = 'lateral') {
    this.viewMode = viewMode;
  }

  public processFrame(frame: PoseFrame): void {
    this.frameHistory.push(frame);

    // Keep reasonable history for analysis (300 frames = ~5 seconds at 60fps)
    if (this.frameHistory.length > 300) {
      this.frameHistory.shift();
    }
  }

  public calculateDetailedKinematics(): DetailedKinematics {
    if (this.frameHistory.length < 10) {
      return this.getEmptyKinematics();
    }

    return {
      ankle: {
        left: {
          dorsiplantarflexion: this.calculateAnkleDorsiflexion('left'),
          inversionEversion: this.viewMode === 'frontal' ? this.calculateAnkleInversion('left') : null
        },
        right: {
          dorsiplantarflexion: this.calculateAnkleDorsiflexion('right'),
          inversionEversion: this.viewMode === 'frontal' ? this.calculateAnkleInversion('right') : null
        }
      },
      knee: {
        left: {
          flexionExtension: this.calculateKneeFlexion('left'),
          abductionAdduction: this.viewMode === 'frontal' ? this.calculateKneeAbduction('left') : null,
          rotation: null // Complex calculation not implemented
        },
        right: {
          flexionExtension: this.calculateKneeFlexion('right'),
          abductionAdduction: this.viewMode === 'frontal' ? this.calculateKneeAbduction('right') : null,
          rotation: null
        }
      },
      hip: {
        left: {
          flexionExtension: this.calculateHipFlexion('left'),
          abductionAdduction: this.viewMode === 'frontal' ? this.calculateHipAbduction('left') : null,
          rotation: null
        },
        right: {
          flexionExtension: this.calculateHipFlexion('right'),
          abductionAdduction: this.viewMode === 'frontal' ? this.calculateHipAbduction('right') : null,
          rotation: null
        }
      },
      pelvis: {
        tilt: this.viewMode === 'lateral' ? this.calculatePelvicTilt() : null,
        obliquity: this.viewMode === 'frontal' ? this.calculatePelvicObliquity() : null,
        rotation: null
      },
      trunk: {
        flexionExtension: this.viewMode === 'lateral' ? this.calculateTrunkFlexion() : null,
        lateralFlexion: this.viewMode === 'frontal' ? this.calculateTrunkLateralFlexion() : null,
        rotation: null
      }
    };
  }

  private calculateAnkleDorsiflexion(side: 'left' | 'right'): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      const hip = side === 'left' ? frame.leftHip : frame.rightHip;
      const knee = side === 'left' ? frame.leftKnee : frame.rightKnee;
      const ankle = side === 'left' ? frame.leftAnkle : frame.rightAnkle;

      if (hip.visibility > 0.7 && knee.visibility > 0.7 && ankle.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate ankle angle in sagittal plane
        const shankVector = { x: ankle.x - knee.x, y: ankle.y - knee.y };
        const footVector = { x: 1, y: 0 }; // Approximation - foot assumed horizontal

        let angle = Math.atan2(
          shankVector.x * footVector.y - shankVector.y * footVector.x,
          shankVector.x * footVector.x + shankVector.y * footVector.y
        ) * 180 / Math.PI;

        // Normalize to dorsiflexion/plantarflexion
        angle = 90 - Math.abs(angle);
        angles.push(angle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateAnkleInversion(side: 'left' | 'right'): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      const knee = side === 'left' ? frame.leftKnee : frame.rightKnee;
      const ankle = side === 'left' ? frame.leftAnkle : frame.rightAnkle;

      if (knee.visibility > 0.7 && ankle.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate frontal plane ankle angle (simplified)
        const angle = Math.atan2(ankle.x - knee.x, ankle.y - knee.y) * 180 / Math.PI;
        angles.push(angle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateKneeFlexion(side: 'left' | 'right'): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      const hip = side === 'left' ? frame.leftHip : frame.rightHip;
      const knee = side === 'left' ? frame.leftKnee : frame.rightKnee;
      const ankle = side === 'left' ? frame.leftAnkle : frame.rightAnkle;

      if (hip.visibility > 0.7 && knee.visibility > 0.7 && ankle.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate knee flexion angle
        const thighVector = { x: knee.x - hip.x, y: knee.y - hip.y };
        const shankVector = { x: ankle.x - knee.x, y: ankle.y - knee.y };

        let angle = Math.atan2(
          thighVector.x * shankVector.y - thighVector.y * shankVector.x,
          thighVector.x * shankVector.x + thighVector.y * shankVector.y
        ) * 180 / Math.PI;

        // Convert to flexion angle (0 = full extension, positive = flexion)
        angle = Math.abs(angle);
        if (angle > 180) angle = 360 - angle;

        angles.push(angle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateKneeAbduction(side: 'left' | 'right'): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      const hip = side === 'left' ? frame.leftHip : frame.rightHip;
      const knee = side === 'left' ? frame.leftKnee : frame.rightKnee;
      const ankle = side === 'left' ? frame.leftAnkle : frame.rightAnkle;

      if (hip.visibility > 0.7 && knee.visibility > 0.7 && ankle.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate frontal plane knee angle
        const thighVector = { x: knee.x - hip.x, y: knee.y - hip.y };
        const shankVector = { x: ankle.x - knee.x, y: ankle.y - knee.y };

        const angle = Math.atan2(
          thighVector.x * shankVector.y - thighVector.y * shankVector.x,
          thighVector.x * shankVector.x + thighVector.y * shankVector.y
        ) * 180 / Math.PI;

        angles.push(Math.abs(angle));
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateHipFlexion(side: 'left' | 'right'): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      const hip = side === 'left' ? frame.leftHip : frame.rightHip;
      const knee = side === 'left' ? frame.leftKnee : frame.rightKnee;

      if (hip.visibility > 0.7 && knee.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate hip flexion relative to vertical
        const verticalRef = { x: 0, y: -1 }; // Vertical reference
        const thighVector = { x: knee.x - hip.x, y: knee.y - hip.y };

        let angle = Math.atan2(
          verticalRef.x * thighVector.y - verticalRef.y * thighVector.x,
          verticalRef.x * thighVector.x + verticalRef.y * thighVector.y
        ) * 180 / Math.PI;

        // Normalize to hip flexion (positive = flexion, negative = extension)
        angles.push(angle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateHipAbduction(side: 'left' | 'right'): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      const hip = side === 'left' ? frame.leftHip : frame.rightHip;
      const knee = side === 'left' ? frame.leftKnee : frame.rightKnee;

      if (hip.visibility > 0.7 && knee.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate hip abduction/adduction in frontal plane
        const verticalRef = { x: 0, y: 1 }; // Vertical reference
        const thighVector = { x: knee.x - hip.x, y: knee.y - hip.y };

        const angle = Math.atan2(
          verticalRef.x * thighVector.y - verticalRef.y * thighVector.x,
          verticalRef.x * thighVector.x + verticalRef.y * thighVector.y
        ) * 180 / Math.PI;

        angles.push(Math.abs(angle));
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculatePelvicTilt(): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate pelvic tilt (anterior/posterior)
        const pelvicLine = {
          x: frame.rightHip.x - frame.leftHip.x,
          y: frame.rightHip.y - frame.leftHip.y
        };

        const horizontalRef = { x: 1, y: 0 };

        const angle = Math.atan2(
          horizontalRef.x * pelvicLine.y - horizontalRef.y * pelvicLine.x,
          horizontalRef.x * pelvicLine.x + horizontalRef.y * pelvicLine.y
        ) * 180 / Math.PI;

        angles.push(angle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculatePelvicObliquity(): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate pelvic obliquity (up/down tilt)
        const angle = Math.atan2(
          frame.rightHip.y - frame.leftHip.y,
          frame.rightHip.x - frame.leftHip.x
        ) * 180 / Math.PI;

        angles.push(angle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateTrunkFlexion(): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Estimate trunk flexion (simplified - would need shoulder landmarks for accuracy)
        const hipCenter = {
          x: (frame.leftHip.x + frame.rightHip.x) / 2,
          y: (frame.leftHip.y + frame.rightHip.y) / 2
        };

        // Approximate shoulder position
        const shoulderEstimate = {
          x: hipCenter.x,
          y: hipCenter.y - 0.3 // Estimated trunk length
        };

        const trunkVector = {
          x: shoulderEstimate.x - hipCenter.x,
          y: shoulderEstimate.y - hipCenter.y
        };

        const verticalRef = { x: 0, y: -1 };

        const angle = Math.atan2(
          verticalRef.x * trunkVector.y - verticalRef.y * trunkVector.x,
          verticalRef.x * trunkVector.x + verticalRef.y * trunkVector.y
        ) * 180 / Math.PI;

        angles.push(angle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateTrunkLateralFlexion(): JointAngleTimeSeries {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (const frame of this.frameHistory) {
      if (frame.leftHip.visibility > 0.7 && frame.rightHip.visibility > 0.7) {
        timestamps.push(frame.timestamp);

        // Calculate trunk lateral flexion in frontal plane
        const hipCenter = {
          x: (frame.leftHip.x + frame.rightHip.x) / 2,
          y: (frame.leftHip.y + frame.rightHip.y) / 2
        };

        // Lateral deviation from midline
        const lateralAngle = Math.atan2(
          Math.abs(hipCenter.x - 0.5), // Deviation from center
          0.3 // Estimated trunk height
        ) * 180 / Math.PI;

        angles.push(lateralAngle);
      }
    }

    const velocity = this.calculateVelocity(angles, timestamps);
    const acceleration = this.calculateAcceleration(velocity, timestamps);

    return { timestamps, angles, velocity, acceleration };
  }

  private calculateVelocity(angles: number[], timestamps: number[]): number[] {
    const velocity: number[] = [];

    for (let i = 1; i < angles.length; i++) {
      const dt = timestamps[i] - timestamps[i - 1];
      if (dt > 0) {
        velocity.push((angles[i] - angles[i - 1]) / dt);
      } else {
        velocity.push(0);
      }
    }

    return [0, ...velocity]; // Pad with zero for first frame
  }

  private calculateAcceleration(velocity: number[], timestamps: number[]): number[] {
    const acceleration: number[] = [];

    for (let i = 1; i < velocity.length; i++) {
      const dt = timestamps[i] - timestamps[i - 1];
      if (dt > 0) {
        acceleration.push((velocity[i] - velocity[i - 1]) / dt);
      } else {
        acceleration.push(0);
      }
    }

    return [0, ...acceleration]; // Pad with zero for first frame
  }

  public generateKinematicSummary(kinematics: DetailedKinematics): KinematicSummary {
    // Calculate ROM for each joint
    const ankleROM = {
      left: this.calculateROM(kinematics.ankle.left.dorsiplantarflexion.angles),
      right: this.calculateROM(kinematics.ankle.right.dorsiplantarflexion.angles)
    };

    const kneeROM = {
      left: this.calculateROM(kinematics.knee.left.flexionExtension.angles),
      right: this.calculateROM(kinematics.knee.right.flexionExtension.angles)
    };

    const hipROM = {
      left: this.calculateROM(kinematics.hip.left.flexionExtension.angles),
      right: this.calculateROM(kinematics.hip.right.flexionExtension.angles)
    };

    // Calculate peak values
    const peakValues = {
      maxAnkleDF: {
        left: Math.max(...kinematics.ankle.left.dorsiplantarflexion.angles.filter(a => a > 0)),
        right: Math.max(...kinematics.ankle.right.dorsiplantarflexion.angles.filter(a => a > 0))
      },
      maxAnklePF: {
        left: Math.abs(Math.min(...kinematics.ankle.left.dorsiplantarflexion.angles.filter(a => a < 0))),
        right: Math.abs(Math.min(...kinematics.ankle.right.dorsiplantarflexion.angles.filter(a => a < 0)))
      },
      maxKneeFlex: {
        left: Math.max(...kinematics.knee.left.flexionExtension.angles),
        right: Math.max(...kinematics.knee.right.flexionExtension.angles)
      },
      maxHipExt: {
        left: Math.abs(Math.min(...kinematics.hip.left.flexionExtension.angles.filter(a => a < 0))),
        right: Math.abs(Math.min(...kinematics.hip.right.flexionExtension.angles.filter(a => a < 0)))
      },
      maxHipFlex: {
        left: Math.max(...kinematics.hip.left.flexionExtension.angles.filter(a => a > 0)),
        right: Math.max(...kinematics.hip.right.flexionExtension.angles.filter(a => a > 0))
      }
    };

    // Calculate timing of peak values (simplified)
    const peakTiming = {
      maxAnkleDFTiming: {
        left: this.findPeakTiming(kinematics.ankle.left.dorsiplantarflexion.angles, Math.max),
        right: this.findPeakTiming(kinematics.ankle.right.dorsiplantarflexion.angles, Math.max)
      },
      maxKneeFlexTiming: {
        left: this.findPeakTiming(kinematics.knee.left.flexionExtension.angles, Math.max),
        right: this.findPeakTiming(kinematics.knee.right.flexionExtension.angles, Math.max)
      },
      maxHipExtTiming: {
        left: this.findPeakTiming(kinematics.hip.left.flexionExtension.angles, Math.min),
        right: this.findPeakTiming(kinematics.hip.right.flexionExtension.angles, Math.min)
      }
    };

    // Identify deviations
    const deviations = this.identifyKinematicDeviations(peakValues, ankleROM, kneeROM, hipROM);

    // Calculate quality score
    const kinematicQualityScore = this.calculateKinematicQualityScore(deviations);

    return {
      ankleROM,
      kneeROM,
      hipROM,
      peakValues,
      peakTiming,
      deviations,
      kinematicQualityScore
    };
  }

  private calculateROM(angles: number[]): { dorsiflexion: number; plantarflexion: number } | { flexion: number; extension: number } {
    if (angles.length === 0) {
      return { dorsiflexion: 0, plantarflexion: 0 };
    }

    const max = Math.max(...angles);
    const min = Math.min(...angles);

    return {
      dorsiflexion: max,
      plantarflexion: Math.abs(min)
    } as any;
  }

  private findPeakTiming(angles: number[], peakFunction: (...args: number[]) => number): number {
    if (angles.length === 0) return 0;

    const peakValue = peakFunction(...angles);
    const peakIndex = angles.indexOf(peakValue);

    return (peakIndex / angles.length) * 100; // Return as percentage of cycle
  }

  private identifyKinematicDeviations(
    peakValues: any,
    ankleROM: any,
    kneeROM: any,
    hipROM: any
  ): KinematicDeviation[] {
    const deviations: KinematicDeviation[] = [];

    // Check ankle ROM
    if (ankleROM.left.dorsiflexion < KinematicAnalyzer.NORMAL_RANGES.ankle.dorsiflexion.min) {
      deviations.push({
        joint: 'ankle',
        side: 'left',
        plane: 'sagittal',
        deviation: 'Limited dorsiflexion',
        severity: ankleROM.left.dorsiflexion < 5 ? 'severe' : 'moderate',
        description: `Dorsiflexión limitada: ${ankleROM.left.dorsiflexion.toFixed(1)}°`,
        clinicalImplication: 'Puede indicar contractura o debilidad del tibial anterior',
        normalRange: KinematicAnalyzer.NORMAL_RANGES.ankle.dorsiflexion,
        observedValue: ankleROM.left.dorsiflexion
      });
    }

    // Check knee flexion
    if (peakValues.maxKneeFlex.left < KinematicAnalyzer.NORMAL_RANGES.knee.flexion.min) {
      deviations.push({
        joint: 'knee',
        side: 'left',
        plane: 'sagittal',
        deviation: 'Reduced knee flexion',
        severity: peakValues.maxKneeFlex.left < 45 ? 'severe' : 'moderate',
        description: `Flexión reducida de rodilla: ${peakValues.maxKneeFlex.left.toFixed(1)}°`,
        clinicalImplication: 'Puede indicar rigidez articular o patrón de marcha en extensión',
        normalRange: KinematicAnalyzer.NORMAL_RANGES.knee.flexion,
        observedValue: peakValues.maxKneeFlex.left
      });
    }

    // Check hip extension
    if (peakValues.maxHipExt.left < KinematicAnalyzer.NORMAL_RANGES.hip.extension.min) {
      deviations.push({
        joint: 'hip',
        side: 'left',
        plane: 'sagittal',
        deviation: 'Limited hip extension',
        severity: peakValues.maxHipExt.left < 5 ? 'severe' : 'moderate',
        description: `Extensión limitada de cadera: ${peakValues.maxHipExt.left.toFixed(1)}°`,
        clinicalImplication: 'Puede indicar contractura en flexión o debilidad de glúteos',
        normalRange: KinematicAnalyzer.NORMAL_RANGES.hip.extension,
        observedValue: peakValues.maxHipExt.left
      });
    }

    // Add similar checks for right side
    // ... (similar logic for right side)

    return deviations;
  }

  private calculateKinematicQualityScore(deviations: KinematicDeviation[]): number {
    let score = 100;

    deviations.forEach(deviation => {
      switch (deviation.severity) {
        case 'mild':
          score -= 5;
          break;
        case 'moderate':
          score -= 15;
          break;
        case 'severe':
          score -= 25;
          break;
      }
    });

    return Math.max(0, score);
  }

  private getEmptyKinematics(): DetailedKinematics {
    const emptyTimeSeries: JointAngleTimeSeries = {
      timestamps: [],
      angles: [],
      velocity: [],
      acceleration: []
    };

    return {
      ankle: {
        left: { dorsiplantarflexion: emptyTimeSeries, inversionEversion: null },
        right: { dorsiplantarflexion: emptyTimeSeries, inversionEversion: null }
      },
      knee: {
        left: { flexionExtension: emptyTimeSeries, abductionAdduction: null, rotation: null },
        right: { flexionExtension: emptyTimeSeries, abductionAdduction: null, rotation: null }
      },
      hip: {
        left: { flexionExtension: emptyTimeSeries, abductionAdduction: null, rotation: null },
        right: { flexionExtension: emptyTimeSeries, abductionAdduction: null, rotation: null }
      },
      pelvis: { tilt: null, obliquity: null, rotation: null },
      trunk: { flexionExtension: null, lateralFlexion: null, rotation: null }
    };
  }

  public clearHistory(): void {
    this.frameHistory = [];
  }

  public generateKinematicReport(summary: KinematicSummary): string {
    let report = '## Análisis Cinemático Detallado\n\n';

    // Quality score
    report += `**Puntuación Cinemática Global:** ${summary.kinematicQualityScore}/100\n\n`;

    // ROM Analysis
    report += '### Rangos de Movimiento (ROM)\n';
    report += `**Tobillo Izquierdo:** DF ${summary.ankleROM.left.dorsiflexion.toFixed(1)}° / PF ${summary.ankleROM.left.plantarflexion.toFixed(1)}°\n`;
    report += `**Tobillo Derecho:** DF ${summary.ankleROM.right.dorsiflexion.toFixed(1)}° / PF ${summary.ankleROM.right.plantarflexion.toFixed(1)}°\n`;
    report += `**Rodilla Izquierda:** Flexión ${summary.kneeROM.left.flexion.toFixed(1)}°\n`;
    report += `**Rodilla Derecha:** Flexión ${summary.kneeROM.right.flexion.toFixed(1)}°\n`;
    report += `**Cadera Izquierda:** Flexión ${summary.hipROM.left.flexion.toFixed(1)}°\n`;
    report += `**Cadera Derecha:** Flexión ${summary.hipROM.right.flexion.toFixed(1)}°\n\n`;

    // Peak values
    report += '### Valores Pico\n';
    report += `**Flexión máxima de rodilla:** Izq ${summary.peakValues.maxKneeFlex.left.toFixed(1)}° / Der ${summary.peakValues.maxKneeFlex.right.toFixed(1)}°\n`;
    report += `**Extensión máxima de cadera:** Izq ${summary.peakValues.maxHipExt.left.toFixed(1)}° / Der ${summary.peakValues.maxHipExt.right.toFixed(1)}°\n\n`;

    // Deviations
    if (summary.deviations.length > 0) {
      report += '### Desviaciones Cinemáticas\n';
      summary.deviations.forEach(deviation => {
        report += `- **${deviation.joint.toUpperCase()} ${deviation.side.toUpperCase()}:** ${deviation.deviation} (${deviation.severity})\n`;
        report += `  ${deviation.description}\n`;
        report += `  *${deviation.clinicalImplication}*\n\n`;
      });
    }

    return report;
  }
}