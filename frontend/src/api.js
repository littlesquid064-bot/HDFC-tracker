import initialSeedData from './data/seed.json';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/tracker`
  : '/api/tracker';

const HEALTH_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/health`
  : '/api/health';

const LOCAL_STORAGE_KEY = 'hdfc_career_hub_tracker_data';
const LOCAL_LOGS_KEY = 'hdfc_career_hub_tracker_logs';

function getLocalData() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
  return initialSeedData;
}

function saveLocalData(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

function getLocalLogs() {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('LocalStorage logs error:', e);
  }
  // Generate initial mock logs for seed data that is in progress
  const initial = [];
  initialSeedData.filter(i => (i.status && i.status !== 'Not Started') || i.remarks).slice(0, 10).forEach((item, idx) => {
    initial.push({
      id: `local-seed-${idx}`,
      ref: item.ref,
      milestone: item.milestone,
      activity: item.activity,
      author: item.partner_owner || 'System',
      field: 'status',
      oldValue: 'Not Started',
      newValue: item.status,
      remarks: item.remarks || '',
      timestamp: new Date(Date.now() - (idx + 1) * 3600000 * 6).toISOString(),
      action: item.status === 'Completed' ? 'completed' : 'status_change'
    });
  });
  return initial;
}

function saveLocalLog(entry) {
  try {
    const logs = getLocalLogs();
    logs.unshift(entry);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch (e) {
    console.warn('Error saving local log:', e);
  }
}

export const api = {
  async checkHealth() {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2500) });
      if (res.ok) return { isBackendOnline: true };
    } catch (e) {}
    return { isBackendOnline: false };
  },

  async getAll(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.milestone) query.append('milestone', params.milestone);
    if (params.status) query.append('status', params.status);
    if (params.filterPreset) query.append('filterPreset', params.filterPreset);

    try {
      const res = await fetch(`${API_BASE}?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        saveLocalData(json.data);
        return { data: json.data, source: 'backend' };
      }
    } catch (e) {
      console.info('Backend unreachable, using local storage state.');
    }

    let items = getLocalData();
    const today = new Date().toISOString().split('T')[0];

    if (params.filterPreset === 'overdue') {
      items = items.filter(item => item.end && item.end < today && item.status !== 'Completed');
    } else if (params.filterPreset === 'upcoming') {
      const next14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      items = items.filter(item => item.end && item.end >= today && item.end <= next14Days && item.status !== 'Completed');
    } else if (params.filterPreset === 'completed') {
      items = items.filter(item => item.status === 'Completed');
    } else if (params.filterPreset === 'attention') {
      items = items.filter(item => item.status === 'On Hold' || (item.end && item.end < today && item.status !== 'Completed'));
    }

    if (params.status) {
      items = items.filter(i => (i.status || 'Not Started').toLowerCase() === params.status.toLowerCase());
    }
    if (params.milestone) {
      items = items.filter(i => i.milestone === params.milestone);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(i => 
        (i.activity && i.activity.toLowerCase().includes(q)) ||
        (i.partner_owner && i.partner_owner.toLowerCase().includes(q)) ||
        (i.ref && i.ref.toLowerCase().includes(q)) ||
        (i.remarks && i.remarks.toLowerCase().includes(q))
      );
    }
    return { data: items, source: 'local' };
  },

  async getActivityLogs(limit = 50, ref = null) {
    try {
      const query = new URLSearchParams();
      if (limit) query.append('limit', limit);
      if (ref) query.append('ref', ref);
      const res = await fetch(`${API_BASE}/activity-log?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch (e) {}

    let logs = getLocalLogs();
    if (ref) logs = logs.filter(l => l.ref === ref);
    return logs.slice(0, limit);
  },

  async updateItem(ref, updates, author = 'Team Member') {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(ref)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, author }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch (e) {
      console.info('Backend unreachable, saving update locally.');
    }

    const items = getLocalData();
    const index = items.findIndex(i => i.ref === ref);
    if (index !== -1) {
      const oldItem = items[index];
      const updated = {
        ...oldItem,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      if (updates.status === 'Completed' && !updated.actual_completion) {
        updated.actual_completion = new Date().toISOString().split('T')[0];
      }
      items[index] = updated;
      saveLocalData(items);

      // Record local logs for each changed property
      const authorName = updates.partner_owner || oldItem.partner_owner || author;
      let recordedChange = false;

      // 1. Status Change
      if (updates.status && updates.status !== oldItem.status) {
        saveLocalLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ref: updated.ref,
          milestone: updated.milestone,
          activity: updated.activity,
          author: authorName,
          field: 'status',
          oldValue: oldItem.status || 'Not Started',
          newValue: updates.status,
          remarks: updates.remarks || updated.remarks || '',
          timestamp: new Date().toISOString(),
          action: updates.status === 'Completed' ? 'completed' : 'status_change'
        });
        recordedChange = true;
      }

      // 2. Remarks Update
      if (updates.remarks !== undefined && updates.remarks !== (oldItem.remarks || '')) {
        saveLocalLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ref: updated.ref,
          milestone: updated.milestone,
          activity: updated.activity,
          author: authorName,
          field: 'remarks',
          oldValue: (oldItem.remarks || '').substring(0, 50),
          newValue: updates.remarks.substring(0, 50),
          remarks: updates.remarks,
          timestamp: new Date().toISOString(),
          action: 'remark_added'
        });
        recordedChange = true;
      }

      // 3. Owner Reassignment
      if (updates.partner_owner !== undefined && updates.partner_owner !== (oldItem.partner_owner || '')) {
        saveLocalLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ref: updated.ref,
          milestone: updated.milestone,
          activity: updated.activity,
          author: authorName,
          field: 'owner',
          oldValue: oldItem.partner_owner || 'Unassigned',
          newValue: updates.partner_owner,
          remarks: updates.remarks || '',
          timestamp: new Date().toISOString(),
          action: 'owner_changed'
        });
        recordedChange = true;
      }

      // 4. Timeline Change
      if ((updates.start && updates.start !== oldItem.start) || (updates.end && updates.end !== oldItem.end)) {
        saveLocalLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ref: updated.ref,
          milestone: updated.milestone,
          activity: updated.activity,
          author: authorName,
          field: 'timeline',
          oldValue: `${oldItem.start || ''} to ${oldItem.end || ''}`,
          newValue: `${updated.start || ''} to ${updated.end || ''}`,
          remarks: updates.remarks || '',
          timestamp: new Date().toISOString(),
          action: 'timeline_changed'
        });
        recordedChange = true;
      }

      // 5. Fallback
      if (!recordedChange) {
        saveLocalLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ref: updated.ref,
          milestone: updated.milestone,
          activity: updated.activity,
          author: authorName,
          field: 'details',
          oldValue: '',
          newValue: 'Updated deliverable details',
          remarks: updates.remarks || '',
          timestamp: new Date().toISOString(),
          action: 'updated'
        });
      }

      return updated;
    }
    throw new Error('Item not found');
  },

  async createItem(item, author = 'Team Member') {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, author }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch (e) {}

    const items = getLocalData();
    const newItem = {
      ...item,
      ref: item.ref || `GEN.${String(items.length + 1).padStart(2, '0')}`,
      updatedAt: new Date().toISOString()
    };
    items.unshift(newItem);
    saveLocalData(items);

    saveLocalLog({
      id: `log-${Date.now()}`,
      ref: newItem.ref,
      milestone: newItem.milestone,
      activity: newItem.activity,
      author: newItem.partner_owner || author,
      field: 'item',
      oldValue: '',
      newValue: 'Created',
      remarks: newItem.remarks || '',
      timestamp: new Date().toISOString(),
      action: 'created'
    });

    return newItem;
  },

  async deleteItem(ref, author = 'Team Member') {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(ref)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author })
      });
      if (res.ok) return true;
    } catch (e) {}

    let items = getLocalData();
    items = items.filter(i => i.ref !== ref);
    saveLocalData(items);
    return true;
  },

  // Replace every item (used by the Excel Sheet tab to keep Dashboard / Table / Kanban in sync)
  async importItems(items) {
    saveLocalData(items);
    try {
      const res = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      return res.ok;
    } catch (e) {
      return true; // backend unreachable: data is saved locally
    }
  },

  async resetToSeed() {
    try {
      const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
      if (res.ok) {
        saveLocalData(initialSeedData);
        localStorage.removeItem(LOCAL_LOGS_KEY);
        return true;
      }
    } catch (e) {}
    saveLocalData(initialSeedData);
    localStorage.removeItem(LOCAL_LOGS_KEY);
    return true;
  },

  exportCsv(items) {
    let customCols = [];
    try {
      const raw = localStorage.getItem('hdfc_table_custom_columns');
      if (raw) customCols = JSON.parse(raw);
    } catch (e) {}

    const headers = [
      'Ref', 
      'Milestone', 
      'Activity', 
      'Role', 
      'Owner', 
      'Start Date', 
      'End Date', 
      'Status', 
      'Actual Completion', 
      'Remarks',
      ...customCols.map(c => c.label),
      'Last Updated'
    ];

    const rows = items.map(i => [
      `"${(i.ref || '').replace(/"/g, '""')}"`,
      `"${(i.milestone || '').replace(/"/g, '""')}"`,
      `"${(i.activity || '').replace(/"/g, '""')}"`,
      `"${(i.niit_role || '').replace(/"/g, '""')}"`,
      `"${(i.partner_owner || '').replace(/"/g, '""')}"`,
      `"${(i.start || '').replace(/"/g, '""')}"`,
      `"${(i.end || '').replace(/"/g, '""')}"`,
      `"${(i.status || '').replace(/"/g, '""')}"`,
      `"${(i.actual_completion || '').replace(/"/g, '""')}"`,
      `"${(i.remarks || '').replace(/"/g, '""')}"`,
      ...customCols.map(c => `"${(i[c.id] || '').toString().replace(/"/g, '""')}"`),
      `"${(i.updatedAt || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hdfc_career_hub_tracker_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async getTableConfig(tableId = 'deliverables') {
    try {
      const res = await fetch(`${API_BASE}/columns?tableId=${encodeURIComponent(tableId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          if (json.data.customColumns) {
            localStorage.setItem('hdfc_table_custom_columns', JSON.stringify(json.data.customColumns));
          }
          if (json.data.columnOrder) {
            localStorage.setItem('hdfc_table_columns_order', JSON.stringify(json.data.columnOrder));
          }
          return json.data;
        }
      }
    } catch (e) {
      console.warn('Backend /columns unreachable, using local storage.');
    }

    try {
      const rawCols = localStorage.getItem('hdfc_table_custom_columns');
      const rawOrder = localStorage.getItem('hdfc_table_columns_order');
      return {
        name: 'Deliverables Table',
        customColumns: rawCols ? JSON.parse(rawCols) : [],
        columnOrder: rawOrder ? JSON.parse(rawOrder) : ['ref', 'role', 'activity', 'owner', 'timeline', 'status', 'remarks', 'actions']
      };
    } catch (e) {
      return {
        name: 'Deliverables Table',
        customColumns: [],
        columnOrder: ['ref', 'role', 'activity', 'owner', 'timeline', 'status', 'remarks', 'actions']
      };
    }
  },

  async saveTableConfig(config, tableId = 'deliverables') {
    // 1. Immediately update local storage cache
    try {
      if (config.customColumns) {
        localStorage.setItem('hdfc_table_custom_columns', JSON.stringify(config.customColumns));
      }
      if (config.columnOrder) {
        localStorage.setItem('hdfc_table_columns_order', JSON.stringify(config.columnOrder));
      }
    } catch (e) {}

    // 2. Persist to MongoDB backend
    try {
      const res = await fetch(`${API_BASE}/columns`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, tableId })
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch (e) {
      console.warn('Failed to persist table config to MongoDB backend:', e);
    }

    return config;
  },

  async getAllTables() {
    try {
      const res = await fetch(`${API_BASE}/tables`);
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch (e) {}
    return [
      {
        _id: 'deliverables',
        name: 'Deliverables Table'
      }
    ];
  }
};
