import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ModeSwitch } from './components/ModeSwitch';
import { BlastRadiusTree } from './components/BlastRadiusTree';
import { IntentPanel } from './components/IntentPanel';
import { IntentHistory } from './components/IntentHistory';
import { DiffPreview } from './components/DiffPreview';
import { useVSCodeMessage } from './hooks/useVSCodeMessage';
import { useBlastRadius } from './hooks/useBlastRadius';
import { vscodeApi } from './vscode';
import type { MarsMode, IntentRecord, RagSearchResult, ExtensionMessage } from './types';

/**
 * MARS 사이드바 메인 앱 컴포넌트.
 * Extension으로부터 메시지를 수신하여 상태를 관리합니다.
 */
export const App: React.FC = () => {
  const [mode, setMode] = useState<MarsMode>('beginner');
  const [intents, setIntents] = useState<IntentRecord[]>([]);
  const [searchResults, setSearchResults] = useState<RagSearchResult[]>([]);
  const [ragContext, setRagContext] = useState('');
  const [relatedIntents, setRelatedIntents] = useState<RagSearchResult[]>([]);
  const blastRadius = useBlastRadius();

  /** Extension 메시지 핸들러 */
  const handleMessage = useCallback((message: ExtensionMessage) => {
    switch (message.type) {
      case 'blastRadiusResult':
        blastRadius.setBlastRadius(message.data);
        break;
      case 'intentCreated':
        setIntents((prev) => [message.data.intent, ...prev]);
        setRelatedIntents(message.data.relatedIntents);
        setRagContext(message.data.context);
        break;
      case 'intentList':
        setIntents(message.data);
        break;
      case 'searchResults':
        setSearchResults(message.data);
        break;
      case 'modeChanged':
        setMode(message.data);
        break;
      case 'error':
        // 에러는 VSCode 알림으로도 표시되므로 여기서는 콘솔만
        console.error('[MARS]', message.data);
        break;
    }
  }, [blastRadius]);

  useVSCodeMessage(handleMessage);

  // 마운트 시 초기 데이터 요청
  useEffect(() => {
    vscodeApi.postMessage({ type: 'ready' });
    vscodeApi.postMessage({ type: 'requestIntentList' });
  }, []);

  return (
    <div>
      <Header mode={mode} intentCount={intents.length} />
      <div style={{ padding: '8px' }}>
        <ModeSwitch currentMode={mode} />
        <IntentPanel mode={mode} />
        <BlastRadiusTree result={blastRadius.result} isAnalyzing={blastRadius.isAnalyzing} />
        <DiffPreview context={ragContext} relatedIntents={relatedIntents} />
        <IntentHistory intents={intents} searchResults={searchResults} />
      </div>
    </div>
  );
};
