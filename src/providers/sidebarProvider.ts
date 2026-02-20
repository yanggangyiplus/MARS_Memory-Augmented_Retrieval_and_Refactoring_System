import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BlastRadiusEngine } from '../core/analysis/blastRadiusEngine';
import { RagPipeline } from '../core/memory/ragPipeline';
import { IntentStore } from '../core/memory/intentStore';
import { ModeManager, MarsMode } from '../core/modes/modeManager';
import { BeginnerMode } from '../core/modes/beginnerMode';
import { ExpertMode } from '../core/modes/expertMode';
import { Logger } from '../utils/logger';

/**
 * MARS 사이드바 Webview 프로바이더.
 * React 웹뷰와 Extension 간 메시지 브릿지를 담당합니다.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private beginnerMode: BeginnerMode;
  private expertMode: ExpertMode;

  constructor(
    private extensionUri: vscode.Uri,
    private blastRadiusEngine: BlastRadiusEngine,
    private ragPipeline: RagPipeline,
    private intentStore: IntentStore,
    private modeManager: ModeManager
  ) {
    this.beginnerMode = new BeginnerMode(blastRadiusEngine, ragPipeline);
    this.expertMode = new ExpertMode(blastRadiusEngine, ragPipeline, intentStore);
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Webview → Extension 메시지 수신
    webviewView.webview.onDidReceiveMessage(async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        Logger.error(`메시지 처리 오류: ${error}`);
        this.postMessage({ type: 'error', data: String(error) });
      }
    });
  }

  /** Webview로부터 수신된 메시지 처리 */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.postMessage({ type: 'modeChanged', data: this.modeManager.currentMode });
        break;

      case 'requestIntentList': {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const list = this.intentStore.getAll();
        const data = workspaceRoot
          ? list.map((i) => this.toRelativePaths(i, workspaceRoot))
          : list;
        this.postMessage({ type: 'intentList', data });
        break;
      }

      case 'analyzeBlastRadius':
        await this.handleAnalyzeBlastRadius(message.data);
        break;

      case 'recordIntent':
        await this.handleRecordIntent(message.data);
        break;

      case 'searchIntents':
        await this.handleSearchIntents(message.data);
        break;

      case 'approveIntent': {
        await this.expertMode.approve(message.data.intentId);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const list = this.intentStore.getAll();
        const data = workspaceRoot ? list.map((i) => this.toRelativePaths(i, workspaceRoot)) : list;
        this.postMessage({ type: 'intentList', data });
        break;
      }

      case 'revertIntent': {
        await this.expertMode.revert(message.data.intentId);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const list = this.intentStore.getAll();
        const data = workspaceRoot ? list.map((i) => this.toRelativePaths(i, workspaceRoot)) : list;
        this.postMessage({ type: 'intentList', data });
        break;
      }

      case 'intentFeedback':
        await this.intentStore.recordFeedback(message.data.intentId, message.data.feedback);
        break;

      case 'toggleMode':
        await this.modeManager.toggle();
        break;
    }
  }

  /** 절대 경로를 워크스페이스 기준 상대 경로로 변환 (UI에 긴 폴더명이 안 보이도록) */
  private toRelativePaths<T>(data: T, workspaceRoot: string): T {
    const norm = (p: string) =>
      p && p.startsWith(workspaceRoot)
        ? path.relative(workspaceRoot, p).replace(/\\/g, '/')
        : p;
    const clone = JSON.parse(JSON.stringify(data)) as any;
    if (clone.targetFile) clone.targetFile = norm(clone.targetFile);
    if (clone.impactedFiles?.length) {
      clone.impactedFiles = clone.impactedFiles.map((f: any) => ({
        ...f,
        path: norm(f.path),
      }));
    }
    if (clone.dependencyChain?.length) {
      clone.dependencyChain = clone.dependencyChain.map((e: any) => ({
        ...e,
        from: norm(e.from),
        to: norm(e.to),
      }));
    }
    if (clone.scope?.files) clone.scope.files = clone.scope.files.map((f: string) => norm(f));
    if (clone.scope?.ranges?.length) {
      clone.scope.ranges = clone.scope.ranges.map((r: any) => ({ ...r, file: norm(r.file) }));
    }
    if (clone.blastRadius) clone.blastRadius = this.toRelativePaths(clone.blastRadius, workspaceRoot);
    return clone;
  }

  /** Blast Radius 분석 처리 */
  private async handleAnalyzeBlastRadius(data: { filePath: string; symbol: string }): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      this.postMessage({ type: 'error', data: '워크스페이스가 열려 있지 않습니다.' });
      return;
    }

    try {
      // tsconfig.json 탐색
      const tsConfigPath = path.join(workspaceRoot, 'tsconfig.json');
      const hasTsConfig = fs.existsSync(tsConfigPath);

      await this.blastRadiusEngine.initialize(
        workspaceRoot,
        hasTsConfig ? tsConfigPath : undefined
      );

      const result = this.blastRadiusEngine.analyze(data.filePath, data.symbol);
      const dataForWebview = this.toRelativePaths(result, workspaceRoot);
      this.postMessage({ type: 'blastRadiusResult', data: dataForWebview });
    } catch (error) {
      this.postMessage({ type: 'error', data: `Blast Radius 분석 실패: ${error}` });
    }
  }

  /** Intent 기록 처리 (모드에 따라 Beginner/Expert 분기) */
  private async handleRecordIntent(data: {
    description: string;
    files: string[];
    symbols: string[];
  }): Promise<void> {
    const input = {
      description: data.description,
      scope: {
        files: data.files,
        symbols: data.symbols,
        ranges: [],
      },
      mode: this.modeManager.currentMode as 'beginner' | 'expert',
    };

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (this.modeManager.currentMode === 'beginner') {
      const result = await this.beginnerMode.analyzeAndSuggest(input);
      const intent = workspaceRoot ? this.toRelativePaths(result.intent, workspaceRoot) : result.intent;
      const relatedIntents = (result.relatedIntents || []).map((r) => ({
        ...r,
        intent: workspaceRoot ? this.toRelativePaths(r.intent, workspaceRoot) : r.intent,
      }));
      this.postMessage({
        type: 'intentCreated',
        data: { intent, relatedIntents, context: result.context },
      });

      if (result.suggestion) {
        vscode.window.showInformationMessage(`MARS: ${result.suggestion}`);
      }
    } else {
      const result = await this.expertMode.analyze(input);
      const intent = workspaceRoot ? this.toRelativePaths(result.intent, workspaceRoot) : result.intent;
      const relatedIntents = (result.relatedIntents || []).map((r) => ({
        ...r,
        intent: workspaceRoot ? this.toRelativePaths(r.intent, workspaceRoot) : r.intent,
      }));
      this.postMessage({
        type: 'intentCreated',
        data: { intent, relatedIntents, context: result.context },
      });
    }
  }

  /** Intent 검색 처리 */
  private async handleSearchIntents(data: { query: string }): Promise<void> {
    const results = await this.ragPipeline.searchSimilarIntents(data.query);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const dataForWebview = workspaceRoot
      ? results.map((r) => ({ ...r, intent: this.toRelativePaths(r.intent, workspaceRoot) }))
      : results;
    this.postMessage({ type: 'searchResults', data: dataForWebview });
  }

  /** 모드 변경을 Webview에 알림 */
  notifyModeChanged(mode: MarsMode): void {
    this.postMessage({ type: 'modeChanged', data: mode });
  }

  /** Blast Radius 결과를 Webview에 전송 (경로는 상대 경로로 변환) */
  notifyBlastRadius(result: any): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const data = workspaceRoot ? this.toRelativePaths(result, workspaceRoot) : result;
    this.postMessage({ type: 'blastRadiusResult', data });
  }

  /** Extension → Webview 메시지 전송 */
  private postMessage(message: any): void {
    this.view?.webview.postMessage(message);
  }

  /** React 빌드 결과를 로드하는 HTML 생성 */
  private getHtmlContent(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist');

    // 빌드된 에셋 확인
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'assets', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>MARS</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

/** Content Security Policy용 nonce 생성 */
function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
