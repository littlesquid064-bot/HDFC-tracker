import React from 'react';
import { 
  LayoutDashboard, 
  LayoutList, 
  Kanban, 
  History, 
  BarChart3, 
  Sun, 
  Moon, 
  Activity, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function Sidebar({
  activeView,
  setActiveView,
  logsCount = 0,
  isOnline,
  theme,
  toggleTheme,
  completionPct = 0,
  totalDeliverables = 0,
  isOpen = false,
  onClose
}) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      desc: 'Executive summary & KPIs'
    },
    {
      id: 'table',
      label: 'Table View',
      icon: LayoutList,
      badge: totalDeliverables > 0 ? totalDeliverables : null,
      desc: 'Deliverables with inline edit'
    },
    {
      id: 'kanban',
      label: 'Kanban Board',
      icon: Kanban,
      badge: null,
      desc: 'Stage-by-stage board'
    },
    {
      id: 'feed',
      label: 'Activity Logs',
      icon: History,
      badge: logsCount > 0 ? logsCount : null,
      badgeColor: 'var(--primary)',
      desc: 'Audit trail of all updates'
    },
    {
      id: 'matrix',
      label: 'Readiness Matrix',
      icon: BarChart3,
      badge: null,
      desc: 'Milestone progress matrix'
    }
  ];

  const handleNavClick = (id) => {
    setActiveView(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} />
      )}

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand Section */}
        <div className="sidebar-brand">
          <div className="sidebar-logo-badge">
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', letterSpacing: '0.5px' }}>HDFC</span>
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">
              HDFC <span>Career HUB</span>
            </div>
            <div className="sidebar-brand-sub">Powered by NIIT</div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="sidebar-nav-section">
          <div className="sidebar-section-title">Navigation</div>
          <nav className="sidebar-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  title={item.desc}
                >
                  <div className="sidebar-nav-icon">
                    <Icon size={18} />
                  </div>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {item.badge !== null && (
                    <span 
                      className="sidebar-nav-badge"
                      style={item.badgeColor ? { background: item.badgeColor, color: '#fff' } : {}}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <div className="sidebar-active-indicator" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Readiness Snapshot Widget */}
        <div className="sidebar-widget">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Launch Readiness
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--status-completed-text)' }}>
              {completionPct}%
            </span>
          </div>
          <div className="progress-track" style={{ height: '6px', margin: 0 }}>
            <div
              className="progress-fill"
              style={{
                width: `${completionPct}%`,
                background: completionPct === 100 ? 'var(--status-completed-text)' : 'var(--primary)'
              }}
            />
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {totalDeliverables} Total Milestone Deliverables
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Theme:</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>{theme}</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            className="sidebar-theme-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>
    </>
  );
}
