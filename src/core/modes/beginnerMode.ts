import { BlastRadiusEngine } from '../analysis/blastRadiusEngine';
import { RagPipeline } from '../memory/ragPipeline';
import { CreateIntentInput, IntentRecord, RagSearchResult } from '../../models/intent';
import { BlastRadiusResult } from '../../models/blastRadius';
import { Logger } from '../../utils/logger';

/**
 * Beginner Mode: AI가 자율적으로 분석하고 제안합니다.
 *
 * - 수정 의도 입력 시 자동으로 Blast Radius 분석 실행
 * - RAG로 유사 과거 사례를 자동 검색하여 위험 경고 제공
 * - 자동 승인 추천 (임계값 이하 시)
 */
export class BeginnerMode {
  constructor(
    private blastRadiusEngine: BlastRadiusEngine,
    private ragPipeline: RagPipeline
  ) {}

  /**
   * 자동 분석 + 제안 워크플로우.
   * 1. RAG로 유사 의도 검색
   * 2. Blast Radius 자동 계산
   * 3. 위험도 기반 자동 제안 생성
   */
  async analyzeAndSuggest(input: CreateIntentInput): Promise<{
    intent: IntentRecord;
    blastRadius: BlastRadiusResult | null;
    relatedIntents: RagSearchResult[];
    context: string;
    autoApproved: boolean;
    suggestion: string;
  }> {
    Logger.info('[Beginner Mode] 자동 분석 시작');

    // Blast Radius 분석 (첫 번째 대상 파일 기준)
    let blastRadius: BlastRadiusResult | null = null;
    if (input.scope.files.length > 0 && input.scope.symbols.length > 0) {
      try {
        blastRadius = this.blastRadiusEngine.analyze(
          input.scope.files[0],
          input.scope.symbols[0]
        );
        input.blastRadius = blastRadius;
      } catch (e) {
        Logger.warn(`[Beginner Mode] Blast Radius 분석 실패: ${e}`);
      }
    }

    // RAG 기반 Intent 생성
    const { intent, relatedIntents, context } =
      await this.ragPipeline.createIntentWithRag(input);

    // 자동 승인 여부 판단 (위험도 40 미만이면 자동 승인)
    const riskScore = blastRadius?.totalRiskScore ?? 0;
    const hasNegativeFeedback = relatedIntents.some(
      (r) => r.intent.metadata.feedback === 'negative'
    );
    const autoApproved = riskScore < 40 && !hasNegativeFeedback;

    // 제안 메시지 생성
    const suggestion = this.generateSuggestion(riskScore, relatedIntents, hasNegativeFeedback);

    Logger.info(`[Beginner Mode] 분석 완료 — 위험도: ${riskScore}, 자동 승인: ${autoApproved}`);

    return {
      intent,
      blastRadius,
      relatedIntents,
      context,
      autoApproved,
      suggestion,
    };
  }

  /** 위험도와 과거 사례를 기반으로 사용자에게 표시할 제안 메시지 생성 */
  private generateSuggestion(
    riskScore: number,
    relatedIntents: RagSearchResult[],
    hasNegativeFeedback: boolean
  ): string {
    const parts: string[] = [];

    if (riskScore >= 80) {
      parts.push('위험도가 매우 높습니다. Expert 모드로 전환하여 수동 검토를 권장합니다.');
    } else if (riskScore >= 60) {
      parts.push('중간 이상의 위험도가 감지되었습니다. 영향 범위를 신중히 확인하세요.');
    } else if (riskScore >= 40) {
      parts.push('경미한 위험이 감지되었습니다. 자동 분석 결과를 확인하세요.');
    } else {
      parts.push('낮은 위험도입니다. 안전하게 진행할 수 있습니다.');
    }

    if (hasNegativeFeedback) {
      parts.push('유사 수정이 과거에 부정적 피드백을 받았습니다. 주의하세요.');
    }

    if (relatedIntents.length > 0) {
      parts.push(`${relatedIntents.length}건의 유사 과거 사례가 발견되었습니다.`);
    }

    return parts.join(' ');
  }
}
