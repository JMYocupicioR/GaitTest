export const MEDIAPIPE_LANDMARK_NAMES: string[] = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
];

export type MarkerNamingProfile =
  | 'plug_in_gait_partial'
  | 'opensim_model_generic'
  | 'mediapipe';

const PIG_MAPPING: Record<string, string> = {
  left_hip: 'LHJC',
  right_hip: 'RHJC',
  left_knee: 'LKNE',
  right_knee: 'RKNE',
  left_ankle: 'LANK',
  right_ankle: 'RANK',
  left_heel: 'LHEE',
  right_heel: 'RHEE',
  left_foot_index: 'LTOE',
  right_foot_index: 'RTOE',
  left_shoulder: 'LSHO',
  right_shoulder: 'RSHO',
  left_elbow: 'LELB',
  right_elbow: 'RELB',
  left_wrist: 'LWRA',
  right_wrist: 'RWRA',
  nose: 'C7',
};

const OPENSIM_GENERIC_MAPPING: Record<string, string> = {
  left_hip: 'L_HIP',
  right_hip: 'R_HIP',
  left_knee: 'L_KNEE',
  right_knee: 'R_KNEE',
  left_ankle: 'L_ANKLE',
  right_ankle: 'R_ANKLE',
  left_heel: 'L_HEEL',
  right_heel: 'R_HEEL',
  left_foot_index: 'L_TOE',
  right_foot_index: 'R_TOE',
  left_shoulder: 'L_SHOULDER',
  right_shoulder: 'R_SHOULDER',
  left_elbow: 'L_ELBOW',
  right_elbow: 'R_ELBOW',
  left_wrist: 'L_WRIST',
  right_wrist: 'R_WRIST',
  nose: 'HEAD',
};

export function escapeForAnyBody(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, (char) => `_${char.charCodeAt(0)}_`);
}

function sanitizeMarkerName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

export function truncateUnique(names: string[], maxLen = 4): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const cleaned = sanitizeMarkerName(name);
    let candidate = cleaned.slice(0, maxLen) || 'MKR0';
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }

    let suffix = 1;
    while (suffix < 1000) {
      const suffixText = String(suffix);
      const baseLength = Math.max(1, maxLen - suffixText.length);
      candidate = `${cleaned.slice(0, baseLength)}${suffixText}`;
      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }
      suffix += 1;
    }

    used.add(candidate);
    return candidate;
  });
}

export function mapMediaPipeToPlugInGait(
  names: string[] = MEDIAPIPE_LANDMARK_NAMES,
  profile: MarkerNamingProfile = 'plug_in_gait_partial',
): string[] {
  if (profile === 'mediapipe') {
    return names.map((name) => sanitizeMarkerName(name).slice(0, 12));
  }
  if (profile === 'opensim_model_generic') {
    return names.map((name) => OPENSIM_GENERIC_MAPPING[name] ?? sanitizeMarkerName(name).slice(0, 12));
  }
  return names.map((name) => PIG_MAPPING[name] ?? sanitizeMarkerName(name).slice(0, 8));
}

export function enforcePiGAsymmetry(markerHeights: {
  RTHI?: number;
  LTHI?: number;
  RTIB?: number;
  LTIB?: number;
}): {
  ok: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (
    markerHeights.RTHI != null &&
    markerHeights.LTHI != null &&
    markerHeights.RTHI <= markerHeights.LTHI
  ) {
    warnings.push('RTHI debe estar mas alto que LTHI para evitar swapping.');
  }

  if (
    markerHeights.RTIB != null &&
    markerHeights.LTIB != null &&
    markerHeights.RTIB <= markerHeights.LTIB
  ) {
    warnings.push('RTIB debe estar mas alto que LTIB para cumplir asimetria PiG.');
  }

  return { ok: warnings.length === 0, warnings };
}
