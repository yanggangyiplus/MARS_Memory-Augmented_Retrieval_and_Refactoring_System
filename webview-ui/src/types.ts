/** Extension ↔ Webview 간 메시지 타입 정의 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type MarsMode = 'beginner' | 'expert';
export type IntentStatus = 'pending' | 'approved' | 'applied' | 'reverted';

export interface ImpactedFile {
  path: string;
  symbols: string[];
  riskLevel: RiskLevel;
  distance: number;
  riskTags: string[];
}

export interface BlastRadiusResult {
  targetFile: string;
  targetSymbol: string;
  impactedFiles: ImpactedFile[];
  totalRiskScore: number;
  riskTags: string[];
  dependencyChain: Array<{ from: string; to: string; type: string; symbols: string[] }>;
  analyzedAt: number;
}

export interface IntentRecord {
  id: string;
  timestamp: number;
  description: string;
  scope: {
    files: string[];
    symbols: string[];
    ranges: Array<{ file: string; startLine: number; endLine: number }>;
  };
  riskTags: string[];
  mode: MarsMode;
  status: IntentStatus;
  blastRadius?: BlastRadiusResult;
  metadata: {
    approvedBy?: string;
    appliedAt?: number;
    relatedIntents?: string[];
    feedback?: 'positive' | 'negative' | 'neutral';
    notes?: string;
  };
}

export interface RagSearchResult {
  intent: IntentRecord;
  similarity: number;
}

/** Extension → Webview 메시지 */
export type ExtensionMessage =
  | { type: 'blastRadiusResult'; data: BlastRadiusResult }
  | { type: 'intentCreated'; data: { intent: IntentRecord; relatedIntents: RagSearchResult[]; context: string } }
  | { type: 'intentList'; data: IntentRecord[] }
  | { type: 'searchResults'; data: RagSearchResult[] }
  | { type: 'modeChanged'; data: MarsMode }
  | { type: 'error'; data: string };

/** Webview → Extension 메시지 */
export type WebviewMessage =
  | { type: 'analyzeBlastRadius'; data: { filePath: string; symbol: string } }
  | { type: 'recordIntent'; data: { description: string; files: string[]; symbols: string[] } }
  | { type: 'searchIntents'; data: { query: string } }
  | { type: 'approveIntent'; data: { intentId: string } }
  | { type: 'revertIntent'; data: { intentId: string } }
  | { type: 'intentFeedback'; data: { intentId: string; feedback: 'positive' | 'negative' | 'neutral' } }
  | { type: 'toggleMode' }
  | { type: 'requestIntentList' }
  | { type: 'ready' };
