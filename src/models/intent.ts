import { RiskTag } from './riskTag';
import { BlastRadiusResult } from './blastRadius';

/** 코드 수정 범위 정의 */
export interface ModificationScope {
  /** 대상 파일 경로 목록 */
  files: string[];
  /** 대상 심볼(함수/클래스) 이름 목록 */
  symbols: string[];
  /** 코드 범위 (줄 번호) */
  ranges: Array<{ file: string; startLine: number; endLine: number }>;
}

/** 의도 기록 상태 */
export type IntentStatus = 'pending' | 'approved' | 'applied' | 'reverted';

/**
 * Intent Record: 수정 의도의 구조화된 기록.
 * RAG 검색을 위한 벡터 임베딩을 포함하며,
 * 과거 수정 컨텍스트의 시맨틱 메모리로 기능합니다.
 */
export interface IntentRecord {
  /** 고유 식별자 */
  id: string;
  /** 기록 시각 (Unix timestamp ms) */
  timestamp: number;
  /** 수정 의도에 대한 자연어 설명 */
  description: string;
  /** 수정 대상 범위 */
  scope: ModificationScope;
  /** 자동 감지된 위험 태그 */
  riskTags: RiskTag[];
  /** 수정 시점의 의존성 스냅샷 (관련 파일 경로 목록) */
  dependencySnapshot: string[];
  /** 적용된 MARS 모드 */
  mode: 'beginner' | 'expert';
  /** 현재 상태 */
  status: IntentStatus;
  /** 시맨틱 검색용 벡터 임베딩 */
  embedding: number[];
  /** 연관된 Blast Radius 분석 결과 */
  blastRadius?: BlastRadiusResult;
  /** 추가 메타데이터 */
  metadata: IntentMetadata;
}

/** Intent 부가 메타데이터 */
export interface IntentMetadata {
  /** Expert 모드에서 승인한 사용자 */
  approvedBy?: string;
  /** 수정 적용 시각 */
  appliedAt?: number;
  /** 관련된 이전 Intent ID 목록 */
  relatedIntents?: string[];
  /** 사용자 피드백 (향후 Reinforced RAG용) */
  feedback?: 'positive' | 'negative' | 'neutral';
  /** 사용자가 추가한 자유 형식 메모 */
  notes?: string;
}

/** RAG 검색 결과 */
export interface RagSearchResult {
  /** 매칭된 Intent */
  intent: IntentRecord;
  /** 코사인 유사도 점수 (0-1) */
  similarity: number;
}

/** Intent 생성 시 필요한 입력 데이터 */
export interface CreateIntentInput {
  description: string;
  scope: ModificationScope;
  mode: 'beginner' | 'expert';
  blastRadius?: BlastRadiusResult;
  notes?: string;
}
