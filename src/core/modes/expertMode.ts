import { BlastRadiusEngine } from '../analysis/blastRadiusEngine';
import { RagPipeline } from '../memory/ragPipeline';
import { IntentStore } from '../memory/intentStore';
import { CreateIntentInput, IntentRecord, RagSearchResult } from '../../models/intent';
import { BlastRadiusResult } from '../../models/blastRadius';
import { Logger } from '../../utils/logger';

/**
 * Expert Mode: 사용자가 모든 단계를 수동으로 통제합니다.
 *
 * - Blast Radius와 위험 태그를 수동으로 검토
 * - 영향 범위 가중치 수동 조정 가능
 * - 명시적 승인 후에만 Intent가 'approved' 상태로 전환
 */
export class ExpertMode {
  constructor(
    private blastRadiusEngine: BlastRadiusEngine,
    private ragPipeline: RagPipeline,
    private intentStore: IntentStore
  ) {}

  /**
   * Expert 워크플로우: 분석만 수행하고 승인은 대기합니다.
   */
  async analyze(input: CreateIntentInput): Promise<{
    intent: IntentRecord;
    blastRadius: BlastRadiusResult | null;
    relatedIntents: RagSearchResult[];
    context: string;
  }> {
    Logger.info('[Expert Mode] 수동 분석 시작');

    // Blast Radius 분석
    let blastRadius: BlastRadiusResult | null = null;
    if (input.scope.files.length > 0 && input.scope.symbols.length > 0) {
      try {
        blastRadius = this.blastRadiusEngine.analyze(
          input.scope.files[0],
          input.scope.symbols[0]
        );
        input.blastRadius = blastRadius;
      } catch (e) {
        Logger.warn(`[Expert Mode] Blast Radius 분석 실패: ${e}`);
      }
    }

    // RAG 기반 Intent 생성 (pending 상태)
    const { intent, relatedIntents, context } =
      await this.ragPipeline.createIntentWithRag(input);

    Logger.info(`[Expert Mode] 분석 완료 — 승인 대기: ${intent.id}`);

    return { intent, blastRadius, relatedIntents, context };
  }

  /**
   * Expert가 Intent를 명시적으로 승인합니다.
   * 승인자 정보를 메타데이터에 기록합니다.
   */
  async approve(intentId: string, approvedBy: string = 'expert'): Promise<boolean> {
    const intent = this.intentStore.get(intentId);
    if (!intent) {
      Logger.warn(`[Expert Mode] Intent를 찾을 수 없습니다: ${intentId}`);
      return false;
    }

    if (intent.status !== 'pending') {
      Logger.warn(`[Expert Mode] 승인 가능한 상태가 아닙니다: ${intent.status}`);
      return false;
    }

    intent.metadata.approvedBy = approvedBy;
    await this.intentStore.updateStatus(intentId, 'approved');
    Logger.info(`[Expert Mode] Intent 승인: ${intentId} by ${approvedBy}`);
    return true;
  }

  /**
   * Intent를 되돌림 상태로 변경합니다.
   */
  async revert(intentId: string): Promise<boolean> {
    const intent = this.intentStore.get(intentId);
    if (!intent) return false;

    await this.intentStore.updateStatus(intentId, 'reverted');
    Logger.info(`[Expert Mode] Intent 되돌림: ${intentId}`);
    return true;
  }

  /**
   * 특정 경로를 분석에서 제외합니다 (Expert 전용).
   * auth 폴더 등을 선택적으로 제외하는 시나리오에 사용됩니다.
   */
  filterBlastRadius(
    result: BlastRadiusResult,
    excludePaths: string[]
  ): BlastRadiusResult {
    const filtered = {
      ...result,
      impactedFiles: result.impactedFiles.filter(
        (f) => !excludePaths.some((excl) => f.path.includes(excl))
      ),
    };

    // 위험도 재계산 (제외된 파일 반영)
    if (filtered.impactedFiles.length < result.impactedFiles.length) {
      const ratio = filtered.impactedFiles.length / Math.max(1, result.impactedFiles.length);
      filtered.totalRiskScore = Math.round(result.totalRiskScore * ratio);
    }

    return filtered;
  }
}
