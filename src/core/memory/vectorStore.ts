import * as fs from 'fs';
import * as path from 'path';

/** 벡터 저장소 내 개별 항목 */
interface VectorEntry {
  id: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}

/**
 * JSON 기반 경량 벡터 저장소.
 * 코사인 유사도를 사용하여 시맨틱 검색을 수행합니다.
 * 네이티브 의존성 없이 동작합니다.
 */
export class VectorStore {
  private entries: VectorEntry[] = [];
  private storagePath: string;

  constructor(storageDir: string) {
    this.storagePath = path.join(storageDir, 'vector-store.json');
  }

  /** 저장소 초기화 — 기존 데이터 로드 또는 새 파일 생성 */
  async initialize(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.storagePath)) {
      try {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        this.entries = JSON.parse(raw);
      } catch {
        this.entries = [];
      }
    }
  }

  /** 벡터 항목 추가 또는 업데이트 */
  async upsert(id: string, embedding: number[], metadata?: Record<string, unknown>): Promise<void> {
    const existingIdx = this.entries.findIndex((e) => e.id === id);
    const entry: VectorEntry = { id, embedding, metadata };

    if (existingIdx >= 0) {
      this.entries[existingIdx] = entry;
    } else {
      this.entries.push(entry);
    }

    await this.persist();
  }

  /** ID로 항목 삭제 */
  async remove(id: string): Promise<boolean> {
    const prevLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length !== prevLength) {
      await this.persist();
      return true;
    }
    return false;
  }

  /**
   * 코사인 유사도 기반으로 가장 유사한 벡터 k개를 검색합니다.
   * @param queryEmbedding - 질의 벡터
   * @param topK - 반환할 최대 결과 수
   * @param minSimilarity - 최소 유사도 임계값
   */
  async search(
    queryEmbedding: number[],
    topK: number = 5,
    minSimilarity: number = 0.3
  ): Promise<Array<{ id: string; similarity: number; metadata?: Record<string, unknown> }>> {
    const results = this.entries
      .map((entry) => ({
        id: entry.id,
        similarity: this.cosineSimilarity(queryEmbedding, entry.embedding),
        metadata: entry.metadata,
      }))
      .filter((r) => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return results;
  }

  /** 두 벡터 간 코사인 유사도 계산 */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /** 데이터를 JSON 파일로 영속화 */
  private async persist(): Promise<void> {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storagePath, JSON.stringify(this.entries, null, 2));
  }

  /** 저장된 항목 수 */
  get count(): number {
    return this.entries.length;
  }

  /** 특정 ID가 존재하는지 확인 */
  has(id: string): boolean {
    return this.entries.some((e) => e.id === id);
  }

  /** 전체 저장소 초기화 */
  async clear(): Promise<void> {
    this.entries = [];
    await this.persist();
  }
}
