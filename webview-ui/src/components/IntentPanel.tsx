import React, { useState } from 'react';
import type { MarsMode } from '../types';
import { vscodeApi } from '../vscode';

interface IntentPanelProps {
  mode: MarsMode;
}

/** Intent 기록 패널 — 수정 의도를 입력하고 기록 */
export const IntentPanel: React.FC<IntentPanelProps> = ({ mode }) => {
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState('');
  const [symbols, setSymbols] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  const handleSubmit = () => {
    if (!description.trim()) return;

    vscodeApi.postMessage({
      type: 'recordIntent',
      data: {
        description: description.trim(),
        files: files.split(',').map((f) => f.trim()).filter(Boolean),
        symbols: symbols.split(',').map((s) => s.trim()).filter(Boolean),
      },
    });

    setDescription('');
    setFiles('');
    setSymbols('');
  };

  return (
    <div className="mars-section">
      <div className="mars-section-header" onClick={() => setIsOpen(!isOpen)}>
        <span>Record Intent</span>
        <span>{isOpen ? '−' : '+'}</span>
      </div>
      {isOpen && (
        <div className="mars-section-body">
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
              수정 의도 설명
            </label>
            <textarea
              className="mars-input mars-textarea"
              placeholder="예: 사용자 데이터 마스킹 정책을 변경하여 이메일 필드를 마스킹 처리"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
              대상 파일 (쉼표로 구분)
            </label>
            <input
              className="mars-input"
              placeholder="src/auth/login.ts, src/api/user.ts"
              value={files}
              onChange={(e) => setFiles(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', opacity: 0.7, display: 'block', marginBottom: '4px' }}>
              대상 심볼 (쉼표로 구분)
            </label>
            <input
              className="mars-input"
              placeholder="maskUserData, UserResponse"
              value={symbols}
              onChange={(e) => setSymbols(e.target.value)}
            />
          </div>

          <button className="mars-btn mars-btn-primary" onClick={handleSubmit} style={{ width: '100%' }}>
            {mode === 'beginner' ? 'Auto-Analyze & Record' : 'Record Intent'}
          </button>
        </div>
      )}
    </div>
  );
};
