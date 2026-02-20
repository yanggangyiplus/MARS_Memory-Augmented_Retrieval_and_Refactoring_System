import * as path from 'path';
import { AstParser } from './astParser';
import { DependencyGraph } from './dependencyGraph';
import { RiskTagger } from './riskTagger';
import { BlastRadiusResult, DependencyEdge } from '../../models/blastRadius';
import { RiskTag } from '../../models/riskTag';
import { Logger } from '../../utils/logger';

/**
 * Blast Radius Engine: 코드 수정의 영향 반경을 계산하는 핵심 엔진.
 *
 * 1. AST 파서로 프로젝트를 분석
 * 2. 의존성 그래프를 구축
 * 3. 수정 대상 심볼로부터 BFS 탐색으로 영향 범위 산출
 * 4. Risk Tagger로 각 파일에 위험 태그와 점수 할당
 */
export class BlastRadiusEngine {
  private astParser: AstParser;
  private dependencyGraph: DependencyGraph;
  private riskTagger: RiskTagger;
  private initialized = false;

  constructor() {
    this.astParser = new AstParser();
    this.dependencyGraph = new DependencyGraph(this.astParser);
    this.riskTagger = new RiskTagger();
  }

  /**
   * 엔진을 초기화합니다. 프로젝트 루트를 기준으로 AST 파싱 및
   * 의존성 그래프를 구축합니다.
   */
  async initialize(rootDir: string, tsConfigPath?: string): Promise<void> {
    Logger.info(`Blast Radius Engine 초기화: ${rootDir}`);
    this.astParser.initialize(rootDir, tsConfigPath);
    this.dependencyGraph.build();
    this.initialized = true;
    Logger.info(`의존성 그래프 구축 완료: ${this.dependencyGraph.size}개 파일`);
  }

  /**
   * 특정 파일의 특정 심볼에 대한 Blast Radius를 계산합니다.
   *
   * @param targetFile - 수정 대상 파일 절대 경로
   * @param targetSymbol - 수정 대상 심볼 이름
   * @param maxDepth - 최대 탐색 깊이 (기본 5)
   */
  analyze(targetFile: string, targetSymbol: string, maxDepth: number = 5): BlastRadiusResult {
    if (!this.initialized) {
      throw new Error('BlastRadiusEngine이 초기화되지 않았습니다.');
    }

    Logger.info(`영향 분석 시작: ${targetSymbol} @ ${path.basename(targetFile)}`);

    // 대상 파일의 심볼 사용처 추적
    const symbolUsages = this.dependencyGraph.findSymbolUsages(targetSymbol, targetFile);

    // BFS로 전이적 의존자 탐색
    const transitiveDeps = this.dependencyGraph.getTransitiveDependents(targetFile, maxDepth);

    // 심볼 직접 사용자 + 전이적 의존자를 병합
    const impactedPaths = new Map<string, { symbols: string[]; distance: number }>();

    // 직접 사용자 (distance = 1)
    for (const usagePath of symbolUsages) {
      const node = this.dependencyGraph.getNode(usagePath);
      const symbols = node
        ? node.exports.map((e) => e.name)
        : [];
      impactedPaths.set(usagePath, { symbols, distance: 1 });
    }

    // 전이적 의존자
    for (const dep of transitiveDeps) {
      if (!impactedPaths.has(dep.path)) {
        const node = this.dependencyGraph.getNode(dep.path);
        const symbols = node ? node.exports.map((e) => e.name) : [];
        impactedPaths.set(dep.path, { symbols, distance: dep.distance });
      }
    }

    // RiskTagger로 영향 파일에 위험 태그와 수준 할당
    const impactedArray = Array.from(impactedPaths.entries()).map(([p, info]) => ({
      path: p,
      symbols: info.symbols,
      distance: info.distance,
    }));
    const impactedFiles = this.riskTagger.enrichImpactedFiles(impactedArray);

    // 대상 파일 자체의 위험 태그
    const targetTags = this.riskTagger.tagAll(targetFile, [targetSymbol]);

    // 전체 위험 태그 집합
    const allTags = new Set<RiskTag>(targetTags);
    for (const file of impactedFiles) {
      for (const tag of file.riskTags) {
        allTags.add(tag);
      }
    }

    // 종합 위험 점수 계산
    const totalRiskScore = this.calculateTotalRisk(
      targetTags,
      impactedFiles.length,
      impactedFiles.map((f) => f.distance)
    );

    // 관련 의존성 엣지 수집
    const dependencyChain = this.collectDependencyChain(targetFile, impactedPaths);

    const result: BlastRadiusResult = {
      targetFile,
      targetSymbol,
      impactedFiles: impactedFiles.sort((a, b) => a.distance - b.distance),
      totalRiskScore,
      riskTags: Array.from(allTags),
      dependencyChain,
      analyzedAt: Date.now(),
    };

    Logger.info(
      `영향 분석 완료: ${impactedFiles.length}개 파일 영향, 위험도 ${totalRiskScore}`
    );

    return result;
  }

  /**
   * 파일 수준의 Blast Radius를 계산합니다 (심볼 미지정 시).
   * 해당 파일이 export하는 모든 심볼의 영향을 종합합니다.
   */
  analyzeFile(targetFile: string, maxDepth: number = 5): BlastRadiusResult {
    const node = this.dependencyGraph.getNode(targetFile);
    const primarySymbol = node?.exports[0]?.name || path.basename(targetFile);

    return this.analyze(targetFile, primarySymbol, maxDepth);
  }

  /** 종합 위험 점수 산출 */
  private calculateTotalRisk(
    targetTags: RiskTag[],
    impactedCount: number,
    distances: number[]
  ): number {
    const baseScore = this.riskTagger.calculateRiskScore(targetTags);

    // 영향 파일 수에 비례한 가산 (최대 20점)
    const countBonus = Math.min(20, impactedCount * 2);

    // 가까운 파일이 많을수록 위험도 증가
    const closeFiles = distances.filter((d) => d <= 2).length;
    const proximityBonus = Math.min(15, closeFiles * 3);

    return Math.min(100, baseScore + countBonus + proximityBonus);
  }

  /** 영향 범위에 관련된 의존성 엣지 수집 */
  private collectDependencyChain(
    targetFile: string,
    impactedPaths: Map<string, { symbols: string[]; distance: number }>
  ): DependencyEdge[] {
    const relevantFiles = new Set([targetFile, ...impactedPaths.keys()]);
    const allEdges = this.dependencyGraph.getAllEdges();
    return allEdges.filter((e) => relevantFiles.has(e.from) || relevantFiles.has(e.to));
  }

  /** 엔진 재초기화 (파일 변경 후) */
  async rebuild(rootDir: string, tsConfigPath?: string): Promise<void> {
    this.dispose();
    await this.initialize(rootDir, tsConfigPath);
  }

  dispose(): void {
    this.astParser.dispose();
    this.initialized = false;
  }
}
