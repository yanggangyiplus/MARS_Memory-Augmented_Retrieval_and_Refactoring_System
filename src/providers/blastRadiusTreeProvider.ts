import * as vscode from 'vscode';
import * as path from 'path';
import { BlastRadiusResult, ImpactedFile } from '../models/blastRadius';
import { RiskLevel } from '../models/riskTag';

/**
 * Blast Radius 트리뷰 프로바이더.
 * VSCode의 네이티브 트리뷰에 영향 범위를 표시합니다.
 */
export class BlastRadiusTreeProvider implements vscode.TreeDataProvider<BlastRadiusTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BlastRadiusTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private result: BlastRadiusResult | null = null;

  /** 새 분석 결과로 트리를 업데이트 */
  update(result: BlastRadiusResult): void {
    this.result = result;
    this._onDidChangeTreeData.fire(undefined);
  }

  /** 트리 초기화 */
  clear(): void {
    this.result = null;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: BlastRadiusTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BlastRadiusTreeItem): BlastRadiusTreeItem[] {
    if (!this.result) return [];

    // 루트 레벨: 대상 심볼 + 영향 그룹
    if (!element) {
      return this.getRootItems();
    }

    // 거리 그룹의 자식: 개별 파일
    if (element.contextValue === 'distanceGroup') {
      return this.getFilesAtDistance(element.distance!);
    }

    // 파일의 자식: 심볼 목록
    if (element.contextValue === 'impactedFile') {
      return this.getFileSymbols(element);
    }

    return [];
  }

  /** 루트 아이템: 대상 + 거리별 그룹 */
  private getRootItems(): BlastRadiusTreeItem[] {
    if (!this.result) return [];

    const items: BlastRadiusTreeItem[] = [];

    // 대상 심볼
    const target = new BlastRadiusTreeItem(
      `Target: ${this.result.targetSymbol}`,
      vscode.TreeItemCollapsibleState.None
    );
    target.description = path.basename(this.result.targetFile);
    target.iconPath = new vscode.ThemeIcon('target', new vscode.ThemeColor('charts.red'));
    target.contextValue = 'target';
    target.tooltip = `위험도: ${this.result.totalRiskScore}/100\n태그: ${this.result.riskTags.join(', ')}`;
    items.push(target);

    // 거리별 그룹
    const distances = new Set(this.result.impactedFiles.map((f) => f.distance));
    for (const dist of Array.from(distances).sort()) {
      const filesAtDist = this.result.impactedFiles.filter((f) => f.distance === dist);
      const group = new BlastRadiusTreeItem(
        `Distance ${dist} (${filesAtDist.length} files)`,
        vscode.TreeItemCollapsibleState.Expanded
      );
      group.contextValue = 'distanceGroup';
      group.distance = dist;
      group.iconPath = new vscode.ThemeIcon('layers');
      items.push(group);
    }

    return items;
  }

  /** 특정 거리에 있는 파일 목록 */
  private getFilesAtDistance(distance: number): BlastRadiusTreeItem[] {
    if (!this.result) return [];

    return this.result.impactedFiles
      .filter((f) => f.distance === distance)
      .map((file) => {
        const item = new BlastRadiusTreeItem(
          path.basename(file.path),
          file.symbols.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None
        );
        item.description = `${file.riskLevel.toUpperCase()} — ${file.riskTags.join(', ') || 'no tags'}`;
        item.iconPath = new vscode.ThemeIcon(
          'file-code',
          new vscode.ThemeColor(riskLevelToColor(file.riskLevel))
        );
        item.contextValue = 'impactedFile';
        item.tooltip = `${file.path}\n위험도: ${file.riskLevel}\n심볼: ${file.symbols.join(', ')}`;
        item.filePath = file.path;
        item.fileSymbols = file.symbols;

        // 클릭 시 파일 열기
        item.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(file.path)],
        };

        return item;
      });
  }

  /** 파일 내 심볼 목록 */
  private getFileSymbols(element: BlastRadiusTreeItem): BlastRadiusTreeItem[] {
    return (element.fileSymbols || []).map((sym) => {
      const item = new BlastRadiusTreeItem(sym, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('symbol-method');
      item.contextValue = 'symbol';
      return item;
    });
  }
}

/** Blast Radius 트리의 개별 아이템 */
class BlastRadiusTreeItem extends vscode.TreeItem {
  distance?: number;
  filePath?: string;
  fileSymbols?: string[];
}

/** 위험 수준 → VSCode 테마 색상 매핑 */
function riskLevelToColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'errorForeground';
    case 'high': return 'list.warningForeground';
    case 'medium': return 'list.warningForeground';
    case 'low': return 'charts.green';
    default: return 'foreground';
  }
}
