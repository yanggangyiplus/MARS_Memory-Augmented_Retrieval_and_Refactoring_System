import { IntentStore } from './intentStore';
import { VectorStore } from './vectorStore';
import { EmbeddingProvider } from './embeddingProvider';
import { IntentRecord, RagSearchResult, CreateIntentInput } from '../../models/intent';
import { Logger } from '../../utils/logger';

/**
 * RAG (Retrieval-Augmented Generation) 파이프라인.
 *
 * 1. Retrieval: 사용자 질의를 임베딩 → 벡터 검색으로 유사 과거 Intent 조회
 * 2. Augmentation: 관련 Intent 컨텍스트를 구조화된 텍스트로 조립
 * 3. 새로운 Intent 생성 시 과거 사례를 참조하여 위험 회피
 */
export class RagPipeline {
  constructor(
    private intentStore: IntentStore,
    private vectorStore: VectorStore,
    private embeddingProvider: EmbeddingProvider
  ) {}

  /**
   * 자연어 질의로 과거 유사 Intent를 검색합니다.
   * @param query - 검색 질의 (수정 의도 설명)
   * @param topK - 반환할 최대 결과 수
   */
  async searchSimilarIntents(query: string, topK: number = 5): Promise<RagSearchResult[]> {
    Logger.info(`RAG 검색: "${query.substring(0, 50)}..."`);

    // 질의를 벡터로 변환
    const queryEmbedding = await this.embeddingProvider.embed(query);

    // 벡터 스토어에서 유사 항목 검색
    const vectorResults = await this.vectorStore.search(queryEmbedding, topK);

    // 벡터 결과를 Intent 레코드와 매핑
    const results: RagSearchResult[] = [];
    for (const vr of vectorResults) {
      const intent = this.intentStore.get(vr.id);
      if (intent) {
        results.push({ intent, similarity: vr.similarity });
      }
    }

    Logger.info(`RAG 검색 완료: ${results.length}건 발견`);
    return results;
  }

  /**
   * RAG 컨텍스트 문자열을 생성합니다.
   * 유사 과거 Intent를 구조화된 텍스트로 조립하여
   * LLM 프롬프트나 사용자 리뷰에 활용합니다.
   */
  async buildContext(query: string, topK: number = 3): Promise<string> {
    const results = await this.searchSimilarIntents(query, topK);

    if (results.length === 0) {
      return '관련 과거 수정 사례가 없습니다.';
    }

    const lines: string[] = ['=== 관련 과거 수정 사례 ===\n'];

    for (let i = 0; i < results.length; i++) {
      const { intent, similarity } = results[i];
      const date = new Date(intent.timestamp).toLocaleDateString('ko-KR');
      const riskStr = intent.riskTags.length > 0 ? intent.riskTags.join(', ') : '없음';
      const statusEmoji = this.statusLabel(intent.status);

      lines.push(`[사례 ${i + 1}] (유사도: ${(similarity * 100).toFixed(1)}%)`);
      lines.push(`  설명: ${intent.description}`);
      lines.push(`  날짜: ${date}`);
      lines.push(`  상태: ${statusEmoji}`);
      lines.push(`  위험 태그: ${riskStr}`);
      lines.push(`  대상 파일: ${intent.scope.files.join(', ')}`);

      if (intent.blastRadius) {
        lines.push(`  영향 파일 수: ${intent.blastRadius.impactedFiles.length}`);
        lines.push(`  위험도: ${intent.blastRadius.totalRiskScore}/100`);
      }

      if (intent.metadata.feedback) {
        lines.push(`  피드백: ${intent.metadata.feedback}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 새 Intent를 생성하고 자동으로 임베딩 + 관련 과거 사례를 연결합니다.
   */
  async createIntentWithRag(input: CreateIntentInput): Promise<{
    intent: IntentRecord;
    relatedIntents: RagSearchResult[];
    context: string;
  }> {
    // 1. 유사 과거 사례 검색
    const relatedIntents = await this.searchSimilarIntents(input.description, 3);

    // 2. 의도를 임베딩으로 변환
    const embedding = await this.embeddingProvider.embed(input.description);

    // 3. Intent 생성
    const intent = await this.intentStore.create(input, embedding);

    // 4. 관련 Intent ID 연결
    if (relatedIntents.length > 0) {
      intent.metadata.relatedIntents = relatedIntents.map((r) => r.intent.id);
    }

    // 5. 컨텍스트 텍스트 생성
    const context = this.formatRelatedContext(relatedIntents);

    Logger.info(`RAG Intent 생성 완료: ${intent.id}, 관련 사례 ${relatedIntents.length}건`);

    return { intent, relatedIntents, context };
  }

  /** 관련 사례를 요약 텍스트로 변환 */
  private formatRelatedContext(results: RagSearchResult[]): string {
    if (results.length === 0) return '';

    return results
      .map((r, i) => {
        const warnings: string[] = [];
        if (r.intent.metadata.feedback === 'negative') {
          warnings.push('[주의] 이전에 부정적 피드백을 받은 유사 수정 사례입니다.');
        }
        if (r.intent.blastRadius && r.intent.blastRadius.totalRiskScore > 70) {
          warnings.push(`[경고] 유사 사례의 위험도가 ${r.intent.blastRadius.totalRiskScore}점이었습니다.`);
        }

        return [
          `관련 사례 ${i + 1}: ${r.intent.description}`,
          ...warnings,
        ].join('\n');
      })
      .join('\n\n');
  }

  /** Intent 상태 라벨 */
  private statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '대기 중',
      approved: '승인됨',
      applied: '적용됨',
      reverted: '되돌림',
    };
    return labels[status] || status;
  }
}
