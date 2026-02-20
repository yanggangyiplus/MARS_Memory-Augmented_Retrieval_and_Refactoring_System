import { Project, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DependencyNode, SymbolInfo, ImportInfo } from '../../models/blastRadius';

/**
 * ts-morph 기반 AST 파서.
 * TypeScript/JavaScript 소스의 심볼, import/export, 참조 관계를 추출합니다.
 */
export class AstParser {
  private project: Project | null = null;

  /**
   * ts-morph Project를 초기화합니다.
   * @param tsConfigPath - tsconfig.json 경로 (선택)
   * @param rootDir - 분석 대상 루트 디렉토리
   */
  initialize(rootDir: string, tsConfigPath?: string): void {
    if (tsConfigPath) {
      this.project = new Project({ tsConfigFilePath: tsConfigPath });
    } else {
      this.project = new Project({
        compilerOptions: {
          allowJs: true,
          jsx: 4, // JsxEmit.ReactJSX
        },
      });
      this.project.addSourceFilesAtPaths(`${rootDir}/**/*.{ts,tsx,js,jsx}`);
    }
  }

  /** 프로젝트가 초기화되었는지 확인하고 반환 */
  private getProject(): Project {
    if (!this.project) {
      throw new Error('AstParser가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.');
    }
    return this.project;
  }

  /**
   * 특정 파일의 DependencyNode를 파싱합니다.
   * export된 심볼과 import 정보를 추출합니다.
   */
  parseFile(filePath: string): DependencyNode | null {
    const project = this.getProject();
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) return null;

    return {
      filePath,
      exports: this.extractExports(sourceFile),
      imports: this.extractImports(sourceFile),
    };
  }

  /** 파일에서 export된 심볼 목록 추출 */
  private extractExports(sourceFile: SourceFile): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    // export된 함수
    for (const fn of sourceFile.getFunctions()) {
      if (fn.isExported()) {
        symbols.push({
          name: fn.getName() || 'anonymous',
          kind: 'function',
          line: fn.getStartLineNumber(),
          references: this.extractReferencedSymbols(fn),
        });
      }
    }

    // export된 클래스
    for (const cls of sourceFile.getClasses()) {
      if (cls.isExported()) {
        symbols.push({
          name: cls.getName() || 'anonymous',
          kind: 'class',
          line: cls.getStartLineNumber(),
          references: this.extractReferencedSymbols(cls),
        });
      }
    }

    // export된 변수
    for (const varStmt of sourceFile.getVariableStatements()) {
      if (varStmt.isExported()) {
        for (const decl of varStmt.getDeclarations()) {
          symbols.push({
            name: decl.getName(),
            kind: 'variable',
            line: decl.getStartLineNumber(),
            references: this.extractReferencedSymbols(decl),
          });
        }
      }
    }

    // export된 인터페이스
    for (const iface of sourceFile.getInterfaces()) {
      if (iface.isExported()) {
        symbols.push({
          name: iface.getName(),
          kind: 'interface',
          line: iface.getStartLineNumber(),
          references: [],
        });
      }
    }

    // export된 타입 별칭
    for (const typeAlias of sourceFile.getTypeAliases()) {
      if (typeAlias.isExported()) {
        symbols.push({
          name: typeAlias.getName(),
          kind: 'type',
          line: typeAlias.getStartLineNumber(),
          references: [],
        });
      }
    }

    // export된 enum
    for (const enumDecl of sourceFile.getEnums()) {
      if (enumDecl.isExported()) {
        symbols.push({
          name: enumDecl.getName(),
          kind: 'enum',
          line: enumDecl.getStartLineNumber(),
          references: [],
        });
      }
    }

    return symbols;
  }

  /** 노드 내에서 참조되는 다른 심볼 이름 추출 */
  private extractReferencedSymbols(node: Node): string[] {
    const refs = new Set<string>();
    node.forEachDescendant((descendant) => {
      if (Node.isIdentifier(descendant)) {
        const parent = descendant.getParent();
        // import 선언의 일부가 아닌 식별자만 수집
        if (parent && !Node.isImportSpecifier(parent) && !Node.isImportDeclaration(parent)) {
          refs.add(descendant.getText());
        }
      }
    });
    return Array.from(refs);
  }

  /** 파일의 import 정보 추출 */
  private extractImports(sourceFile: SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const symbols: string[] = [];

      // named imports: import { A, B } from '...'
      for (const named of importDecl.getNamedImports()) {
        symbols.push(named.getName());
      }

      // default import: import X from '...'
      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport) {
        symbols.push(defaultImport.getText());
      }

      // namespace import: import * as X from '...'
      const namespaceImport = importDecl.getNamespaceImport();
      if (namespaceImport) {
        symbols.push(`* as ${namespaceImport.getText()}`);
      }

      // 모듈 경로 해석 시도
      let resolvedPath: string | undefined;
      try {
        const moduleSourceFile = importDecl.getModuleSpecifierSourceFile();
        resolvedPath = moduleSourceFile?.getFilePath();
      } catch {
        // 외부 모듈(node_modules 등)은 해석 불가
      }

      imports.push({ symbols, source: moduleSpecifier, resolvedPath });
    }

    return imports;
  }

  /** 프로젝트 내 모든 소스 파일 경로 반환 */
  getAllSourceFiles(): string[] {
    return this.getProject()
      .getSourceFiles()
      .map((sf) => sf.getFilePath());
  }

  /**
   * 특정 심볼이 정의된 파일과 위치를 검색합니다.
   * @returns 심볼이 발견된 파일 경로와 줄 번호
   */
  findSymbolDefinition(symbolName: string): Array<{ filePath: string; line: number }> {
    const project = this.getProject();
    const results: Array<{ filePath: string; line: number }> = [];

    for (const sourceFile of project.getSourceFiles()) {
      // 함수, 클래스, 변수, 인터페이스, 타입, enum 모두 검색
      const declarations = [
        ...sourceFile.getFunctions().filter((f) => f.getName() === symbolName),
        ...sourceFile.getClasses().filter((c) => c.getName() === symbolName),
        ...sourceFile.getInterfaces().filter((i) => i.getName() === symbolName),
        ...sourceFile.getTypeAliases().filter((t) => t.getName() === symbolName),
        ...sourceFile.getEnums().filter((e) => e.getName() === symbolName),
      ];

      for (const varStmt of sourceFile.getVariableStatements()) {
        for (const decl of varStmt.getDeclarations()) {
          if (decl.getName() === symbolName) {
            declarations.push(decl as any);
          }
        }
      }

      for (const decl of declarations) {
        results.push({
          filePath: sourceFile.getFilePath(),
          line: decl.getStartLineNumber(),
        });
      }
    }

    return results;
  }

  dispose(): void {
    this.project = null;
  }
}
