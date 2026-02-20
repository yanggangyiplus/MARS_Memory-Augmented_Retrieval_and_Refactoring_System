import * as vscode from 'vscode';

/**
 * MARS 설정 관리자.
 * VSCode workspace configuration에서 MARS 관련 설정을 읽고 제공합니다.
 */
export class MarsConfig {
  private _config: vscode.WorkspaceConfiguration;

  constructor() {
    this._config = vscode.workspace.getConfiguration('mars');
  }

  /** 설정을 다시 로드 */
  reload(): void {
    this._config = vscode.workspace.getConfiguration('mars');
  }

  /** 현재 MARS 동작 모드 */
  get mode(): 'beginner' | 'expert' {
    return this._config.get<'beginner' | 'expert'>('mode', 'beginner');
  }

  /** 임베딩 제공자 (local 또는 openai) */
  get embeddingProvider(): 'local' | 'openai' {
    return this._config.get<'local' | 'openai'>('embeddingProvider', 'local');
  }

  /** OpenAI API 키 */
  get openaiApiKey(): string {
    return this._config.get<string>('openaiApiKey', '');
  }

  /** 위험도 경고 임계값 (0-100) */
  get riskThreshold(): number {
    return this._config.get<number>('riskThreshold', 60);
  }

  /** 분석 제외 경로 패턴 목록 */
  get excludePaths(): string[] {
    return this._config.get<string[]>('excludePaths', []);
  }

  /** 설정값을 프로그래밍적으로 업데이트 */
  async update(key: string, value: unknown): Promise<void> {
    await this._config.update(key, value, vscode.ConfigurationTarget.Workspace);
    this.reload();
  }
}
