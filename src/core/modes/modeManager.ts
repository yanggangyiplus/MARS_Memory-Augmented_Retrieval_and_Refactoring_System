import * as vscode from 'vscode';
import { MarsConfig } from '../../utils/config';
import { Logger } from '../../utils/logger';

export type MarsMode = 'beginner' | 'expert';
type ModeChangeListener = (mode: MarsMode) => void;

/**
 * MARS 모드 매니저.
 * Beginner/Expert 모드 전환을 관리하고, 변경 이벤트를 브로드캐스트합니다.
 */
export class ModeManager {
  private _currentMode: MarsMode;
  private listeners: ModeChangeListener[] = [];

  constructor(private config: MarsConfig) {
    this._currentMode = config.mode;
  }

  get currentMode(): MarsMode {
    return this._currentMode;
  }

  /** 모드 전환 (토글) */
  async toggle(): Promise<MarsMode> {
    const newMode = this._currentMode === 'beginner' ? 'expert' : 'beginner';
    return this.setMode(newMode);
  }

  /** 특정 모드로 설정 */
  async setMode(mode: MarsMode): Promise<MarsMode> {
    if (this._currentMode === mode) return mode;

    this._currentMode = mode;
    await this.config.update('mode', mode);

    Logger.info(`MARS 모드 변경: ${mode}`);
    vscode.window.showInformationMessage(`MARS: ${mode === 'beginner' ? 'Beginner' : 'Expert'} 모드로 전환`);

    this.notifyListeners(mode);
    return mode;
  }

  /** 모드 변경 이벤트 구독 */
  onModeChanged(listener: ModeChangeListener): void {
    this.listeners.push(listener);
  }

  private notifyListeners(mode: MarsMode): void {
    for (const listener of this.listeners) {
      listener(mode);
    }
  }
}
