import React from 'react';
import { Search, X, RefreshCw, LayoutList, Kanban } from 'lucide-react';

export default function FilterBar({
  search,
  setSearch,
  selectedMilestone,
  setSelectedMilestone,
  selectedRole,
  setSelectedRole,
  filterPreset,
  setFilterPreset,
  activeView,
  setActiveView,
  milestones,
  onClear,
  onRefresh,
  isRefreshing
}) {
  const hasActiveFilters = search || selectedMilestone || selectedRole || filterPreset;

  const presets = [
    { id: '', label: 'All' },
    { id: 'inprogress', label: '⚡ In Progress' },
    { id: 'overdue', label: '⚠️ Overdue' },
    { id: 'upcoming', label: '📅 Due in 14d' },
    { id: 'completed', label: '✅ Completed' },
    { id: 'attention', label: '🚨 Needs Attention' }
  ];

  return (
    <div className="filter-wrapper">
      {/* Top Row: Quick Filter Presets + View layout toggle */}
      <div className="filter-top-row">
        {/* Quick Filter Presets */}
        <div className="preset-pills-list">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`preset-pill ${filterPreset === p.id ? 'active' : ''}`}
              onClick={() => setFilterPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Quick Table/Kanban toggle if in one of those views */}
        {(activeView === 'table' || activeView === 'kanban') && (
          <div className="view-switcher" style={{ margin: 0 }}>
            <button
              className={`view-btn ${activeView === 'table' ? 'active' : ''}`}
              onClick={() => setActiveView('table')}
              title="Table view with grouped milestones"
            >
              <LayoutList size={14} />
              <span>Table</span>
            </button>
            <button
              className={`view-btn ${activeView === 'kanban' ? 'active' : ''}`}
              onClick={() => setActiveView('kanban')}
              title="Kanban columns by status"
            >
              <Kanban size={14} />
              <span>Kanban</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Row: Search, Milestone Dropdown, Role Filter, Refresh */}
      <div className="filter-card" style={{ marginBottom: 0 }}>
        <div className="filter-left">
          {/* Search Input */}
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search deliverables, owner, remarks, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="search-clear-btn"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Milestone Dropdown */}
          <select
            className="select-input"
            value={selectedMilestone}
            onChange={(e) => setSelectedMilestone(e.target.value)}
          >
            <option value="">All Milestones ({milestones.length})</option>
            {milestones.map((m) => (
              <option key={m} value={m}>
                {m.length > 40 ? `${m.substring(0, 40)}...` : m}
              </option>
            ))}
          </select>

          {/* Role Dropdown */}
          <select
            className="select-input"
            style={{ maxWidth: '140px' }}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="Lead">Lead</option>
            <option value="Support">Support</option>
          </select>
        </div>

        <div className="filter-right">
          {hasActiveFilters && (
            <button 
              className="btn btn-secondary-outline"
              onClick={onClear}
            >
              <X size={14} />
              <span>Clear</span>
            </button>
          )}

          <button 
            className="btn btn-secondary-outline" 
            onClick={onRefresh}
            title="Refresh tracker data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </div>
  );
}
