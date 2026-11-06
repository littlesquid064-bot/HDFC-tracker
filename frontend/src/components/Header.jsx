import React from 'react';
import { Download, Plus, Sun, Moon, Menu } from 'lucide-react';

const VIEW_TITLES = {
  dashboard: { title: 'Dashboard', sub: 'Executive overview, launch readiness & KPIs' },
  table: { title: 'Deliverables Table', sub: 'Comprehensive tracker with inline updates' },
  kanban: { title: 'Kanban Board', sub: 'Stage-by-stage workflow pipeline' },
  feed: { title: 'Activity Logs', sub: 'Real-time audit trail of all project updates' },
  sheet: { title: 'Excel Sheet', sub: 'Uploaded tracker — rename columns & rows' },
  matrix: { title: 'Readiness Matrix', sub: 'Milestone-by-milestone progress breakdown' }
};

export default function Header({
  isOnline,
  theme,
  toggleTheme,
  onAddClick,
  onExportClick,
  onResetClick,
  activeView = 'dashboard',
  onToggleSidebar
}) {
  const currentViewMeta = VIEW_TITLES[activeView] || { title: 'Tracker', sub: 'HDFC Career HUB' };

  return (
    <header className="app-top-header">
      <div className="header-left-col">
        {/* Mobile Sidebar Hamburger Toggle */}
        <button 
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title="Toggle Navigation Sidebar"
        >
          <Menu size={20} />
        </button>

        {/* View Heading & Subtitle */}
        <div className="header-page-title-wrap">
          <h1 className="header-page-title">{currentViewMeta.title}</h1>
          <p className="header-page-sub">{currentViewMeta.sub}</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Theme Toggle (Light / Dark) */}
        <button 
          className="btn btn-ghost-dark" 
          onClick={toggleTheme} 
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Export to CSV */}
        <button 
          className="btn btn-secondary" 
          onClick={onExportClick}
          title="Download tracker data as CSV"
        >
          <Download size={14} />
          <span className="btn-label-desktop">Export CSV</span>
        </button>

        {/* Add Activity Primary Button */}
        <button 
          className="btn btn-primary" 
          onClick={onAddClick}
          title="Add new deliverable or milestone activity"
        >
          <Plus size={16} />
          <span>Add Activity</span>
        </button>
      </div>
    </header>
  );
}
