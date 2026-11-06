// Maps Excel columns <-> tracker item fields so the uploaded sheet drives the
// Dashboard, Table and Kanban views.
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const STATUSES = ['Not Started', 'In Progress', 'Ongoing', 'Completed', 'On Hold'];

// header text (lower-case, trimmed) -> item field
const HEADER_FIELDS = {
  'ref': 'ref',
  'milestone': 'milestone',
  'activity / deliverable': 'activity',
  'niit role': 'niit_role',
  'partner owner (name)': 'partner_owner',
  'actual': 'actual',
  'hdfc owner': 'hdfc_owner',
  'committed start date': 'start',
  'committed completion date': 'end',
  'status': 'status',
  'actual completion date': 'actual_completion',
  'remarks / dependency / blocker': 'remarks'
};

export const fieldForHeader = (label) => HEADER_FIELDS[String(label).trim().toLowerCase()] || null;

const DATE_FIELDS = new Set(['start', 'end', 'actual_completion']);

export function toIsoDate(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[-\s/]([A-Za-z]{3})[a-z]*[-\s/,]*(\d{2,4})$/.exec(t);
  if (m) {
    const mi = MONTHS.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
    if (mi >= 0) {
      const yr = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return `${yr}-${String(mi + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

export function toSheetDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1].slice(2)}` : (iso || '');
}

function normaliseStatus(v) {
  const t = String(v || '').trim().toLowerCase();
  const hit = STATUSES.find(s => s.toLowerCase() === t);
  if (hit) return hit;
  if (t === 'delayed') return 'In Progress';
  return 'Not Started';
}

// sheet rows -> tracker items (unique refs guaranteed)
export function sheetToItems(sheet) {
  const colField = {};
  sheet.columns.forEach(c => { if (c.field) colField[c.id] = c.field; });
  const seen = new Set();
  return sheet.rows.map((r, n) => {
    const item = {};
    Object.entries(colField).forEach(([colId, field]) => {
      const v = r.cells[colId] ?? '';
      item[field] = DATE_FIELDS.has(field) ? toIsoDate(v) : String(v).trim();
    });
    item.status = normaliseStatus(item.status);
    item.niit_role = item.niit_role || 'Support';
    item.milestone = item.milestone || 'General';
    item.activity = item.activity || '';
    item.partner_owner = item.partner_owner || '';
    item.remarks = item.remarks || '';
    item.actual_completion = item.actual_completion || '';
    let ref = item.ref || `ROW.${n + 1}`;
    while (seen.has(ref)) ref = `${ref}-${n + 1}`;
    seen.add(ref);
    item.ref = ref;
    return item;
  });
}

// Pull tracker item values back into the sheet (after edits made in Table / Kanban).
// Returns the same sheet object if nothing changed.
export function applyItemsToSheet(sheet, items) {
  const first = sheet.columns[0];
  if (!first) return sheet;
  const byRef = new Map(items.map(i => [i.ref, i]));
  let changed = false;
  const rows = sheet.rows.map(r => {
    const item = byRef.get(String(r.cells[first.id] ?? '').trim());
    if (!item) return r;
    let cells = r.cells;
    sheet.columns.forEach(c => {
      if (!c.field || c.field === 'ref') return;
      const itemVal = item[c.field] ?? '';
      const cur = r.cells[c.id] ?? '';
      const next = DATE_FIELDS.has(c.field) ? toSheetDate(itemVal) : String(itemVal);
      const same = DATE_FIELDS.has(c.field) ? toIsoDate(cur) === itemVal : cur.trim() === next.trim();
      // a blank status in Excel becomes "Not Started" in the tracker: don't write that back
      if (same || (c.field === 'status' && cur.trim() === '' && next === 'Not Started')) return;
      if (cells === r.cells) cells = { ...r.cells };
      cells[c.id] = next;
      changed = true;
    });
    return cells === r.cells ? r : { ...r, cells };
  });
  return changed ? { ...sheet, rows } : sheet;
}
