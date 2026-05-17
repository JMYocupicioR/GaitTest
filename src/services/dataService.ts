import {
  supabase,
  type GaitAnalysisRecord,
  type GaitKeyFrameRecord,
  type GaitKinematicSeriesRecord,
  type SessionRecord,
} from '../lib/supabase.ts';
import type { SessionData } from '../types/session.ts';
import { kinematicExtractor } from '../lib/kinematicExtractor.ts';
import {
  buildPersistedSessionData,
  extractCompactKeyFrames,
  extractKinematicSeriesData,
} from '../lib/posePersistence.ts';
import { extractEventThumbnails } from '../lib/thumbnailExtractor.ts';

export class DataService {
  private static async getCurrentUserId(): Promise<string | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error loading authenticated user:', error);
      return null;
    }
    return data.user?.id ?? null;
  }

  /**
   * Save a complete session to the database
   */
  static async saveSession(sessionData: SessionData): Promise<string | null> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        console.error('No authenticated user found. Session cannot be saved.');
        return null;
      }

      const patientId = sessionData.patient?.identifier ||
                       sessionData.patient?.name ||
                       `patient_${Date.now()}`;

      const examId = `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const persistedSession = buildPersistedSessionData(sessionData);

      // Extract key metrics for indexing
      const pathologyFromSnapshot = sessionData.clinicalAnalysisSnapshot?.pathologyAnalysis;
      const pathologyFromEnhanced = sessionData.enhancedAnalysisResult?.pathologyAnalysis;
      const primaryFindings =
        pathologyFromSnapshot?.primaryFindings ?? pathologyFromEnhanced?.primaryFindings;
      const primaryFinding = primaryFindings?.[0];

      const sessionRecord: Omit<SessionRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        patient_id: patientId,
        exam_id: examId,
        session_date: new Date().toISOString().split('T')[0],
        session_data: persistedSession,
        duration_seconds: sessionData.quality.durationSeconds || undefined,
        steps: sessionData.metrics.steps || undefined,
        distance_meters: sessionData.captureSettings.distanceMeters ?? undefined,
        avg_speed: sessionData.metrics.speedMps || undefined,
        cadence: sessionData.metrics.cadenceSpm || undefined,
        ogs_left_total: sessionData.ogs?.leftTotal || undefined,
        ogs_right_total: sessionData.ogs?.rightTotal || undefined,
        ogs_quality_index: sessionData.ogs?.qualityIndex || undefined,
        ogs_asymmetry_index: sessionData.ogs?.asymmetryIndex || undefined,
        pathology_detected: Boolean(primaryFindings && primaryFindings.length > 0),
        primary_pathology:
          sessionData.clinicalAnalysisSnapshot?.primaryDiagnosis ||
          primaryFinding?.condition ||
          undefined,
        pathology_confidence: primaryFinding?.confidence || undefined,
        patient_name: sessionData.patient?.name || undefined,
        patient_age: sessionData.patient?.age || undefined,
        patient_height: sessionData.patient?.height || undefined,
        patient_weight: sessionData.patient?.weight || undefined,
        estimated_height:
          sessionData.patient?.estimatedHeight ??
          sessionData.derivedBiometrics?.estimatedHeightCm ??
          undefined,
        height_source:
          sessionData.patient?.heightSource ??
          sessionData.derivedBiometrics?.heightSource ??
          undefined,
        leg_length_derived: sessionData.derivedBiometrics?.legLengthCm ?? undefined,
        bmi_derived:
          sessionData.derivedBiometrics?.bmi ??
          (sessionData.patient?.height && sessionData.patient?.weight
            ? sessionData.patient.weight / Math.pow(sessionData.patient.height / 100, 2)
            : undefined),
      };

      let { data, error } = await supabase
        .from('session_records')
        .insert(sessionRecord)
        .select('id')
        .single();

      if (error && /column .* does not exist/i.test(error.message ?? '')) {
        // Backward compatibility for DBs not yet migrated with derived biometric columns.
        const {
          estimated_height: _estimatedHeight,
          height_source: _heightSource,
          leg_length_derived: _legLengthDerived,
          bmi_derived: _bmiDerived,
          ...legacySessionRecord
        } = sessionRecord as SessionRecord;
        void _estimatedHeight;
        void _heightSource;
        void _legLengthDerived;
        void _bmiDerived;

        const legacyInsert = await supabase
          .from('session_records')
          .insert(legacySessionRecord)
          .select('id')
          .single();
        data = legacyInsert.data;
        error = legacyInsert.error;
      }

      if (error) {
        console.error('Error saving session:', error);
        return null;
      }

      await Promise.all([
        this.saveGaitAnalysisRecords(sessionData, userId, patientId, examId),
        this.saveKinematicSeries(sessionData, userId, patientId, examId),
        this.saveKeyFrames(sessionData, userId, examId),
      ]);

      return data?.id ?? null;
    } catch (error) {
      console.error('Error saving session:', error);
      return null;
    }
  }

  /**
   * Save gait analysis records in CSV format
   */
  private static async saveGaitAnalysisRecords(
    sessionData: SessionData,
    userId: string,
    patientId: string,
    examId: string
  ): Promise<void> {
    try {
      const records: Omit<GaitAnalysisRecord, 'id' | 'created_at' | 'updated_at'>[] = [];

      // Extract kinematic values using the new extractor
      const kinematicValues = kinematicExtractor.extractKinematicValues(sessionData);

      // Derive clinical data from pathology analysis if available
      const snap = sessionData.clinicalAnalysisSnapshot;
      const enhanced = sessionData.enhancedAnalysisResult?.pathologyAnalysis;
      const primaryPathology =
        snap?.pathologyAnalysis?.primaryFindings?.[0] ?? enhanced?.primaryFindings?.[0];
      const dx_mod =
        snap?.primaryDiagnosis || primaryPathology?.condition || undefined;

      // Create records for both sides
      (['L', 'R'] as const).forEach(side => {
        const isLeft = side === 'L';
        const sideKinematics = isLeft ? kinematicValues.left : kinematicValues.right;

        const record: Omit<GaitAnalysisRecord, 'id' | 'created_at' | 'updated_at'> = {
          user_id: userId,
          patient_id: patientId,
          exam_id: examId,
          side: side,

          // Extract real kinematic data
          hip_flex_ic: sideKinematics.hip_flex_ic ?? undefined,
          hip_rot_mean: sideKinematics.hip_rot_mean ?? undefined,
          knee_flex_mean_stance: sideKinematics.knee_flex_mean_stance ?? undefined,
          knee_flex_max_extension: sideKinematics.knee_flex_max_extension ?? undefined,

          // Clinical data derived from analysis
          dx_mod: dx_mod,
          dx_side: side,
          faq: undefined, // Functional Assessment Questionnaire - to be implemented
          gmfcs: undefined, // Gross Motor Function Classification System - to be implemented

          // Patient characteristics
          age: sessionData.patient?.age || undefined,
          height:
            sessionData.patient?.height ??
            sessionData.derivedBiometrics?.effectiveHeightCm ??
            undefined,
          mass:
            sessionData.patient?.weight ??
            sessionData.derivedBiometrics?.weightKg ??
            undefined,

          // Gait parameters
          cadence: sessionData.metrics.cadenceSpm || undefined,
          speed: sessionData.metrics.speedMps || undefined,
          step_len: sessionData.metrics.stepLengthMeters || undefined,
          leg_len:
            sessionData.derivedBiometrics?.legLengthCm ??
            kinematicValues.leg_len ??
            undefined,
          bmi:
            sessionData.derivedBiometrics?.bmi ??
            (sessionData.patient?.height && sessionData.patient?.weight
              ? sessionData.patient.weight / Math.pow(sessionData.patient.height / 100, 2)
              : undefined),
          speed_norm: kinematicValues.speed_norm ?? undefined,
          step_len_norm: kinematicValues.step_len_norm ?? undefined,
          cadence_norm: kinematicValues.cadence_norm ?? undefined,
          data_source: kinematicValues.data_source,
        };

        records.push(record);
      });

      const { error } = await supabase
        .from('gait_analysis_records')
        .insert(records);

      if (error) {
        console.error('Error saving gait analysis records:', error);
      }
    } catch (error) {
      console.error('Error saving gait analysis records:', error);
    }
  }

  private static async saveKinematicSeries(
    sessionData: SessionData,
    userId: string,
    patientId: string,
    examId: string,
  ): Promise<void> {
    try {
      const series = extractKinematicSeriesData(sessionData);
      if (!series.length) {
        return;
      }

      const records: Omit<GaitKinematicSeriesRecord, 'id' | 'created_at'>[] = series.map((item) => ({
        user_id: userId,
        patient_id: patientId,
        exam_id: examId,
        joint: item.joint,
        side: item.side,
        percent_cycle: item.percentCycle,
      }));

      const { error } = await supabase.from('gait_kinematic_series').insert(records);
      if (error) {
        console.error('Error saving kinematic series:', error);
      }
    } catch (error) {
      console.error('Error saving kinematic series:', error);
    }
  }

  private static async saveKeyFrames(
    sessionData: SessionData,
    userId: string,
    examId: string,
  ): Promise<void> {
    try {
      const compactKeyFrames = extractCompactKeyFrames(sessionData.poseFrames ?? [], sessionData.events, 12);
      if (!compactKeyFrames.length) {
        return;
      }

      const bucket = 'gait-thumbnails';
      await supabase.storage.createBucket(bucket, { public: false }).catch(() => undefined);

      const thumbnailMap = new Map<string, string>();
      if (sessionData.videoBlob && typeof window !== 'undefined') {
        try {
          const thumbnails = await extractEventThumbnails(sessionData.videoBlob, sessionData.events, 12);
          for (let index = 0; index < thumbnails.length; index += 1) {
            const thumbnail = thumbnails[index];
            const filePath = `${userId}/${examId}/event-${index + 1}-${Math.round(thumbnail.timestampSec * 1000)}.jpg`;
            const { error } = await supabase.storage.from(bucket).upload(filePath, thumbnail.blob, {
              contentType: 'image/jpeg',
              upsert: false,
            });
            if (!error) {
              const key = `${thumbnail.eventType}:${thumbnail.foot}:${thumbnail.timestampSec.toFixed(3)}`;
              thumbnailMap.set(key, filePath);
            }
          }
        } catch (error) {
          console.warn('Thumbnail extraction skipped:', error);
        }
      }

      const records: Omit<GaitKeyFrameRecord, 'id' | 'created_at'>[] = compactKeyFrames.map((keyFrame) => {
        const key = `${keyFrame.eventType}:${keyFrame.foot}:${keyFrame.timestampSec.toFixed(3)}`;
        return {
          user_id: userId,
          exam_id: examId,
          event_type: keyFrame.eventType,
          foot: keyFrame.foot,
          timestamp_sec: keyFrame.timestampSec,
          landmark_snapshot: keyFrame.landmarkSnapshot,
          thumbnail_path: thumbnailMap.get(key),
        };
      });

      const { error } = await supabase.from('gait_key_frames').insert(records);
      if (error) {
        console.error('Error saving key frames:', error);
      }
    } catch (error) {
      console.error('Error saving key frames:', error);
    }
  }

  /**
   * Get all sessions for a patient
   */
  static async getPatientSessions(patientId: string): Promise<SessionRecord[]> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return [];
      }

      const { data, error } = await supabase
        .from('session_records')
        .select('*')
        .eq('user_id', userId)
        .eq('patient_id', patientId)
        .order('session_date', { ascending: false });

      if (error) {
        console.error('Error fetching patient sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching patient sessions:', error);
      return [];
    }
  }

  /**
   * Get gait analysis records for a patient
   */
  static async getPatientGaitRecords(patientId: string): Promise<GaitAnalysisRecord[]> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return [];
      }

      const { data, error } = await supabase
        .from('gait_analysis_records')
        .select('*')
        .eq('user_id', userId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching gait records:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching gait records:', error);
      return [];
    }
  }

  /**
   * Get longitudinal analysis for a patient
   */
  static async getLongitudinalAnalysis(patientId: string): Promise<{
    sessions: SessionRecord[];
    gaitRecords: GaitAnalysisRecord[];
    trends: any;
  }> {
    try {
      const [sessions, gaitRecords] = await Promise.all([
        this.getPatientSessions(patientId),
        this.getPatientGaitRecords(patientId)
      ]);

      // Calculate trends
      const trends = this.calculateTrends(sessions);

      return {
        sessions,
        gaitRecords,
        trends
      };
    } catch (error) {
      console.error('Error getting longitudinal analysis:', error);
      return {
        sessions: [],
        gaitRecords: [],
        trends: {}
      };
    }
  }

  /**
   * Calculate trends from session data
   */
  private static calculateTrends(sessions: SessionRecord[]): any {
    if (sessions.length < 2) {
      return {
        message: 'Se necesitan al menos 2 sesiones para calcular tendencias'
      };
    }

    const sortedSessions = sessions.sort((a, b) =>
      new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
    );

    const first = sortedSessions[0];
    const last = sortedSessions[sortedSessions.length - 1];

    const trends: any = {
      totalSessions: sessions.length,
      timeSpan: {
        start: first.session_date,
        end: last.session_date,
        days: Math.ceil((new Date(last.session_date).getTime() - new Date(first.session_date).getTime()) / (1000 * 60 * 60 * 24))
      },
      improvements: [],
      concerns: []
    };

    // Speed trend
    if (first.avg_speed && last.avg_speed) {
      const speedChange = ((last.avg_speed - first.avg_speed) / first.avg_speed) * 100;
      trends.speedChange = {
        percentage: speedChange,
        initial: first.avg_speed,
        current: last.avg_speed
      };

      if (speedChange > 5) {
        trends.improvements.push(`Velocidad mejoró ${speedChange.toFixed(1)}%`);
      } else if (speedChange < -5) {
        trends.concerns.push(`Velocidad disminuyó ${Math.abs(speedChange).toFixed(1)}%`);
      }
    }

    // Cadence trend
    if (first.cadence && last.cadence) {
      const cadenceChange = ((last.cadence - first.cadence) / first.cadence) * 100;
      trends.cadenceChange = {
        percentage: cadenceChange,
        initial: first.cadence,
        current: last.cadence
      };

      if (cadenceChange > 3) {
        trends.improvements.push(`Cadencia mejoró ${cadenceChange.toFixed(1)}%`);
      } else if (cadenceChange < -3) {
        trends.concerns.push(`Cadencia disminuyó ${Math.abs(cadenceChange).toFixed(1)}%`);
      }
    }

    // OGS trends
    if (first.ogs_quality_index && last.ogs_quality_index) {
      const ogsChange = last.ogs_quality_index - first.ogs_quality_index;
      trends.ogsChange = {
        absolute: ogsChange,
        initial: first.ogs_quality_index,
        current: last.ogs_quality_index
      };

      if (ogsChange > 10) {
        trends.improvements.push(`Calidad observacional mejoró ${ogsChange.toFixed(1)} puntos`);
      } else if (ogsChange < -10) {
        trends.concerns.push(`Calidad observacional disminuyó ${Math.abs(ogsChange).toFixed(1)} puntos`);
      }
    }

    return trends;
  }

  /**
   * Export patient data to CSV format
   */
  static async exportPatientDataToCSV(patientId: string): Promise<string> {
    try {
      const gaitRecords = await this.getPatientGaitRecords(patientId);

      if (gaitRecords.length === 0) {
        return 'Patient_ID,examid,side,HipFlex_IC,HipRot_mean,KneeFlex_meanStance,KneeFlex_maxExtension,dxmod,dxside,faq,gmfcs,age,height,mass,cadence,speed,steplen,leglen,bmi,speedNorm,steplenNorm,cadenceNorm,data_source\n';
      }

      const headers = [
        'Patient_ID', 'examid', 'side', 'HipFlex_IC', 'HipRot_mean',
        'KneeFlex_meanStance', 'KneeFlex_maxExtension', 'dxmod', 'dxside',
        'faq', 'gmfcs', 'age', 'height', 'mass', 'cadence', 'speed',
        'steplen', 'leglen', 'bmi', 'speedNorm', 'steplenNorm', 'cadenceNorm', 'data_source'
      ];

      let csvContent = headers.join(',') + '\n';

      gaitRecords.forEach(record => {
        const row = [
          record.patient_id,
          record.exam_id,
          record.side,
          record.hip_flex_ic || '',
          record.hip_rot_mean || '',
          record.knee_flex_mean_stance || '',
          record.knee_flex_max_extension || '',
          record.dx_mod || '',
          record.dx_side || '',
          record.faq || '',
          record.gmfcs || '',
          record.age || '',
          record.height || '',
          record.mass || '',
          record.cadence || '',
          record.speed || '',
          record.step_len || '',
          record.leg_len || '',
          record.bmi || '',
          record.speed_norm || '',
          record.step_len_norm || '',
          record.cadence_norm || '',
          record.data_source || ''
        ];
        csvContent += row.join(',') + '\n';
      });

      return csvContent;
    } catch (error) {
      console.error('Error exporting CSV:', error);
      return '';
    }
  }

  /**
   * Search patients by name or ID
   */
  static async searchPatients(query: string): Promise<Array<{patient_id: string, patient_name: string, last_session: string}>> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        return [];
      }

      const { data, error } = await supabase
        .from('session_records')
        .select('patient_id, patient_name, session_date')
        .eq('user_id', userId)
        .or(`patient_id.ilike.%${query}%, patient_name.ilike.%${query}%`)
        .order('session_date', { ascending: false });

      if (error) {
        console.error('Error searching patients:', error);
        return [];
      }

      // Group by patient and get the latest session
      const patientsMap = new Map();
      data?.forEach(record => {
        if (!patientsMap.has(record.patient_id) ||
            new Date(record.session_date) > new Date(patientsMap.get(record.patient_id).last_session)) {
          patientsMap.set(record.patient_id, {
            patient_id: record.patient_id,
            patient_name: record.patient_name || record.patient_id,
            last_session: record.session_date
          });
        }
      });

      return Array.from(patientsMap.values());
    } catch (error) {
      console.error('Error searching patients:', error);
      return [];
    }
  }
}