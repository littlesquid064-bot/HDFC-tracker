const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(__dirname, 'data', 'seed.json');
const STORE_FILE = path.join(__dirname, 'data', 'store.json');
const LOGS_FILE = path.join(__dirname, 'data', 'activity_log.json');

const MONGODB_URI = process.env.MONGODB_URI;
let mongoDb = null; // set in init() when MONGODB_URI is configured

class DataStore {
  constructor() {
    this.items = [];
    this.activityLogs = [];
    this.isPersisting = true;
    this.useDb = !!MONGODB_URI;
    this.writeChain = Promise.resolve();
  }

  // Must be awaited once before the server starts listening.
  async init() {
    if (!this.useDb) {
      console.warn('MONGODB_URI not set: using local JSON files (data is lost on ephemeral hosts).');
      return this.initFromFiles();
    }
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    await client.connect();
    mongoDb = client.db(); // database name comes from the URI (hdfc-tracker)

    const items = await mongoDb.collection('items').find({}).sort({ order: 1 }).toArray();
    if (items.length > 0) {
      this.items = items.map(({ _id, order, ...rest }) => rest);
      const logs = await mongoDb.collection('activity_logs').find({}).sort({ order: 1 }).toArray();
      this.activityLogs = logs.map(({ _id, order, ...rest }) => rest);
    } else {
      // First run: migrate existing local data (store.json / activity_log.json), else seed.json
      this.initFromFiles();
      this.useDb = true;
      await this.save();
      await this.saveLogs();
      console.log(`Migrated ${this.items.length} items and ${this.activityLogs.length} log entries to MongoDB`);
    }
    console.log(`Loaded ${this.items.length} items from MongoDB`);
  }

  // Serialised write-through: upsert current docs (with order), delete the rest.
  persistCollection(name, docs, idOf) {
    this.writeChain = this.writeChain
      .then(async () => {
        const col = mongoDb.collection(name);
        const ids = docs.map(idOf);
        const ops = docs.map((d, i) => ({
          replaceOne: { filter: { _id: idOf(d) }, replacement: { ...d, order: i }, upsert: true }
        }));
        ops.push({ deleteMany: { filter: { _id: { $nin: ids } } } });
        await col.bulkWrite(ops, { ordered: true });
      })
      .catch(err => console.error(`Failed to persist "${name}" to MongoDB:`, err.message));
    return this.writeChain;
  }

  initFromFiles() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        this.items = JSON.parse(raw);
      } else if (fs.existsSync(SEED_FILE)) {
        const raw = fs.readFileSync(SEED_FILE, 'utf8');
        this.items = JSON.parse(raw);
        this.save();
      } else {
        this.items = [];
      }

      if (fs.existsSync(LOGS_FILE)) {
        this.activityLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      } else {
        // Generate baseline audit logs from existing items
        this.activityLogs = [];
        this.items
          .filter(i => (i.status && i.status !== 'Not Started') || i.remarks)
          .slice(0, 15)
          .forEach((item, idx) => {
            this.activityLogs.push({
              id: `log-seed-${idx}`,
              ref: item.ref,
              milestone: item.milestone,
              activity: item.activity,
              author: item.partner_owner || 'System',
              field: 'status',
              oldValue: 'Not Started',
              newValue: item.status,
              remarks: item.remarks || '',
              timestamp: item.updatedAt || new Date(Date.now() - (idx + 1) * 3600000 * 5).toISOString(),
              action: item.status === 'Completed' ? 'completed' : 'status_change'
            });
          });
        this.saveLogs();
      }
    } catch (err) {
      console.warn('Warning: Persistent store not accessible, using memory store:', err.message);
      this.isPersisting = false;
      if (fs.existsSync(SEED_FILE)) {
        this.items = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      }
    }
  }

  save() {
    if (this.useDb) return this.persistCollection('items', this.items, d => d.ref);
    if (!this.isPersisting) return;
    try {
      const dir = path.dirname(STORE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.items, null, 2), 'utf8');
    } catch (err) {
      console.warn('Failed to persist store to disk:', err.message);
      this.isPersisting = false;
    }
  }

  saveLogs() {
    if (this.useDb) return this.persistCollection('activity_logs', this.activityLogs.slice(0, 500), d => d.id);
    if (!this.isPersisting) return;
    try {
      const dir = path.dirname(LOGS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOGS_FILE, JSON.stringify(this.activityLogs.slice(0, 500), null, 2), 'utf8');
    } catch (err) {
      console.warn('Failed to persist activity logs:', err.message);
    }
  }

  recordActivity(log) {
    const entry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log
    };
    this.activityLogs.unshift(entry);
    if (this.activityLogs.length > 500) {
      this.activityLogs = this.activityLogs.slice(0, 500);
    }
    this.saveLogs();
    console.log(`[ACTIVITY LOG] [${entry.ref}] ${entry.action ? entry.action.toUpperCase() : 'UPDATE'}: ${entry.field || ''} -> ${entry.newValue || ''} (by ${entry.author || 'User'})`);
    return entry;
  }

  getActivityLogs(limit = 60, ref = null) {
    let logs = this.activityLogs;
    if (ref) {
      logs = logs.filter(l => l.ref === ref);
    }
    return logs.slice(0, limit);
  }

  getAll({ search, milestone, status, owner, filterPreset } = {}) {
    let result = [...this.items];

    const today = new Date().toISOString().split('T')[0];
    if (filterPreset === 'overdue') {
      result = result.filter(item => item.end && item.end < today && item.status !== 'Completed');
    } else if (filterPreset === 'upcoming') {
      const next14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      result = result.filter(item => item.end && item.end >= today && item.end <= next14Days && item.status !== 'Completed');
    } else if (filterPreset === 'completed') {
      result = result.filter(item => item.status === 'Completed');
    } else if (filterPreset === 'attention') {
      result = result.filter(item => item.status === 'On Hold' || (item.end && item.end < today && item.status !== 'Completed'));
    }

    if (status) {
      result = result.filter(item => (item.status || 'Not Started').toLowerCase() === status.toLowerCase());
    }

    if (milestone) {
      result = result.filter(item => item.milestone === milestone);
    }

    if (owner) {
      result = result.filter(item => item.partner_owner && item.partner_owner.toLowerCase().includes(owner.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        (item.activity && item.activity.toLowerCase().includes(q)) ||
        (item.partner_owner && item.partner_owner.toLowerCase().includes(q)) ||
        (item.ref && item.ref.toLowerCase().includes(q)) ||
        (item.remarks && item.remarks.toLowerCase().includes(q)) ||
        (item.milestone && item.milestone.toLowerCase().includes(q))
      );
    }

    return result;
  }

  getByRef(ref) {
    return this.items.find(item => item.ref === ref);
  }

  update(ref, updates, author = 'Team Member') {
    const index = this.items.findIndex(item => item.ref === ref);
    if (index === -1) return null;

    const current = this.items[index];
    const updated = {
      ...current,
      ...updates,
      ref: current.ref,
      updatedAt: new Date().toISOString()
    };

    if (updates.status === 'Completed' && !updated.actual_completion) {
      updated.actual_completion = new Date().toISOString().split('T')[0];
    }

    const logAuthor = updates.partner_owner || current.partner_owner || author;
    let recordedChange = false;

    // 1. Status Change
    if (updates.status && updates.status !== current.status) {
      this.recordActivity({
        ref: current.ref,
        milestone: current.milestone,
        activity: current.activity,
        author: logAuthor,
        field: 'status',
        oldValue: current.status || 'Not Started',
        newValue: updates.status,
        remarks: updates.remarks || current.remarks || '',
        action: updates.status === 'Completed' ? 'completed' : 'status_change'
      });
      recordedChange = true;
    }

    // 2. Remarks Update
    if (updates.remarks !== undefined && updates.remarks !== (current.remarks || '')) {
      this.recordActivity({
        ref: current.ref,
        milestone: current.milestone,
        activity: current.activity,
        author: logAuthor,
        field: 'remarks',
        oldValue: (current.remarks || '').substring(0, 50),
        newValue: updates.remarks.substring(0, 50),
        remarks: updates.remarks,
        action: 'remark_added'
      });
      recordedChange = true;
    }

    // 3. Partner / Owner Reassignment
    if (updates.partner_owner !== undefined && updates.partner_owner !== (current.partner_owner || '')) {
      this.recordActivity({
        ref: current.ref,
        milestone: current.milestone,
        activity: current.activity,
        author: logAuthor,
        field: 'owner',
        oldValue: current.partner_owner || 'Unassigned',
        newValue: updates.partner_owner,
        remarks: updates.remarks || '',
        action: 'owner_changed'
      });
      recordedChange = true;
    }

    // 4. Timeline / Dates Change
    if ((updates.start && updates.start !== current.start) || (updates.end && updates.end !== current.end)) {
      this.recordActivity({
        ref: current.ref,
        milestone: current.milestone,
        activity: current.activity,
        author: logAuthor,
        field: 'timeline',
        oldValue: `${current.start || ''} to ${current.end || ''}`,
        newValue: `${updated.start || ''} to ${updated.end || ''}`,
        remarks: updates.remarks || '',
        action: 'timeline_changed'
      });
      recordedChange = true;
    }

    // 5. Fallback if other fields changed
    if (!recordedChange) {
      this.recordActivity({
        ref: current.ref,
        milestone: current.milestone,
        activity: current.activity,
        author: logAuthor,
        field: 'details',
        oldValue: '',
        newValue: 'Updated deliverable details',
        remarks: updates.remarks || '',
        action: 'updated'
      });
    }

    this.items[index] = updated;
    this.save();
    return updated;
  }

  create(newItem, author = 'Team Member') {
    if (!newItem.ref) {
      const maxId = this.items.length + 1;
      newItem.ref = `GEN.${String(maxId).padStart(2, '0')}`;
    }

    const existing = this.getByRef(newItem.ref);
    if (existing) {
      throw new Error(`Item with ref "${newItem.ref}" already exists`);
    }

    const item = {
      ref: newItem.ref,
      milestone: newItem.milestone || 'General',
      activity: newItem.activity || '',
      niit_role: newItem.niit_role || 'Support',
      partner_owner: newItem.partner_owner || '',
      start: newItem.start || new Date().toISOString().split('T')[0],
      end: newItem.end || new Date().toISOString().split('T')[0],
      status: newItem.status || 'Not Started',
      actual_completion: newItem.actual_completion || '',
      remarks: newItem.remarks || '',
      updatedAt: new Date().toISOString()
    };

    this.items.unshift(item);
    this.save();

    this.recordActivity({
      ref: item.ref,
      milestone: item.milestone,
      activity: item.activity,
      author: item.partner_owner || author,
      field: 'item',
      oldValue: '',
      newValue: 'Created',
      remarks: item.remarks,
      action: 'created'
    });

    return item;
  }

  delete(ref, author = 'Team Member') {
    const index = this.items.findIndex(item => item.ref === ref);
    if (index === -1) return false;

    const removed = this.items.splice(index, 1)[0];
    this.save();

    this.recordActivity({
      ref: removed.ref,
      milestone: removed.milestone,
      activity: removed.activity,
      author,
      field: 'item',
      oldValue: 'Existing',
      newValue: 'Deleted',
      remarks: '',
      action: 'deleted'
    });

    return true;
  }

  getMilestones() {
    const set = new Set();
    this.items.forEach(item => {
      if (item.milestone) set.add(item.milestone);
    });
    return Array.from(set);
  }

  getStats() {
    const today = new Date().toISOString().split('T')[0];
    const next14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const counts = {
      total: this.items.length,
      'In Progress': 0,
      'Ongoing': 0,
      'Completed': 0,
      'Not Started': 0,
      'On Hold': 0,
      overdue: 0,
      upcomingDeadline: 0,
      leadRoles: 0,
      supportRoles: 0
    };

    const milestoneBreakdown = {};

    this.items.forEach(item => {
      const s = item.status || 'Not Started';
      if (counts[s] !== undefined) counts[s]++;
      else counts[s] = 1;

      if (item.niit_role === 'Lead') counts.leadRoles++;
      else counts.supportRoles++;

      // Overdue check
      if (item.end && item.end < today && item.status !== 'Completed') {
        counts.overdue++;
      }

      // Upcoming in next 14 days
      if (item.end && item.end >= today && item.end <= next14Days && item.status !== 'Completed') {
        counts.upcomingDeadline++;
      }

      const m = item.milestone || 'Other';
      if (!milestoneBreakdown[m]) {
        milestoneBreakdown[m] = { total: 0, completed: 0, inProgress: 0 };
      }
      milestoneBreakdown[m].total++;
      if (item.status === 'Completed') milestoneBreakdown[m].completed++;
      if (item.status === 'In Progress' || item.status === 'Ongoing') milestoneBreakdown[m].inProgress++;
    });

    const completionRate = counts.total > 0 
      ? Math.round((counts['Completed'] / counts.total) * 100) 
      : 0;

    return {
      counts,
      completionRate,
      milestoneBreakdown
    };
  }

  resetToSeed() {
    if (fs.existsSync(SEED_FILE)) {
      this.items = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
      this.activityLogs = [];
      this.save();
      this.saveLogs();
      return true;
    }
    return false;
  }
}

module.exports = new DataStore();
