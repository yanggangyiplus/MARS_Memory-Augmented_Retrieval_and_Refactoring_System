import { useState, useCallback } from 'react';
import type { BlastRadiusResult } from '../types';

/** Blast Radius 분석 결과를 관리하는 React Hook */
export function useBlastRadius() {
  const [result, setResult] = useState<BlastRadiusResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const setBlastRadius = useCallback((data: BlastRadiusResult) => {
    setResult(data);
    setIsAnalyzing(false);
  }, []);

  const startAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    setResult(null);
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setIsAnalyzing(false);
  }, []);

  return { result, isAnalyzing, setBlastRadius, startAnalysis, clear };
}
