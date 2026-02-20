import React, { useState } from 'react';
import type { IntentRecord, RagSearchResult } from '../types';
import { RiskBadge } from './RiskBadge';
import { vscodeApi } from '../vscode';

interface IntentHistoryProps {
  intents: IntentRecord[];
  searchResults: RagSearchResult[];
}

/** 과거 Intent 타임라인 + RAG 검색 */
export const IntentHistory: React.FC<IntentHistoryProps> = ({ intents, searchResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'search'>('history');

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    vscodeApi.postMessage({ type: 'searchIntents', data: { query: searchQuery.trim() } });
    setActiveTab('search');
  };

  const statusColor: Record<string, string> = {
    pending: 'var(--mars-yellow)',
    approved: 'var(--mars-blue)',
    applied: 'var(--mars-green)',
    reverted: 'var(--mars-red)',
  };

  const statusLabel: Record<string, string> = {
    pending: '대기 중',
    approved: '승인됨',
    applied: '적용됨',
    reverted: '되돌림',
  };

  return (
    <div className="mars-section">
      <div className="mars-section-header" onClick={() => setIsOpen(!isOpen)}>
        <span>Intent Memory</span>
        <span>{isOpen ? '−' : '+'}</span>
      </div>
      {isOpen && (
        <div className="mars-section-body">
          {/* 검색 바 */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
            <input
              className="mars-input"
              placeholder="과거 Intent 검색 (시맨틱)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1 }}
            />
            <button className="mars-btn mars-btn-primary mars-btn-sm" onClick={handleSearch}>
              Search
            </button>
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              className={`mars-btn mars-btn-sm ${activeTab === 'history' ? 'mars-btn-primary' : 'mars-btn-secondary'}`}
              onClick={() => setActiveTab('history')}
            >
              History ({intents.length})
            </button>
            <button
              className={`mars-btn mars-btn-sm ${activeTab === 'search' ? 'mars-btn-primary' : 'mars-btn-secondary'}`}
              onClick={() => setActiveTab('search')}
            >
              Search ({searchResults.length})
            </button>
          </div>

          {/* 내용 */}
          {activeTab === 'history' ? (
            intents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">아직 기록된 Intent가 없습니다.</div>
              </div>
            ) : (
              <div>
                {intents.slice(0, 20).map((intent) => (
                  <div key={intent.id} className="timeline-item">
                    <IntentItem intent={intent} statusColor={statusColor} statusLabel={statusLabel} />
                  </div>
                ))}
              </div>
            )
          ) : (
            searchResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">검색 결과가 없습니다.</div>
              </div>
            ) : (
              <div>
                {searchResults.map((sr) => (
                  <div key={sr.intent.id} className="timeline-item">
                    <div style={{ fontSize: '10px', color: 'var(--mars-blue)', marginBottom: '2px' }}>
                      유사도: {(sr.similarity * 100).toFixed(1)}%
                    </div>
                    <IntentItem
                      intent={sr.intent}
                      statusColor={statusColor}
                      statusLabel={statusLabel}
                    />
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

/** 개별 Intent 아이템 */
const IntentItem: React.FC<{
  intent: IntentRecord;
  statusColor: Record<string, string>;
  statusLabel: Record<string, string>;
}> = ({ intent, statusColor, statusLabel }) => {
  const date = new Date(intent.timestamp).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '10px', opacity: 0.5 }}>{date}</span>
        <span className="mars-badge" style={{ background: statusColor[intent.status] || '#666', fontSize: '9px' }}>
          {statusLabel[intent.status] || intent.status}
        </span>
      </div>
      <div style={{ fontSize: '12px', marginBottom: '4px' }}>{intent.description}</div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {intent.riskTags.map((tag) => (
          <RiskBadge key={tag} level="medium" tag={tag} />
        ))}
      </div>
      {intent.blastRadius && (
        <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
          영향: {intent.blastRadius.impactedFiles.length}개 파일 | 위험도: {intent.blastRadius.totalRiskScore}
        </div>
      )}
      {intent.status === 'pending' && (
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <button
            className="mars-btn mars-btn-primary mars-btn-sm"
            onClick={() => vscodeApi.postMessage({ type: 'approveIntent', data: { intentId: intent.id } })}
          >
            Approve
          </button>
          <button
            className="mars-btn mars-btn-secondary mars-btn-sm"
            onClick={() => vscodeApi.postMessage({
              type: 'intentFeedback',
              data: { intentId: intent.id, feedback: 'positive' },
            })}
          >
            +
          </button>
          <button
            className="mars-btn mars-btn-secondary mars-btn-sm"
            onClick={() => vscodeApi.postMessage({
              type: 'intentFeedback',
              data: { intentId: intent.id, feedback: 'negative' },
            })}
          >
            -
          </button>
        </div>
      )}
    </div>
  );
};
