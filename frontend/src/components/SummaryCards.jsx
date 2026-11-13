import React from 'react';
import { Layers, Clock, AlertTriangle, CheckCircle, PauseCircle, HelpCircle, Calendar, ShieldAlert } from 'lucide-react';

export default function SummaryCards({ counts, activeFilter, onSelectFilter, filterPreset, onSelectPreset }) {
  const cards = [
    {
      id: '',
      classKey: 'all',
      label: 'All Deliverables',
      count: counts.total || 0,
      icon: <Layers size={17} color="var(--primary)" />,
      bg: 'var(--primary-light)'
    },
    {
      id: 'In Progress',
      classKey: 'inprogress',
      label: 'In Progress',
      count: counts['In Progress'] || 0,
      icon: <Clock size={17} color="var(--status-inprogress-text)" />,
      bg: 'var(--status-inprogress-bg)'
    },
    {
      id: 'Ongoing',
      classKey: 'ongoing',
      label: 'Ongoing',
      count: counts['Ongoing'] || 0,
      icon: <AlertTriangle size={17} color="var(--status-ongoing-text)" />,
      bg: 'var(--status-ongoing-bg)'
    },
    {
      id: 'Completed',
      classKey: 'completed',
      label: 'Completed',
      count: counts['Completed'] || 0,
      icon: <CheckCircle size={17} color="var(--status-completed-text)" />,
      bg: 'var(--status-completed-bg)'
    },
    {
      id: 'Not Started',
      classKey: 'notstarted',
      label: 'Not Started',
      count: counts['Not Started'] || 0,
      icon: <HelpCircle size={17} color="var(--status-notstarted-text)" />,
      bg: 'var(--status-notstarted-bg)'
    },
    {
      id: 'On Hold',
      classKey: 'onhold',
      label: 'On Hold',
      count: counts['On Hold'] || 0,
      icon: <PauseCircle size={17} color="var(--status-onhold-text)" />,
      bg: 'var(--status-onhold-bg)'
    }
  ];

  const total = counts.total || 0;
  const completed = counts['Completed'] || 0;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      {/* 6 Status Cards */}
      <div className="stats-grid">
        {cards.map(card => {
          const isActive = activeFilter === card.id && !filterPreset;
          return (
            <div
              key={card.label}
              className={`stat-card ${card.classKey} ${isActive ? 'active' : ''}`}
              onClick={() => onSelectFilter(card.id)}
              role="button"
              tabIndex={0}
            >
              <div className="stat-info">
                <span className="stat-label">{card.label}</span>
                <span className="stat-count">{card.count}</span>
              </div>
              <div className="stat-icon" style={{ background: card.bg }}>
                {card.icon}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress & Quick Health Indicator */}
      <div className="progress-container">
        <div className="progress-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--status-completed-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} color="var(--status-completed-text)" />
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                Career HUB Launch Readiness
              </span>
              {/* <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {completed} of {total} milestone deliverables completed
              </div> */}
            </div>
          </div>
        </div>

        {/* Overdue & Upcoming badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {counts.overdue > 0 && (
            <div
              className="health-badge overdue"
              onClick={() => onSelectPreset('overdue')}
              title="Click to view overdue deliverables"
            >
              <ShieldAlert size={14} />
              <span>{counts.overdue} Overdue</span>
            </div>
          )}

          {counts.upcomingDeadline > 0 && (
            <div
              className="health-badge upcoming"
              onClick={() => onSelectPreset('upcoming')}
              title="Click to view deliverables due in the next 14 days"
            >
              <Calendar size={14} />
              <span>{counts.upcomingDeadline} Due in 14d</span>
            </div>
          )}
        </div>

        {/* Progress Track */}
        <div className="progress-track">
          {/* <div
            className="progress-fill"
            style={{ width: `${completionPct}%` }}
          /> */}
          <div
            className="progress-fill"
            style={{ width: `${23}%` }}
          />
        </div>

        {/* <div className="progress-badge">
          {completionPct}% Complete
        </div> */}
        <div className="progress-badge">
          23% Complete
        </div>
      </div>
    </div>
  );
}
