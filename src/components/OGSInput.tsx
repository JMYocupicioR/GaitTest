import { useState } from 'react';
import type { OGSScore, OGSItemScore, FootSide } from '../types/session.ts';
import { OGS_ITEM_LABELS, OGS_SCORE_LABELS } from '../types/session.ts';

interface OGSInputProps {
  foot: FootSide;
  score: OGSScore | null;
  onChange: (foot: FootSide, item: keyof OGSScore, score: OGSItemScore | null) => void;
  disabled?: boolean;
}

export const OGSInput = ({ foot, score, onChange, disabled = false }: OGSInputProps) => {
  const [expandedItem, setExpandedItem] = useState<keyof OGSScore | null>(null);

  const footLabel = foot === 'L' ? 'Izquierda' : 'Derecha';

  const handleScoreChange = (item: keyof OGSScore, newScore: OGSItemScore | null) => {
    onChange(foot, item, newScore);
  };

  const getScoreColor = (itemScore: OGSItemScore | null): string => {
    if (itemScore === null) return 'transparent';

    switch (itemScore) {
      case -1: return '#dc2626'; // red-600
      case 0: return '#ea580c'; // orange-600
      case 1: return '#eab308'; // yellow-500
      case 2: return '#65a30d'; // lime-600
      case 3: return '#16a34a'; // green-600
      default: return 'transparent';
    }
  };

  const getItemTotal = (): number => {
    if (!score) return 0;
    return Object.values(score).reduce((sum, itemScore) => sum + (itemScore ?? 0), 0);
  };

  const getCompletionPercentage = (): number => {
    if (!score) return 0;
    const completedItems = Object.values(score).filter(itemScore => itemScore !== null).length;
    return (completedItems / 8) * 100;
  };

  return (
    <div className="card" style={{ minHeight: '400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Pierna {footLabel}</h3>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getItemTotal() >= 16 ? '#16a34a' : getItemTotal() >= 8 ? '#eab308' : '#dc2626' }}>
            Total: {getItemTotal()}/24
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            Completado: {getCompletionPercentage().toFixed(0)}%
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${getCompletionPercentage()}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {(Object.keys(OGS_ITEM_LABELS) as Array<keyof OGSScore>).map((item) => {
          const itemScore = score?.[item] ?? null;
          const isExpanded = expandedItem === item;

          return (
            <div
              key={item}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: isExpanded ? '#f9fafb' : 'white',
                transition: 'all 0.2s ease'
              }}
            >
              <div
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onClick={() => setExpandedItem(isExpanded ? null : item)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getScoreColor(itemScore),
                      border: itemScore === null ? '2px solid #d1d5db' : 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                    {OGS_ITEM_LABELS[item]}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {itemScore !== null && (
                    <span style={{
                      fontSize: '0.8rem',
                      color: '#6b7280',
                      backgroundColor: '#f3f4f6',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {OGS_SCORE_LABELS[itemScore]}
                    </span>
                  )}
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {itemScore ?? '?'}
                  </span>
                  <span style={{ fontSize: '0.8rem', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    ▼
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 0.75rem 0.75rem 0.75rem', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    Selecciona la puntuación observada:
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {([-1, 0, 1, 2, 3] as OGSItemScore[]).map((scoreOption) => (
                      <button
                        key={scoreOption}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleScoreChange(item, scoreOption)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          border: itemScore === scoreOption ? '2px solid #3b82f6' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: itemScore === scoreOption ? '#dbeafe' : 'white',
                          color: itemScore === scoreOption ? '#1e40af' : '#374151',
                          fontSize: '0.8rem',
                          fontWeight: itemScore === scoreOption ? '600' : '400',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.6 : 1,
                          transition: 'all 0.2s ease',
                          minWidth: '60px',
                          textAlign: 'center'
                        }}
                        onMouseEnter={(e) => {
                          if (!disabled && itemScore !== scoreOption) {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!disabled && itemScore !== scoreOption) {
                            e.currentTarget.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>{scoreOption}</div>
                        <div style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
                          {OGS_SCORE_LABELS[scoreOption]}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleScoreChange(item, null)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: '#6b7280',
                        fontSize: '0.7rem',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.6 : 1
                      }}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {score && getCompletionPercentage() === 100 && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: getItemTotal() >= 16 ? '#dcfce7' : getItemTotal() >= 8 ? '#fef3c7' : '#fee2e2',
          border: `1px solid ${getItemTotal() >= 16 ? '#16a34a' : getItemTotal() >= 8 ? '#eab308' : '#dc2626'}`,
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            Evaluación Completa
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            {getItemTotal() >= 16 && 'Patrón de marcha dentro de límites normales'}
            {getItemTotal() >= 8 && getItemTotal() < 16 && 'Alteraciones moderadas identificadas'}
            {getItemTotal() < 8 && 'Alteraciones significativas que requieren atención'}
          </div>
        </div>
      )}
    </div>
  );
};