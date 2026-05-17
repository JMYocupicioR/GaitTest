import type { ProcessedSkeleton, SessionData } from '../types/session.ts';
import { postProcessPoseFrames } from '../lib/postProcessSkeleton.ts';
import { exportToTRC } from '../lib/exporters/trcWriter.ts';
import { exportToMOT } from '../lib/exporters/motWriter.ts';
import { buildExportSidecar } from '../lib/exporters/sidecarWriter.ts';
import { getValidatedEventsForExport } from '../lib/eventValidation.ts';
import { supabase } from '../lib/supabase.ts';

export type ClinicalExportFormat = 'trc' | 'mot' | 'c3d' | 'sidecar_json';
export type ClinicalTargetSystem = 'OpenSim' | 'Visual3D' | 'AnyBody' | 'Generic';
export type CoordinateMode = 'zup_mm' | 'yup_m';

export interface ClinicalExportResult {
  format: ClinicalExportFormat;
  fileName: string;
  blob?: Blob;
  storagePath?: string;
  signedUrl?: string;
}

interface C3DFunctionResponse {
  fileName: string;
  storagePath: string;
  signedUrl: string;
}

export class ExportService {
  private static readonly STORAGE_BUCKET = 'clinical-exports';

  private static async getCurrentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  private static resolveProcessedSkeleton(session: SessionData): ProcessedSkeleton {
    if (session.processedSkeleton?.frames?.length) {
      return session.processedSkeleton;
    }
    if (!session.poseFrames?.length) {
      throw new Error('No hay datos de pose para exportar.');
    }
    return postProcessPoseFrames(session.poseFrames, {
      sampleRateHz:
        (session.quality.fpsDetected && Number.isFinite(session.quality.fpsDetected)
          ? session.quality.fpsDetected
          : session.captureSettings.targetFps) || 30,
      filterCutoffHz: 6,
      interpolationVisibilityThreshold: 0.5,
      interpolationMaxGapFrames: 6,
      enforceRigidBones: true,
    });
  }

  private static async uploadAndRegister(
    session: SessionData,
    format: ClinicalExportFormat,
    fileName: string,
    blob: Blob,
    targetSystem: ClinicalTargetSystem,
  ): Promise<{ storagePath?: string; signedUrl?: string }> {
    const userId = await this.getCurrentUserId();
    if (!userId) return {};

    const storagePath = `${userId}/${session.sessionId}/${fileName}`;
    const uploadResult = await supabase.storage.from(this.STORAGE_BUCKET).upload(storagePath, blob, {
      upsert: true,
      contentType: blob.type || 'application/octet-stream',
    });

    if (uploadResult.error) {
      console.error('Error uploading clinical export:', uploadResult.error);
      return {};
    }

    const { data: signed } = await supabase.storage
      .from(this.STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24);

    const { error: insertError } = await supabase.from('clinical_exports').insert({
      session_id: session.sessionId,
      user_id: userId,
      format,
      storage_path: storagePath,
      file_size_bytes: blob.size,
      target_system: targetSystem,
    });

    if (insertError) {
      console.error('Error writing clinical_exports record:', insertError);
    }

    return { storagePath, signedUrl: signed?.signedUrl };
  }

  static async exportTRC(
    session: SessionData,
    targetSystem: ClinicalTargetSystem = 'OpenSim',
    coordinateMode: CoordinateMode = 'yup_m',
  ): Promise<ClinicalExportResult> {
    const processed = this.resolveProcessedSkeleton(session);
    const fileName = `gait-${session.sessionId}.trc`;
    const calibratedGroundWidthMeters =
      session.derivedBiometrics?.frameGroundWidthMeters ??
      session.captureSettings.frameGroundWidthMeters ??
      1.8;
    const content = exportToTRC(processed, {
      fileName,
      frameRateHz:
        (session.quality.fpsDetected && Number.isFinite(session.quality.fpsDetected)
          ? session.quality.fpsDetected
          : session.captureSettings.targetFps) || 30,
      groundWidthMeters: calibratedGroundWidthMeters,
      coordinateMode,
      markerNamingProfile: targetSystem === 'OpenSim' ? 'opensim_model_generic' : 'plug_in_gait_partial',
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const upload = await this.uploadAndRegister(session, 'trc', fileName, blob, targetSystem);
    return { format: 'trc', fileName, blob, ...upload };
  }

  static async exportMOT(
    session: SessionData,
    targetSystem: ClinicalTargetSystem = 'OpenSim',
    _coordinateMode: CoordinateMode = 'yup_m',
  ): Promise<ClinicalExportResult> {
    const processed = this.resolveProcessedSkeleton(session);
    const fileName = `gait-${session.sessionId}.mot`;
    const validatedEvents = getValidatedEventsForExport(session);
    const content = exportToMOT(processed, validatedEvents, [], {
      frameRateHz:
        (session.quality.fpsDetected && Number.isFinite(session.quality.fpsDetected)
          ? session.quality.fpsDetected
          : session.captureSettings.targetFps) || 30,
      verticalThresholdN: 10,
      defaultCopMeters: { x: 0, y: 0, z: 0 },
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const upload = await this.uploadAndRegister(session, 'mot', fileName, blob, targetSystem);
    return { format: 'mot', fileName, blob, ...upload };
  }

  static async exportC3D(
    session: SessionData,
    targetSystem: ClinicalTargetSystem = 'Visual3D',
    coordinateMode: CoordinateMode = 'zup_mm',
  ): Promise<ClinicalExportResult> {
    const processed = this.resolveProcessedSkeleton(session);
    const calibratedGroundWidthMeters =
      session.derivedBiometrics?.frameGroundWidthMeters ??
      session.captureSettings.frameGroundWidthMeters ??
      1.8;
    const { data, error } = await supabase.functions.invoke<C3DFunctionResponse>('export-c3d', {
      body: {
        sessionId: session.sessionId,
        frameRateHz:
          (session.quality.fpsDetected && Number.isFinite(session.quality.fpsDetected)
            ? session.quality.fpsDetected
            : session.captureSettings.targetFps) || 30,
        markerNames: null,
        frames: processed.frames.map((frame) => frame.landmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility }))),
        targetSystem,
        coordinateMode,
        groundWidthMeters: calibratedGroundWidthMeters,
      },
    });

    if (error || !data) {
      throw new Error(error?.message || 'No se pudo exportar C3D.');
    }

    return {
      format: 'c3d',
      fileName: data.fileName,
      storagePath: data.storagePath,
      signedUrl: data.signedUrl,
    };
  }

  static async exportAll(
    session: SessionData,
    targetSystem: ClinicalTargetSystem = 'OpenSim',
    coordinateMode: CoordinateMode = 'yup_m',
  ): Promise<ClinicalExportResult[]> {
    const results: ClinicalExportResult[] = [];
    results.push(await this.exportTRC(session, targetSystem, coordinateMode));
    results.push(await this.exportMOT(session, targetSystem, coordinateMode));
    results.push(this.exportSidecar(session, targetSystem, coordinateMode));
    try {
      results.push(await this.exportC3D(session, targetSystem, coordinateMode));
    } catch (error) {
      console.error('C3D export failed during exportAll:', error);
    }
    return results;
  }

  static exportSidecar(
    session: SessionData,
    targetSystem: ClinicalTargetSystem = 'OpenSim',
    coordinateMode: CoordinateMode = 'yup_m',
  ): ClinicalExportResult {
    const fileName = `gait-${session.sessionId}.sidecar.json`;
    const content = JSON.stringify(
      buildExportSidecar(session, { targetSystem, coordinateMode }),
      null,
      2,
    );
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    return { format: 'sidecar_json', fileName, blob };
  }

  static downloadBlob(result: ClinicalExportResult): void {
    if (!result.blob || typeof window === 'undefined') return;
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
