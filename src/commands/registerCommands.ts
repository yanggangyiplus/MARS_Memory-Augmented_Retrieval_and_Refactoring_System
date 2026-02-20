import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BlastRadiusEngine } from '../core/analysis/blastRadiusEngine';
import { RagPipeline } from '../core/memory/ragPipeline';
import { IntentStore } from '../core/memory/intentStore';
import { ModeManager } from '../core/modes/modeManager';
import { BlastRadiusTreeProvider } from '../providers/blastRadiusTreeProvider';
import { SidebarProvider } from '../providers/sidebarProvider';
import { Logger } from '../utils/logger';

/**
 * MARS의 모든 VSCode 커맨드를 등록합니다.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  blastRadiusEngine: BlastRadiusEngine,
  ragPipeline: RagPipeline,
  intentStore: IntentStore,
  modeManager: ModeManager,
  blastRadiusTreeProvider: BlastRadiusTreeProvider,
  sidebarProvider: SidebarProvider
): void {

  // Blast Radius 분석 명령
  context.subscriptions.push(
    vscode.commands.registerCommand('mars.analyzeBlastRadius', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('MARS: 활성 에디터가 없습니다.');
        return;
      }

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('MARS: 워크스페이스가 열려 있지 않습니다.');
        return;
      }

      // 커서 위치의 심볼 감지
      const position = editor.selection.active;
      const wordRange = editor.document.getWordRangeAtPosition(position);
      const symbol = wordRange ? editor.document.getText(wordRange) : '';

      if (!symbol) {
        vscode.window.showWarningMessage('MARS: 커서 위치에 심볼이 없습니다.');
        return;
      }

      const filePath = editor.document.uri.fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `MARS: "${symbol}" 영향 범위 분석 중...`,
          cancellable: false,
        },
        async () => {
          try {
            const tsConfigPath = path.join(workspaceRoot, 'tsconfig.json');
            const hasTsConfig = fs.existsSync(tsConfigPath);

            await blastRadiusEngine.initialize(
              workspaceRoot,
              hasTsConfig ? tsConfigPath : undefined
            );

            const result = blastRadiusEngine.analyze(filePath, symbol);

            // 트리뷰 업데이트
            blastRadiusTreeProvider.update(result);

            // 사이드바에도 전송
            sidebarProvider.notifyBlastRadius(result);

            // 에디터 인라인 데코레이션 (위험 파일 표시)
            applyEditorDecorations(result.impactedFiles.map((f) => f.path));

            vscode.window.showInformationMessage(
              `MARS: ${result.impactedFiles.length}개 파일 영향, 위험도 ${result.totalRiskScore}/100`
            );
          } catch (error) {
            Logger.error(`Blast Radius 분석 실패: ${error}`);
            vscode.window.showErrorMessage(`MARS: 분석 실패 — ${error}`);
          }
        }
      );
    })
  );

  // Intent 기록 명령
  context.subscriptions.push(
    vscode.commands.registerCommand('mars.recordIntent', async () => {
      const description = await vscode.window.showInputBox({
        prompt: '수정 의도를 설명하세요',
        placeHolder: '예: 사용자 인증 로직에 2FA 추가',
      });

      if (!description) return;

      const editor = vscode.window.activeTextEditor;
      const filePath = editor?.document.uri.fsPath || '';
      const position = editor?.selection.active;
      const wordRange = position ? editor?.document.getWordRangeAtPosition(position) : undefined;
      const symbol = wordRange ? editor!.document.getText(wordRange) : '';

      const embedding = await ragPipeline['embeddingProvider'].embed(description);
      const intent = await intentStore.create(
        {
          description,
          scope: {
            files: filePath ? [filePath] : [],
            symbols: symbol ? [symbol] : [],
            ranges: [],
          },
          mode: modeManager.currentMode,
        },
        embedding
      );

      vscode.window.showInformationMessage(`MARS: Intent 기록 완료 — ${intent.id}`);
    })
  );

  // Intent 검색 명령
  context.subscriptions.push(
    vscode.commands.registerCommand('mars.searchIntents', async () => {
      const query = await vscode.window.showInputBox({
        prompt: '과거 수정 의도를 검색하세요 (시맨틱 검색)',
        placeHolder: '예: 인증 관련 수정',
      });

      if (!query) return;

      const results = await ragPipeline.searchSimilarIntents(query);

      if (results.length === 0) {
        vscode.window.showInformationMessage('MARS: 관련 과거 Intent가 없습니다.');
        return;
      }

      // Quick Pick으로 결과 표시
      const items = results.map((r) => ({
        label: `$(note) ${r.intent.description}`,
        description: `유사도: ${(r.similarity * 100).toFixed(1)}% | ${r.intent.riskTags.join(', ')}`,
        detail: `${new Date(r.intent.timestamp).toLocaleDateString('ko-KR')} — ${r.intent.status}`,
        intent: r.intent,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '검색 결과를 선택하세요',
        matchOnDescription: true,
      });

      if (selected) {
        // 선택된 Intent의 파일을 열기
        if (selected.intent.scope.files.length > 0) {
          const fileUri = vscode.Uri.file(selected.intent.scope.files[0]);
          await vscode.window.showTextDocument(fileUri);
        }
      }
    })
  );

  // 모드 토글 명령
  context.subscriptions.push(
    vscode.commands.registerCommand('mars.toggleMode', async () => {
      await modeManager.toggle();
    })
  );
}

/** 영향 파일에 대한 에디터 데코레이션 적용 (사이드 인디케이터) */
const impactDecorationType = vscode.window.createTextEditorDecorationType({
  overviewRulerColor: '#f57c00',
  overviewRulerLane: vscode.OverviewRulerLane.Left,
  gutterIconPath: undefined,
  gutterIconSize: '80%',
});

function applyEditorDecorations(impactedPaths: string[]): void {
  for (const editor of vscode.window.visibleTextEditors) {
    if (impactedPaths.includes(editor.document.uri.fsPath)) {
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      );
      editor.setDecorations(impactDecorationType, [
        {
          range: fullRange,
          hoverMessage: new vscode.MarkdownString('$(warning) **MARS**: 이 파일은 현재 수정의 영향 범위에 포함됩니다.'),
        },
      ]);
    }
  }
}
