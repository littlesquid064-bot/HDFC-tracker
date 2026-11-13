import React, { useState } from 'react';
import { X, Plus, Calendar, User, Tag } from 'lucide-react';

export default function AddActivityModal({
  isOpen,
  onClose,
  onAdd,
  milestones
}) {
  const [ref, setRef] = useState('');
  const [milestone, setMilestone] = useState(milestones[0] || '01 · Partner Mobilisation & Governance');
  const [customMilestone, setCustomMilestone] = useState('');
  const [activity, setActivity] = useState('');
  const [role, setRole] = useState('Lead');
  const [owner, setOwner] = useState('');
  const [actual, setActual] = useState('');
  const [hdfcOwner, setHdfcOwner] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('Not Started');
  const [remarks, setRemarks] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activity.trim()) {
      alert('Please enter an activity description.');
      return;
    }

    const finalMilestone = milestone === '__custom__' ? customMilestone.trim() : milestone;

    onAdd({
      ref: ref.trim() || undefined,
      milestone: finalMilestone || 'General',
      activity: activity.trim(),
      niit_role: role,
      partner_owner: owner.trim() || 'TBD',
      actual: actual.trim() || '',
      hdfc_owner: hdfcOwner.trim() || '',
      start: startDate,
      end: endDate,
      status,
      remarks: remarks.trim()
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Add New Activity / Deliverable</div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Ref Code (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 05.04 (auto if blank)"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">NIIT Role</label>
                <select 
                  className="form-control"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Lead">Lead</option>
                  <option value="Support">Support</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Milestone</label>
              <select
                className="form-control"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
              >
                {milestones.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__custom__">+ Add Custom Milestone...</option>
              </select>
            </div>

            {milestone === '__custom__' && (
              <div className="form-group">
                <label className="form-label">New Milestone Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 16 · Phase 2 Rollout"
                  value={customMilestone}
                  onChange={(e) => setCustomMilestone(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Activity / Deliverable Description *</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Describe the activity, key outcome or deliverable..."
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Partner Owner</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Neha Basandani"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Sub-Owner (Actual)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rashmi / Avinash"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">HDFC Owner</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Myra / Sabnam / Nikita"
                  value={hdfcOwner}
                  onChange={(e) => setHdfcOwner(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Initial Remarks / Notes</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Initial comments or current status notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn"
              style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Plus size={16} />
              <span>Create Activity</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
