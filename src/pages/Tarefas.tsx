import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DndContext, DragOverlay, closestCorners,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
  DragStartEvent, DragEndEvent, DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, X, MoreHorizontal, Calendar, CheckSquare,
  MessageSquare, Archive, Trash2, Search, Filter,
  Clock, Edit3, Grip, Layout, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ── Palette ───────────────────────────────────────────────────
const C = {
  bg:      '#F3ECD6',
  navy:    '#1c53ba',
  red:     '#f1381c',
  ink:     '#2b2b2b',
  inkMid:  'rgba(43,43,43,0.5)',
  inkLow:  'rgba(43,43,43,0.12)',
  navyMid: 'rgba(28,83,186,0.08)',
  navyLow: 'rgba(28,83,186,0.04)',
  white:   '#ffffff',
  cream:   '#faf6ea',
};

// ── Types ─────────────────────────────────────────────────────
interface ChecklistItem { id: string; content: string; is_done: boolean; position: number }
interface Checklist     { id: string; title: string; position: number; items: ChecklistItem[] }
interface Label         { id: string; name: string; color: string }
interface Comment       { id: string; content: string; created_at: string }
interface Task {
  id: string; list_id: string; title: string; description: string;
  cover_image: string | null; due_date: string | null; position: number;
  is_archived: boolean; labels: Label[]; checklists: Checklist[]; comments: Comment[];
}
interface List  { id: string; board_id: string; title: string; position: number; tasks: Task[] }
interface Board { id: string; title: string; description: string }

// ── Utils ─────────────────────────────────────────────────────
const generateId = () => crypto.randomUUID();
const formatDate  = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const isOverdue   = (d: string) => new Date(d) < new Date();
const isDueSoon   = (d: string) => { const diff = (new Date(d).getTime() - Date.now()) / 86400000; return diff > 0 && diff <= 3; };

const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  red:    { bg: 'rgba(241,56,28,0.12)',  text: '#f1381c' },
  orange: { bg: 'rgba(234,88,12,0.12)',  text: '#ea580c' },
  yellow: { bg: 'rgba(202,138,4,0.12)',  text: '#ca8a04'  },
  green:  { bg: 'rgba(26,122,74,0.12)',  text: '#1a7a4a'  },
  blue:   { bg: 'rgba(28,83,186,0.12)',  text: '#1c53ba'  },
  purple: { bg: 'rgba(147,51,234,0.12)', text: '#9333ea'  },
  teal:   { bg: 'rgba(13,148,136,0.12)', text: '#0d9488'  },
  pink:   { bg: 'rgba(219,39,119,0.12)', text: '#db2777'  },
};

// ── SortableCard ──────────────────────────────────────────────
const SortableCard: React.FC<{ task: Task; onOpenDetail: (t: Task) => void }> = ({ task, onOpenDetail }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const checklistProgress = useMemo(() => {
    const all = task.checklists.flatMap(c => c.items);
    if (!all.length) return null;
    const done = all.filter(i => i.is_done).length;
    return { done, total: all.length, pct: Math.round((done / all.length) * 100) };
  }, [task.checklists]);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onOpenDetail(task)}
      className="group cursor-pointer rounded-xl p-3.5 transition-all hover:shadow-md"
      css-var-workaround="true"
      {...({
        style: {
          ...style,
          background:  C.white,
          border:      `1px solid ${C.inkLow}`,
          opacity:     isDragging ? 0.4 : 1,
          boxShadow:   '0 1px 4px rgba(43,43,43,0.05)',
        }
      } as any)}
    >
      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {task.labels.slice(0, 3).map(label => {
            const lc = LABEL_COLORS[label.color] || LABEL_COLORS.blue;
            return (
              <span
                key={label.id}
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: lc.bg, color: lc.text }}
              >
                {label.name}
              </span>
            );
          })}
          {task.labels.length > 3 && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: C.navyMid, color: C.navy }}>
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 cursor-grab active:cursor-grabbing flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <Grip className="h-4 w-4" style={{ color: C.inkMid }} />
        </button>
        <p className="flex-1 text-sm font-bold leading-snug" style={{ color: C.ink }}>
          {task.title}
        </p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 mt-2.5 flex-wrap">
        {task.due_date && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg"
            style={{
              background: isOverdue(task.due_date) ? 'rgba(241,56,28,0.1)' : isDueSoon(task.due_date) ? 'rgba(202,138,4,0.1)' : C.navyMid,
              color:      isOverdue(task.due_date) ? C.red                 : isDueSoon(task.due_date) ? '#ca8a04'               : C.navy,
            }}
          >
            <Clock className="h-3 w-3" /> {formatDate(task.due_date)}
          </span>
        )}
        {checklistProgress && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-black"
            style={{ color: checklistProgress.pct === 100 ? '#1a7a4a' : C.inkMid }}
          >
            <CheckSquare className="h-3 w-3" />
            {checklistProgress.done}/{checklistProgress.total}
          </span>
        )}
        {task.comments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[9px] font-black" style={{ color: C.inkMid }}>
            <MessageSquare className="h-3 w-3" /> {task.comments.length}
          </span>
        )}
      </div>

      {/* Checklist progress bar */}
      {checklistProgress && (
        <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: C.inkLow }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${checklistProgress.pct}%`, background: checklistProgress.pct === 100 ? '#1a7a4a' : C.navy }}
          />
        </div>
      )}
    </div>
  );
};

// ── SortableList ──────────────────────────────────────────────
const SortableList: React.FC<{
  list: List;
  onAddTask: (listId: string, title: string) => void;
  onUpdateListTitle: (listId: string, title: string) => void;
  onDeleteList: (listId: string) => void;
  onOpenTaskDetail: (task: Task) => void;
}> = ({ list, onAddTask, onUpdateListTitle, onDeleteList, onOpenTaskDetail }) => {
  const [isEditing,    setIsEditing]    = useState(false);
  const [title,        setTitle]        = useState(list.title);
  const [isAdding,     setIsAdding]     = useState(false);
  const [newTitle,     setNewTitle]     = useState('');
  const [showMenu,     setShowMenu]     = useState(false);
  const inputRef      = useRef<HTMLInputElement>(null);
  const taskInputRef  = useRef<HTMLInputElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id, data: { type: 'list' } });
  const style = { transform: CSS.Transform.toString(transform), transition };

  useEffect(() => { if (isEditing   && inputRef.current)     { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);
  useEffect(() => { if (isAdding    && taskInputRef.current) { taskInputRef.current.focus(); } }, [isAdding]);

  const saveTitle  = () => { if (title.trim()) onUpdateListTitle(list.id, title.trim()); else setTitle(list.title); setIsEditing(false); };
  const addTask    = () => { if (newTitle.trim()) { onAddTask(list.id, newTitle.trim()); setNewTitle(''); } setIsAdding(false); };
  const activeTasks = list.tasks.filter(t => !t.is_archived);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity:   isDragging ? 0.5 : 1,
        minWidth:  '280px',
        maxWidth:  '280px',
        flexShrink: 0,
      }}
      className="flex flex-col rounded-2xl overflow-hidden"
    >
      {/* Column header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: C.navy }}
      >
        <div className="flex items-center gap-2 flex-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing flex-shrink-0"
            style={{ color: 'rgba(243,236,214,0.4)' }}
          >
            <Grip className="h-4 w-4" />
          </button>
          {isEditing ? (
            <input
              ref={inputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => e.key === 'Enter' && saveTitle()}
              className="flex-1 text-sm font-black uppercase tracking-wider bg-transparent border-b focus:outline-none"
              style={{ color: C.bg, borderColor: 'rgba(243,236,214,0.3)' }}
            />
          ) : (
            <h3
              onClick={() => setIsEditing(true)}
              className="text-xs font-black uppercase tracking-widest cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: C.bg }}
            >
              {list.title}
            </h3>
          )}
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(243,236,214,0.15)', color: 'rgba(243,236,214,0.7)' }}
          >
            {activeTasks.length}
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: 'rgba(243,236,214,0.5)' }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden py-1 min-w-[160px]"
                style={{ background: C.white, border: `1px solid ${C.inkLow}`, boxShadow: `0 8px 24px rgba(43,43,43,0.12)` }}
              >
                <button
                  onClick={() => { onDeleteList(list.id); setShowMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                  style={{ color: C.red }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(241,56,28,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir lista
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Cards container */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ background: 'rgba(243,236,214,0.4)', maxHeight: 'calc(100vh - 280px)' }}
      >
        <SortableContext items={activeTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {activeTasks.length === 0 ? (
            <div
              className="py-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed"
              style={{ borderColor: C.inkLow }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.inkMid }}>
                Sem tarefas
              </p>
            </div>
          ) : (
            activeTasks
              .sort((a, b) => a.position - b.position)
              .map(task => (
                <SortableCard key={task.id} task={task} onOpenDetail={onOpenTaskDetail} />
              ))
          )}
        </SortableContext>
      </div>

      {/* Add card */}
      <div className="p-3" style={{ background: 'rgba(243,236,214,0.4)', borderTop: `1px solid ${C.inkLow}` }}>
        {isAdding ? (
          <div className="space-y-2">
            <input
              ref={taskInputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setIsAdding(false); }}
              placeholder="Título da tarefa…"
              className="w-full px-3 py-2 text-sm rounded-xl border-0 focus:outline-none focus:ring-2"
              style={{
                background: C.white,
                color: C.ink,
                ['--tw-ring-color' as any]: C.navy,
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={addTask}
                className="h-8 px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
                style={{ background: C.navy, color: C.bg }}
              >
                Adicionar
              </button>
              <button onClick={() => setIsAdding(false)} style={{ color: C.inkMid }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
            style={{ color: C.inkMid, background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = C.navyLow)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Plus className="h-4 w-4" /> Adicionar cartão
          </button>
        )}
      </div>
    </div>
  );
};

// ── Task Detail Modal ─────────────────────────────────────────
interface TaskDetailModalProps {
  task: Task; availableLabels: Label[];
  onClose: () => void; onUpdate: (id: string, u: Partial<Task>) => void;
  onDelete: (id: string) => void; onArchive: (id: string) => void;
  onAddChecklist: (id: string, title: string) => void;
  onUpdateChecklistItem: (tid: string, cid: string, iid: string, done: boolean) => void;
  onAddChecklistItem: (tid: string, cid: string, content: string) => void;
  onToggleLabel: (tid: string, label: Label) => void;
  onAddComment: (tid: string, content: string) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task, availableLabels, onClose, onUpdate, onDelete, onArchive,
  onAddChecklist, onUpdateChecklistItem, onAddChecklistItem, onToggleLabel, onAddComment,
}) => {
  const [title,             setTitle]             = useState(task.title);
  const [description,       setDescription]       = useState(task.description || '');
  const [dueDate,           setDueDate]           = useState(task.due_date ? task.due_date.split('T')[0] : '');
  const [showLabels,        setShowLabels]        = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showAddChecklist,  setShowAddChecklist]  = useState(false);
  const [newComment,        setNewComment]        = useState('');
  const [newItemContent,    setNewItemContent]    = useState<Record<string, string>>({});

  const save = () => onUpdate(task.id, { title: title.trim() || task.title, description: description.trim(), due_date: dueDate || null });

  const addChecklist = () => {
    if (newChecklistTitle.trim()) { onAddChecklist(task.id, newChecklistTitle.trim()); setNewChecklistTitle(''); setShowAddChecklist(false); }
  };
  const addComment = () => { if (newComment.trim()) { onAddComment(task.id, newComment.trim()); setNewComment(''); } };

  const clProg = useMemo(() => {
    const all = task.checklists.flatMap(c => c.items);
    if (!all.length) return null;
    const done = all.filter(i => i.is_done).length;
    return { done, total: all.length, pct: Math.round((done / all.length) * 100) };
  }, [task.checklists]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(43,43,43,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: C.bg, border: `1px solid ${C.inkLow}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="px-7 py-5 flex items-start justify-between flex-shrink-0"
          style={{ background: C.navy, borderRadius: '1.5rem 1.5rem 0 0' }}
        >
          <div className="flex-1 pr-4">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={save}
              className="w-full text-xl font-black uppercase tracking-tight bg-transparent border-0 focus:outline-none"
              style={{ color: C.bg }}
              placeholder="Título da tarefa"
            />
            {/* Labels */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {task.labels.map(label => {
                const lc = LABEL_COLORS[label.color] || LABEL_COLORS.blue;
                return (
                  <span
                    key={label.id}
                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(243,236,214,0.12)', color: 'rgba(243,236,214,0.8)' }}
                  >
                    {label.name}
                  </span>
                );
              })}
              <button
                onClick={() => setShowLabels(!showLabels)}
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors"
                style={{ background: 'rgba(243,236,214,0.1)', color: 'rgba(243,236,214,0.5)' }}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {showLabels && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(243,236,214,0.08)' }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(243,236,214,0.4)' }}>
                  Etiquetas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {availableLabels.map(label => {
                    const lc = LABEL_COLORS[label.color] || LABEL_COLORS.blue;
                    const has = task.labels.some(l => l.id === label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => onToggleLabel(task.id, label)}
                        className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full transition-all"
                        style={{
                          background: 'rgba(243,236,214,0.12)',
                          color: 'rgba(243,236,214,0.7)',
                          outline: has ? `2px solid rgba(243,236,214,0.5)` : 'none',
                          outlineOffset: '2px',
                        }}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
            style={{ color: 'rgba(243,236,214,0.5)', background: 'rgba(243,236,214,0.1)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-7 space-y-6">

          {/* Due date */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: C.inkMid }}>
              <Calendar className="h-3.5 w-3.5" /> Data de Entrega
            </label>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={dueDate}
                onChange={e => { setDueDate(e.target.value); setTimeout(save, 0); }}
                className="h-10 px-4 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
                style={{
                  background: C.white,
                  color: C.ink,
                  border: `1px solid ${C.inkLow}`,
                  ['--tw-ring-color' as any]: C.navy,
                }}
              />
              {dueDate && (
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
                  style={{
                    background: isOverdue(dueDate) ? 'rgba(241,56,28,0.1)' : isDueSoon(dueDate) ? 'rgba(202,138,4,0.1)' : C.navyMid,
                    color:      isOverdue(dueDate) ? C.red                  : isDueSoon(dueDate) ? '#ca8a04'              : C.navy,
                  }}
                >
                  {isOverdue(dueDate) ? 'Atrasado' : isDueSoon(dueDate) ? 'Em breve' : 'Agendado'}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: C.inkMid }}>
              <Edit3 className="h-3.5 w-3.5" /> Descrição
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={save}
              placeholder="Adicione uma descrição…"
              className="w-full px-4 py-3 rounded-xl text-sm min-h-[100px] resize-none border-0 focus:outline-none focus:ring-2"
              style={{
                background: C.white,
                color: C.ink,
                border: `1px solid ${C.inkLow}`,
                ['--tw-ring-color' as any]: C.navy,
              }}
            />
          </div>

          {/* Checklists */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: C.inkMid }}>
                <CheckSquare className="h-3.5 w-3.5" /> Checklists
                {clProg && (
                  <span style={{ color: clProg.pct === 100 ? '#1a7a4a' : C.navy }}>
                    ({clProg.pct}%)
                  </span>
                )}
              </label>
              <button
                onClick={() => setShowAddChecklist(true)}
                className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
                style={{ color: C.navy }}
              >
                + Novo checklist
              </button>
            </div>

            {showAddChecklist && (
              <div className="flex gap-2">
                <input
                  value={newChecklistTitle}
                  onChange={e => setNewChecklistTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChecklist()}
                  placeholder="Nome do checklist"
                  autoFocus
                  className="flex-1 h-10 px-3 text-sm rounded-xl border-0 focus:outline-none focus:ring-2"
                  style={{ background: C.white, color: C.ink, border: `1px solid ${C.inkLow}`, ['--tw-ring-color' as any]: C.navy }}
                />
                <button onClick={addChecklist} className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest" style={{ background: C.navy, color: C.bg }}>Criar</button>
                <button onClick={() => setShowAddChecklist(false)} style={{ color: C.inkMid }}><X className="h-4 w-4" /></button>
              </div>
            )}

            {task.checklists.map(cl => {
              const done = cl.items.filter(i => i.is_done).length;
              const pct  = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
              return (
                <div
                  key={cl.id}
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: C.white, border: `1px solid ${C.inkLow}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: C.ink }}>{cl.title}</span>
                    <span className="text-[9px] font-bold" style={{ color: C.inkMid }}>{done}/{cl.items.length}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: C.inkLow }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#1a7a4a' : C.navy }} />
                  </div>
                  <div className="space-y-1">
                    {cl.items.sort((a, b) => a.position - b.position).map(item => (
                      <label key={item.id} className="flex items-center gap-3 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.is_done}
                          onChange={e => onUpdateChecklistItem(task.id, cl.id, item.id, e.target.checked)}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: C.navy }}
                        />
                        <span className="text-sm flex-1" style={{ color: item.is_done ? C.inkMid : C.ink, textDecoration: item.is_done ? 'line-through' : 'none' }}>
                          {item.content}
                        </span>
                      </label>
                    ))}
                  </div>
                  <input
                    value={newItemContent[cl.id] || ''}
                    onChange={e => setNewItemContent({ ...newItemContent, [cl.id]: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newItemContent[cl.id]?.trim()) {
                        onAddChecklistItem(task.id, cl.id, newItemContent[cl.id].trim());
                        setNewItemContent({ ...newItemContent, [cl.id]: '' });
                      }
                    }}
                    placeholder="Adicionar item…"
                    className="w-full px-2 py-1 text-sm bg-transparent border-b focus:outline-none"
                    style={{ borderColor: C.inkLow, color: C.ink }}
                  />
                </div>
              );
            })}
          </div>

          {/* Comments */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: C.inkMid }}>
              <MessageSquare className="h-3.5 w-3.5" /> Comentários ({task.comments.length})
            </label>
            <div className="flex gap-2">
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()}
                placeholder="Escreva um comentário…"
                className="flex-1 h-10 px-4 text-sm rounded-xl border-0 focus:outline-none focus:ring-2"
                style={{ background: C.white, color: C.ink, border: `1px solid ${C.inkLow}`, ['--tw-ring-color' as any]: C.navy }}
              />
              <button
                onClick={addComment}
                disabled={!newComment.trim()}
                className="h-10 px-5 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all hover:opacity-80"
                style={{ background: C.navy, color: C.bg }}
              >
                Enviar
              </button>
            </div>
            <div className="space-y-2">
              {task.comments
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(comment => (
                  <div key={comment.id} className="p-4 rounded-xl" style={{ background: C.white, border: `1px solid ${C.inkLow}` }}>
                    <p className="text-sm" style={{ color: C.ink }}>{comment.content}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider mt-2" style={{ color: C.inkMid }}>
                      {new Date(comment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-7 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: `1px solid ${C.inkLow}`, background: C.white }}
        >
          <div className="flex gap-2">
            <button
              onClick={() => onArchive(task.id)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
              style={{ background: C.navyMid, color: C.navy }}
            >
              <Archive className="h-3.5 w-3.5" /> Arquivar
            </button>
            <button
              onClick={() => { onDelete(task.id); onClose(); }}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
              style={{ background: 'rgba(241,56,28,0.08)', color: C.red }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
          </div>
          <button
            onClick={onClose}
            className="h-9 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
            style={{ background: C.navy, color: C.bg }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
//  MAIN TAREFAS
// ══════════════════════════════════════════════════════════════
const Tarefas: React.FC = () => {
  const [boards,       setBoards]       = useState<Board[]>([]);
  const [currentBoard, setCurrentBoard] = useState<Board | null>(null);
  const [lists,        setLists]        = useState<List[]>([]);
  const [labels,       setLabels]       = useState<Label[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterLabel,  setFilterLabel]  = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'dueSoon' | 'completed'>('all');
  const [showFilters,  setShowFilters]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(true);
  const [activeId,     setActiveId]     = useState<string | null>(null);
  const [activeTask,   setActiveTask]   = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: boardsData } = await supabase.from('boards').select('*').order('created_at', { ascending: true });
      const loadedBoards = boardsData || [];
      setBoards(loadedBoards);
      const defaultBoard = loadedBoards.find((b: Board) => b.id === '00000000-0000-0000-0000-000000000001') || loadedBoards[0];
      if (defaultBoard) { setCurrentBoard(defaultBoard); await loadBoardData(defaultBoard.id); }
    } catch (e) {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadBoardData = async (boardId: string) => {
    try {
      const { data: labelsData }  = await supabase.from('labels').select('*').eq('board_id', boardId);
      setLabels(labelsData || []);
      const { data: listsData }   = await supabase.from('lists').select('*').eq('board_id', boardId).order('position', { ascending: true });
      const listsWithTasks: List[] = [];
      for (const list of listsData || []) {
        const { data: tasksData } = await supabase.from('tasks').select('*').eq('list_id', list.id).order('position', { ascending: true });
        const tasksWithDetails: Task[] = [];
        for (const task of tasksData || []) {
          const { data: tlData }    = await supabase.from('task_labels').select('label_id').eq('task_id', task.id);
          const taskLabels          = (tlData || []).map((tl: any) => labelsData?.find((l: Label) => l.id === tl.label_id)).filter(Boolean) as Label[];
          const { data: clData }    = await supabase.from('checklists').select('*').eq('task_id', task.id).order('position', { ascending: true });
          const checklistsWithItems: Checklist[] = [];
          for (const cl of clData || []) {
            const { data: items } = await supabase.from('checklist_items').select('*').eq('checklist_id', cl.id).order('position', { ascending: true });
            checklistsWithItems.push({ ...cl, items: items || [] });
          }
          const { data: comments } = await supabase.from('task_comments').select('*').eq('task_id', task.id).order('created_at', { ascending: false });
          tasksWithDetails.push({ ...task, labels: taskLabels, checklists: checklistsWithItems, comments: comments || [] });
        }
        listsWithTasks.push({ ...list, tasks: tasksWithDetails });
      }
      setLists(listsWithTasks);
    } catch (e) { console.error(e); }
  };

  // List ops
  const addList = async () => {
    if (!currentBoard) return;
    const { data, error } = await supabase.from('lists').insert({ board_id: currentBoard.id, title: 'Nova Lista', position: lists.length }).select().single();
    if (!error && data) { setLists([...lists, { ...data, tasks: [] }]); toast({ title: 'Lista criada!' }); }
  };
  const updateListTitle = async (id: string, title: string) => {
    await supabase.from('lists').update({ title }).eq('id', id);
    setLists(lists.map(l => l.id === id ? { ...l, title } : l));
  };
  const deleteList = async (id: string) => {
    await supabase.from('lists').delete().eq('id', id);
    setLists(lists.filter(l => l.id !== id));
    toast({ title: 'Lista excluída' });
  };

  // Task ops
  const addTask = async (listId: string, title: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    const { data, error } = await supabase.from('tasks').insert({ list_id: listId, title, position: list.tasks.length, is_archived: false }).select().single();
    if (!error && data) {
      const taskWithDetails: Task = { ...data, labels: [], checklists: [], comments: [] };
      setLists(lists.map(l => l.id === listId ? { ...l, tasks: [...l.tasks, taskWithDetails] } : l));
      toast({ title: 'Tarefa criada!' });
    }
  };
  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    const dbUpdates: any = {};
    if (updates.title       !== undefined) dbUpdates.title       = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.due_date    !== undefined) dbUpdates.due_date    = updates.due_date;
    if (updates.is_archived !== undefined) dbUpdates.is_archived = updates.is_archived;
    if (Object.keys(dbUpdates).length) await supabase.from('tasks').update(dbUpdates).eq('id', taskId);
    setLists(lists.map(l => ({ ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) })));
    if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, ...updates });
  };
  const deleteTask  = async (id: string) => { await supabase.from('tasks').delete().eq('id', id); setLists(lists.map(l => ({ ...l, tasks: l.tasks.filter(t => t.id !== id) }))); toast({ title: 'Tarefa excluída' }); };
  const archiveTask = async (id: string) => { await updateTask(id, { is_archived: true }); setSelectedTask(null); toast({ title: 'Tarefa arquivada' }); };

  // Checklist ops
  const addChecklist = async (taskId: string, title: string) => {
    const task = lists.flatMap(l => l.tasks).find(t => t.id === taskId);
    if (!task) return;
    const { data, error } = await supabase.from('checklists').insert({ task_id: taskId, title, position: task.checklists.length }).select().single();
    if (!error && data) {
      const newCl: Checklist = { ...data, items: [] };
      setLists(lists.map(l => ({ ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, checklists: [...t.checklists, newCl] } : t) })));
      if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, checklists: [...selectedTask.checklists, newCl] });
    }
  };
  const addChecklistItem = async (taskId: string, checklistId: string, content: string) => {
    const task = lists.flatMap(l => l.tasks).find(t => t.id === taskId);
    const cl   = task?.checklists.find(c => c.id === checklistId);
    if (!cl) return;
    const { data, error } = await supabase.from('checklist_items').insert({ checklist_id: checklistId, content, is_done: false, position: cl.items.length }).select().single();
    if (!error && data) {
      const updCl = (cls: Checklist[]) => cls.map(c => c.id === checklistId ? { ...c, items: [...c.items, data] } : c);
      setLists(lists.map(l => ({ ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, checklists: updCl(t.checklists) } : t) })));
      if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, checklists: updCl(selectedTask.checklists) });
    }
  };
  const updateChecklistItem = async (taskId: string, checklistId: string, itemId: string, isDone: boolean) => {
    await supabase.from('checklist_items').update({ is_done: isDone }).eq('id', itemId);
    const updCl = (cls: Checklist[]) => cls.map(c => c.id === checklistId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, is_done: isDone } : i) } : c);
    setLists(lists.map(l => ({ ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, checklists: updCl(t.checklists) } : t) })));
    if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, checklists: updCl(selectedTask.checklists) });
  };

  // Label ops
  const toggleLabel = async (taskId: string, label: Label) => {
    const task = lists.flatMap(l => l.tasks).find(t => t.id === taskId);
    if (!task) return;
    const has = task.labels.some(l => l.id === label.id);
    if (has) {
      await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', label.id);
      const newLabels = task.labels.filter(l => l.id !== label.id);
      setLists(lists.map(l => ({ ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, labels: newLabels } : t) })));
      if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, labels: newLabels });
    } else {
      await supabase.from('task_labels').insert({ task_id: taskId, label_id: label.id });
      const newLabels = [...task.labels, label];
      setLists(lists.map(l => ({ ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, labels: newLabels } : t) })));
      if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, labels: newLabels });
    }
  };

  // Comment ops
  const addComment = async (taskId: string, content: string) => {
    const { data, error } = await supabase.from('task_comments').insert({ task_id: taskId, content }).select().single();
    if (!error && data) {
      setLists(lists.map(l => ({ ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, comments: [data, ...t.comments] } : t) })));
      if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, comments: [data, ...selectedTask.comments] });
    }
  };

  // DnD
  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
    setActiveTask(lists.flatMap(l => l.tasks).find(t => t.id === e.active.id) || null);
  };
  const handleDragOver  = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const aId = active.id as string, oId = over.id as string;
    const aList = lists.find(l => l.tasks.some(t => t.id === aId));
    const oList = lists.find(l => l.id === oId || l.tasks.some(t => t.id === oId));
    if (!aList || !oList || aList.id === oList.id) return;
    setLists(prev => {
      const aTask = aList.tasks.find(t => t.id === aId);
      if (!aTask) return prev;
      return prev.map(list => {
        if (list.id === aList.id) return { ...list, tasks: list.tasks.filter(t => t.id !== aId) };
        if (list.id === oList.id) {
          const oIdx = list.tasks.findIndex(t => t.id === oId);
          const newTasks = [...list.tasks];
          const upd = { ...aTask, list_id: oList.id };
          if (oIdx >= 0) newTasks.splice(oIdx, 0, upd); else newTasks.push(upd);
          return { ...list, tasks: newTasks };
        }
        return list;
      });
    });
  };
  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null); setActiveTask(null);
    if (!over) return;
    const aId = active.id as string, oId = over.id as string;
    const aList = lists.find(l => l.tasks.some(t => t.id === aId));
    const oList = lists.find(l => l.id === oId || l.tasks.some(t => t.id === oId));
    if (!aList || !oList) return;
    if (aList.id === oList.id) {
      const oi = aList.tasks.findIndex(t => t.id === aId), ni = aList.tasks.findIndex(t => t.id === oId);
      if (oi !== ni) {
        const newTasks = arrayMove(aList.tasks, oi, ni).map((t, i) => ({ ...t, position: i }));
        setLists(lists.map(l => l.id === aList.id ? { ...l, tasks: newTasks } : l));
        for (const t of newTasks) await supabase.from('tasks').update({ position: t.position }).eq('id', t.id);
      }
    } else {
      await supabase.from('tasks').update({ list_id: oList.id, position: oList.tasks.length }).eq('id', aId);
    }
  };

  const filteredLists = useMemo(() => lists.map(list => ({
    ...list,
    tasks: list.tasks.filter(task => {
      if (task.is_archived) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
      }
      if (filterLabel && !task.labels.some(l => l.id === filterLabel)) return false;
      if (filterStatus === 'overdue'   && (!task.due_date || !isOverdue(task.due_date))) return false;
      if (filterStatus === 'dueSoon'   && (!task.due_date || !isDueSoon(task.due_date))) return false;
      if (filterStatus === 'completed') {
        const all = task.checklists.flatMap(c => c.items);
        if (!all.length || !all.every(i => i.is_done)) return false;
      }
      return true;
    }),
  })), [lists, searchQuery, filterLabel, filterStatus]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: `${C.navy} transparent ${C.navy} ${C.navy}` }} />
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.inkMid }}>Carregando…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:pl-20 pb-20 md:pb-0" style={{ background: C.bg }}>

      {/* ── Header ─────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 px-5 md:px-8 py-3 flex items-center gap-4"
        style={{
          background:    'rgba(243,236,214,0.9)',
          backdropFilter:'blur(12px)',
          borderBottom:  `1px solid ${C.inkLow}`,
        }}
      >
        <div className="flex items-center gap-3 flex-shrink-0">
          <Layout className="h-5 w-5" style={{ color: C.navy }} />
          <h1 className="text-base font-black uppercase tracking-widest hidden sm:block" style={{ color: C.ink }}>
            {currentBoard?.title || 'Tarefas'}
          </h1>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.inkMid }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar tarefas…"
            className="w-full pl-10 pr-4 h-10 rounded-xl text-sm border-0 focus:outline-none focus:ring-2"
            style={{ background: C.white, color: C.ink, boxShadow: `0 1px 4px ${C.inkLow}`, ['--tw-ring-color' as any]: C.navy }}
          />
        </div>

        {/* Filters */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
          style={{
            background: showFilters || filterLabel || filterStatus !== 'all' ? C.navy : C.white,
            color:      showFilters || filterLabel || filterStatus !== 'all' ? C.bg   : C.inkMid,
            border:     `1px solid ${C.inkLow}`,
          }}
        >
          <Filter className="h-3.5 w-3.5" /> Filtros
        </button>
      </header>

      {/* Filter panel */}
      {showFilters && (
        <div
          className="px-5 md:px-8 py-4 flex flex-wrap gap-4 items-end"
          style={{ background: C.white, borderBottom: `1px solid ${C.inkLow}` }}
        >
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.inkMid }}>Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="h-9 px-3 rounded-xl text-xs font-bold border-0 focus:outline-none"
              style={{ background: C.bg, color: C.ink }}
            >
              <option value="all">Todos</option>
              <option value="overdue">Atrasados</option>
              <option value="dueSoon">Em breve</option>
              <option value="completed">Concluídos</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest" style={{ color: C.inkMid }}>Etiqueta</label>
            <select
              value={filterLabel || ''}
              onChange={e => setFilterLabel(e.target.value || null)}
              className="h-9 px-3 rounded-xl text-xs font-bold border-0 focus:outline-none"
              style={{ background: C.bg, color: C.ink }}
            >
              <option value="">Todas</option>
              {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {(filterLabel || filterStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => { setFilterLabel(null); setFilterStatus('all'); setSearchQuery(''); }}
              className="h-9 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:opacity-80"
              style={{ background: 'rgba(241,56,28,0.08)', color: C.red }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Board ──────────────────────────────────── */}
      <main className="flex-1 overflow-x-auto p-5 md:p-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 pb-4 min-h-[calc(100vh-200px)] items-start">
            <SortableContext
              items={filteredLists.map(l => l.id)}
              strategy={horizontalListSortingStrategy}
            >
              {filteredLists
                .sort((a, b) => a.position - b.position)
                .map(list => (
                  <SortableList
                    key={list.id}
                    list={list}
                    onAddTask={addTask}
                    onUpdateListTitle={updateListTitle}
                    onDeleteList={deleteList}
                    onOpenTaskDetail={setSelectedTask}
                  />
                ))}
            </SortableContext>

            {/* Add list */}
            <button
              onClick={addList}
              className="flex-shrink-0 w-[280px] h-[72px] flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-all hover:opacity-80"
              style={{ borderColor: C.inkLow, color: C.inkMid }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.navy; (e.currentTarget as HTMLElement).style.color = C.navy; (e.currentTarget as HTMLElement).style.background = C.navyLow; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.inkLow; (e.currentTarget as HTMLElement).style.color = C.inkMid; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-widest">Adicionar lista</span>
            </button>
          </div>

          <DragOverlay>
            {activeTask && (
              <div
                className="rounded-xl p-3.5 shadow-2xl rotate-[2deg]"
                style={{ background: C.white, border: `1px solid ${C.navy}`, opacity: 0.95, width: '280px' }}
              >
                <p className="text-sm font-bold" style={{ color: C.ink }}>{activeTask.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          availableLabels={labels}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onArchive={archiveTask}
          onAddChecklist={addChecklist}
          onUpdateChecklistItem={updateChecklistItem}
          onAddChecklistItem={addChecklistItem}
          onToggleLabel={toggleLabel}
          onAddComment={addComment}
        />
      )}
    </div>
  );
};

export default Tarefas;