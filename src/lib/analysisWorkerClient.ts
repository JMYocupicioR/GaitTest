import { EnhancedGaitAnalyzer, type EnhancedAnalysisInput, type EnhancedAnalysisResult } from './enhancedAnalysis.ts';
import { MedicalReportGenerator } from './medicalReporting.ts';

interface AnalysisWorkerPayload {
  result: EnhancedAnalysisResult;
  medReport: ReturnType<MedicalReportGenerator['generateComprehensiveReport']>;
}

export async function runAnalysisWithWorkerFallback(
  input: EnhancedAnalysisInput & {
    ogs?: unknown;
    patient?: { identifier?: string; age?: number };
  },
): Promise<AnalysisWorkerPayload> {
  if (typeof Worker !== 'undefined') {
    try {
      const payload = await new Promise<AnalysisWorkerPayload>((resolve, reject) => {
        const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
        const cleanup = () => {
          worker.onmessage = null;
          worker.onerror = null;
          worker.terminate();
        };
        worker.onmessage = (event: MessageEvent<{ type: string; payload?: AnalysisWorkerPayload; }>) => {
          const message = event.data;
          if (message?.type === 'result' && message.payload) {
            cleanup();
            resolve(message.payload);
            return;
          }
          if (message?.type === 'error') {
            cleanup();
            reject(new Error('Analysis worker failed'));
          }
        };
        worker.onerror = (e) => {
          cleanup();
          reject(new Error(e.message || 'Analysis worker error'));
        };
        worker.postMessage({ type: 'analyze', payload: input });
      });
      return payload;
    } catch {
      // fallback below
    }
  }

  const analyzer = new EnhancedGaitAnalyzer();
  const result = await analyzer.performCompleteAnalysis(input);
  const reportGen = new MedicalReportGenerator();
  const medReport = reportGen.generateComprehensiveReport(
    result.advancedMetrics,
    result.kinematicSummary,
    result.compensationAnalysis,
    result.frontalMetrics,
    result.cycleAnalysis,
    result.detectedGaitCycles,
    result.detailedKinematics,
    input.ogs as never,
    input.patient,
  );
  return { result, medReport };
}
