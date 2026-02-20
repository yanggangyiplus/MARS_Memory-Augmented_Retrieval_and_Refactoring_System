import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VectorStore } from '../src/core/memory/vectorStore';

describe('VectorStore', () => {
  let store: VectorStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mars-test-'));
    store = new VectorStore(tempDir);
    await store.initialize();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('upsert & search', () => {
    it('벡터를 저장하고 검색할 수 있다', async () => {
      await store.upsert('a', [1, 0, 0]);
      await store.upsert('b', [0, 1, 0]);
      await store.upsert('c', [0.9, 0.1, 0]);

      const results = await store.search([1, 0, 0], 3, 0.0);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('a');
    });

    it('코사인 유사도가 높은 순으로 정렬된다', async () => {
      await store.upsert('exact', [1, 0, 0]);
      await store.upsert('similar', [0.9, 0.1, 0]);
      await store.upsert('different', [0, 0, 1]);

      const results = await store.search([1, 0, 0], 3, 0.0);
      expect(results[0].id).toBe('exact');
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it('최소 유사도 이하의 결과는 제외된다', async () => {
      await store.upsert('a', [1, 0, 0]);
      await store.upsert('opposite', [-1, 0, 0]);

      const results = await store.search([1, 0, 0], 5, 0.5);
      const ids = results.map((r) => r.id);
      expect(ids).not.toContain('opposite');
    });
  });

  describe('upsert (update)', () => {
    it('같은 ID로 다시 저장하면 업데이트된다', async () => {
      await store.upsert('x', [1, 0, 0]);
      await store.upsert('x', [0, 1, 0]);

      expect(store.count).toBe(1);

      const results = await store.search([0, 1, 0], 1, 0.0);
      expect(results[0].id).toBe('x');
      expect(results[0].similarity).toBeCloseTo(1, 2);
    });
  });

  describe('remove', () => {
    it('벡터를 삭제할 수 있다', async () => {
      await store.upsert('a', [1, 0, 0]);
      expect(store.count).toBe(1);

      const removed = await store.remove('a');
      expect(removed).toBe(true);
      expect(store.count).toBe(0);
    });

    it('존재하지 않는 ID를 삭제하면 false를 반환한다', async () => {
      const removed = await store.remove('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('persistence', () => {
    it('데이터가 파일에 영속화된다', async () => {
      await store.upsert('persist-test', [0.5, 0.5, 0]);

      // 새 인스턴스로 로드
      const store2 = new VectorStore(tempDir);
      await store2.initialize();

      expect(store2.count).toBe(1);
      expect(store2.has('persist-test')).toBe(true);
    });
  });

  describe('clear', () => {
    it('전체 저장소를 초기화할 수 있다', async () => {
      await store.upsert('a', [1, 0, 0]);
      await store.upsert('b', [0, 1, 0]);

      await store.clear();
      expect(store.count).toBe(0);
    });
  });
});
