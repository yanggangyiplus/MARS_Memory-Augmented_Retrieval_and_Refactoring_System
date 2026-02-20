import { MarsConfig } from '../../utils/config';
import { Logger } from '../../utils/logger';

/**
 * 임베딩 제공자 추상화 레이어.
 * 로컬 모델(@xenova/transformers)과 OpenAI API를 동적으로 전환합니다.
 */
export class EmbeddingProvider {
  private config: MarsConfig;
  private localPipeline: any = null;

  constructor(config: MarsConfig) {
    this.config = config;
  }

  /**
   * 텍스트를 벡터 임베딩으로 변환합니다.
   * 설정에 따라 로컬 또는 OpenAI를 사용합니다.
   */
  async embed(text: string): Promise<number[]> {
    const provider = this.config.embeddingProvider;

    if (provider === 'openai') {
      return this.embedWithOpenAI(text);
    }
    return this.embedWithLocal(text);
  }

  /** 여러 텍스트를 배치로 임베딩 */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  /**
   * @xenova/transformers의 all-MiniLM-L6-v2 모델로 로컬 임베딩.
   * 384차원 벡터를 생성합니다.
   */
  private async embedWithLocal(text: string): Promise<number[]> {
    try {
      if (!this.localPipeline) {
        Logger.info('로컬 임베딩 모델 로딩 중...');
        const { pipeline } = await import('@xenova/transformers');
        this.localPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        Logger.info('로컬 임베딩 모델 로딩 완료');
      }

      const output = await this.localPipeline(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data as Float32Array);
    } catch (error) {
      Logger.warn('로컬 임베딩 실패, 폴백 해시 벡터를 사용합니다.');
      return this.fallbackHash(text);
    }
  }

  /**
   * OpenAI text-embedding-3-small 모델로 클라우드 임베딩.
   * 1536차원 벡터를 생성합니다.
   */
  private async embedWithOpenAI(text: string): Promise<number[]> {
    const apiKey = this.config.openaiApiKey;
    if (!apiKey) {
      Logger.warn('OpenAI API 키가 설정되지 않았습니다. 로컬 임베딩으로 폴백합니다.');
      return this.embedWithLocal(text);
    }

    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey });
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      Logger.error(`OpenAI 임베딩 실패: ${error}`);
      return this.embedWithLocal(text);
    }
  }

  /**
   * 폴백용 결정적 해시 벡터 생성.
   * 실제 시맨틱 의미는 담지 않지만, 동일 입력에 동일 출력을 보장합니다.
   * 임베딩 모델을 사용할 수 없는 환경에서 기본 동작을 유지합니다.
   */
  private fallbackHash(text: string): number[] {
    const dimension = 384;
    const vector = new Array(dimension).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const idx = i % dimension;
      vector[idx] = (vector[idx] + charCode * (i + 1)) % 1000 / 1000;
    }

    // L2 정규화
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /** 현재 사용 중인 임베딩 제공자 반환 */
  get currentProvider(): string {
    return this.config.embeddingProvider;
  }
}
