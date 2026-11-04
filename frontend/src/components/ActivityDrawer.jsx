import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, User, Calendar, Tag, History, Send, AlertTriangle, ArrowRight } from 'lucide-react';

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Ongoing', 'Completed', 'On Hold'];

export default function ActivityDrawer({
  item,
  isOpen,
  onClose,
  onSave,
  historyLogs = [],
  initialTab = 'update'
}) {
  const [status, setStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actualCompletion, setActualCompletion] = useState('');
  const [owner, setOwner] = useState('');
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab); // 'update' | 'history'
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setStatus(item.status || 'Not Started');
      setRemarks(item.remarks || '');
      setActualCompletion(item.actual_completion || '');
      setOwner(item.partner_owner || '');
      setNewComment('');
      setActiveTab(initialTab);
    }
  }, [item, initialTab, isOpen]);

  if (!isOpen || !item) return null;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    let finalRemarks = remarks;
    if (newComment.trim()) {
      const ts = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      finalRemarks = remarks 
        ? `${remarks}\n[${ts}] ${newComment.trim()}`
        : `[${ts}] ${newComment.trim()}`;
    }

    await onSave(item.ref, {
      status,
      remarks: finalRemarks,
      actual_completion: actualCompletion,
      partner_owner: owner
    });

    setIsSaving(false);
    onClose();
  };

  const handleQuickStatus = async (newSts) => {
    setStatus(newSts);
    let finalActual = actualCompletion;
    if (newSts === 'Completed' && !finalActual) {
      finalActual = new Date().toISOString().split('T')[0];
      setActualCompletion(finalActual);
    }
    await onSave(item.ref, {
      status: newSts,
      actual_completion: finalActual
    });
  };

  const isOverdue = item.end && item.end < new Date().toISOString().split('T')[0] && item.status !== 'Completed';

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ref-pill">{item.ref}</span>
            <span className={`role-badge ${item.niit_role === 'Lead' ? 'role-lead' : 'role-support'}`}>
              {item.niit_role || 'Support'}
            </span>
            {isOverdue && (
              <span className="badge-overdue">
                <AlertTriangle size={12} /> Overdue
              </span>
            )}
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Milestone & Activity Title */}
        <div className="drawer-title-section">
          <div className="drawer-milestone">{item.milestone}</div>
          <h2 className="drawer-activity-title">{item.activity}</h2>
        </div>

        {/* Quick Status Bar */}
        <div className="drawer-quick-status">
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Quick Status:</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`quick-status-btn ${status === opt ? 'active ' + opt.toLowerCase().replace(/\s+/g, '') : ''}`}
                onClick={() => handleQuickStatus(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="drawer-tabs">
          <button 
            className={`drawer-tab ${activeTab === 'update' ? 'active' : ''}`}
            onClick={() => setActiveTab('update')}
          >
            Update & Details
          </button>
          <button 
            className={`drawer-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} />
            <span>Activity Logs ({historyLogs.length})</span>
          </button>
        </div>

        <div className="drawer-body">
          {activeTab === 'update' ? (
            <form onSubmit={handleSave}>
              {/* Meta Grid */}
              <div className="drawer-meta-grid">
                <div>
                  <label className="form-label">
                    <User size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    Owner / SPOC
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    placeholder="e.g. Saira / Sanjeev"
                  />
                </div>
                <div>
                  <label className="form-label">
                    <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                    Planned Timeline
                  </label>
                  <div style={{ fontSize: '0.85rem', padding: '0.55rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
                    {item.start} &rarr; {item.end}
                  </div>
                </div>
              </div>

              {/* Status & Actual Completion */}
              <div className="drawer-meta-grid" style={{ marginTop: '1rem' }}>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    className="form-control"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Actual Completion Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={actualCompletion}
                    onChange={(e) => setActualCompletion(e.target.value)}
                  />
                </div>
              </div>

              {/* Current Remarks */}
              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label className="form-label">Remarks & Progress History</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Record current blockers, milestone progress, or meeting notes..."
                />
              </div>

              {/* Add Progress Note / Comment */}
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">+ Add New Note / Update</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Agreement draft sent to legal team for review..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>
                    <Send size={14} />
                    <span>Post</span>
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} style={{ color: 'var(--text-main)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* History / What's Happened Feed */
            <div className="drawer-history-feed">
              {historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No updates recorded yet on this deliverable.
                </div>
              ) : (
                historyLogs.map((log) => (
                  <div key={log.id} className="history-event-card">
                    <div className="history-event-dot" />
                    <div className="history-event-header">
                      <span className="history-author">{log.author || 'Stakeholder'}</span>
                      <span className="history-time">
                        {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                        {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="history-event-desc">
                      {log.field === 'status' ? (
                        <span>
                          Changed status from <strong>{log.oldValue}</strong> to{' '}
                          <span className={`status-badge status-${(log.newValue || '').toLowerCase().replace(/\s+/g, '')}`}>
                            {log.newValue}
                          </span>
                        </span>
                      ) : log.field === 'remarks' ? (
                        <span>Updated progress notes & remarks</span>
                      ) : log.field === 'owner' ? (
                        <span>
                          Reassigned owner from <strong>{log.oldValue || 'Unassigned'}</strong> to <strong>{log.newValue}</strong>
                        </span>
                      ) : log.field === 'timeline' ? (
                        <span>
                          Adjusted timeline: <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>{log.oldValue}</span> &rarr; <strong>{log.newValue}</strong>
                        </span>
                      ) : (
                        <span>{log.newValue || log.action || 'Updated deliverable'}</span>
                      )}
                    </div>
                    {log.remarks && log.field !== 'status' && (
                      <div className="history-event-quote">
                        "{log.remarks}"
                      </div>
                    )}
                    {log.remarks && log.field === 'status' && (
                      <div className="history-event-quote" style={{ marginTop: '4px' }}>
                        Note: "{log.remarks}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
