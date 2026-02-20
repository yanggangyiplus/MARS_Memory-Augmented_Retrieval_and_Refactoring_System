/**
 * 코드 수정 시 자동 분류되는 위험 태그 열거형.
 * 경로 패턴, 키워드, AST 분석 결과를 기반으로 태깅됩니다.
 */
export enum RiskTag {
  Auth = 'auth',
  Database = 'database',
  Validation = 'validation',
  Api = 'api',
  State = 'state',
  Security = 'security',
  Payment = 'payment',
  Config = 'config',
  Migration = 'migration',
  Test = 'test',
}

/** 위험 수준 (Blast Radius 계산 결과) */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 각 위험 태그에 대한 기본 가중치 설정 */
export const RISK_TAG_WEIGHTS: Record<RiskTag, number> = {
  [RiskTag.Auth]: 90,
  [RiskTag.Security]: 95,
  [RiskTag.Payment]: 95,
  [RiskTag.Database]: 85,
  [RiskTag.Migration]: 80,
  [RiskTag.Api]: 70,
  [RiskTag.Validation]: 65,
  [RiskTag.State]: 60,
  [RiskTag.Config]: 50,
  [RiskTag.Test]: 20,
};

/** 위험 수준을 점수로 변환 */
export function riskScoreToLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * 위험 태그를 자동 감지하기 위한 경로 패턴 매핑.
 * 파일 경로에 해당 키워드가 포함되면 대응하는 태그가 부여됩니다.
 */
export const RISK_PATH_PATTERNS: Record<string, RiskTag> = {
  'auth': RiskTag.Auth,
  'login': RiskTag.Auth,
  'session': RiskTag.Auth,
  'token': RiskTag.Auth,
  'db': RiskTag.Database,
  'database': RiskTag.Database,
  'repository': RiskTag.Database,
  'migration': RiskTag.Migration,
  'schema': RiskTag.Database,
  'prisma': RiskTag.Database,
  'valid': RiskTag.Validation,
  'sanitiz': RiskTag.Validation,
  'api': RiskTag.Api,
  'route': RiskTag.Api,
  'endpoint': RiskTag.Api,
  'controller': RiskTag.Api,
  'state': RiskTag.State,
  'store': RiskTag.State,
  'redux': RiskTag.State,
  'context': RiskTag.State,
  'security': RiskTag.Security,
  'encrypt': RiskTag.Security,
  'permission': RiskTag.Security,
  'payment': RiskTag.Payment,
  'billing': RiskTag.Payment,
  'stripe': RiskTag.Payment,
  'config': RiskTag.Config,
  'env': RiskTag.Config,
  'setting': RiskTag.Config,
  'test': RiskTag.Test,
  'spec': RiskTag.Test,
  '__test__': RiskTag.Test,
};
