const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all items (supports ?search=...&milestone=...&status=...&filterPreset=...)
router.get('/', (req, res) => {
  try {
    const { search, milestone, status, owner, filterPreset } = req.query;
    const items = db.getAll({ search, milestone, status, owner, filterPreset });
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET stats summary
router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET activity feed / audit trail ("what's happened")
router.get('/activity-log', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const ref = req.query.ref || null;
    const logs = db.getActivityLogs(limit, ref);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET list of unique milestones
router.get('/milestones', (req, res) => {
  try {
    const milestones = db.getMilestones();
    res.json({ success: true, data: milestones });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET table columns / configuration from MongoDB
router.get('/columns', (req, res) => {
  try {
    const tableId = req.query.tableId || 'deliverables';
    const config = db.getTableConfig(tableId);
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update table columns / configuration in MongoDB
router.put('/columns', async (req, res) => {
  try {
    const { customColumns, columnOrder, name, tableId = 'deliverables' } = req.body;
    const saved = await db.saveTableConfig({ customColumns, columnOrder, name }, tableId);
    res.json({ success: true, message: 'Table columns saved to MongoDB', data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all tables from MongoDB
router.get('/tables', async (req, res) => {
  try {
    const tables = await db.getAllTables();
    res.json({ success: true, count: tables.length, data: tables });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET export as CSV
router.get('/export/csv', (req, res) => {
  try {
    const items = db.getAll();
    const headers = ['Ref', 'Milestone', 'Activity', 'Role', 'Owner', 'Start Date', 'End Date', 'Status', 'Actual Completion', 'Remarks', 'Last Updated'];
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
      `"${(i.updatedAt || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hdfc_career_hub_tracker.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single item by ref
router.get('/:ref', (req, res) => {
  try {
    const item = db.getByRef(req.params.ref);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const itemLogs = db.getActivityLogs(20, req.params.ref);
    res.json({ success: true, data: item, history: itemLogs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT update an item
router.put('/:ref', (req, res) => {
  try {
    const author = req.body.author || req.body.partner_owner || 'Stakeholder';
    const updated = db.update(req.params.ref, req.body, author);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, message: 'Item updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create new item
router.post('/', (req, res) => {
  try {
    const author = req.body.author || req.body.partner_owner || 'Stakeholder';
    const created = db.create(req.body, author);
    res.status(201).json({ success: true, message: 'Item created successfully', data: created });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE an item
router.delete('/:ref', (req, res) => {
  try {
    const author = req.body.author || 'Stakeholder';
    const deleted = db.delete(req.params.ref, author);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST replace all items (Excel import / two-way sync from the Excel Sheet tab)
router.post('/import', (req, res) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items array required' });
    const count = db.replaceAll(items);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST reset to original seed data
router.post('/reset', (req, res) => {
  try {
    const success = db.resetToSeed();
    if (success) {
      res.json({ success: true, message: 'Store reset to seed data successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to reset store' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
