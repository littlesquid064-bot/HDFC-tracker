import React, { useState, useEffect, useMemo } from 'react';
import { 
  Edit3, 
  Check, 
  X, 
  Trash2, 
  User, 
  AlertTriangle, 
  ChevronDown, 
  History, 
  Plus, 
  ArrowLeft, 
  ArrowRight, 
  SlidersHorizontal, 
  ExternalLink, 
  RotateCcw,
  Sparkles,
  Tag as TagIcon,
  Calendar,
  Layers
} from 'lucide-react';
import AddColumnModal from './AddColumnModal';
import ColumnManagerModal from './ColumnManagerModal';
import { api } from '../api';

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Ongoing', 'Completed', 'On Hold'];
const ROLE_OPTIONS = ['Lead', 'Support'];

const DEFAULT_COLUMNS = [
  { id: 'ref', label: 'REF', width: '80px', canMove: true, isDefault: true },
  { id: 'role', label: 'ROLE', width: '105px', canMove: true, isDefault: true },
  { id: 'activity', label: 'ACTIVITY / DELIVERABLE', minWidth: '260px', canMove: true, isDefault: true },
  { id: 'owner', label: 'OWNER', width: '135px', canMove: true, isDefault: true },
  { id: 'timeline', label: 'TIMELINE', width: '145px', canMove: true, isDefault: true },
  { id: 'status', label: 'STATUS', width: '150px', canMove: true, isDefault: true },
  { id: 'remarks', label: 'REMARKS / BLOCKERS', minWidth: '220px', canMove: true, isDefault: true },
  { id: 'actions', label: 'ACTIONS', width: '90px', canMove: false, isDefault: true, align: 'center' }
];

const STORAGE_KEYS = {
  COLUMNS_ORDER: 'hdfc_table_columns_order',
  CUSTOM_COLUMNS: 'hdfc_table_custom_columns'
};

const COMMON_TAGS = ['High', 'Medium', 'Low', 'Critical', 'Urgent', 'On Track', 'Review Needed'];

export default function TrackerTable({
  items = [],
  onSaveRow,
  onDeleteRow,
  onOpenDrawer,
  onAddRow,
  onOpenAddModal,
  milestones = [],
  isGrouped = true,
  isInlineRowOpen: propIsInlineRowOpen,
  setIsInlineRowOpen: propSetIsInlineRowOpen,
  isAddColumnOpen: propIsAddColumnOpen,
  setIsAddColumnOpen: propSetIsAddColumnOpen,
  isColumnManagerOpen: propIsColumnManagerOpen,
  setIsColumnManagerOpen: propSetIsColumnManagerOpen,
  onColumnsChange
}) {
  // Remarks & Status editing state
  const [editingRemarkRef, setEditingRemarkRef] = useState(null);
  const [remarkText, setRemarkText] = useState('');
  const [openStatusDropdownRef, setOpenStatusDropdownRef] = useState(null);

  // Custom Columns & Column Order State
  const [customColumns, setCustomColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_COLUMNS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COLUMNS_ORDER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_COLUMNS.map(c => c.id);
  });

  // Modals state (controlled from props or fallback to local)
  const [localIsAddColumnOpen, setLocalIsAddColumnOpen] = useState(false);
  const [localIsColumnManagerOpen, setLocalIsColumnManagerOpen] = useState(false);
  const [localIsInlineRowOpen, setLocalIsInlineRowOpen] = useState(false);

  const isAddColumnOpen = propIsAddColumnOpen !== undefined ? propIsAddColumnOpen : localIsAddColumnOpen;
  const setIsAddColumnOpen = propSetIsAddColumnOpen || setLocalIsAddColumnOpen;

  const isColumnManagerOpen = propIsColumnManagerOpen !== undefined ? propIsColumnManagerOpen : localIsColumnManagerOpen;
  const setIsColumnManagerOpen = propSetIsColumnManagerOpen || setLocalIsColumnManagerOpen;

  const isInlineRowOpen = propIsInlineRowOpen !== undefined ? propIsInlineRowOpen : localIsInlineRowOpen;
  const setIsInlineRowOpen = propSetIsInlineRowOpen || setLocalIsInlineRowOpen;

  // Quick inline row addition state
  const [inlineMilestone, setInlineMilestone] = useState('');
  const [inlineRef, setInlineRef] = useState('');
  const [inlineActivity, setInlineActivity] = useState('');
  const [inlineRole, setInlineRole] = useState('Lead');
  const [inlineOwner, setInlineOwner] = useState('');
  const [inlineStart, setInlineStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [inlineEnd, setInlineEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [inlineStatus, setInlineStatus] = useState('Not Started');
  const [inlineRemarks, setInlineRemarks] = useState('');
  const [inlineCustomValues, setInlineCustomValues] = useState({});

  // Inline custom cell editing state: { ref, colId, value }
  const [editingCustomCell, setEditingCustomCell] = useState(null);
  const [openTagDropdownCell, setOpenTagDropdownCell] = useState(null);

  // Drag and drop state for column headers
  const [draggedColId, setDraggedColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  // Combined columns map and active column list
  const allColumnsMap = useMemo(() => {
    const map = {};
    DEFAULT_COLUMNS.forEach(col => { map[col.id] = col; });
    customColumns.forEach(col => { map[col.id] = col; });
    return map;
  }, [customColumns]);

  // Filtered active columns in display order
  const activeColumns = useMemo(() => {
    const list = [];
    columnOrder.forEach(id => {
      if (allColumnsMap[id]) list.push(allColumnsMap[id]);
    });
    // Ensure any custom columns not in order are appended before actions
    customColumns.forEach(col => {
      if (!list.some(c => c.id === col.id)) {
        const actionsIdx = list.findIndex(c => c.id === 'actions');
        if (actionsIdx !== -1) list.splice(actionsIdx, 0, col);
        else list.push(col);
      }
    });
    // Ensure actions is always present at end if missing
    if (!list.some(c => c.id === 'actions') && allColumnsMap['actions']) {
      list.push(allColumnsMap['actions']);
    }
    return list;
  }, [columnOrder, allColumnsMap, customColumns]);

  // Sync columns count with parent component
  useEffect(() => {
    if (onColumnsChange) {
      onColumnsChange(activeColumns.length);
    }
  }, [activeColumns.length, onColumnsChange]);

  // When isInlineRowOpen is triggered externally and ref is empty, initialize fields
  useEffect(() => {
    if (isInlineRowOpen && !inlineRef) {
      handleOpenInlineRow();
    }
  }, [isInlineRowOpen]);

  // Load table configuration and custom columns from MongoDB on mount
  useEffect(() => {
    api.getTableConfig().then(config => {
      if (config) {
        if (config.customColumns && Array.isArray(config.customColumns)) {
          setCustomColumns(config.customColumns);
        }
        if (config.columnOrder && Array.isArray(config.columnOrder)) {
          setColumnOrder(config.columnOrder);
        }
      }
    }).catch(err => {
      console.warn('Could not load table config from MongoDB:', err);
    });
  }, []);

  // Keep columnOrder in sync with activeColumns IDs and save to MongoDB & localStorage
  const updateColumnOrder = (newOrder) => {
    setColumnOrder(newOrder);
    api.saveTableConfig({ customColumns, columnOrder: newOrder });
  };

  const updateCustomColumns = (newCols) => {
    setCustomColumns(newCols);
    api.saveTableConfig({ customColumns: newCols, columnOrder });
  };

  // Move column by swapping indices
  const handleMoveColumn = (fromIndex, toIndex) => {
    const actionsIdx = activeColumns.findIndex(c => c.id === 'actions');
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= activeColumns.length || toIndex >= activeColumns.length) return;
    if (fromIndex === actionsIdx || toIndex === actionsIdx) return; // Actions column is pinned right

    const newOrder = activeColumns.map(c => c.id);
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setColumnOrder(newOrder);
    api.saveTableConfig({ customColumns, columnOrder: newOrder });
  };

  // Move a column after next (Shift right)
  const handleMoveAfterNext = (colId, e) => {
    if (e) e.stopPropagation();
    const currentIdx = activeColumns.findIndex(c => c.id === colId);
    if (currentIdx === -1) return;
    const actionsIdx = activeColumns.findIndex(c => c.id === 'actions');
    const maxIdx = actionsIdx !== -1 ? actionsIdx - 1 : activeColumns.length - 1;
    if (currentIdx < maxIdx) {
      handleMoveColumn(currentIdx, currentIdx + 1);
    }
  };

  // Move a column before previous (Shift left)
  const handleMoveBefore = (colId, e) => {
    if (e) e.stopPropagation();
    const currentIdx = activeColumns.findIndex(c => c.id === colId);
    if (currentIdx > 0) {
      handleMoveColumn(currentIdx, currentIdx - 1);
    }
  };

  // HTML5 Drag and drop handlers for column headers
  const handleDragStart = (e, colId) => {
    if (colId === 'actions') return;
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleDragOver = (e, colId) => {
    if (colId === 'actions' || colId === draggedColId) return;
    e.preventDefault();
    setDragOverColId(colId);
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedColId || targetColId === 'actions' || draggedColId === targetColId) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }
    const fromIdx = activeColumns.findIndex(c => c.id === draggedColId);
    const toIdx = activeColumns.findIndex(c => c.id === targetColId);
    if (fromIdx !== -1 && toIdx !== -1) {
      handleMoveColumn(fromIdx, toIdx);
    }
    setDraggedColId(null);
    setDragOverColId(null);
  };

  // Add new custom column - persists directly to MongoDB
  const handleAddColumn = ({ name, type, insertAfter }) => {
    const colId = `custom_${Date.now()}`;
    const newCol = {
      id: colId,
      label: name.toUpperCase(),
      type: type || 'text',
      minWidth: '150px',
      canMove: true,
      isDefault: false
    };

    const newCustomList = [...customColumns, newCol];
    setCustomColumns(newCustomList);

    // Insert into order
    const currentOrder = activeColumns.map(c => c.id);
    let insertIdx = currentOrder.length - 1; // before actions
    if (insertAfter && insertAfter !== 'end') {
      const targetIdx = currentOrder.indexOf(insertAfter);
      if (targetIdx !== -1) insertIdx = targetIdx + 1;
    }

    currentOrder.splice(insertIdx, 0, colId);
    setColumnOrder(currentOrder);

    // Persist to MongoDB
    api.saveTableConfig({ customColumns: newCustomList, columnOrder: currentOrder });
  };

  // Delete custom column - persists directly to MongoDB
  const handleDeleteCustomColumn = (colId) => {
    const updated = customColumns.filter(c => c.id !== colId);
    const newOrder = columnOrder.filter(id => id !== colId);
    setCustomColumns(updated);
    setColumnOrder(newOrder);
    api.saveTableConfig({ customColumns: updated, columnOrder: newOrder });
  };

  // Reset to default columns layout in MongoDB
  const handleResetColumns = () => {
    const defaultOrder = DEFAULT_COLUMNS.map(c => c.id);
    setCustomColumns([]);
    setColumnOrder(defaultOrder);
    api.saveTableConfig({ customColumns: [], columnOrder: defaultOrder });
    setIsColumnManagerOpen(false);
  };

  // Remarks inline editing
  const handleStartEditRemark = (item, e) => {
    e.stopPropagation();
    setEditingRemarkRef(item.ref);
    setRemarkText(item.remarks || '');
  };

  const handleSaveRemark = async (ref, e) => {
    if (e) e.stopPropagation();
    await onSaveRow(ref, { remarks: remarkText });
    setEditingRemarkRef(null);
  };

  const handleCancelRemark = (e) => {
    if (e) e.stopPropagation();
    setEditingRemarkRef(null);
  };

  // Status 1-click change
  const handleStatusChange = async (ref, newStatus, e) => {
    e.stopPropagation();
    setOpenStatusDropdownRef(null);
    let actualCompletion = undefined;
    if (newStatus === 'Completed') {
      actualCompletion = today;
    }
    await onSaveRow(ref, { status: newStatus, actual_completion: actualCompletion });
  };

  // Custom cell inline save
  const handleSaveCustomCell = async (ref, colId, value) => {
    await onSaveRow(ref, { [colId]: value });
    setEditingCustomCell(null);
    setOpenTagDropdownCell(null);
  };

  // Start inline quick add row
  const handleOpenInlineRow = (milestoneName = '') => {
    const defaultM = milestoneName || (milestones[0] || (items[0]?.milestone || '01 · Partner Mobilisation & Governance'));
    setInlineMilestone(defaultM);

    // Auto-generate next suggested ref code
    const existingInMilestone = items.filter(i => i.milestone === defaultM);
    let suggestedRef = '';
    if (existingInMilestone.length > 0) {
      const last = existingInMilestone[existingInMilestone.length - 1];
      const match = (last.ref || '').match(/^(\d+)\.(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2], 10) + 1;
        suggestedRef = `${prefix}.${num < 10 ? '0' + num : num}`;
      }
    }
    if (!suggestedRef) {
      const matchM = defaultM.match(/^(\d+)/);
      const mNum = matchM ? matchM[1] : '01';
      suggestedRef = `${mNum}.01`;
    }

    setInlineRef(suggestedRef);
    setInlineActivity('');
    setInlineRole('Lead');
    setInlineOwner('Saira / Sanjeev');
    setInlineRemarks('');
    setInlineCustomValues({});
    setIsInlineRowOpen(true);
  };

  // Submit quick inline row
  const handleSubmitInlineRow = async (e) => {
    if (e) e.preventDefault();
    if (!inlineActivity.trim()) {
      alert('Please enter an activity description.');
      return;
    }

    const newDeliverable = {
      ref: inlineRef.trim() || undefined,
      milestone: inlineMilestone || 'General',
      activity: inlineActivity.trim(),
      niit_role: inlineRole,
      partner_owner: inlineOwner.trim() || 'TBD',
      start: inlineStart,
      end: inlineEnd,
      status: inlineStatus,
      remarks: inlineRemarks.trim(),
      ...inlineCustomValues
    };

    if (onAddRow) {
      await onAddRow(newDeliverable);
    } else if (onOpenAddModal) {
      onOpenAddModal();
    }

    setIsInlineRowOpen(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
  };

  // Render dynamic cell based on column ID
  const renderCell = (col, item) => {
    const isEditingRemark = editingRemarkRef === item.ref;
    const isStatusOpen = openStatusDropdownRef === item.ref;
    const isOverdue = item.end && item.end < today && item.status !== 'Completed';
    const statusKey = (item.status || 'Not Started').toLowerCase().replace(/\s+/g, '');

    switch (col.id) {
      case 'ref':
        return (
          <td key={col.id} style={{ width: col.width || '80px' }}>
            <span className="ref-pill">{item.ref}</span>
          </td>
        );

      case 'role':
        return (
          <td key={col.id} style={{ width: col.width || '105px' }}>
            <span className={`role-badge ${item.niit_role === 'Lead' ? 'role-lead' : 'role-support'}`}>
              {item.niit_role || 'Support'}
            </span>
          </td>
        );

      case 'activity':
        return (
          <td key={col.id} style={{ minWidth: col.minWidth || '260px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px' }}>
              {item.activity}
            </div>
            {item.actual_completion && (
              <div style={{ fontSize: '0.725rem', color: 'var(--status-completed-text)', fontWeight: 600 }}>
                ✓ Completed on {formatDate(item.actual_completion)}
              </div>
            )}
          </td>
        );

      case 'owner':
        return (
          <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ width: col.width || '135px' }}>
            <div className="table-owner-cell">
              <User size={13} color="var(--text-subtle)" />
              <span>{item.partner_owner || 'Unassigned'}</span>
            </div>
          </td>
        );

      case 'timeline':
        return (
          <td key={col.id} style={{ width: col.width || '145px' }}>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              {formatDate(item.start)} &rarr; {formatDate(item.end)}
            </div>
            {isOverdue && (
              <span className="badge-overdue" style={{ marginTop: '4px' }}>
                <AlertTriangle size={11} /> Overdue
              </span>
            )}
          </td>
        );

      case 'status':
        return (
          <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: col.width || '150px' }}>
            <button
              type="button"
              className={`status-badge-interactive status-${statusKey}`}
              onClick={() => setOpenStatusDropdownRef(isStatusOpen ? null : item.ref)}
              title="Click to quickly change status"
            >
              <span>{item.status || 'Not Started'}</span>
              <ChevronDown size={12} style={{ opacity: 0.7 }} />
            </button>

            {isStatusOpen && (
              <div className="status-dropdown-menu">
                {STATUS_OPTIONS.map((opt) => (
                  <div
                    key={opt}
                    className={`status-dropdown-option ${item.status === opt ? 'selected' : ''}`}
                    onClick={(e) => handleStatusChange(item.ref, opt, e)}
                  >
                    <span className={`status-dot dot-${opt.toLowerCase().replace(/\s+/g, '')}`} />
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            )}
          </td>
        );

      case 'remarks':
        return (
          <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ minWidth: col.minWidth || '220px' }}>
            {isEditingRemark ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                <textarea
                  className="form-control"
                  rows="2"
                  autoFocus
                  style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                  onClick={(e) => handleSaveRemark(item.ref, e)}
                  title="Save"
                >
                  <Check size={13} />
                </button>
                <button
                  className="btn"
                  style={{ padding: '4px 6px', fontSize: '0.75rem', background: 'var(--bg-subtle)' }}
                  onClick={handleCancelRemark}
                  title="Cancel"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div 
                className="table-remarks-box"
                onClick={(e) => handleStartEditRemark(item, e)}
                title="Click to edit remarks"
              >
                <div style={{ fontSize: '0.8rem', color: item.remarks ? 'var(--text-main)' : 'var(--text-subtle)', fontStyle: item.remarks ? 'normal' : 'italic' }}>
                  {item.remarks || '+ Add remarks or notes...'}
                </div>
              </div>
            )}
          </td>
        );

      case 'actions':
        return (
          <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', width: col.width || '90px' }}>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
              <button
                className="btn-icon"
                onClick={() => onOpenDrawer(item, 'update')}
                title="Edit deliverable details"
              >
                <Edit3 size={13} />
              </button>
              <button
                className="btn-icon"
                onClick={() => onOpenDrawer(item, 'history')}
                title="View activity & update logs for this item"
              >
                <History size={13} />
              </button>
              <button
                className="btn-icon text-danger"
                onClick={() => {
                  if (window.confirm(`Delete activity [${item.ref}]?`)) {
                    onDeleteRow(item.ref);
                  }
                }}
                title="Delete activity"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </td>
        );

      default:
        // Dynamic Custom Column Cell
        return renderCustomCell(col, item);
    }
  };

  // Render custom column cell with interactive editing
  const renderCustomCell = (col, item) => {
    const val = item[col.id] || '';
    const isEditing = editingCustomCell?.ref === item.ref && editingCustomCell?.colId === col.id;
    const isTagMenuOpen = openTagDropdownCell?.ref === item.ref && openTagDropdownCell?.colId === col.id;

    if (isEditing) {
      return (
        <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ minWidth: col.minWidth || '140px' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
              className="form-control"
              style={{ fontSize: '0.8rem', padding: '3px 6px', height: '28px' }}
              value={editingCustomCell.value}
              autoFocus
              onChange={(e) => setEditingCustomCell({ ...editingCustomCell, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCustomCell(item.ref, col.id, editingCustomCell.value);
                if (e.key === 'Escape') setEditingCustomCell(null);
              }}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '3px 6px', height: '28px' }}
              onClick={() => handleSaveCustomCell(item.ref, col.id, editingCustomCell.value)}
              title="Save"
            >
              <Check size={12} />
            </button>
            <button
              className="btn"
              style={{ padding: '3px 6px', height: '28px', background: 'var(--bg-subtle)' }}
              onClick={() => setEditingCustomCell(null)}
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>
        </td>
      );
    }

    if (col.type === 'tag') {
      return (
        <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ position: 'relative', minWidth: col.minWidth || '140px' }}>
          <div
            className="custom-tag-cell"
            onClick={() => setOpenTagDropdownCell(isTagMenuOpen ? null : { ref: item.ref, colId: col.id })}
            title="Click to set tag"
          >
            {val ? (
              <span className="badge-custom-tag">{val}</span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                + Set tag
              </span>
            )}
          </div>

          {isTagMenuOpen && (
            <div className="status-dropdown-menu" style={{ width: '150px' }}>
              {COMMON_TAGS.map((tag) => (
                <div
                  key={tag}
                  className={`status-dropdown-option ${val === tag ? 'selected' : ''}`}
                  onClick={() => handleSaveCustomCell(item.ref, col.id, tag)}
                >
                  <TagIcon size={12} color="var(--primary)" />
                  <span>{tag}</span>
                </div>
              ))}
              <div 
                className="status-dropdown-option"
                style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                onClick={() => {
                  setOpenTagDropdownCell(null);
                  setEditingCustomCell({ ref: item.ref, colId: col.id, value: val });
                }}
              >
                <span>Custom tag...</span>
              </div>
            </div>
          )}
        </td>
      );
    }

    if (col.type === 'link') {
      return (
        <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ minWidth: col.minWidth || '140px' }}>
          {val ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <a 
                href={val.startsWith('http') ? val : `https://${val}`} 
                target="_blank" 
                rel="noreferrer"
                className="table-link-cell"
              >
                <span>Open Link</span>
                <ExternalLink size={11} />
              </a>
              <button
                className="btn-icon"
                style={{ padding: '2px', opacity: 0.6 }}
                onClick={() => setEditingCustomCell({ ref: item.ref, colId: col.id, value: val })}
                title="Edit URL"
              >
                <Edit3 size={11} />
              </button>
            </div>
          ) : (
            <div 
              style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', cursor: 'pointer', fontStyle: 'italic' }}
              onClick={() => setEditingCustomCell({ ref: item.ref, colId: col.id, value: '' })}
            >
              + Add link
            </div>
          )}
        </td>
      );
    }

    // Default text / number / date custom cell
    return (
      <td key={col.id} onClick={(e) => e.stopPropagation()} style={{ minWidth: col.minWidth || '140px' }}>
        <div 
          className="table-custom-text-box"
          onClick={() => setEditingCustomCell({ ref: item.ref, colId: col.id, value: val })}
          title="Click to edit"
        >
          {val ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{val}</span>
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
              + Add {col.label.toLowerCase()}
            </span>
          )}
        </div>
      </td>
    );
  };

  let lastMilestone = '';

  return (
    <div className="table-wrapper-card">
      {/* Main Table Container */}
      <div className="table-container">
        <table className="tracker-table">
          <thead>
            <tr>
              {activeColumns.map((col, index) => {
                const isActions = col.id === 'actions';
                const canMoveLeft = index > 0 && !isActions;
                const actionsIdx = activeColumns.findIndex(c => c.id === 'actions');
                const canMoveRight = !isActions && index < (actionsIdx !== -1 ? actionsIdx - 1 : activeColumns.length - 1);
                const isDragTarget = dragOverColId === col.id;

                return (
                  <th
                    key={col.id}
                    draggable={col.canMove !== false}
                    onDragStart={(e) => handleDragStart(e, col.id)}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`table-th-interactive ${isDragTarget ? 'drag-over' : ''}`}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth,
                      textAlign: col.align || 'left'
                    }}
                  >
                    <div className="th-content-wrap">
                      <span className="th-title" title={`Column: ${col.label}`}>
                        {col.label}
                      </span>

                      {/* Header Move & Action Controls */}
                      {!isActions && (
                        <div className="th-move-controls" onClick={(e) => e.stopPropagation()}>
                          {/* Move Left / Shift Before */}
                          <button
                            type="button"
                            className="btn-th-arrow"
                            disabled={!canMoveLeft}
                            onClick={(e) => handleMoveBefore(col.id, e)}
                            title={`Move ${col.label} left / before previous column`}
                          >
                            <ArrowLeft size={11} />
                          </button>

                          {/* Move Right / Shift After Next */}
                          <button
                            type="button"
                            className="btn-th-arrow btn-th-after-next"
                            disabled={!canMoveRight}
                            onClick={(e) => handleMoveAfterNext(col.id, e)}
                            title={`Move ${col.label} right / after next column`}
                          >
                            <ArrowRight size={11} />
                          </button>

                          {/* Delete Custom Column */}
                          {!col.isDefault && (
                            <button
                              type="button"
                              className="btn-th-arrow text-danger"
                              onClick={() => {
                                if (window.confirm(`Delete custom column "${col.label}"?`)) {
                                  handleDeleteCustomColumn(col.id);
                                }
                              }}
                              title="Delete custom column"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}

              {/* Quick + Column Header Button */}
              <th 
                className="th-add-col-btn"
                onClick={() => setIsAddColumnOpen(true)}
                title="Add a new column"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                  <Plus size={13} />
                  <span>Col</span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Quick Inline Row Form (if open at the top) */}
            {isInlineRowOpen && (
              <tr className="quick-add-row-form">
                <td colSpan={activeColumns.length + 1} style={{ padding: '12px 16px', background: 'var(--bg-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)' }}>
                        + Quick Add Deliverable
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        in {inlineMilestone}
                      </span>
                    </div>
                    {onOpenAddModal && (
                      <button
                        type="button"
                        className="btn-link-action"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => {
                          setIsInlineRowOpen(false);
                          onOpenAddModal();
                        }}
                      >
                        <span>Open Detailed Form ↗</span>
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSubmitInlineRow}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 105px 1.5fr 140px 180px 130px 1fr auto', gap: '8px', alignItems: 'center' }}>
                      {/* Ref */}
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                        placeholder="Ref"
                        value={inlineRef}
                        onChange={(e) => setInlineRef(e.target.value)}
                      />

                      {/* Role */}
                      <select
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                        value={inlineRole}
                        onChange={(e) => setInlineRole(e.target.value)}
                      >
                        <option value="Lead">Lead</option>
                        <option value="Support">Support</option>
                      </select>

                      {/* Activity */}
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                        placeholder="Activity / Deliverable description *"
                        autoFocus
                        value={inlineActivity}
                        onChange={(e) => setInlineActivity(e.target.value)}
                        required
                      />

                      {/* Owner */}
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                        placeholder="Owner (e.g. Saira)"
                        value={inlineOwner}
                        onChange={(e) => setInlineOwner(e.target.value)}
                      />

                      {/* Timeline */}
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          type="date"
                          className="form-control"
                          style={{ fontSize: '0.75rem', padding: '3px 4px' }}
                          value={inlineStart}
                          onChange={(e) => setInlineStart(e.target.value)}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>&rarr;</span>
                        <input
                          type="date"
                          className="form-control"
                          style={{ fontSize: '0.75rem', padding: '3px 4px' }}
                          value={inlineEnd}
                          onChange={(e) => setInlineEnd(e.target.value)}
                        />
                      </div>

                      {/* Status */}
                      <select
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                        value={inlineStatus}
                        onChange={(e) => setInlineStatus(e.target.value)}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>

                      {/* Remarks */}
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                        placeholder="Remarks / blockers..."
                        value={inlineRemarks}
                        onChange={(e) => setInlineRemarks(e.target.value)}
                      />

                      {/* Save / Cancel buttons */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                          title="Save new deliverable"
                        >
                          <Check size={14} />
                          <span>Save</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '5px 8px' }}
                          onClick={() => setIsInlineRowOpen(false)}
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </form>
                </td>
              </tr>
            )}

            {/* Empty items state */}
            {items.length === 0 && (
              <tr>
                <td colSpan={activeColumns.length + 1} style={{ padding: '3.5rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, margin: 0 }}>
                    No matching activities found for this filter.
                  </p>
                </td>
              </tr>
            )}

            {/* Deliverable Rows */}
            {items.map((item) => {
              const showMilestoneHeader = isGrouped && item.milestone && item.milestone !== lastMilestone;
              if (showMilestoneHeader) {
                lastMilestone = item.milestone;
              }

              return (
                <React.Fragment key={item.ref}>
                  {showMilestoneHeader && (
                    <tr className="milestone-group-row">
                      <td colSpan={activeColumns.length + 1}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700 }}>{item.milestone}</span>
                          <button
                            type="button"
                            className="btn-milestone-add-row"
                            onClick={() => handleOpenInlineRow(item.milestone)}
                            title={`Add a new row in ${item.milestone}`}
                          >
                            <Plus size={12} />
                            <span>+ Add Row</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  <tr className="tracker-row" onClick={() => onOpenDrawer(item)}>
                    {activeColumns.map(col => renderCell(col, item))}
                    {/* Empty cell matching + Col header */}
                    <td style={{ width: '40px', padding: 0 }} />
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Column Modal */}
      <AddColumnModal
        isOpen={isAddColumnOpen}
        onClose={() => setIsAddColumnOpen(false)}
        onAddColumn={handleAddColumn}
        existingColumns={activeColumns}
      />

      {/* Column Manager Modal */}
      <ColumnManagerModal
        isOpen={isColumnManagerOpen}
        onClose={() => setIsColumnManagerOpen(false)}
        columns={activeColumns}
        onMoveColumn={handleMoveColumn}
        onDeleteCustomColumn={handleDeleteCustomColumn}
        onResetColumns={handleResetColumns}
        onOpenAddColumn={() => setIsAddColumnOpen(true)}
      />
    </div>
  );
}
