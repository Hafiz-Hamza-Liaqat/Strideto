import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  getAllBlockDefinitions,
  createDefaultBlock,
  BLOCK_CATEGORIES,
} from '@shared/blockRegistry.js';
import { createBlock, reindexBlocks } from '@shared/blockSchema.js';
import {
  duplicateBlockInList,
  moveBlockToBottom,
  moveBlockToTop,
  reorderBlocksByIds,
} from '@shared/pageBuilderEditorOps.js';
import { getPageValidationSummary } from '@shared/blockValidation.js';
import { createBlockFromTemplate, filterTemplates, TEMPLATE_CATEGORIES } from '@shared/pageBuilderTemplates.js';
import {
  convertBlockToGlobalReference,
  detachBlockFromGlobal,
} from '@shared/pageBuilderGlobalBlocks.js';
import { adminContentApi } from '../../services/adminContentApi';
import { adminFieldClass } from '../admin/AdminImageUrlField';
import { DragOverlayBlockRow, SortableBlockRow } from './SortableBlockRow';
import { BlockTemplateSaveModal } from './BlockTemplateSaveModal';

function ValidationSummaryBanner({ summary }) {
  if (!summary.errors.length && !summary.warnings.length) {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-200">
        All enabled blocks are valid and ready to publish.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm space-y-2">
      {summary.errors.length ? (
        <div>
          <p className="font-medium text-red-700 dark:text-red-300">
            {summary.invalidCount} block(s) must be fixed before publishing
          </p>
          <ul className="mt-1 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
            {summary.errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}
            {summary.errors.length > 6 ? <li>…and {summary.errors.length - 6} more</li> : null}
          </ul>
        </div>
      ) : null}
      {summary.warnings.length ? (
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-200">
            {summary.warningCount} block(s) have warnings
          </p>
          <ul className="mt-1 text-xs text-amber-700 dark:text-amber-300 list-disc list-inside">
            {summary.warnings.slice(0, 4).map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Block editor with DnD, templates, global blocks (C.6.4.11–C.6.4.12).
 */
export function AdminBlockEditor({ blocks, onChange, globalMap = new Map() }) {
  const [addTab, setAddTab] = useState('types');
  const [addType, setAddType] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [globalSearch, setGlobalSearch] = useState('');
  const [templates, setTemplates] = useState([]);
  const [globalBlocksList, setGlobalBlocksList] = useState([]);
  const [templateBlock, setTemplateBlock] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragAnnounceRef = useRef(null);

  const sorted = useMemo(() => reindexBlocks(blocks), [blocks]);
  const blocksRef = useRef(sorted);
  blocksRef.current = sorted;
  const blockIds = useMemo(() => sorted.map((b) => b.id), [sorted]);
  const definitions = useMemo(() => getAllBlockDefinitions(), []);
  const validationSummary = useMemo(
    () => getPageValidationSummary(sorted, { globalMap }),
    [sorted, globalMap],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminContentApi.listBlockTemplates({ limit: 200 }),
      adminContentApi.listGlobalBlocks({ limit: 200 }),
    ]).then(([tRes, gRes]) => {
      if (cancelled) return;
      setTemplates(tRes.data?.data || tRes.data?.items || []);
      setGlobalBlocksList(gRes.data?.data || gRes.data?.items || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filteredTemplates = useMemo(
    () => filterTemplates(templates, { q: templateSearch, category: templateCategory, sort: 'name' }),
    [templates, templateSearch, templateCategory],
  );

  const filteredGlobals = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    let list = [...globalBlocksList].filter((g) => g.enabled !== false);
    if (q) {
      list = list.filter((g) =>
        String(g.name || '').toLowerCase().includes(q)
        || String(g.description || '').toLowerCase().includes(q)
        || String(g.blockType || '').toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [globalBlocksList, globalSearch]);

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const cat of BLOCK_CATEGORIES) map.set(cat, []);
    for (const def of definitions) {
      if (!map.has(def.category)) map.set(def.category, []);
      map.get(def.category).push(def);
    }
    return map;
  }, [definitions]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const announce = useCallback((message) => {
    if (dragAnnounceRef.current) dragAnnounceRef.current.textContent = message;
  }, []);

  const insertBlock = useCallback((created) => {
    if (!created) return;
    created.order = sorted.length;
    onChange(reindexBlocks([...sorted, created]));
    setExpandedIds((prev) => new Set(prev).add(created.id));
  }, [onChange, sorted]);

  const addBlock = () => {
    if (!addType) return;
    const created = createDefaultBlock(addType);
    insertBlock(created);
    setAddType('');
  };

  const insertFromTemplate = (template) => {
    const created = createBlockFromTemplate(template);
    insertBlock(created);
  };

  const insertGlobalReference = (global) => {
    const created = createBlock(global.blockType, {}, { enabled: true });
    const linked = convertBlockToGlobalReference(created, String(global._id || global.id), global);
    insertBlock(linked);
  };

  const saveAsTemplate = async (payload) => {
    await adminContentApi.createBlockTemplate(payload);
    const { data } = await adminContentApi.listBlockTemplates({ limit: 200 });
    setTemplates(data?.data || data?.items || []);
  };

  const updateBlockById = useCallback((id, patch) => {
    onChange(sorted.map((b) => (b.id === id ? patch : b)));
  }, [onChange, sorted]);

  const convertToGlobal = async (block) => {
    const name = window.prompt('Global block name', `${block.type} (shared)`);
    if (!name?.trim()) return;
    const { data: global } = await adminContentApi.createGlobalBlock({
      name: name.trim(),
      blockType: block.type,
      config: block.config || {},
      enabled: true,
    });
    updateBlockById(block.id, convertBlockToGlobalReference(block, String(global._id), global));
    const { data } = await adminContentApi.listGlobalBlocks({ limit: 200 });
    setGlobalBlocksList(data?.data || data?.items || []);
  };

  const detachFromGlobal = (block) => {
    const global = globalMap.get(String(block.globalBlockId));
    updateBlockById(block.id, detachBlockFromGlobal(block, global));
  };

  const deleteBlock = useCallback((id) => {
    onChange(reindexBlocks(sorted.filter((b) => b.id !== id)));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [onChange, sorted]);

  const duplicateBlock = useCallback((id) => {
    onChange(duplicateBlockInList(sorted, id));
    announce('Block duplicated');
  }, [announce, onChange, sorted]);

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDragStart = ({ active }) => {
    setActiveId(active.id);
    setOverId(null);
    const def = sorted.find((b) => b.id === active.id);
    announce(`Picked up ${def?.type || 'block'}. Use arrow keys to move, Escape to cancel.`);
  };

  const handleDragOver = ({ active, over }) => {
    if (over) setOverId(String(over.id));
    if (!over || active.id === over.id) return;
    const next = reorderBlocksByIds(blocksRef.current, String(active.id), String(over.id));
    blocksRef.current = next;
    onChange(next);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) {
      announce('Reorder cancelled');
      return;
    }
    const next = reorderBlocksByIds(blocksRef.current, String(active.id), String(over.id));
    blocksRef.current = next;
    onChange(next);
    announce('Block reordered');
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
    announce('Reorder cancelled');
  };

  const activeBlock = activeId ? sorted.find((b) => b.id === activeId) : null;
  const activeIndex = activeBlock ? sorted.findIndex((b) => b.id === activeBlock.id) : -1;

  return (
    <div className="space-y-4">
      <div ref={dragAnnounceRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <ValidationSummaryBanner summary={validationSummary} />

      <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-wrap gap-2">
          {['types', 'templates', 'global'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setAddTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${addTab === tab ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600'}`}
            >
              {tab === 'types' ? 'Block Types' : tab === 'templates' ? 'Templates' : 'Global Blocks'}
            </button>
          ))}
        </div>

        {addTab === 'types' ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
              <span className="font-medium text-gray-700 dark:text-gray-300">Block type</span>
              <select className={adminFieldClass} value={addType} onChange={(e) => setAddType(e.target.value)}>
                <option value="">Select block type…</option>
                {[...byCategory.entries()].map(([cat, defs]) => (
                  <optgroup key={cat} label={cat}>
                    {defs.map((d) => (
                      <option key={d.blockType} value={d.blockType}>{d.displayName}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="button" onClick={addBlock} disabled={!addType} className="px-4 py-2 rounded-lg bg-primary text-white text-sm disabled:opacity-50">
              Add block
            </button>
          </div>
        ) : null}

        {addTab === 'templates' ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input className={`${adminFieldClass} w-full min-w-0 sm:flex-1 sm:min-w-[160px]`} placeholder="Search templates…" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} />
              <select className={adminFieldClass} value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)}>
                <option value="all">All categories</option>
                {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredTemplates.map((t) => (
                <button key={t._id} type="button" onClick={() => insertFromTemplate(t)} className="w-full text-left px-3 py-2 rounded border border-gray-200 dark:border-gray-700 hover:border-primary text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{t.blockType} · {t.category}</span>
                </button>
              ))}
              {!filteredTemplates.length ? <p className="text-xs text-gray-500 py-2">No templates match.</p> : null}
            </div>
          </div>
        ) : null}

        {addTab === 'global' ? (
          <div className="space-y-2">
            <input className={adminFieldClass} placeholder="Search global blocks…" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredGlobals.map((g) => (
                <button key={g._id} type="button" onClick={() => insertGlobalReference(g)} className="w-full text-left px-3 py-2 rounded border border-gray-200 dark:border-gray-700 hover:border-primary text-sm">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{g.blockType}{g.usageCount ? ` · used ${g.usageCount}×` : ''}</span>
                </button>
              ))}
              {!filteredGlobals.length ? <p className="text-xs text-gray-500 py-2">No global blocks available.</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      <BlockTemplateSaveModal
        block={templateBlock}
        open={Boolean(templateBlock)}
        onClose={() => setTemplateBlock(null)}
        onSave={saveAsTemplate}
      />

      {!sorted.length ? (
        <div
          className="text-sm text-gray-500 dark:text-gray-400 py-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
          role="region"
          aria-label="Empty page layout"
        >
          No blocks yet. Add a block above to start building this page layout.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3" role="list" aria-label="Page blocks">
              {sorted.map((block, index) => (
                <div key={block.id} role="listitem" className="relative">
                  {activeId && overId === block.id && activeId !== block.id ? (
                    <div
                      className="absolute -top-2 left-4 right-4 h-1 bg-primary rounded-full z-10 shadow-sm"
                      aria-hidden
                    />
                  ) : null}
                  <SortableBlockRow
                    block={block}
                    index={index}
                    total={sorted.length}
                    expanded={expandedIds.has(block.id)}
                    globalMap={globalMap}
                    globalLabel={block.globalBlockId ? globalMap.get(String(block.globalBlockId))?.name : undefined}
                    onUpdate={(patch) => updateBlockById(block.id, patch)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onToggleExpand={() => toggleExpanded(block.id)}
                    onToggleEnabled={() => updateBlockById(block.id, { ...block, enabled: !block.enabled })}
                    onMoveTop={() => onChange(moveBlockToTop(sorted, block.id))}
                    onMoveBottom={() => onChange(moveBlockToBottom(sorted, block.id))}
                    onSaveAsTemplate={() => setTemplateBlock(block)}
                    onConvertToGlobal={() => convertToGlobal(block)}
                    onDetachGlobal={() => detachFromGlobal(block)}
                  />
                </div>
              ))}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1)' }}>
            {activeBlock ? (
              <DragOverlayBlockRow block={activeBlock} index={activeIndex} total={sorted.length} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

export { getPageValidationSummary };
