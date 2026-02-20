import type { WebviewMessage } from './types';

/** VSCode Webview API 브릿지 — acquireVsCodeApi 싱글턴 래핑 */
interface VSCodeApi {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

class VSCodeAPIWrapper {
  private readonly api: VSCodeApi;

  constructor() {
    this.api = (window as any).acquireVsCodeApi();
  }

  /** Extension에 메시지 전송 */
  postMessage(message: WebviewMessage): void {
    this.api.postMessage(message);
  }

  /** Webview 상태 저장 (패널 재열림 시 복원) */
  setState<T>(state: T): void {
    this.api.setState(state);
  }

  /** 저장된 Webview 상태 복원 */
  getState<T>(): T | undefined {
    return this.api.getState() as T | undefined;
  }
}

export const vscodeApi = new VSCodeAPIWrapper();
