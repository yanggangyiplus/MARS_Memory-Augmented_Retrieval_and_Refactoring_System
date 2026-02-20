import * as vscode from 'vscode';

/**
 * MARS 전용 로거.
 * VSCode Output Channel을 통해 로그를 출력합니다.
 */
export class Logger {
  private static channel: vscode.OutputChannel | null = null;

  private static getChannel(): vscode.OutputChannel {
    if (!Logger.channel) {
      Logger.channel = vscode.window.createOutputChannel('MARS');
    }
    return Logger.channel;
  }

  static info(message: string): void {
    const timestamp = new Date().toISOString();
    Logger.getChannel().appendLine(`[INFO  ${timestamp}] ${message}`);
  }

  static warn(message: string): void {
    const timestamp = new Date().toISOString();
    Logger.getChannel().appendLine(`[WARN  ${timestamp}] ${message}`);
  }

  static error(message: string): void {
    const timestamp = new Date().toISOString();
    Logger.getChannel().appendLine(`[ERROR ${timestamp}] ${message}`);
  }

  /** Output Channel을 사용자에게 표시 */
  static show(): void {
    Logger.getChannel().show();
  }

  static dispose(): void {
    Logger.channel?.dispose();
    Logger.channel = null;
  }
}
