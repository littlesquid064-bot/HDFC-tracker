import React from 'react';
import { X, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Trash2, RotateCcw, Plus, GripVertical, Check } from 'lucide-react';

export default function ColumnManagerModal({
  isOpen,
  onClose,
  columns,
  onMoveColumn,
  onDeleteCustomColumn,
  onResetColumns,
  onOpenAddColumn
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Manage & Reorder Columns</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Reorder columns, move columns after next, or add custom columns
            </p>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              CURRENT ORDER ({columns.length} columns)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary-outline btn-xs"
                onClick={onResetColumns}
                title="Reset columns to default layout"
              >
                <RotateCcw size={12} />
                <span>Reset to Default</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => {
                  onClose();
                  onOpenAddColumn();
                }}
              >
                <Plus size={13} />
                <span>+ Column</span>
              </button>
            </div>
          </div>

          <div className="column-manager-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {columns.map((col, index) => {
              const isActions = col.id === 'actions';
              const canMoveLeft = index > 0 && !isActions;
              const canMoveRight = index < columns.length - (columns[columns.length - 1]?.id === 'actions' ? 2 : 1) && !isActions;

              return (
                <div 
                  key={col.id} 
                  className="column-manager-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: col.isDefault ? 'var(--bg-card)' : 'rgba(59, 130, 246, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-subtle)', width: '20px' }}>
                      {index + 1}.
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{col.label}</span>
                        {!col.isDefault && (
                          <span className="badge-custom-tag" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                            Custom ({col.type || 'text'})
                          </span>
                        )}
                        {isActions && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)', background: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: '4px' }}>
                            Fixed right
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* Move Before / Move Left Button */}
                    <button
                      type="button"
                      className="btn-icon"
                      disabled={!canMoveLeft}
                      onClick={() => onMoveColumn(index, index - 1)}
                      title={canMoveLeft ? `Move ${col.label} left / before previous` : 'Cannot move left'}
                      style={{ opacity: canMoveLeft ? 1 : 0.3, padding: '4px' }}
                    >
                      <ArrowLeft size={14} />
                    </button>

                    {/* Move After Next / Move Right Button */}
                    <button
                      type="button"
                      className="btn-icon"
                      disabled={!canMoveRight}
                      onClick={() => onMoveColumn(index, index + 1)}
                      title={canMoveRight ? `Move ${col.label} right / after next column` : 'Cannot move right'}
                      style={{ 
                        opacity: canMoveRight ? 1 : 0.3, 
                        padding: '4px',
                        background: canMoveRight ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                        color: canMoveRight ? 'var(--primary)' : 'inherit'
                      }}
                    >
                      <ArrowRight size={14} />
                    </button>

                    {/* Delete Custom Column */}
                    {!col.isDefault && (
                      <button
                        type="button"
                        className="btn-icon text-danger"
                        onClick={() => {
                          if (window.confirm(`Delete custom column "${col.label}"? Custom data in this column will be hidden.`)) {
                            onDeleteCustomColumn(col.id);
                          }
                        }}
                        title="Delete custom column"
                        style={{ padding: '4px', marginLeft: '6px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '14px', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            💡 <strong>Quick tip:</strong> You can also reorder columns directly on the table header by clicking the <strong>◀</strong> and <strong>▶</strong> (&quot;Move after next&quot;) arrow controls, or by dragging column headers left and right!
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            <Check size={14} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
