import React from 'react';
import SummaryCards from './SummaryCards';
import { 
  ArrowRight, 
  History, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Layers, 
  BarChart3, 
  ShieldAlert, 
  UserCheck, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';

export default function DashboardView({
  items = [],
  counts,
  activityLogs = [],
  onSelectMilestone,
  onSelectPreset,
  onSelectFilter,
  onOpenDrawer,
  onNavigateTab
}) {
  const today = new Date().toISOString().split('T')[0];
  const next14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  // Urgent items: Overdue or due in next 14 days
  const urgentItems = items.filter(
    i => (i.end && i.end < today && i.status !== 'Completed') ||
         (i.end && i.end >= today && i.end <= next14Days && i.status !== 'Completed')
  ).slice(0, 5);

  // Milestones aggregation
  const milestonesMap = {};
  items.forEach((item) => {
    const m = item.milestone || 'General';
    if (!milestonesMap[m]) {
      milestonesMap[m] = { name: m, total: 0, completed: 0, inProgress: 0, notStarted: 0 };
    }
    milestonesMap[m].total++;
    if (item.status === 'Completed') milestonesMap[m].completed++;
    else if (item.status === 'In Progress' || item.status === 'Ongoing') milestonesMap[m].inProgress++;
    else milestonesMap[m].notStarted++;
  });

  const milestoneList = Object.values(milestonesMap).slice(0, 6);

  // Lead vs Support Role count
  const leadCount = items.filter(i => i.niit_role === 'Lead').length;
  const supportCount = items.filter(i => i.niit_role === 'Support').length;

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

  return (
    <div className="dashboard-container">
      {/* 1. Summary Cards + Launch Readiness Banner */}
      <SummaryCards
        counts={counts}
        activeFilter=""
        onSelectFilter={(val) => {
          onSelectFilter(val);
          onNavigateTab('table');
        }}
        filterPreset=""
        onSelectPreset={(preset) => {
          onSelectPreset(preset);
          onNavigateTab('table');
        }}
      />

      {/* 2. Secondary Metrics Row */}
      <div className="dashboard-metrics-grid">
        <div className="metric-box">
          <div className="metric-box-header">
            <span className="metric-box-title">Total Milestones</span>
            <div className="metric-box-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Layers size={16} />
            </div>
          </div>
          <div className="metric-box-val">{Object.keys(milestonesMap).length}</div>
          <div className="metric-box-sub">Across partnership deliverables</div>
        </div>

        <div className="metric-box">
          <div className="metric-box-header">
            <span className="metric-box-title">NIIT Lead Role</span>
            <div className="metric-box-icon" style={{ background: 'var(--status-inprogress-bg)', color: 'var(--status-inprogress-text)' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="metric-box-val">{leadCount}</div>
          <div className="metric-box-sub">{Math.round((leadCount / (items.length || 1)) * 100)}% of deliverables led by NIIT</div>
        </div>

        <div className="metric-box">
          <div className="metric-box-header">
            <span className="metric-box-title">Support Role</span>
            <div className="metric-box-icon" style={{ background: 'var(--status-ongoing-bg)', color: 'var(--status-ongoing-text)' }}>
              <UserCheck size={16} />
            </div>
          </div>
          <div className="metric-box-val">{supportCount}</div>
          <div className="metric-box-sub">Partner & stakeholder collaboration</div>
        </div>

        <div className="metric-box">
          <div className="metric-box-header">
            <span className="metric-box-title">Urgent Attention</span>
            <div className="metric-box-icon" style={{ background: 'var(--status-overdue-bg)', color: 'var(--status-overdue-text)' }}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="metric-box-val" style={{ color: counts.overdue > 0 ? 'var(--status-overdue-text)' : 'inherit' }}>
            {counts.overdue + counts.upcomingDeadline}
          </div>
          <div className="metric-box-sub">{counts.overdue} overdue &bull; {counts.upcomingDeadline} due soon</div>
        </div>
      </div>

      {/* 3. Main Dashboard 2-Column Section */}
      <div className="dashboard-content-grid">
        {/* Left Column: Milestones Progress & Urgent Attention */}
        <div className="dashboard-col">
          {/* Milestone Readiness Highlights */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} color="var(--primary)" />
                <h3 className="dashboard-card-title">Milestone Readiness Overview</h3>
              </div>
              <button 
                className="btn-link-action"
                onClick={() => onNavigateTab('matrix')}
              >
                <span>View Full Matrix</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="dashboard-milestone-list">
              {milestoneList.map((m) => {
                const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                return (
                  <div 
                    key={m.name} 
                    className="dashboard-milestone-row"
                    onClick={() => {
                      onSelectMilestone(m.name);
                      onNavigateTab('table');
                    }}
                    title="Click to view deliverables for this milestone"
                  >
                    <div className="dashboard-milestone-info">
                      <span className="dashboard-milestone-name">{m.name}</span>
                      <div className="dashboard-milestone-meta">
                        <span>{m.completed}/{m.total} completed</span>
                        <span>&bull;</span>
                        <span>{m.inProgress} active</span>
                      </div>
                    </div>
                    <div className="dashboard-milestone-pct-wrap">
                      <span className="dashboard-milestone-pct">{pct}%</span>
                      <div className="progress-track" style={{ width: '80px', height: '6px', margin: 0 }}>
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${pct}%`,
                            background: pct === 100 ? 'var(--status-completed-text)' : 'var(--primary)'
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Urgent Attention / Deadlines */}
          <div className="dashboard-card" style={{ marginTop: '1.25rem' }}>
            <div className="dashboard-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent-orange)" />
                <h3 className="dashboard-card-title">Deadlines & Upcoming Attention</h3>
              </div>
              <button 
                className="btn-link-action"
                onClick={() => {
                  onSelectPreset('attention');
                  onNavigateTab('table');
                }}
              >
                <span>View In Table</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {urgentItems.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                🎉 No overdue or immediate items requiring urgent attention!
              </div>
            ) : (
              <div className="dashboard-urgent-list">
                {urgentItems.map((item) => {
                  const isOverdue = item.end && item.end < today && item.status !== 'Completed';
                  return (
                    <div 
                      key={item.ref} 
                      className="dashboard-urgent-row"
                      onClick={() => onOpenDrawer(item)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ref-pill">{item.ref}</span>
                        {isOverdue ? (
                          <span className="badge-overdue" style={{ fontSize: '0.65rem' }}>
                            <AlertTriangle size={10} /> Overdue
                          </span>
                        ) : (
                          <span className="badge-upcoming" style={{ fontSize: '0.65rem' }}>
                            <Calendar size={10} /> Due Soon
                          </span>
                        )}
                      </div>
                      <div className="dashboard-urgent-title">{item.activity}</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Owner: {item.partner_owner || 'Unassigned'} &bull; Due: {item.end}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Latest Activity & Update Logs */}
        <div className="dashboard-col">
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} color="var(--primary)" />
                <h3 className="dashboard-card-title">Recent Activity Logs</h3>
              </div>
              <button 
                className="btn-link-action"
                onClick={() => onNavigateTab('feed')}
              >
                <span>View All Logs ({activityLogs.length})</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {activityLogs.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No activity logs recorded yet.
              </div>
            ) : (
              <div className="dashboard-activity-mini-feed">
                {activityLogs.slice(0, 6).map((log) => {
                  let badgeBg = 'var(--status-inprogress-bg)';
                  let badgeColor = 'var(--status-inprogress-text)';
                  let Icon = Clock;

                  if (log.action === 'completed') {
                    badgeBg = 'var(--status-completed-bg)';
                    badgeColor = 'var(--status-completed-text)';
                    Icon = CheckCircle2;
                  } else if (log.action === 'remark_added' || log.field === 'remarks') {
                    badgeBg = 'var(--status-ongoing-bg)';
                    badgeColor = 'var(--status-ongoing-text)';
                    Icon = Clock;
                  } else if (log.field === 'owner') {
                    badgeBg = 'var(--primary-light)';
                    badgeColor = 'var(--primary)';
                    Icon = UserCheck;
                  }

                  return (
                    <div 
                      key={log.id} 
                      className="dashboard-mini-log-item"
                      onClick={() => {
                        const found = items.find(i => i.ref === log.ref);
                        if (found) onOpenDrawer(found);
                      }}
                    >
                      <div className="dashboard-mini-log-dot" style={{ background: badgeBg, color: badgeColor }}>
                        <Icon size={13} />
                      </div>
                      <div className="dashboard-mini-log-content">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="ref-pill" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{log.ref}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                            {formatRelativeTime(log.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '3px' }}>
                          {log.activity ? (log.activity.length > 55 ? `${log.activity.substring(0, 55)}...` : log.activity) : log.ref}
                        </div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {log.field === 'status' ? (
                            <span>Status changed to <strong style={{ color: 'var(--primary)' }}>{log.newValue}</strong></span>
                          ) : log.field === 'remarks' ? (
                            <span>Updated remarks: "{log.remarks ? log.remarks.substring(0, 40) + '...' : ''}"</span>
                          ) : log.field === 'owner' ? (
                            <span>Reassigned to <strong>{log.newValue}</strong></span>
                          ) : (
                            <span>{log.newValue || log.action}</span>
                          )}
                          <span style={{ marginLeft: '4px', opacity: 0.7 }}>by {log.author || 'User'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
