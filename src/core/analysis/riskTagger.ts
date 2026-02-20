import { RiskTag, RiskLevel, RISK_PATH_PATTERNS, RISK_TAG_WEIGHTS, riskScoreToLevel } from '../../models/riskTag';
import { ImpactedFile } from '../../models/blastRadius';

/**
 * 코드 위험 태그 자동 분류기.
 * 파일 경로 패턴과 심볼 키워드를 기반으로 위험 태그를 할당합니다.
 */
export class RiskTagger {
  /**
   * 파일 경로를 분석하여 해당하는 위험 태그를 반환합니다.
   * 경로의 각 세그먼트를 RISK_PATH_PATTERNS와 대조합니다.
   */
  tagFile(filePath: string): RiskTag[] {
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    const tags = new Set<RiskTag>();

    for (const [pattern, tag] of Object.entries(RISK_PATH_PATTERNS)) {
      if (normalizedPath.includes(pattern)) {
        tags.add(tag);
      }
    }

    return Array.from(tags);
  }

  /**
   * 심볼 이름 목록을 분석하여 위험 태그를 반환합니다.
   * 심볼 이름에 포함된 키워드 기반으로 태깅합니다.
   */
  tagSymbols(symbolNames: string[]): RiskTag[] {
    const tags = new Set<RiskTag>();
    const keywordMap: Record<string, RiskTag> = {
      'auth': RiskTag.Auth,
      'login': RiskTag.Auth,
      'password': RiskTag.Auth,
      'token': RiskTag.Auth,
      'session': RiskTag.Auth,
      'query': RiskTag.Database,
      'insert': RiskTag.Database,
      'update': RiskTag.Database,
      'delete': RiskTag.Database,
      'schema': RiskTag.Database,
      'validate': RiskTag.Validation,
      'sanitize': RiskTag.Validation,
      'parse': RiskTag.Validation,
      'fetch': RiskTag.Api,
      'request': RiskTag.Api,
      'response': RiskTag.Api,
      'endpoint': RiskTag.Api,
      'state': RiskTag.State,
      'dispatch': RiskTag.State,
      'reducer': RiskTag.State,
      'encrypt': RiskTag.Security,
      'decrypt': RiskTag.Security,
      'hash': RiskTag.Security,
      'permission': RiskTag.Security,
      'payment': RiskTag.Payment,
      'charge': RiskTag.Payment,
      'config': RiskTag.Config,
      'migrate': RiskTag.Migration,
    };

    for (const symbol of symbolNames) {
      const lower = symbol.toLowerCase();
      for (const [keyword, tag] of Object.entries(keywordMap)) {
        if (lower.includes(keyword)) {
          tags.add(tag);
        }
      }
    }

    return Array.from(tags);
  }

  /** 파일 경로 + 심볼을 결합하여 종합 위험 태그 산출 */
  tagAll(filePath: string, symbolNames: string[]): RiskTag[] {
    const fileTags = this.tagFile(filePath);
    const symbolTags = this.tagSymbols(symbolNames);
    return Array.from(new Set([...fileTags, ...symbolTags]));
  }

  /**
   * 위험 태그 목록으로부터 종합 위험 점수를 계산합니다.
   * 각 태그의 가중치 중 최대값을 기준으로 산출합니다.
   */
  calculateRiskScore(tags: RiskTag[]): number {
    if (tags.length === 0) return 0;

    // 최대 가중치를 기본 점수로, 추가 태그당 소량 가산
    const weights = tags.map((tag) => RISK_TAG_WEIGHTS[tag]);
    const maxWeight = Math.max(...weights);
    const additionalScore = (tags.length - 1) * 3;

    return Math.min(100, maxWeight + additionalScore);
  }

  /** 위험 점수를 위험 수준으로 변환 */
  scoreToLevel(score: number): RiskLevel {
    return riskScoreToLevel(score);
  }

  /**
   * 영향받는 파일들에 위험 태그와 위험 수준을 할당합니다.
   */
  enrichImpactedFiles(files: Array<{ path: string; symbols: string[]; distance: number }>): ImpactedFile[] {
    return files.map((file) => {
      const riskTags = this.tagAll(file.path, file.symbols);
      const score = this.calculateRiskScore(riskTags);
      // 거리가 멀수록 직접적 위험이 감소하므로 거리 보정 적용
      const adjustedScore = Math.max(0, score - file.distance * 5);

      return {
        path: file.path,
        symbols: file.symbols,
        riskLevel: this.scoreToLevel(adjustedScore),
        distance: file.distance,
        riskTags,
      };
    });
  }
}
