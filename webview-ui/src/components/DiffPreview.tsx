import React from 'react';
import type { RagSearchResult } from '../types';

interface DiffPreviewProps {
  context: string;
  relatedIntents: RagSearchResult[];
}

/**
 * RAG 컨텍스트 미리보기 패널.
 * 과거 유사 사례와 경고 메시지를 표시합니다.
 */
export const DiffPreview: React.FC<DiffPreviewProps> = ({ context, relatedIntents }) => {
  if (!context && relatedIntents.length === 0) return null;

  return (
    <div className="mars-section">
      <div className="mars-section-header">
        <span>RAG Context</span>
        <span style={{ fontSize: '10px', opacity: 0.7 }}>
          {relatedIntents.length} related
        </span>
      </div>
      <div className="mars-section-body">
        {/* 경고 메시지 (부정적 피드백을 받은 유사 사례) */}
        {relatedIntents
          .filter((r) => r.intent.metadata.feedback === 'negative')
          .map((r) => (
            <div
              key={r.intent.id}
              style={{
                padding: '8px',
                marginBottom: '8px',
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid var(--mars-red)',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--mars-red)', marginBottom: '4px' }}>
                Warning: 유사 수정이 이전에 부정적 피드백을 받았습니다
              </div>
              <div style={{ opacity: 0.8 }}>{r.intent.description}</div>
            </div>
          ))}

        {/* RAG 컨텍스트 텍스트 */}
        {context && (
          <pre style={{
            fontSize: '11px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'var(--vscode-textCodeBlock-background, #1e1e1e)',
            padding: '8px',
            borderRadius: '4px',
            maxHeight: '200px',
            overflow: 'auto',
          }}>
            {context}
          </pre>
        )}
      </div>
    </div>
  );
};
