import React, { useState, useEffect, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Check, 
  CheckSquare, 
  Square, 
  Edit2, 
  Layers, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import { fieldForHeader, FIELD_LABELS, toIsoDate, STATUSES } from '../sheetMapping';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function cellText(cell) {
  if (!cell) return '';
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
  return String(v).trim();
}

function normaliseStatus(v) {
  const t = String(v || '').trim().toLowerCase();
  const hit = STATUSES.find(s => s.toLowerCase() === t);
  if (hit) return hit;
  if (t === 'delayed') return 'In Progress';
  return 'Not Started';
}

const normStr = (s) => String(s || '').toLowerCase().replace(/[\s\r\n]+/g, ' ').trim();
const normRef = (r) => {
  const parts = String(r || '').trim().split('.');
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0].padStart(2, '0') + '.' + parts[1].padStart(2, '0');
  }
  return String(r || '').trim();
};

export default function ExcelUploadModal({
  isOpen,
  onClose,
  initialFile = null,
  items = [],
  onApplyUpdates,
  onToast
}) {
  const [file, setFile] = useState(initialFile);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [parsedColumns, setParsedColumns] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Primary Key mapping: 'milestone' | 'ref' | 'milestone_activity'
  const [primaryKey, setPrimaryKey] = useState('milestone');
  
  // Selected columns state: { [colId]: boolean }
  const [selectedCols, setSelectedCols] = useState({});
  // Renamed columns state: { [colId]: string }
  const [renamedLabels, setRenamedLabels] = useState({});
  // Add new rows not found in tracker?
  const [addNewRows, setAddNewRows] = useState(true);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
      loadWorkbook(initialFile);
    }
  }, [initialFile]);

  const loadWorkbook = async (fileObj) => {
    setIsLoading(true);
    setError('');
    try {
      const wb = new ExcelJS.Workbook();
      const buffer = await fileObj.arrayBuffer();
      await wb.xlsx.load(buffer);
      setWorkbook(wb);
      const names = wb.worksheets.map(w => w.name);
      setSheetNames(names);

      // Prefer sheet 'NIIT ' or first sheet that has 'Ref'
      let preferred = names.find(n => n.trim().toLowerCase() === 'niit');
      if (!preferred) {
        preferred = wb.worksheets.find(ws => {
          for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
            let hit = false;
            ws.getRow(r).eachCell(c => {
              if (cellText(c).trim().toLowerCase() === 'ref') hit = true;
            });
            if (hit) return true;
          }
          return false;
        })?.name || names[0];
      }
      setSelectedSheet(preferred);
      parseSelectedSheet(wb, preferred);
    } catch (err) {
      console.error(err);
      setError('Could not read Excel file. Please ensure it is a valid .xlsx file.');
    } finally {
      setIsLoading(false);
    }
  };

  const parseSelectedSheet = (wb, sheetName) => {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) return;

    // Detect header row
    let headerRow = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !headerRow; r++) {
      ws.getRow(r).eachCell(c => {
        if (cellText(c).trim().toLowerCase() === 'ref') headerRow = r;
      });
    }
    if (!headerRow) headerRow = 1;

    const hdr = ws.getRow(headerRow);
    const cols = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      if (ws.getColumn(c).hidden) continue;
      const label = cellText(hdr.getCell(c)).trim();
      if (!label) continue;
      const field = fieldForHeader(label);
      cols.push({
        id: `col_${c}`,
        idx: c,
        rawHeader: label,
        field: field,
        label: FIELD_LABELS[field] || label.toUpperCase()
      });
    }

    // Extract rows
    const rows = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells = {};
      let hasData = false;
      cols.forEach(c => {
        const val = cellText(row.getCell(c.idx));
        cells[c.id] = val;
        if (val) hasData = true;
      });
      if (!hasData) continue;
      rows.push(cells);
    }

    setParsedColumns(cols);
    setParsedRows(rows);

    // Initial column selection and labels
    const sel = {};
    const renames = {};
    cols.forEach(c => {
      // If column is actual (sub-owner) or hdfc_owner, select by default!
      const isOwnerCol = c.field === 'actual' || c.field === 'hdfc_owner';
      sel[c.id] = isOwnerCol;
      renames[c.id] = c.label;
    });
    // If neither was found, select all by default
    const hasAnyOwner = cols.some(c => c.field === 'actual' || c.field === 'hdfc_owner');
    if (!hasAnyOwner) {
      cols.forEach(c => { sel[c.id] = true; });
    }

    setSelectedCols(sel);
    setRenamedLabels(renames);
  };

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      parseSelectedSheet(workbook, sheetName);
    }
  };

  const handleFileInput = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) {
      setFile(f);
      loadWorkbook(f);
    }
  };

  const toggleColumn = (colId) => {
    setSelectedCols(prev => ({ ...prev, [colId]: !prev[colId] }));
  };

  const handleSelectAll = () => {
    const next = {};
    parsedColumns.forEach(c => { next[c.id] = true; });
    setSelectedCols(next);
  };

  const handleDeselectAll = () => {
    const next = {};
    parsedColumns.forEach(c => { next[c.id] = false; });
    setSelectedCols(next);
  };

  const handleSelectOnlyOwners = () => {
    const next = {};
    parsedColumns.forEach(c => {
      next[c.id] = c.field === 'actual' || c.field === 'hdfc_owner';
    });
    setSelectedCols(next);
  };

  const handleRenameChange = (colId, newLabel) => {
    setRenamedLabels(prev => ({ ...prev, [colId]: newLabel }));
  };

  // Sample values for a column from the parsed rows
  const getSamples = (colId) => {
    const samples = [];
    for (const r of parsedRows) {
      const v = (r[colId] || '').trim();
      if (v && !samples.includes(v)) {
        samples.push(v);
        if (samples.length >= 3) break;
      }
    }
    return samples.join(', ');
  };

  // Selected count
  const selectedCount = useMemo(() => {
    return Object.values(selectedCols).filter(Boolean).length;
  }, [selectedCols]);

  // Execute the selective update
  const handleApply = () => {
    if (selectedCount === 0) {
      alert('Please select at least one column to update.');
      return;
    }

    // Identify which columns were selected and their mapped fields
    const activeColDefs = parsedColumns.filter(c => selectedCols[c.id]);
    const updatedFieldNames = activeColDefs.map(c => renamedLabels[c.id] || c.label);

    // Convert parsed rows into objects with field mappings
    const excelItems = parsedRows.map((r, rowIdx) => {
      const item = {};
      parsedColumns.forEach(c => {
        const val = r[c.id] ?? '';
        const field = c.field || c.id;
        if (field === 'start' || field === 'end' || field === 'actual_completion') {
          item[field] = toIsoDate(val);
        } else if (field === 'status') {
          item[field] = normaliseStatus(val);
        } else {
          item[field] = String(val).trim();
        }
      });
      return {
        ...item,
        _excelRowIdx: rowIdx,
        _rawCells: r
      };
    });

    // Merge logic: match existing items using primaryKey
    const updatedTrackerItems = [...items];
    const matchedExcelIndices = new Set();
    let updatedCount = 0;

    // Helper: update item with only the selected columns
    const applySelectedFields = (targetItem, sourceRow) => {
      activeColDefs.forEach(col => {
        const field = col.field || col.id;
        const val = sourceRow[field] !== undefined ? sourceRow[field] : (sourceRow._rawCells?.[col.id] ?? '');
        targetItem[field] = val;
      });
      targetItem.updatedAt = new Date().toISOString();
      updatedCount++;
    };

    if (primaryKey === 'ref') {
      // Match directly on Ref
      updatedTrackerItems.forEach(item => {
        const hitIdx = excelItems.findIndex(e => normRef(e.ref) === normRef(item.ref));
        if (hitIdx !== -1) {
          applySelectedFields(item, excelItems[hitIdx]);
          matchedExcelIndices.add(hitIdx);
        }
      });
    } else if (primaryKey === 'milestone_activity') {
      // Match on Milestone + Activity
      updatedTrackerItems.forEach(item => {
        const hitIdx = excelItems.findIndex(e => 
          normStr(e.milestone) === normStr(item.milestone) && 
          normStr(e.activity) === normStr(item.activity)
        );
        if (hitIdx !== -1) {
          applySelectedFields(item, excelItems[hitIdx]);
          matchedExcelIndices.add(hitIdx);
        }
      });
    } else {
      // Primary Key: 'milestone' (explicit user requirement)
      // Group excel rows by milestone
      const excelByMilestone = new Map();
      excelItems.forEach((e, idx) => {
        const mKey = normStr(e.milestone);
        if (!excelByMilestone.has(mKey)) excelByMilestone.set(mKey, []);
        excelByMilestone.get(mKey).push({ item: e, idx });
      });

      // Group existing tracker items by milestone
      const trackerByMilestone = new Map();
      updatedTrackerItems.forEach((t, idx) => {
        const mKey = normStr(t.milestone);
        if (!trackerByMilestone.has(mKey)) trackerByMilestone.set(mKey, []);
        trackerByMilestone.get(mKey).push(t);
      });

      // Match each milestone group
      excelByMilestone.forEach((eGroup, mKey) => {
        const tGroup = trackerByMilestone.get(mKey) || [];

        // For each tracker item in this milestone, find the matching excel item:
        // 1. Try matching by activity
        // 2. Try matching by ref
        // 3. Fallback to order/index within the milestone
        const usedEIndices = new Set();

        tGroup.forEach((tItem, tIdx) => {
          let foundE = eGroup.find(e => !usedEIndices.has(e.idx) && normStr(e.item.activity) === normStr(tItem.activity));
          if (!foundE) {
            foundE = eGroup.find(e => !usedEIndices.has(e.idx) && normRef(e.item.ref) === normRef(tItem.ref));
          }
          if (!foundE && eGroup[tIdx] && !usedEIndices.has(eGroup[tIdx].idx)) {
            foundE = eGroup[tIdx];
          }

          if (foundE) {
            usedEIndices.add(foundE.idx);
            matchedExcelIndices.add(foundE.idx);
            applySelectedFields(tItem, foundE.item);
          }
        });
      });
    }

    // If addNewRows is enabled, add rows from Excel that were not matched to any existing item
    if (addNewRows) {
      let addedCount = 0;
      excelItems.forEach((e, idx) => {
        if (!matchedExcelIndices.has(idx)) {
          const newItem = {
            ref: e.ref || `NEW.${updatedTrackerItems.length + 1}`,
            milestone: e.milestone || 'General',
            activity: e.activity || '',
            niit_role: e.niit_role || 'Lead',
            partner_owner: e.partner_owner || '',
            actual: e.actual || '',
            hdfc_owner: e.hdfc_owner || '',
            start: e.start || '',
            end: e.end || '',
            status: e.status || 'Not Started',
            actual_completion: e.actual_completion || '',
            remarks: e.remarks || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          // Only populate the selected columns from the excel row, keep defaults for others
          activeColDefs.forEach(col => {
            const field = col.field || col.id;
            newItem[field] = e[field] !== undefined ? e[field] : (e._rawCells?.[col.id] ?? '');
          });
          updatedTrackerItems.push(newItem);
          addedCount++;
        }
      });
      if (addedCount > 0) {
        onToast?.(`Added ${addedCount} new deliverables found in Excel`, 'info');
      }
    }

    // Save column renames
    const columnRenameMap = {};
    parsedColumns.forEach(c => {
      const customName = renamedLabels[c.id];
      if (customName && customName !== c.label) {
        columnRenameMap[c.field || c.id] = customName.trim();
      }
    });

    onApplyUpdates(updatedTrackerItems, {
      updatedColumns: updatedFieldNames,
      columnRenames: columnRenameMap,
      updatedCount,
      fileName: file?.name || 'Excel'
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '780px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '8px', 
              background: 'rgba(34, 197, 94, 0.12)', 
              color: '#16a34a',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: '1.15rem' }}>Update Tracker from Excel</div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Select only the columns you want to update. All unselected columns will remain untouched.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {/* File & Sheet Picker Bar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'var(--bg-subtle)', 
            padding: '10px 14px', 
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
            border: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={16} color="var(--primary)" />
              <strong style={{ fontSize: '0.875rem' }}>{file?.name || 'No file selected'}</strong>
              {parsedRows.length > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  ({parsedRows.length} rows, {parsedColumns.length} columns)
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {sheetNames.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sheet:</span>
                  <select 
                    value={selectedSheet} 
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="form-control"
                    style={{ fontSize: '0.8rem', padding: '3px 8px', height: '30px' }}
                  >
                    {sheetNames.map(name => (
                      <option key={name} value={name}>{name.trim()}</option>
                    ))}
                  </select>
                </div>
              )}
              <input 
                ref={fileInputRef} 
                type="file" 
                accept=".xlsx,.xlsm" 
                onChange={handleFileInput} 
                style={{ display: 'none' }} 
              />
              <button 
                type="button" 
                className="btn btn-secondary btn-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={12} /> Choose another file
              </button>
            </div>
          </div>

          {isLoading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              Reading Excel workbook and analyzing columns...
            </div>
          )}

          {error && (
            <div style={{ 
              padding: '12px', 
              borderRadius: 'var(--radius-md)', 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: 'var(--status-delayed-text)', 
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && parsedColumns.length > 0 && (
            <>
              {/* Primary Key Selection Card */}
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.05)', 
                border: '1px solid rgba(59, 130, 246, 0.2)', 
                borderRadius: 'var(--radius-md)', 
                padding: '12px 14px',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Row Mapping (Primary Key):
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={primaryKey}
                      onChange={(e) => setPrimaryKey(e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.85rem', padding: '4px 10px', height: '32px', fontWeight: 600, color: 'var(--primary)', borderColor: 'rgba(59, 130, 246, 0.4)' }}
                    >
                      <option value="milestone">Milestone (Primary Key) — Recommended</option>
                      <option value="ref">Ref (e.g. 01.01)</option>
                      <option value="milestone_activity">Milestone + Activity</option>
                    </select>
                  </div>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {primaryKey === 'milestone' 
                    ? 'Deliverables will be matched by Milestone. Only the columns you select below will be updated. Your other columns (e.g. Status or Remarks updated earlier) will remain untouched.'
                    : primaryKey === 'ref'
                      ? 'Deliverables will be matched by Ref code (e.g. 01.01).'
                      : 'Deliverables will be matched by matching both Milestone and Activity description.'}
                </p>
              </div>

              {/* Column Selection Toolbar */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '10px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    Which columns to update? ({selectedCount} of {parsedColumns.length} selected)
                  </span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Check columns to update. You can also rename any column in the text box.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary-outline btn-xs" 
                    onClick={handleSelectOnlyOwners}
                    title="Select only Sub-Owner (Actual) and HDFC Owner"
                  >
                    <Sparkles size={12} /> Only Actual & HDFC Owner
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary-outline btn-xs" 
                    onClick={handleSelectAll}
                  >
                    Select All
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary-outline btn-xs" 
                    onClick={handleDeselectAll}
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Columns Table */}
              <div style={{ 
                border: '1px solid var(--border-subtle)', 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden',
                background: 'var(--bg-card)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                      <th style={{ width: '45px', padding: '8px 10px', textAlign: 'center' }}>Update</th>
                      <th style={{ width: '220px', padding: '8px 10px' }}>Excel Column Header</th>
                      <th style={{ width: '220px', padding: '8px 10px' }}>Column Label (Editable)</th>
                      <th style={{ padding: '8px 10px' }}>Sample Data from Excel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedColumns.map(col => {
                      const isSelected = !!selectedCols[col.id];
                      const isOwner = col.field === 'actual' || col.field === 'hdfc_owner';
                      const samples = getSamples(col.id);

                      return (
                        <tr 
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          style={{ 
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isSelected 
                              ? (isOwner ? 'rgba(34, 197, 94, 0.05)' : 'rgba(59, 130, 246, 0.04)')
                              : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleColumn(col.id)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>

                          {/* Excel Column */}
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                {col.rawHeader}
                              </span>
                              {isOwner && (
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  background: 'rgba(34, 197, 94, 0.15)', 
                                  color: '#16a34a', 
                                  padding: '1px 6px', 
                                  borderRadius: '4px',
                                  fontWeight: 700 
                                }}>
                                  {col.field === 'actual' ? 'Sub-Owner' : 'HDFC Owner'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Renamed Label Input */}
                          <td style={{ padding: '8px 10px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input 
                                type="text"
                                className="form-control"
                                value={renamedLabels[col.id] || ''}
                                onChange={(e) => handleRenameChange(col.id, e.target.value)}
                                placeholder={col.label}
                                style={{ 
                                  fontSize: '0.8rem', 
                                  padding: '3px 8px', 
                                  height: '28px',
                                  fontWeight: 600 
                                }}
                              />
                            </div>
                          </td>

                          {/* Sample Data */}
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                            <span style={{ 
                              display: 'inline-block', 
                              maxWidth: '220px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              fontSize: '0.78rem'
                            }}>
                              {samples || '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add New Deliverables Checkbox */}
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="chk-add-new"
                  checked={addNewRows}
                  onChange={(e) => setAddNewRows(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="chk-add-new" style={{ fontSize: '0.825rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                  Add any new deliverables found in this Excel that do not exist in the current tracker
                </label>
              </div>

              {/* Non-destructive guarantee callout */}
              <div style={{ 
                marginTop: '1rem', 
                padding: '10px 14px', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(234, 179, 8, 0.08)', 
                border: '1px solid rgba(234, 179, 8, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <ShieldCheck size={18} color="#ca8a04" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                  <strong>Selective Update Guarantee:</strong> Only the {selectedCount} selected columns will be modified. Any updates made yesterday on unselected columns (e.g. Status, Remarks, Custom tags) will stay completely intact and untouched.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>

          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleApply}
            disabled={isLoading || parsedColumns.length === 0 || selectedCount === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={16} />
            <span>Apply Selected Updates ({selectedCount} columns)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

