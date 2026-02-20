import React from 'react';
import type { MarsMode } from '../types';

interface HeaderProps {
  mode: MarsMode;
  intentCount: number;
}

/** MARS 사이드바 헤더 — 모드 표시, Intent 수 */
export const Header: React.FC<HeaderProps> = ({ mode, intentCount }) => {
  const modeLabel = mode === 'beginner' ? 'Beginner' : 'Expert';
  const modeColor = mode === 'beginner' ? 'var(--mars-blue)' : 'var(--mars-purple)';

  return (
    <div style={{
      padding: '12px',
      borderBottom: '1px solid var(--vscode-panel-border, #2b2b2b)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px', fontWeight: 700 }}>MARS</span>
        <span
          className="mars-badge"
          style={{ background: modeColor }}
        >
          {modeLabel}
        </span>
      </div>
      <div style={{ fontSize: '11px', opacity: 0.7 }}>
        {intentCount} intents
      </div>
    </div>
  );
};
