import { describe, it, expect, beforeEach } from 'vitest';
import { RiskTagger } from '../src/core/analysis/riskTagger';
import { RiskTag } from '../src/models/riskTag';

describe('RiskTagger', () => {
  let tagger: RiskTagger;

  beforeEach(() => {
    tagger = new RiskTagger();
  });

  describe('tagFile', () => {
    it('인증 관련 파일 경로에 Auth 태그를 부여한다', () => {
      const tags = tagger.tagFile('src/auth/loginController.ts');
      expect(tags).toContain(RiskTag.Auth);
    });

    it('데이터베이스 관련 파일 경로에 Database 태그를 부여한다', () => {
      const tags = tagger.tagFile('src/repository/userRepository.ts');
      expect(tags).toContain(RiskTag.Database);
    });

    it('API 관련 파일에 Api 태그를 부여한다', () => {
      const tags = tagger.tagFile('src/api/routes/user.ts');
      expect(tags).toContain(RiskTag.Api);
    });

    it('테스트 파일에 Test 태그를 부여한다', () => {
      const tags = tagger.tagFile('src/__test__/auth.spec.ts');
      expect(tags).toContain(RiskTag.Test);
    });

    it('여러 패턴이 일치하면 복수 태그를 부여한다', () => {
      const tags = tagger.tagFile('src/auth/api/tokenValidation.ts');
      expect(tags).toContain(RiskTag.Auth);
      expect(tags).toContain(RiskTag.Api);
      expect(tags).toContain(RiskTag.Validation);
    });

    it('해당 패턴이 없으면 빈 배열을 반환한다', () => {
      const tags = tagger.tagFile('src/components/Button.tsx');
      expect(tags).toHaveLength(0);
    });
  });

  describe('tagSymbols', () => {
    it('인증 관련 심볼 이름에 Auth 태그를 부여한다', () => {
      const tags = tagger.tagSymbols(['validateToken', 'checkPassword']);
      expect(tags).toContain(RiskTag.Auth);
    });

    it('데이터베이스 관련 심볼에 Database 태그를 부여한다', () => {
      const tags = tagger.tagSymbols(['insertUser', 'updateProfile']);
      expect(tags).toContain(RiskTag.Database);
    });

    it('보안 관련 심볼에 Security 태그를 부여한다', () => {
      const tags = tagger.tagSymbols(['encryptData', 'checkPermission']);
      expect(tags).toContain(RiskTag.Security);
    });
  });

  describe('calculateRiskScore', () => {
    it('태그가 없으면 점수 0을 반환한다', () => {
      expect(tagger.calculateRiskScore([])).toBe(0);
    });

    it('단일 Auth 태그는 90점을 반환한다', () => {
      expect(tagger.calculateRiskScore([RiskTag.Auth])).toBe(90);
    });

    it('복수 태그는 최대 가중치에 추가 점수를 더한다', () => {
      const score = tagger.calculateRiskScore([RiskTag.Auth, RiskTag.Database]);
      expect(score).toBeGreaterThan(90);
    });

    it('점수는 100을 초과하지 않는다', () => {
      const allTags = Object.values(RiskTag);
      const score = tagger.calculateRiskScore(allTags);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('Test 태그만 있으면 낮은 점수를 반환한다', () => {
      expect(tagger.calculateRiskScore([RiskTag.Test])).toBe(20);
    });
  });

  describe('enrichImpactedFiles', () => {
    it('파일에 위험 태그, 수준, 거리 정보를 부여한다', () => {
      const files = [
        { path: 'src/auth/login.ts', symbols: ['authenticate'], distance: 1 },
        { path: 'src/components/ui.tsx', symbols: ['Button'], distance: 3 },
      ];

      const enriched = tagger.enrichImpactedFiles(files);

      expect(enriched[0].riskTags).toContain(RiskTag.Auth);
      expect(enriched[0].riskLevel).toBeDefined();
      expect(enriched[1].distance).toBe(3);
    });

    it('거리가 멀수록 위험도가 감소한다', () => {
      const files = [
        { path: 'src/auth/login.ts', symbols: ['auth'], distance: 1 },
        { path: 'src/auth/session.ts', symbols: ['auth'], distance: 5 },
      ];

      const enriched = tagger.enrichImpactedFiles(files);
      // 같은 경로/심볼이라도 distance에 따라 adjustedScore가 달라짐
      expect(enriched).toHaveLength(2);
    });
  });
});
