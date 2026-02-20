import * as vscode from 'vscode';
import { SidebarProvider } from './providers/sidebarProvider';
import { BlastRadiusTreeProvider } from './providers/blastRadiusTreeProvider';
import { registerCommands } from './commands/registerCommands';
import { ModeManager } from './core/modes/modeManager';
import { IntentStore } from './core/memory/intentStore';
import { VectorStore } from './core/memory/vectorStore';
import { EmbeddingProvider } from './core/memory/embeddingProvider';
import { RagPipeline } from './core/memory/ragPipeline';
import { BlastRadiusEngine } from './core/analysis/blastRadiusEngine';
import { MarsConfig } from './utils/config';
import { Logger } from './utils/logger';

/**
 * MARS 확장 활성화 진입점
 * 모든 핵심 서비스를 초기화하고 VSCode에 등록합니다.
 */
export async function activate(context: vscode.ExtensionContext) {
  Logger.info('MARS 확장 활성화 시작');

  // 설정 로드
  const config = new MarsConfig();

  // 핵심 서비스 초기화
  const embeddingProvider = new EmbeddingProvider(config);
  const vectorStore = new VectorStore(context.globalStorageUri.fsPath);
  const intentStore = new IntentStore(context.globalStorageUri.fsPath, vectorStore);
  const ragPipeline = new RagPipeline(intentStore, vectorStore, embeddingProvider);
  const blastRadiusEngine = new BlastRadiusEngine();
  const modeManager = new ModeManager(config);

  // Blast Radius 트리뷰 등록
  const blastRadiusTreeProvider = new BlastRadiusTreeProvider();
  vscode.window.registerTreeDataProvider('mars.blastRadiusTree', blastRadiusTreeProvider);

  // 사이드바 웹뷰 등록
  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    blastRadiusEngine,
    ragPipeline,
    intentStore,
    modeManager
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('mars.sidebarView', sidebarProvider)
  );

  // 커맨드 등록
  registerCommands(
    context,
    blastRadiusEngine,
    ragPipeline,
    intentStore,
    modeManager,
    blastRadiusTreeProvider,
    sidebarProvider
  );

  // 상태바 아이템 생성
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'mars.toggleMode';
  statusBarItem.text = `$(rocket) MARS: ${modeManager.currentMode}`;
  statusBarItem.tooltip = 'MARS 모드 전환 (Beginner/Expert)';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 모드 변경 시 상태바 업데이트
  modeManager.onModeChanged((mode) => {
    statusBarItem.text = `$(rocket) MARS: ${mode}`;
    sidebarProvider.notifyModeChanged(mode);
  });

  // 설정 변경 감지
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mars')) {
        config.reload();
        Logger.info('MARS 설정 재로드 완료');
      }
    })
  );

  await vectorStore.initialize();
  Logger.info('MARS 확장 활성화 완료');
}

/** 확장 비활성화 */
export function deactivate() {
  Logger.info('MARS 확장 비활성화');
}
