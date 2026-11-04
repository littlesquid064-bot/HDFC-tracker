import React, { useState } from 'react';
import { Edit3, Check, X, Trash2, Calendar, User, Clock, ArrowRight, AlertTriangle, MessageSquare, ChevronDown, History } from 'lucide-react';

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Ongoing', 'Completed', 'On Hold'];

export default function TrackerTable({
  items,
  onSaveRow,
  onDeleteRow,
  onOpenDrawer,
  isGrouped = true
}) {
  const [editingRemarkRef, setEditingRemarkRef] = useState(null);
  const [remarkText, setRemarkText] = useState('');
  const [openStatusDropdownRef, setOpenStatusDropdownRef] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const handleStartEditRemark = (item, e) => {
    e.stopPropagation();
    setEditingRemarkRef(item.ref);
    setRemarkText(item.remarks || '');
  };

  const handleSaveRemark = async (ref, e) => {
    if (e) e.stopPropagation();
    await onSaveRow(ref, { remarks: remarkText });
    setEditingRemarkRef(null);
  };

  const handleCancelRemark = (e) => {
    if (e) e.stopPropagation();
    setEditingRemarkRef(null);
  };

  const handleStatusChange = async (ref, newStatus, e) => {
    e.stopPropagation();
    setOpenStatusDropdownRef(null);
    let actualCompletion = undefined;
    if (newStatus === 'Completed') {
      actualCompletion = today;
    }
    await onSaveRow(ref, { status: newStatus, actual_completion: actualCompletion });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  };

  if (!items || items.length === 0) {
    return (
      <div className="table-container" style={{ padding: '3.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500 }}>
          No matching activities found for this filter.
        </p>
      </div>
    );
  }

  let lastMilestone = '';

  return (
    <div className="table-container">
      <table className="tracker-table">
        <thead>
          <tr>
            <th style={{ width: '75px' }}>Ref</th>
            <th style={{ width: '110px' }}>Role</th>
            <th style={{ minWidth: '260px' }}>Activity / Deliverable</th>
            <th style={{ width: '135px' }}>Owner</th>
            <th style={{ width: '145px' }}>Timeline</th>
            <th style={{ width: '150px' }}>Status</th>
            <th style={{ minWidth: '220px' }}>Remarks / Blockers</th>
            <th style={{ width: '85px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isEditingRemark = editingRemarkRef === item.ref;
            const isStatusOpen = openStatusDropdownRef === item.ref;
            const isOverdue = item.end && item.end < today && item.status !== 'Completed';

            const showMilestoneHeader = isGrouped && item.milestone && item.milestone !== lastMilestone;
            if (showMilestoneHeader) {
              lastMilestone = item.milestone;
            }

            const statusKey = (item.status || 'Not Started').toLowerCase().replace(/\s+/g, '');

            return (
              <React.Fragment key={item.ref}>
                {showMilestoneHeader && (
                  <tr className="milestone-group-row">
                    <td colSpan="8">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{item.milestone}</span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr className="tracker-row" onClick={() => onOpenDrawer(item)}>
                  {/* Ref */}
                  <td>
                    <span className="ref-pill">{item.ref}</span>
                  </td>

                  {/* Role */}
                  <td>
                    <span className={`role-badge ${item.niit_role === 'Lead' ? 'role-lead' : 'role-support'}`}>
                      {item.niit_role || 'Support'}
                    </span>
                  </td>

                  {/* Activity */}
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px' }}>
                      {item.activity}
                    </div>
                    {item.actual_completion && (
                      <div style={{ fontSize: '0.725rem', color: 'var(--status-completed-text)', fontWeight: 600 }}>
                        ✓ Completed on {formatDate(item.actual_completion)}
                      </div>
                    )}
                  </td>

                  {/* Owner */}
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="table-owner-cell">
                      <User size={13} color="var(--text-subtle)" />
                      <span>{item.partner_owner || 'Unassigned'}</span>
                    </div>
                  </td>

                  {/* Dates & Overdue Flag */}
                  <td>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                      {formatDate(item.start)} &rarr; {formatDate(item.end)}
                    </div>
                    {isOverdue && (
                      <span className="badge-overdue" style={{ marginTop: '4px' }}>
                        <AlertTriangle size={11} /> Overdue
                      </span>
                    )}
                  </td>

                  {/* 1-Click Interactive Status Selector */}
                  <td onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className={`status-badge-interactive status-${statusKey}`}
                      onClick={() => setOpenStatusDropdownRef(isStatusOpen ? null : item.ref)}
                      title="Click to quickly change status"
                    >
                      <span>{item.status || 'Not Started'}</span>
                      <ChevronDown size={12} style={{ opacity: 0.7 }} />
                    </button>

                    {isStatusOpen && (
                      <div className="status-dropdown-menu">
                        {STATUS_OPTIONS.map((opt) => (
                          <div
                            key={opt}
                            className={`status-dropdown-option ${item.status === opt ? 'selected' : ''}`}
                            onClick={(e) => handleStatusChange(item.ref, opt, e)}
                          >
                            <span className={`status-dot dot-${opt.toLowerCase().replace(/\s+/g, '')}`} />
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Inline Editable Remarks */}
                  <td onClick={(e) => e.stopPropagation()}>
                    {isEditingRemark ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                        <textarea
                          className="form-control"
                          rows="2"
                          autoFocus
                          style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                          value={remarkText}
                          onChange={(e) => setRemarkText(e.target.value)}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                          onClick={(e) => handleSaveRemark(item.ref, e)}
                          title="Save"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '4px 6px', fontSize: '0.75rem', background: 'var(--bg-subtle)' }}
                          onClick={handleCancelRemark}
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="table-remarks-box"
                        onClick={(e) => handleStartEditRemark(item, e)}
                        title="Click to edit remarks"
                      >
                        <div style={{ fontSize: '0.8rem', color: item.remarks ? 'var(--text-main)' : 'var(--text-subtle)', fontStyle: item.remarks ? 'normal' : 'italic' }}>
                          {item.remarks || '+ Add remarks or notes...'}
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        className="btn-icon"
                        onClick={() => onOpenDrawer(item, 'update')}
                        title="Edit deliverable details"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onOpenDrawer(item, 'history')}
                        title="View activity & update logs for this item"
                      >
                        <History size={13} />
                      </button>
                      <button
                        className="btn-icon text-danger"
                        onClick={() => {
                          if (window.confirm(`Delete activity [${item.ref}]?`)) {
                            onDeleteRow(item.ref);
                          }
                        }}
                        title="Delete activity"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
