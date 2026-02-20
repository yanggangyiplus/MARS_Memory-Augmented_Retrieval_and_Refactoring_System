import { RiskTag, RiskLevel } from './riskTag';

/** 영향을 받는 개별 파일 정보 */
export interface ImpactedFile {
  path: string;
  symbols: string[];
  riskLevel: RiskLevel;
  /** 원본 수정 대상으로부터의 호출 체인 거리 */
  distance: number;
  riskTags: RiskTag[];
}

/** 의존성 체인의 개별 노드 (from → to 관계) */
export interface DependencyEdge {
  from: string;
  to: string;
  /** 관계 유형: import, call, type-reference, extends 등 */
  type: 'import' | 'call' | 'type-reference' | 'extends' | 'implements' | 'reexport';
  /** 관련 심볼 이름 */
  symbols: string[];
}

/**
 * Blast Radius 분석 결과.
 * 특정 심볼 수정 시 영향을 받는 전체 범위와 위험도를 나타냅니다.
 */
export interface BlastRadiusResult {
  /** 수정 대상 파일 경로 */
  targetFile: string;
  /** 수정 대상 심볼 (함수/클래스/변수명) */
  targetSymbol: string;
  /** 영향을 받는 파일 목록 */
  impactedFiles: ImpactedFile[];
  /** 종합 위험 점수 (0-100) */
  totalRiskScore: number;
  /** 감지된 위험 태그 목록 */
  riskTags: RiskTag[];
  /** 의존성 관계 체인 */
  dependencyChain: DependencyEdge[];
  /** 분석 수행 시각 */
  analyzedAt: number;
}

/** 의존성 그래프의 개별 노드 */
export interface DependencyNode {
  /** 파일 경로 */
  filePath: string;
  /** 파일이 export하는 심볼 목록 */
  exports: SymbolInfo[];
  /** 파일이 import하는 심볼 목록 */
  imports: ImportInfo[];
}

/** 심볼 정보 (함수, 클래스, 변수, 타입 등) */
export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum';
  /** 정의 위치 (줄 번호) */
  line: number;
  /** 해당 심볼이 참조하는 다른 심볼 */
  references: string[];
}

/** Import 정보 */
export interface ImportInfo {
  /** import된 심볼 이름 목록 */
  symbols: string[];
  /** import 소스 모듈 경로 */
  source: string;
  /** 해석된 절대 경로 */
  resolvedPath?: string;
}
