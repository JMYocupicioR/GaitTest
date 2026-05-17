import { EnhancedGaitAnalyzer, type EnhancedAnalysisInput } from '../lib/enhancedAnalysis.ts';
import { MedicalReportGenerator } from '../lib/medicalReporting.ts';

interface AnalyzeRequest {
  type: 'analyze';
  payload: EnhancedAnalysisInput & {
    ogs?: unknown;
    patient?: {
      identifier?: string;
      age?: number;
    };
  };
}

self.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  const request = event.data;
  if (!request || request.type !== 'analyze') {
    return;
  }
  try {
    const analyzer = new EnhancedGaitAnalyzer();
    const result = await analyzer.performCompleteAnalysis(request.payload);
    const reportGen = new MedicalReportGenerator();
    const medReport = reportGen.generateComprehensiveReport(
      result.advancedMetrics,
      result.kinematicSummary,
      result.compensationAnalysis,
      result.frontalMetrics,
      result.cycleAnalysis,
      result.detectedGaitCycles,
      result.detailedKinematics,
      request.payload.ogs as never,
      request.payload.patient,
    );
    self.postMessage({
      type: 'result',
      payload: { result, medReport },
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      payload: {
        message: error instanceof Error ? error.message : 'Analysis worker error',
      },
    });
  }
};
