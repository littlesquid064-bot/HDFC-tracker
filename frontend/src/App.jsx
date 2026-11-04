import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import FilterBar from './components/FilterBar';
import TrackerTable from './components/TrackerTable';
import KanbanBoard from './components/KanbanBoard';
import ActivityLogFeed from './components/ActivityLogFeed';
import MilestoneMatrix from './components/MilestoneMatrix';
import ActivityDrawer from './components/ActivityDrawer';
import AddActivityModal from './components/AddActivityModal';
import Toast from './components/Toast';
import { api } from './api';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('hdfc_theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  // Core Data State
  const [items, setItems] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active View: 'dashboard' | 'table' | 'kanban' | 'feed' | 'matrix'
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filterPreset, setFilterPreset] = useState('');

  // Drawer & Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState('update');
  const [itemHistory, setItemHistory] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hdfc_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch data & audit logs
  const fetchData = useCallback(async (showToastIndicator = false, silent = false) => {
    try {
      const health = await api.checkHealth();
      setIsOnline(health.isBackendOnline);

      const [itemsRes, logsRes] = await Promise.all([
        api.getAll(),
        api.getActivityLogs(100)
      ]);

      setItems(itemsRes.data);
      setActivityLogs(logsRes);

      if (showToastIndicator) {
        addToast(itemsRes.source === 'backend' ? 'Synced with live database' : 'Loaded latest local data');
      }
    } catch (err) {
      console.error('Failed to load tracker items:', err);
      if (!silent) addToast('Failed to sync data with server', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live updates: silently re-sync every 30s
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') fetchData(false, true);
    };
    const timer = setInterval(sync, 30000);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData(true);
  };

  // Open Drawer for an item and load its specific history
  const handleOpenDrawer = async (item, tab = 'update') => {
    setSelectedItem(item);
    setDrawerInitialTab(tab);
    setIsDrawerOpen(true);
    try {
      const logs = await api.getActivityLogs(40, item.ref);
      setItemHistory(logs);
    } catch (e) {
      setItemHistory([]);
    }
  };

  // Save row updates (Status, Remarks, Dates, Owner)
  const handleSaveRow = async (ref, updates) => {
    try {
      setItems(prev => prev.map(item => {
        if (item.ref === ref) {
          const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
          if (updates.status === 'Completed' && !updated.actual_completion) {
            updated.actual_completion = new Date().toISOString().split('T')[0];
          }
          return updated;
        }
        return item;
      }));

      const updated = await api.updateItem(ref, updates);
      
      // Update selected drawer item if currently open
      if (selectedItem && selectedItem.ref === ref) {
        setSelectedItem(updated);
        const freshLogs = await api.getActivityLogs(40, ref);
        setItemHistory(freshLogs);
      }

      // Refresh global activity logs
      const freshAllLogs = await api.getActivityLogs(100);
      setActivityLogs(freshAllLogs);

      const changeSummary = updates.status 
        ? `Status: ${updates.status}`
        : updates.remarks 
        ? 'Remarks updated' 
        : updates.partner_owner 
        ? `Owner: ${updates.partner_owner}`
        : 'Saved';
      addToast(`Logged & Saved [${ref}]: ${changeSummary}`);
    } catch (err) {
      console.error('Failed to save activity:', err);
      addToast(`Error saving activity [${ref}]`, 'error');
      fetchData();
    }
  };

  // Quick 1-click status change from table or kanban
  const handleQuickStatusChange = async (ref, newStatus) => {
    await handleSaveRow(ref, { status: newStatus });
  };

  // Add new activity
  const handleAddActivity = async (newItem) => {
    try {
      const created = await api.createItem(newItem);
      setItems(prev => [created, ...prev]);
      const freshLogs = await api.getActivityLogs(100);
      setActivityLogs(freshLogs);
      addToast(`Created & logged new deliverable [${created.ref}]`);
    } catch (err) {
      console.error('Failed to create activity:', err);
      addToast('Failed to create activity', 'error');
    }
  };

  // Delete activity
  const handleDeleteActivity = async (ref) => {
    try {
      setItems(prev => prev.filter(item => item.ref !== ref));
      if (selectedItem && selectedItem.ref === ref) {
        setIsDrawerOpen(false);
      }
      await api.deleteItem(ref);
      const freshLogs = await api.getActivityLogs(100);
      setActivityLogs(freshLogs);
      addToast(`Deleted activity [${ref}]`);
    } catch (err) {
      console.error('Failed to delete activity:', err);
      addToast(`Failed to delete activity [${ref}]`, 'error');
      fetchData();
    }
  };

  // Reset to original seed data
  const handleReset = async () => {
    if (window.confirm('Reset all 58 milestones to original defaults? Custom changes will be cleared.')) {
      setLoading(true);
      await api.resetToSeed();
      await fetchData();
      addToast('Tracker successfully reset to original seed data', 'info');
    }
  };

  // Export current list to CSV
  const handleExport = () => {
    api.exportCsv(filteredItems.length > 0 ? filteredItems : items);
    addToast(`Exported ${filteredItems.length > 0 ? filteredItems.length : items.length} activities to CSV`);
  };

  // Unique milestones
  const milestones = useMemo(() => {
    const set = new Set();
    items.forEach(i => {
      if (i.milestone) set.add(i.milestone);
    });
    return Array.from(set);
  }, [items]);

  // Operational Counts & Health Metrics
  const counts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const next14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const c = {
      total: items.length,
      'In Progress': 0,
      'Ongoing': 0,
      'Completed': 0,
      'Not Started': 0,
      'On Hold': 0,
      overdue: 0,
      upcomingDeadline: 0
    };

    items.forEach(i => {
      const s = i.status || 'Not Started';
      if (c[s] !== undefined) c[s]++;
      else c[s] = 1;

      if (i.end && i.end < today && i.status !== 'Completed') {
        c.overdue++;
      }
      if (i.end && i.end >= today && i.end <= next14Days && i.status !== 'Completed') {
        c.upcomingDeadline++;
      }
    });

    return c;
  }, [items]);

  const completionPct = items.length > 0 
    ? Math.round(((counts['Completed'] || 0) / items.length) * 100) 
    : 0;

  // Filtered Activities
  const filteredItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const next14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    return items.filter(item => {
      // Preset filters
      if (filterPreset === 'inprogress') {
        if (item.status !== 'In Progress' && item.status !== 'Ongoing') return false;
      } else if (filterPreset === 'overdue') {
        if (!item.end || item.end >= today || item.status === 'Completed') return false;
      } else if (filterPreset === 'upcoming') {
        if (!item.end || item.end < today || item.end > next14Days || item.status === 'Completed') return false;
      } else if (filterPreset === 'completed') {
        if (item.status !== 'Completed') return false;
      } else if (filterPreset === 'attention') {
        const isOverdue = item.end && item.end < today && item.status !== 'Completed';
        const isOnHold = item.status === 'On Hold';
        if (!isOverdue && !isOnHold) return false;
      }

      // Status pill filter
      if (statusFilter && (item.status || 'Not Started').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Milestone filter
      if (selectedMilestone && item.milestone !== selectedMilestone) {
        return false;
      }

      // Role filter
      if (selectedRole && item.niit_role !== selectedRole) {
        return false;
      }

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesRef = item.ref && item.ref.toLowerCase().includes(q);
        const matchesActivity = item.activity && item.activity.toLowerCase().includes(q);
        const matchesOwner = item.partner_owner && item.partner_owner.toLowerCase().includes(q);
        const matchesRemarks = item.remarks && item.remarks.toLowerCase().includes(q);
        const matchesMilestone = item.milestone && item.milestone.toLowerCase().includes(q);
        if (!matchesRef && !matchesActivity && !matchesOwner && !matchesRemarks && !matchesMilestone) {
          return false;
        }
      }

      return true;
    });
  }, [items, filterPreset, statusFilter, selectedMilestone, selectedRole, search]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedMilestone('');
    setSelectedRole('');
    setStatusFilter('');
    setFilterPreset('');
  };

  const handleSelectRefFromFeed = (ref) => {
    const found = items.find(i => i.ref === ref);
    if (found) {
      handleOpenDrawer(found);
    }
  };

  const handleSelectMilestoneFromMatrix = (milestoneName) => {
    setSelectedMilestone(milestoneName);
    setActiveView('table');
  };

  return (
    <div className="app-layout">
      {/* 5-Tab Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        logsCount={activityLogs.length}
        isOnline={isOnline}
        theme={theme}
        toggleTheme={toggleTheme}
        completionPct={completionPct}
        totalDeliverables={items.length}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main App Column */}
      <div className="app-main-content">
        <Header
          isOnline={isOnline}
          theme={theme}
          toggleTheme={toggleTheme}
          onAddClick={() => setIsAddModalOpen(true)}
          onExportClick={handleExport}
          onResetClick={handleReset}
          activeView={activeView}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <main className="main-viewport">
          {loading ? (
            <div className="table-container" style={{ padding: '3.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>Loading live tracker data...</p>
            </div>
          ) : (
            <>
              {/* Tab 1: Dashboard View */}
              {activeView === 'dashboard' && (
                <DashboardView
                  items={items}
                  counts={counts}
                  activityLogs={activityLogs}
                  onSelectMilestone={handleSelectMilestoneFromMatrix}
                  onSelectPreset={(preset) => {
                    handleClearFilters();
                    setFilterPreset(preset);
                  }}
                  onSelectFilter={(val) => {
                    handleClearFilters();
                    setStatusFilter(val);
                  }}
                  onOpenDrawer={handleOpenDrawer}
                  onNavigateTab={(tab) => setActiveView(tab)}
                />
              )}

              {/* Filter Bar for Table & Kanban views */}
              {(activeView === 'table' || activeView === 'kanban') && (
                <FilterBar
                  search={search}
                  setSearch={setSearch}
                  selectedMilestone={selectedMilestone}
                  setSelectedMilestone={setSelectedMilestone}
                  selectedRole={selectedRole}
                  setSelectedRole={setSelectedRole}
                  filterPreset={filterPreset}
                  setFilterPreset={setFilterPreset}
                  activeView={activeView}
                  setActiveView={setActiveView}
                  milestones={milestones}
                  onClear={handleClearFilters}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                />
              )}

              {/* Tab 2: Table View */}
              {activeView === 'table' && (
                <TrackerTable
                  items={filteredItems}
                  onSaveRow={handleSaveRow}
                  onDeleteRow={handleDeleteActivity}
                  onOpenDrawer={handleOpenDrawer}
                  isGrouped={!statusFilter && !search && !filterPreset}
                />
              )}

              {/* Tab 3: Kanban Board */}
              {activeView === 'kanban' && (
                <KanbanBoard
                  items={filteredItems}
                  onSelectRow={handleOpenDrawer}
                  onQuickStatusChange={handleQuickStatusChange}
                />
              )}

              {/* Tab 4: Activity Logs Feed */}
              {activeView === 'feed' && (
                <ActivityLogFeed
                  logs={activityLogs}
                  onSelectRef={handleSelectRefFromFeed}
                />
              )}

              {/* Tab 5: Readiness Matrix */}
              {activeView === 'matrix' && (
                <MilestoneMatrix
                  items={items}
                  onSelectMilestone={handleSelectMilestoneFromMatrix}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Activity Details & Quick Fill Drawer */}
      <ActivityDrawer
        item={selectedItem}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSaveRow}
        historyLogs={itemHistory}
        initialTab={drawerInitialTab}
      />

      {/* Add Deliverable Modal */}
      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddActivity}
        milestones={milestones}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
