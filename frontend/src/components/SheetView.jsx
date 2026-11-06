import React, { useState, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { sheetToItems, applyItemsToSheet, fieldForHeader } from '../sheetMapping';
import { Upload, Trash2, Pencil, Download, FileSpreadsheet } from 'lucide-react';

const STORAGE_KEY = 'hdfc_imported_sheet';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const argbToHex = (c) => (c && c.argb && c.argb.length === 8 ? `#${c.argb.slice(2)}` : undefined);

function cellText(cell) {
  let v = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('formula' in v || 'sharedFormula' in v || 'result' in v) v = cell.result;
    else if (v.richText) v = v.richText.map(t => t.text).join('');
    else if (v.text) v = v.text;
    else if (v.error) v = '';
  }
  if (v == null) return '';
  if (v instanceof Date) {
    return `${String(v.getUTCDate()).padStart(2, '0')}-${MONTHS[v.getUTCMonth()]}-${String(v.getUTCFullYear()).slice(2)}`;
  }
  return String(v);
}

// Visual style of a cell as it looks in Excel (fill, font colour, bold, alignment)
function cellStyle(cell) {
  const s = {};
  const fill = cell.fill;
  if (fill && fill.type === 'pattern' && fill.pattern === 'solid') s.bg = argbToHex(fill.fgColor);
  const f = cell.font || {};
  if (f.bold) s.b = 1;
  if (f.italic) s.i = 1;
  const color = argbToHex(f.color);
  if (color) s.c = color;
  if (cell.alignment && cell.alignment.horizontal) s.a = cell.alignment.horizontal;
  return s;
}

const colNum = (letters) => letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

// Convert one worksheet into columns / rows / banner rows / conditional-format rules,
// keeping the Excel look. Hidden columns are skipped; the header row is the first
// row containing "Ref".
function parseSheet(ws) {
  let headerRow = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 15) && !headerRow; r++) {
    ws.getRow(r).eachCell(c => { if (cellText(c).trim().toLowerCase() === 'ref') headerRow = r; });
  }
  if (!headerRow) headerRow = 1;

  const hdr = ws.getRow(headerRow);
  const columns = [];
  for (let i = 1; i <= ws.columnCount; i++) {
    if (ws.getColumn(i).hidden) continue;
    const label = cellText(hdr.getCell(i)).trim();
    if (!label) continue;
    columns.push({ id: `c${i}`, idx: i, label, style: cellStyle(hdr.getCell(i)) });
  }

  // Title / note rows above the header (e.g. the dark banner)
  const banner = [];
  for (let r = 1; r < headerRow; r++) {
    const cell = ws.getRow(r).getCell(1);
    const text = cellText(cell);
    if (text) banner.push({ text, style: cellStyle(cell) });
  }

  const refCol = columns.find(c => c.label.toLowerCase() === 'ref') || columns[0];
  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells = {};
    const styles = {};
    let any = false;
    columns.forEach(c => {
      const cell = row.getCell(c.idx);
      cells[c.id] = cellText(cell);
      if (cells[c.id].trim() !== '') any = true;
      styles[c.id] = cellStyle(cell);
    });
    if (!any) continue;
    rows.push({ id: `r${r}`, label: cells[refCol.id] || String(rows.length + 1), cells, styles });
  }

  // Conditional formatting (e.g. Schedule Flag colours): "cell equals / > value"
  const rules = [];
  (ws.conditionalFormattings || []).forEach(cf => {
    const m = /^([A-Z]+)\d+/.exec(cf.ref);
    const col = m && columns.find(c => c.idx === colNum(m[1]));
    if (!col) return;
    (cf.rules || []).forEach(rule => {
      if (rule.type !== 'cellIs' || !rule.style) return;
      const st = rule.style;
      rules.push({
        colId: col.id,
        op: rule.operator,
        value: String((rule.formulae && rule.formulae[0]) || '').replace(/^"|"$/g, ''),
        bg: argbToHex(st.fill && (st.fill.bgColor || st.fill.fgColor)),
        c: argbToHex(st.font && st.font.color),
        b: st.font && st.font.bold ? 1 : 0
      });
    });
  });

  return { columns: columns.map(({ idx, ...c }) => c), rows, banner, rules };
}

function matchRule(rule, value) {
  const v = String(value).trim();
  if (rule.op === 'equal') return v.toLowerCase() === rule.value.toLowerCase();
  const n = parseFloat(v), t = parseFloat(rule.value);
  if (Number.isNaN(n) || Number.isNaN(t)) return false;
  if (rule.op === 'greaterThan') return n > t;
  if (rule.op === 'lessThan') return n < t;
  return false;
}

function toCss(s = {}) {
  return {
    background: s.bg,
    color: s.c,
    fontWeight: s.b ? 700 : undefined,
    fontStyle: s.i ? 'italic' : undefined,
    textAlign: s.a === 'center' || s.a === 'right' ? s.a : undefined
  };
}

function EditableText({ value, onCommit, className = '', multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing) {
    const props = {
      ref,
      value: draft,
      onChange: e => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: e => {
        if (e.key === 'Enter' && !(multiline && e.shiftKey)) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      },
      className: 'sheet-edit-input'
    };
    return multiline ? <textarea rows={3} {...props} /> : <input {...props} />;
  }
  return (
    <span
      className={`sheet-editable ${className}`}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value === '' ? <span className="sheet-empty">—</span> : value}
    </span>
  );
}

export default function SheetView({ onToast, items = [], onSyncItems }) {
  const [sheet, setSheet] = useState(loadSaved);
  const [workbook, setWorkbook] = useState(null);
  const fileRef = useRef(null);
  const dirtyRef = useRef(false);   // sheet edited here, not yet pushed to the tracker
  const versionRef = useRef(0);

  // Sheet -> tracker: debounce, then replace the tracker items with the sheet's rows
  useEffect(() => {
    if (!sheet || !dirtyRef.current || !onSyncItems) return;
    const version = ++versionRef.current;
    const t = setTimeout(async () => {
      await onSyncItems(sheetToItems(sheet));
      if (version === versionRef.current) dirtyRef.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, [sheet]);

  // Tracker -> sheet: reflect edits made in Table / Kanban / drawer
  useEffect(() => {
    if (dirtyRef.current) return;
    setSheet(s => (s && s.synced ? applyItemsToSheet(s, items) : s));
  }, [items]);

  useEffect(() => {
    try {
      if (sheet) localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }, [sheet]);

  const importSheet = (wb, sheetName, fileName) => {
    const ws = wb.getWorksheet(sheetName);
    const { columns, rows, banner, rules } = parseSheet(ws);
    if (!columns.length) {
      onToast?.(`Sheet "${sheetName}" has no data`, 'error');
      return;
    }
    const next = {
      fileName, sheetName, sheetNames: wb.worksheets.map(w => w.name),
      columns: columns.map(c => ({ ...c, field: fieldForHeader(c.label) })),
      rows, banner, rules, synced: true
    };
    dirtyRef.current = true; // push the freshly imported data into the tracker
    setSheet(next);
    onToast?.(`Imported ${rows.length} rows × ${columns.length} columns — synced to Dashboard, Table & Kanban`);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      setWorkbook(wb);
      // Prefer the first sheet that has a "Ref" header, otherwise the first sheet
      const guess = wb.worksheets.find(ws => {
        for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
          let hit = false;
          ws.getRow(r).eachCell(c => { if (cellText(c).trim().toLowerCase() === 'ref') hit = true; });
          if (hit) return true;
        }
        return false;
      }) || wb.worksheets[0];
      importSheet(wb, guess.name, file.name);
    } catch (err) {
      console.error(err);
      onToast?.('Could not read that file. Please upload a valid .xlsx file', 'error');
    }
  };

  const switchSheet = (name) => {
    if (workbook) importSheet(workbook, name, sheet.fileName);
    else onToast?.('Re-upload the file to switch sheets', 'info');
  };

  const renameColumn = (id, label) =>
    setSheet(s => ({ ...s, columns: s.columns.map(c => c.id === id ? { ...c, label: label.trim() || c.label } : c) }));
  const editCell = (rowId, colId, value) => {
    dirtyRef.current = true;
    setSheet(s => ({ ...s, rows: s.rows.map(r => r.id === rowId ? { ...r, label: colId === s.columns[0].id ? value : r.label, cells: { ...r.cells, [colId]: value } } : r) }));
  };

  const clearSheet = () => {
    if (window.confirm('Remove the imported sheet from this browser?')) {
      setSheet(null);
      setWorkbook(null);
    }
  };

  const exportCsv = () => {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      [...sheet.columns.map(c => c.label)].map(esc).join(','),
      ...sheet.rows.map(r => sheet.columns.map(c => r.cells[c.id]).map(esc).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(sheet.sheetName || 'sheet').trim()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fileInput = (
    <input ref={fileRef} type="file" accept=".xlsx,.xlsm" onChange={handleFile} style={{ display: 'none' }} />
  );

  if (!sheet) {
    return (
      <div className="table-container sheet-empty-state">
        {fileInput}
        <FileSpreadsheet size={40} />
        <h3>Upload your Excel tracker</h3>
        <p>All columns and rows are imported exactly as they appear in the sheet. You can then rename any column or row.</p>
        <button className="btn btn-primary" onClick={() => fileRef.current.click()}>
          <Upload size={15} /> Choose Excel file
        </button>
      </div>
    );
  }

  return (
    <div className="sheet-view">
      {fileInput}
      <div className="sheet-toolbar">
        <div className="sheet-meta">
          <FileSpreadsheet size={16} />
          <strong>{sheet.fileName}</strong>
          <span>· {sheet.rows.length} rows · {sheet.columns.length} columns</span>
          {sheet.sheetNames?.length > 1 && workbook && (
            <select value={sheet.sheetName} onChange={e => switchSheet(e.target.value)} className="sheet-select">
              {sheet.sheetNames.map(n => <option key={n} value={n}>{n.trim()}</option>)}
            </select>
          )}
        </div>
        <div className="sheet-actions">
          <span className="sheet-hint"><Pencil size={12} /> Click any header, Ref (row name) or cell to rename / edit</span>
          <button className="btn btn-secondary" onClick={exportCsv}><Download size={14} /> CSV</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current.click()}><Upload size={14} /> Replace</button>
          <button className="btn btn-secondary" onClick={clearSheet}><Trash2 size={14} /> Remove</button>
        </div>
      </div>

      <div className="table-container sheet-scroll">
        <table className="sheet-table">
          <thead>
            {(sheet.banner || []).map((b, i) => (
              <tr key={`b${i}`} className="sheet-banner-row">
                <td colSpan={sheet.columns.length} style={toCss(b.style)}>{b.text}</td>
              </tr>
            ))}
            <tr>
              {sheet.columns.map((c, i) => (
                <th key={c.id} className={i === 0 ? 'sheet-first-col' : ''} style={toCss({ ...c.style, a: 'center' })}>
                  <EditableText value={c.label} onCommit={v => renameColumn(c.id, v)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map(r => (
              <tr key={r.id}>
                {sheet.columns.map((c, i) => {
                  const value = r.cells[c.id] ?? '';
                  const rule = (sheet.rules || []).find(x => x.colId === c.id && matchRule(x, value));
                  const style = { ...toCss(r.styles?.[c.id]), ...(rule ? toCss({ bg: rule.bg, c: rule.c, b: rule.b }) : {}) };
                  return (
                    <td key={c.id} className={i === 0 ? 'sheet-first-col' : ''} style={style}>
                      <EditableText
                        value={value}
                        onCommit={v => editCell(r.id, c.id, v)}
                        multiline
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
