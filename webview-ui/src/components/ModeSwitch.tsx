import React from 'react';
import type { MarsMode } from '../types';
import { vscodeApi } from '../vscode';

interface ModeSwitchProps {
  currentMode: MarsMode;
}

/** Beginner / Expert 모드 전환 토글 */
export const ModeSwitch: React.FC<ModeSwitchProps> = ({ currentMode }) => {
  const handleToggle = () => {
    vscodeApi.postMessage({ type: 'toggleMode' });
  };

  return (
    <div className="mars-section">
      <div className="mars-section-header">Mode</div>
      <div className="mars-section-body">
        <div className="mode-switch">
          <button
            className={`mode-switch-option ${currentMode === 'beginner' ? 'active' : ''}`}
            onClick={handleToggle}
          >
            Beginner
          </button>
          <button
            className={`mode-switch-option ${currentMode === 'expert' ? 'active' : ''}`}
            onClick={handleToggle}
          >
            Expert
          </button>
        </div>
        <p style={{ marginTop: '8px', fontSize: '11px', opacity: 0.7 }}>
          {currentMode === 'beginner'
            ? 'AI가 자동으로 영향 범위를 분석하고 수정 제안을 제공합니다.'
            : '영향 범위와 위험 태그를 수동으로 검토하고 승인합니다.'}
        </p>
      </div>
    </div>
  );
};
