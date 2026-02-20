import React, { useState } from 'react';
import type { BlastRadiusResult, ImpactedFile, RiskLevel } from '../types';
import { RiskBadge, RiskScoreBar } from './RiskBadge';

interface BlastRadiusTreeProps {
  result: BlastRadiusResult | null;
  isAnalyzing: boolean;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'var(--mars-green)',
  medium: 'var(--mars-yellow)',
  high: 'var(--mars-orange)',
  critical: 'var(--mars-red)',
};

/** 파일 경로에서 파일명만 추출 */
function basename(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/** Blast Radius 분석 결과를 색상 코딩된 트리로 시각화 */
export const BlastRadiusTree: React.FC<BlastRadiusTreeProps> = ({ result, isAnalyzing }) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (isAnalyzing) {
    return (
      <div className="mars-section">
        <div className="mars-section-header">Blast Radius</div>
        <div className="mars-section-body" style={{ textAlign: 'center', padding: '20px' }}>
          <div className="spinner" />
          <p style={{ marginTop: '8px', fontSize: '11px' }}>영향 범위 분석 중...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mars-section">
        <div className="mars-section-header">Blast Radius</div>
        <div className="mars-section-body">
          <div className="empty-state">
            <div className="empty-state-icon">&#128269;</div>
            <div className="empty-state-text">
              코드를 선택하고 "Analyze Blast Radius" 명령을 실행하세요.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 거리별 그룹핑
  const byDistance = new Map<number, ImpactedFile[]>();
  for (const file of result.impactedFiles) {
    const group = byDistance.get(file.distance) || [];
    group.push(file);
    byDistance.set(file.distance, group);
  }

  return (
    <div className="mars-section">
      <div className="mars-section-header">
        <span>Blast Radius</span>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>
          {result.impactedFiles.length} files
        </span>
      </div>
      <div className="mars-section-body">
        {/* 대상 심볼 */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>Target</div>
          <div style={{ fontWeight: 600 }}>
            {result.targetSymbol}
            <span style={{ opacity: 0.5, marginLeft: '4px', fontSize: '11px' }}>
              @ {basename(result.targetFile)}
            </span>
          </div>
        </div>

        {/* 종합 위험 점수 */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span>Total Risk</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {result.riskTags.map((tag) => (
                <RiskBadge key={tag} level="medium" tag={tag} />
              ))}
            </div>
          </div>
          <RiskScoreBar score={result.totalRiskScore} />
        </div>

        {/* 영향 파일 트리 */}
        {Array.from(byDistance.entries())
          .sort(([a], [b]) => a - b)
          .map(([distance, files]) => (
            <div key={distance} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', opacity: 0.5, marginBottom: '4px', textTransform: 'uppercase' }}>
                Distance {distance}
              </div>
              {files.map((file) => (
                <ImpactedFileItem
                  key={file.path}
                  file={file}
                  isExpanded={expandedFiles.has(file.path)}
                  onToggle={() => toggleFile(file.path)}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
};

/** 개별 영향 파일 트리 아이템 */
const ImpactedFileItem: React.FC<{
  file: ImpactedFile;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ file, isExpanded, onToggle }) => {
  return (
    <div>
      <div className="tree-item" onClick={onToggle}>
        <div
          className="tree-item-icon"
          style={{ background: RISK_COLORS[file.riskLevel] }}
        />
        <div className="tree-item-label" title={file.path}>
          {basename(file.path)}
        </div>
        <RiskBadge level={file.riskLevel} />
      </div>

      {isExpanded && (
        <div style={{ paddingLeft: '32px', fontSize: '11px' }}>
          <div style={{ opacity: 0.6, marginBottom: '2px' }}>{file.path}</div>
          {file.symbols.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {file.symbols.map((sym) => (
                <span
                  key={sym}
                  style={{
                    padding: '1px 6px',
                    background: 'var(--vscode-badge-background, #4d4d4d)',
                    borderRadius: '3px',
                    fontSize: '10px',
                  }}
                >
                  {sym}
                </span>
              ))}
            </div>
          )}
          {file.riskTags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {file.riskTags.map((tag) => (
                <span key={tag} className="mars-badge" style={{ background: 'var(--mars-orange)', fontSize: '9px' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
