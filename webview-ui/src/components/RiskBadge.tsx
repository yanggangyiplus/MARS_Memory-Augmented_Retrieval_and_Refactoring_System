import React from 'react';
import type { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  tag?: string;
}

const LEVEL_COLORS: Record<RiskLevel, string> = {
  low: 'var(--mars-green)',
  medium: 'var(--mars-yellow)',
  high: 'var(--mars-orange)',
  critical: 'var(--mars-red)',
};

const LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  critical: 'CRIT',
};

/** 위험 수준 뱃지 컴포넌트 */
export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score, tag }) => {
  const color = LEVEL_COLORS[level];
  const label = tag || LEVEL_LABELS[level];

  return (
    <span
      className="mars-badge"
      style={{ background: color }}
      title={score !== undefined ? `Risk Score: ${score}` : undefined}
    >
      {label}
      {score !== undefined && ` ${score}`}
    </span>
  );
};

/** 위험 점수를 시각적 바로 표시 */
export const RiskScoreBar: React.FC<{ score: number }> = ({ score }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'var(--mars-red)';
    if (s >= 60) return 'var(--mars-orange)';
    if (s >= 40) return 'var(--mars-yellow)';
    return 'var(--mars-green)';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div className="score-bar" style={{ flex: 1 }}>
        <div
          className="score-bar-fill"
          style={{
            width: `${score}%`,
            background: getColor(score),
          }}
        />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 600, minWidth: '28px', textAlign: 'right' }}>
        {score}
      </span>
    </div>
  );
};
