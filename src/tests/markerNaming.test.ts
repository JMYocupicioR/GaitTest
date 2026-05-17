import { describe, expect, it } from 'vitest';
import { enforcePiGAsymmetry, escapeForAnyBody, mapMediaPipeToPlugInGait, truncateUnique } from '../lib/markerNaming.ts';

describe('markerNaming', () => {
  it('maps key mediapipe names to Plug-in Gait labels', () => {
    const mapped = mapMediaPipeToPlugInGait(['left_hip', 'right_knee', 'left_foot_index']);
    expect(mapped).toEqual(['LHJC', 'RKNE', 'LTOE']);
  });

  it('supports OpenSim-friendly profile names', () => {
    const mapped = mapMediaPipeToPlugInGait(['nose', 'left_ankle', 'right_ankle'], 'opensim_model_generic');
    expect(mapped).toEqual(['HEAD', 'L_ANKLE', 'R_ANKLE']);
  });

  it('escapes forbidden AnyBody characters', () => {
    expect(escapeForAnyBody('L*Ankle+')).toBe('L_42_Ankle_43_');
  });

  it('keeps truncated labels unique', () => {
    const truncated = truncateUnique(['L_Ankle_Lateral', 'L_Ankle_Medial', 'L_Ankle_Anterior'], 4);
    expect(new Set(truncated).size).toBe(3);
  });

  it('warns when PiG asymmetry does not hold', () => {
    const result = enforcePiGAsymmetry({ RTHI: 0.4, LTHI: 0.45, RTIB: 0.3, LTIB: 0.32 });
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
