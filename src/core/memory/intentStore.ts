import * as fs from 'fs';
import * as path from 'path';
import { IntentRecord, CreateIntentInput, IntentStatus } from '../../models/intent';
import { VectorStore } from './vectorStore';
import { RiskTagger } from '../analysis/riskTagger';
import { Logger } from '../../utils/logger';

/**
 * Intent Store: 수정 의도를 구조화하여 저장·관리하는 CRUD 저장소.
 * JSON 파일로 영속화하며, VectorStore와 연동하여 시맨틱 검색을 지원합니다.
 */
export class IntentStore {
  private intents: Map<string, IntentRecord> = new Map();
  private storagePath: string;
  private riskTagger: RiskTagger;

  constructor(
    storageDir: string,
    private vectorStore: VectorStore
  ) {
    this.storagePath = path.join(storageDir, 'intents.json');
    this.riskTagger = new RiskTagger();
    this.loadFromDisk();
  }

  /** 디스크에서 기존 데이터 로드 */
  private loadFromDisk(): void {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.storagePath)) {
      try {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        const arr: IntentRecord[] = JSON.parse(raw);
        for (const intent of arr) {
          this.intents.set(intent.id, intent);
        }
        Logger.info(`Intent Store: ${this.intents.size}개 기록 로드 완료`);
      } catch {
        Logger.warn('Intent Store 로드 실패, 새로 생성합니다.');
      }
    }
  }

  /** 디스크에 데이터 저장 */
  private saveToDisk(): void {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const arr = Array.from(this.intents.values());
    fs.writeFileSync(this.storagePath, JSON.stringify(arr, null, 2));
  }

  /**
   * 새 Intent를 생성하고 저장합니다.
   * 위험 태그 자동 감지와 VectorStore 등록을 수행합니다.
   */
  async create(input: CreateIntentInput, embedding: number[]): Promise<IntentRecord> {
    const id = this.generateId();

    // 위험 태그 자동 분류
    const allFiles = input.scope.files;
    const allSymbols = input.scope.symbols;
    const autoTags = this.riskTagger.tagAll(
      allFiles.join(' '),
      allSymbols
    );

    const intent: IntentRecord = {
      id,
      timestamp: Date.now(),
      description: input.description,
      scope: input.scope,
      riskTags: autoTags,
      dependencySnapshot: [...input.scope.files],
      mode: input.mode,
      status: 'pending',
      embedding,
      blastRadius: input.blastRadius,
      metadata: {
        notes: input.notes,
        relatedIntents: [],
      },
    };

    this.intents.set(id, intent);
    this.saveToDisk();

    // 벡터 저장소에도 등록
    await this.vectorStore.upsert(id, embedding, {
      description: input.description,
      timestamp: intent.timestamp,
    });

    Logger.info(`Intent 생성: ${id} — "${input.description}"`);
    return intent;
  }

  /** ID로 Intent 조회 */
  get(id: string): IntentRecord | undefined {
    return this.intents.get(id);
  }

  /** 모든 Intent 반환 (최신순 정렬) */
  getAll(): IntentRecord[] {
    return Array.from(this.intents.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Intent 상태 업데이트 */
  async updateStatus(id: string, status: IntentStatus): Promise<boolean> {
    const intent = this.intents.get(id);
    if (!intent) return false;

    intent.status = status;
    if (status === 'applied') {
      intent.metadata.appliedAt = Date.now();
    }

    this.saveToDisk();
    Logger.info(`Intent ${id} 상태 변경: ${status}`);
    return true;
  }

  /** Intent 피드백 기록 (향후 Reinforced RAG용) */
  async recordFeedback(
    id: string,
    feedback: 'positive' | 'negative' | 'neutral'
  ): Promise<boolean> {
    const intent = this.intents.get(id);
    if (!intent) return false;

    intent.metadata.feedback = feedback;
    this.saveToDisk();
    return true;
  }

  /** Intent 삭제 */
  async delete(id: string): Promise<boolean> {
    const deleted = this.intents.delete(id);
    if (deleted) {
      this.saveToDisk();
      await this.vectorStore.remove(id);
      Logger.info(`Intent 삭제: ${id}`);
    }
    return deleted;
  }

  /** 상태별 필터링 */
  getByStatus(status: IntentStatus): IntentRecord[] {
    return this.getAll().filter((i) => i.status === status);
  }

  /** 특정 파일과 관련된 Intent 검색 */
  getByFile(filePath: string): IntentRecord[] {
    return this.getAll().filter((i) => i.scope.files.some((f) => f.includes(filePath)));
  }

  /** 총 저장된 Intent 수 */
  get count(): number {
    return this.intents.size;
  }

  /** 고유 ID 생성 (타임스탬프 + 랜덤) */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `intent_${timestamp}_${random}`;
  }
}
