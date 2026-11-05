import React, { useState } from 'react';
import { X, Plus, Type, Tag, Calendar, Link as LinkIcon, Hash, Check } from 'lucide-react';

const COLUMN_PRESETS = [
  { name: 'Priority', type: 'tag' },
  { name: 'Department', type: 'text' },
  { name: 'External Link', type: 'link' },
  { name: 'Target Date', type: 'date' },
  { name: 'Budget / Cost', type: 'number' },
  { name: 'Reviewer', type: 'text' }
];

const TYPE_OPTIONS = [
  { id: 'text', label: 'Text', desc: 'Short notes or descriptive text', icon: Type },
  { id: 'tag', label: 'Badge / Tag', desc: 'Colored pill (e.g., High, Medium, Low)', icon: Tag },
  { id: 'date', label: 'Date', desc: 'Target date or deadline', icon: Calendar },
  { id: 'link', label: 'Link / URL', desc: 'Clickable link to external docs or PRD', icon: LinkIcon },
  { id: 'number', label: 'Number', desc: 'Numeric value, metric or budget', icon: Hash }
];

export default function AddColumnModal({
  isOpen,
  onClose,
  onAddColumn,
  existingColumns = []
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [insertAfter, setInsertAfter] = useState('end'); // 'end' or column id
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please provide a column name.');
      return;
    }

    // Check duplicate
    const exists = existingColumns.some(
      c => c.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setError('A column with this name already exists.');
      return;
    }

    onAddColumn({
      name: trimmed,
      type,
      insertAfter
    });

    setName('');
    setType('text');
    setInsertAfter('end');
    setError('');
    onClose();
  };

  const handleSelectPreset = (preset) => {
    setName(preset.name);
    setType(preset.type);
    setError('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">+ Add New Column</div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Add a custom column to track extra data for deliverables
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {error && (
              <div style={{ 
                padding: '8px 12px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: 'var(--accent-red)', 
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                {error}
              </div>
            )}

            {/* Column Name */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Column Name / Header *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Priority, Department, Notes..."
                value={name}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
              />
            </div>

            {/* Quick Presets */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', marginBottom: '6px' }}>
                Quick Presets:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {COLUMN_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="preset-chip"
                    onClick={() => handleSelectPreset(p)}
                    style={{
                      background: name === p.name ? 'var(--primary-light)' : 'var(--bg-subtle)',
                      color: name === p.name ? 'var(--primary)' : 'var(--text-main)',
                      borderColor: name === p.name ? 'var(--primary)' : 'var(--border-subtle)'
                    }}
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Column Type */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Data Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = type === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setType(opt.id)}
                      className={`type-option-card ${isSelected ? 'selected' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <Icon size={14} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                        <span style={{ fontWeight: 600, fontSize: '0.825rem' }}>{opt.label}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                        {opt.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Position */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Initial Position
              </label>
              <select
                className="form-control"
                value={insertAfter}
                onChange={(e) => setInsertAfter(e.target.value)}
              >
                <option value="end">At the end (before Actions)</option>
                {existingColumns
                  .filter(c => c.id !== 'actions')
                  .map((col) => (
                    <option key={col.id} value={col.id}>
                      After {col.label}
                    </option>
                  ))}
              </select>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                💡 You can move or reorder columns anytime using the &quot;Move After Next&quot; buttons or dragging the header.
              </span>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <Plus size={15} />
              <span>Add Column</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
