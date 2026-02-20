import { AstParser } from './astParser';
import { DependencyNode, DependencyEdge } from '../../models/blastRadius';

/**
 * 프로젝트 전체의 파일 간 의존성 그래프.
 * AST 파싱 결과를 기반으로 import/export 관계를 추적합니다.
 */
export class DependencyGraph {
  /** 파일 경로 → DependencyNode 매핑 */
  private nodes: Map<string, DependencyNode> = new Map();
  /** 파일 경로 → 해당 파일을 import하는 파일 목록 (역방향 인덱스) */
  private reverseImports: Map<string, Set<string>> = new Map();
  /** 전체 의존성 엣지 목록 */
  private edges: DependencyEdge[] = [];

  constructor(private astParser: AstParser) {}

  /**
   * 프로젝트의 모든 소스 파일을 파싱하여 의존성 그래프를 구축합니다.
   * reverseImports 인덱스도 함께 생성합니다.
   */
  build(): void {
    this.nodes.clear();
    this.reverseImports.clear();
    this.edges = [];

    const allFiles = this.astParser.getAllSourceFiles();

    // 모든 파일의 DependencyNode를 파싱
    for (const filePath of allFiles) {
      const node = this.astParser.parseFile(filePath);
      if (node) {
        this.nodes.set(filePath, node);
      }
    }

    // import 관계를 기반으로 엣지와 역방향 인덱스 구축
    for (const [filePath, node] of this.nodes) {
      for (const imp of node.imports) {
        if (!imp.resolvedPath) continue;

        // 역방향 인덱스: import 대상 파일 → import하는 파일 목록
        if (!this.reverseImports.has(imp.resolvedPath)) {
          this.reverseImports.set(imp.resolvedPath, new Set());
        }
        this.reverseImports.get(imp.resolvedPath)!.add(filePath);

        // 엣지 생성
        this.edges.push({
          from: filePath,
          to: imp.resolvedPath,
          type: 'import',
          symbols: imp.symbols,
        });
      }
    }
  }

  /** 특정 파일의 DependencyNode 반환 */
  getNode(filePath: string): DependencyNode | undefined {
    return this.nodes.get(filePath);
  }

  /** 특정 파일을 import하는 모든 파일 반환 (직접 의존자) */
  getDependents(filePath: string): string[] {
    return Array.from(this.reverseImports.get(filePath) || []);
  }

  /** 특정 파일이 import하는 모든 파일 반환 (직접 의존성) */
  getDependencies(filePath: string): string[] {
    const node = this.nodes.get(filePath);
    if (!node) return [];
    return node.imports
      .filter((imp) => imp.resolvedPath)
      .map((imp) => imp.resolvedPath!);
  }

  /**
   * BFS로 특정 파일로부터의 전이적 의존자(transitive dependents)를 탐색합니다.
   * @param filePath - 시작 파일
   * @param maxDepth - 최대 탐색 깊이 (기본값 5)
   * @returns 깊이 정보를 포함한 의존자 목록
   */
  getTransitiveDependents(
    filePath: string,
    maxDepth: number = 5
  ): Array<{ path: string; distance: number }> {
    const visited = new Set<string>();
    const result: Array<{ path: string; distance: number }> = [];
    const queue: Array<{ path: string; distance: number }> = [{ path: filePath, distance: 0 }];

    visited.add(filePath);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.distance > 0) {
        result.push(current);
      }
      if (current.distance >= maxDepth) continue;

      const dependents = this.getDependents(current.path);
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push({ path: dep, distance: current.distance + 1 });
        }
      }
    }

    return result;
  }

  /**
   * 특정 심볼을 사용하는 파일을 추적합니다.
   * @param symbolName - 추적할 심볼 이름
   * @param sourceFile - 심볼이 정의된 파일
   */
  findSymbolUsages(symbolName: string, sourceFile: string): string[] {
    const dependents = this.getDependents(sourceFile);
    const usages: string[] = [];

    for (const depPath of dependents) {
      const node = this.nodes.get(depPath);
      if (!node) continue;

      const importsFromSource = node.imports.find(
        (imp) => imp.resolvedPath === sourceFile
      );
      if (importsFromSource && importsFromSource.symbols.includes(symbolName)) {
        usages.push(depPath);
      }
    }

    return usages;
  }

  /** 관련 엣지 필터링 반환 */
  getEdgesForFile(filePath: string): DependencyEdge[] {
    return this.edges.filter((e) => e.from === filePath || e.to === filePath);
  }

  /** 전체 엣지 반환 */
  getAllEdges(): DependencyEdge[] {
    return [...this.edges];
  }

  /** 전체 노드 수 */
  get size(): number {
    return this.nodes.size;
  }
}
