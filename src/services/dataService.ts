import { supabase, type GaitAnalysisRecord, type SessionRecord } from '../lib/supabase.ts';
import type { SessionData } from '../types/session.ts';

export class DataService {

  /**
   * Initialize the database tables
   */
  static async initializeDatabase(): Promise<void> {
    try {
      // Create tables if they don't exist
      const { error: gaitTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS gait_analysis_records (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            patient_id TEXT NOT NULL,
            exam_id TEXT NOT NULL,
            side TEXT CHECK (side IN ('L', 'R')) NOT NULL,
            hip_flex_ic DECIMAL,
            hip_rot_mean DECIMAL,
            knee_flex_mean_stance DECIMAL,
            knee_flex_max_extension DECIMAL,
            dx_mod TEXT,
            dx_side TEXT,
            faq INTEGER,
            gmfcs INTEGER,
            age INTEGER,
            height DECIMAL,
            mass DECIMAL,
            cadence DECIMAL,
            speed DECIMAL,
            step_len DECIMAL,
            leg_len DECIMAL,
            bmi DECIMAL,
            speed_norm DECIMAL,
            step_len_norm DECIMAL,
            cadence_norm DECIMAL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(patient_id, exam_id, side)
          );
        `
      });

      const { error: sessionTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS session_records (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            patient_id TEXT NOT NULL,
            exam_id TEXT NOT NULL,
            session_date DATE NOT NULL,
            session_data JSONB NOT NULL,
            duration_seconds INTEGER,
            steps INTEGER,
            distance_meters DECIMAL,
            avg_speed DECIMAL,
            cadence DECIMAL,
            ogs_left_total INTEGER,
            ogs_right_total INTEGER,
            ogs_quality_index DECIMAL,
            ogs_asymmetry_index DECIMAL,
            pathology_detected BOOLEAN DEFAULT FALSE,
            primary_pathology TEXT,
            pathology_confidence DECIMAL,
            patient_name TEXT,
            patient_age INTEGER,
            patient_height DECIMAL,
            patient_weight DECIMAL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(patient_id, exam_id)
          );
        `
      });

      if (gaitTableError) console.warn('Gait table creation warning:', gaitTableError);
      if (sessionTableError) console.warn('Session table creation warning:', sessionTableError);

    } catch (error) {
      console.error('Database initialization error:', error);
    }
  }

  /**
   * Save a complete session to the database
   */
  static async saveSession(sessionData: SessionData): Promise<string | null> {
    try {
      const patientId = sessionData.patient?.identifier ||
                       sessionData.patient?.name ||
                       `patient_${Date.now()}`;

      const examId = `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Extract key metrics for indexing
      const sessionRecord: Omit<SessionRecord, 'id' | 'created_at' | 'updated_at'> = {
        patient_id: patientId,
        exam_id: examId,
        session_date: new Date().toISOString().split('T')[0],
        session_data: sessionData,
        duration_seconds: sessionData.quality.durationSeconds || undefined,
        steps: sessionData.metrics.steps || undefined,
        distance_meters: undefined, // Not available in current SessionMetrics
        avg_speed: sessionData.metrics.speedMps || undefined,
        cadence: sessionData.metrics.cadenceSpm || undefined,
        ogs_left_total: sessionData.ogs?.leftTotal || undefined,
        ogs_right_total: sessionData.ogs?.rightTotal || undefined,
        ogs_quality_index: sessionData.ogs?.qualityIndex || undefined,
        ogs_asymmetry_index: sessionData.ogs?.asymmetryIndex || undefined,
        pathology_detected: sessionData.enhancedAnalysisResult?.pathologyAnalysis?.primaryFindings.length ? true : false,
        primary_pathology: sessionData.enhancedAnalysisResult?.pathologyAnalysis?.primaryFindings[0]?.condition || undefined,
        pathology_confidence: sessionData.enhancedAnalysisResult?.pathologyAnalysis?.primaryFindings[0]?.confidence || undefined,
        patient_name: sessionData.patient?.name || undefined,
        patient_age: sessionData.patient?.age || undefined,
        patient_height: sessionData.patient?.height || undefined,
        patient_weight: sessionData.patient?.weight || undefined,
      };

      const { data, error } = await supabase
        .from('session_records')
        .insert(sessionRecord)
        .select('id')
        .single();

      if (error) {
        console.error('Error saving session:', error);
        return null;
      }

      // Also save individual gait records in CSV format
      await this.saveGaitAnalysisRecords(sessionData, patientId, examId);

      return data.id;
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
    patientId: string,
    examId: string
  ): Promise<void> {
    try {
      const records: Omit<GaitAnalysisRecord, 'id' | 'created_at' | 'updated_at'>[] = [];

      // Create records for both sides
      ['L', 'R'].forEach(side => {

        const record: Omit<GaitAnalysisRecord, 'id' | 'created_at' | 'updated_at'> = {
          patient_id: patientId,
          exam_id: examId,
          side: side as 'L' | 'R',

          // Extract kinematic data based on available metrics (placeholder values)
          hip_flex_ic: undefined, // Would need kinematic analysis
          hip_rot_mean: undefined, // Would need kinematic analysis
          knee_flex_mean_stance: undefined, // Would need kinematic analysis
          knee_flex_max_extension: undefined, // Would need kinematic analysis

          // Clinical data (would need to be added to session data)
          dx_mod: undefined, // Could be derived from pathology analysis
          dx_side: side,
          faq: undefined, // Functional Assessment Questionnaire - to be implemented
          gmfcs: undefined, // Gross Motor Function Classification System - to be implemented

          // Patient characteristics
          age: sessionData.patient?.age || undefined,
          height: sessionData.patient?.height || undefined,
          mass: sessionData.patient?.weight || undefined,

          // Gait parameters
          cadence: sessionData.metrics.cadenceSpm || undefined,
          speed: sessionData.metrics.speedMps || undefined,
          step_len: sessionData.metrics.stepLengthMeters || undefined,
          leg_len: undefined, // To be calculated or measured
          bmi: sessionData.patient?.height && sessionData.patient?.weight ?
               sessionData.patient.weight / Math.pow(sessionData.patient.height / 100, 2) : undefined,
          speed_norm: undefined, // Normalized to height or leg length
          step_len_norm: undefined, // Normalized to height or leg length
          cadence_norm: undefined, // Normalized cadence
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

  /**
   * Get all sessions for a patient
   */
  static async getPatientSessions(patientId: string): Promise<SessionRecord[]> {
    try {
      const { data, error } = await supabase
        .from('session_records')
        .select('*')
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
      const { data, error } = await supabase
        .from('gait_analysis_records')
        .select('*')
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
        return 'Patient_ID,examid,side,HipFlex_IC,HipRot_mean,KneeFlex_meanStance,KneeFlex_maxExtension,dxmod,dxside,faq,gmfcs,age,height,mass,cadence,speed,steplen,leglen,bmi,speedNorm,steplenNorm,cadenceNorm\n';
      }

      const headers = [
        'Patient_ID', 'examid', 'side', 'HipFlex_IC', 'HipRot_mean',
        'KneeFlex_meanStance', 'KneeFlex_maxExtension', 'dxmod', 'dxside',
        'faq', 'gmfcs', 'age', 'height', 'mass', 'cadence', 'speed',
        'steplen', 'leglen', 'bmi', 'speedNorm', 'steplenNorm', 'cadenceNorm'
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
          record.cadence_norm || ''
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
      const { data, error } = await supabase
        .from('session_records')
        .select('patient_id, patient_name, session_date')
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