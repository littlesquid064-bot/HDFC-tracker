import React, { useState, useMemo } from 'react';
import { History, User, CheckCircle2, Clock, AlertCircle, ArrowRight, MessageSquare, PlusCircle, Trash2, Search, X, Download, Filter, UserCheck, Calendar } from 'lucide-react';

export default function ActivityLogFeed({ logs = [], onSelectRef }) {
  const [filterAuthor, setFilterAuthor] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Unique list of authors
  const authors = useMemo(() => {
    return Array.from(new Set(logs.map(l => l.author).filter(Boolean)));
  }, [logs]);

  // Filter logs based on search, author, and action type
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Author filter
      if (filterAuthor && log.author !== filterAuthor) return false;

      // Action type filter
      if (filterAction !== 'all') {
        if (filterAction === 'status' && log.field !== 'status') return false;
        if (filterAction === 'remarks' && log.field !== 'remarks') return false;
        if (filterAction === 'owner' && log.field !== 'owner') return false;
        if (filterAction === 'timeline' && log.field !== 'timeline') return false;
        if (filterAction === 'created' && log.action !== 'created') return false;
        if (filterAction === 'deleted' && log.action !== 'deleted') return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = log.ref && log.ref.toLowerCase().includes(q);
        const matchesActivity = log.activity && log.activity.toLowerCase().includes(q);
        const matchesMilestone = log.milestone && log.milestone.toLowerCase().includes(q);
        const matchesAuthor = log.author && log.author.toLowerCase().includes(q);
        const matchesRemarks = log.remarks && log.remarks.toLowerCase().includes(q);
        const matchesValues = (log.oldValue && String(log.oldValue).toLowerCase().includes(q)) ||
                              (log.newValue && String(log.newValue).toLowerCase().includes(q));
        if (!matchesRef && !matchesActivity && !matchesMilestone && !matchesAuthor && !matchesRemarks && !matchesValues) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filterAuthor, filterAction, searchQuery]);

  // Action type counts for quick filter pills
  const actionCounts = useMemo(() => {
    const counts = {
      all: logs.length,
      status: 0,
      remarks: 0,
      owner: 0,
      timeline: 0,
      created: 0
    };
    logs.forEach(l => {
      if (l.field === 'status') counts.status++;
      else if (l.field === 'remarks') counts.remarks++;
      else if (l.field === 'owner') counts.owner++;
      else if (l.field === 'timeline') counts.timeline++;
      else if (l.action === 'created') counts.created++;
    });
    return counts;
  }, [logs]);

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMins = Math.round((now - then) / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatExactTime = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  // Export audit logs as CSV
  const handleExportLogs = () => {
    const headers = ['Log ID', 'Timestamp', 'Deliverable Ref', 'Milestone', 'Activity', 'Author', 'Action', 'Field', 'Old Value', 'New Value', 'Remarks'];
    const rows = filteredLogs.map(l => [
      `"${(l.id || '').replace(/"/g, '""')}"`,
      `"${(l.timestamp || '').replace(/"/g, '""')}"`,
      `"${(l.ref || '').replace(/"/g, '""')}"`,
      `"${(l.milestone || '').replace(/"/g, '""')}"`,
      `"${(l.activity || '').replace(/"/g, '""')}"`,
      `"${(l.author || '').replace(/"/g, '""')}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.field || '').replace(/"/g, '""')}"`,
      `"${(l.oldValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${(l.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hdfc_tracker_activity_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="activity-feed-wrapper">
      {/* Feed Top Header */}
      <div className="activity-feed-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="feed-header-icon-box">
            <History size={20} color="var(--primary)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Activity & Update Logs
              </h3>
              <span className="live-log-pulse-badge">
                <span className="live-pulse-dot" />
                Live Feed
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Comprehensive audit trail of all updates, status changes, comments, and milestones
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportLogs}
            title="Download activity logs as CSV"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
          >
            <Download size={14} />
            <span>Export Logs</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="feed-controls-row">
        {/* Search */}
        <div className="search-input-wrap" style={{ flex: 1, minWidth: '220px' }}>
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search logs by ref, title, remark, author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="search-clear-btn">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Author filter dropdown */}
        {authors.length > 0 && (
          <select
            className="select-input"
            style={{ maxWidth: '200px' }}
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
          >
            <option value="">All Team Members ({authors.length})</option>
            {authors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}

        {/* Clear Filters */}
        {(filterAuthor || searchQuery || filterAction !== 'all') && (
          <button
            className="btn btn-secondary-outline"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.7rem' }}
            onClick={() => {
              setFilterAuthor('');
              setSearchQuery('');
              setFilterAction('all');
            }}
          >
            <X size={13} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Action Type Filter Pills */}
      <div className="feed-type-pills">
        <button
          className={`feed-type-pill ${filterAction === 'all' ? 'active' : ''}`}
          onClick={() => setFilterAction('all')}
        >
          All Events ({actionCounts.all})
        </button>
        <button
          className={`feed-type-pill ${filterAction === 'status' ? 'active' : ''}`}
          onClick={() => setFilterAction('status')}
        >
          Status Changes ({actionCounts.status})
        </button>
        <button
          className={`feed-type-pill ${filterAction === 'remarks' ? 'active' : ''}`}
          onClick={() => setFilterAction('remarks')}
        >
          Remarks & Notes ({actionCounts.remarks})
        </button>
        <button
          className={`feed-type-pill ${filterAction === 'owner' ? 'active' : ''}`}
          onClick={() => setFilterAction('owner')}
        >
          Owner Changes ({actionCounts.owner})
        </button>
        <button
          className={`feed-type-pill ${filterAction === 'timeline' ? 'active' : ''}`}
          onClick={() => setFilterAction('timeline')}
        >
          Timeline Shifts ({actionCounts.timeline})
        </button>
        {actionCounts.created > 0 && (
          <button
            className={`feed-type-pill ${filterAction === 'created' ? 'active' : ''}`}
            onClick={() => setFilterAction('created')}
          >
            Created ({actionCounts.created})
          </button>
        )}
      </div>

      {/* Timeline Events List */}
      <div className="feed-timeline">
        {filteredLogs.length === 0 ? (
          <div className="feed-empty-state">
            <History size={36} color="var(--text-subtle)" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>No log entries match your filter</div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Whenever any activity or deliverable is updated, it will immediately appear in this log feed.
            </div>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let Icon = Clock;
            let iconColor = 'var(--status-inprogress-text)';
            let iconBg = 'var(--status-inprogress-bg)';

            if (log.action === 'completed') {
              Icon = CheckCircle2;
              iconColor = 'var(--status-completed-text)';
              iconBg = 'var(--status-completed-bg)';
            } else if (log.action === 'remark_added' || log.field === 'remarks') {
              Icon = MessageSquare;
              iconColor = 'var(--status-ongoing-text)';
              iconBg = 'var(--status-ongoing-bg)';
            } else if (log.action === 'owner_changed' || log.field === 'owner') {
              Icon = UserCheck;
              iconColor = 'var(--primary)';
              iconBg = 'var(--primary-light)';
            } else if (log.action === 'timeline_changed' || log.field === 'timeline') {
              Icon = Calendar;
              iconColor = 'var(--accent-orange)';
              iconBg = 'var(--accent-orange-light)';
            } else if (log.action === 'created') {
              Icon = PlusCircle;
              iconColor = 'var(--status-completed-text)';
              iconBg = 'var(--status-completed-bg)';
            } else if (log.action === 'deleted') {
              Icon = Trash2;
              iconColor = 'var(--status-overdue-text)';
              iconBg = 'var(--status-overdue-bg)';
            }

            return (
              <div 
                key={log.id} 
                className="feed-timeline-item"
                onClick={() => onSelectRef(log.ref)}
                title="Click to view full deliverable details & history"
              >
                <div className="feed-icon-badge" style={{ background: iconBg, color: iconColor }}>
                  <Icon size={16} />
                </div>

                <div className="feed-content-card">
                  <div className="feed-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ref-pill">{log.ref}</span>
                      <span className="feed-author-name">{log.author || 'Team Member'}</span>
                    </div>
                    <span className="feed-timestamp" title={formatExactTime(log.timestamp)}>
                      {formatRelativeTime(log.timestamp)}
                    </span>
                  </div>

                  <div className="feed-card-milestone">{log.milestone}</div>
                  <div className="feed-activity-title">{log.activity}</div>

                  <div className="feed-action-summary">
                    {log.field === 'status' ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Status updated:</span>
                          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{log.oldValue}</span>
                          <ArrowRight size={12} />
                          <span className={`status-badge status-${(log.newValue || '').toLowerCase().replace(/\s+/g, '')}`}>
                            {log.newValue}
                          </span>
                        </div>
                        {log.remarks && (
                          <div className="feed-log-quote">
                            "{log.remarks}"
                          </div>
                        )}
                      </div>
                    ) : log.field === 'remarks' ? (
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Updated remarks:</span>
                        <div className="feed-log-quote">
                          "{log.remarks || log.newValue}"
                        </div>
                      </div>
                    ) : log.field === 'owner' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Reassigned owner:</span>
                        <span style={{ opacity: 0.7 }}>{log.oldValue || 'Unassigned'}</span>
                        <ArrowRight size={12} />
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{log.newValue}</span>
                        {log.remarks && (
                          <div className="feed-log-quote" style={{ width: '100%' }}>
                            "{log.remarks}"
                          </div>
                        )}
                      </div>
                    ) : log.field === 'timeline' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Adjusted timeline:</span>
                        <span style={{ opacity: 0.7, textDecoration: 'line-through' }}>{log.oldValue}</span>
                        <ArrowRight size={12} />
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{log.newValue}</span>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{log.action}:</span>{' '}
                        <span>{log.newValue || 'Deliverable updated'}</span>
                        {log.remarks && (
                          <div className="feed-log-quote">
                            "{log.remarks}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
