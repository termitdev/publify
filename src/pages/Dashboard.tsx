import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Send, FileText, Download, Eye,
  Trash2, Layers, Search,
  Info, TrendingUp, UserCheck, UserPlus,
  Clock, CheckCircle2, AlertCircle, Plus, X,
  Filter, ArrowUpRight, Zap,
  MessageSquare, FolderOpen, Upload,
  TriangleAlert, UserX, TimerReset, Activity,
  ChevronLeft,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, startOfWeek, isAfter } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog as ChecklistDialog,
  DialogContent as ChecklistDialogContent,
  DialogHeader as ChecklistDialogHeader,
  DialogTitle as ChecklistDialogTitle,
  DialogTrigger as ChecklistDialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import useEmblaCarousel from 'embla-carousel-react';
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { UiverseLoader } from '@/components/UiverseLoader';

// ── Design Tokens ─────────────────────────────────────────────
const T = {
  bg:        '#fcfcfc',
  primary:   '#003223',
  accent:    '#ff6400',
  soft:      '#f5ebe1',
  highlight: '#bcc850',
  card:      '#ffffff',
  border:    'rgba(0,0,0,0.05)',
  muted:     '#6b7280',
  mutedLow:  'rgba(107,114,128,0.08)',
  ink:       '#111827',
  primaryLo: 'rgba(0,50,35,0.06)',
};

// ── Types ─────────────────────────────────────────────────────
interface UserProfile {
  id:         string;
  user_id:    string;
  full_name:  string | null;
  email:      string | null;
  avatar_url: string | null;
}

interface Submission {
  id:               string;
  author_name:      string;
  author_email:     string;
  photo_file_url?:  string | null;
  book_coordinator?: string | null;
  submission_type:  'solo' | 'coautoria';
  chapter_title:    string | null;
  chapter_content:  string;
  curriculum:       string;
  summary:          string;
  status:           'novo' | 'recebido' | 'em_analise' | 'solicitar_ajustes' | 'concluido';
  created_at:       string;
  book_id:          string | null;
  assigned_to:      string | null;
  assigned_user?:   { full_name: string | null; avatar_url: string | null } | null;
}

interface Book {
  id:         string;
  name:       string;
  cover_url:  string | null;
  created_at: string;
}

interface ActivityEvent {
  id:         string;
  actor:      string;
  action:     string;
  target:     string;
  created_at: string;
  avatar_url?: string | null;
}

// ── Filter State ───────────────────────────────────────────────
interface FilterState {
  status:      string;
  authorName:  string;
  assigneeId:  string;
  dateFrom:    string;
  dateTo:      string;
  priorityKey: string;
}

const DEFAULT_FILTERS: FilterState = {
  status:      '',
  authorName:  '',
  assigneeId:  '',
  dateFrom:    '',
  dateTo:      '',
  priorityKey: '',
};

const CHECKLIST_DATA = {
  'CAPA':  ['Formato','Orelhas','Lombada','Nome autor','ISBN barcode','Verniz localizado'],
  'MIOLO': ['Copyright','Ficha Catalográfica','Sumário','Numeração páginas','Referências ABNT','Nova Ortografia'],
};

// ── Status helpers ────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  novo:              { label: 'Novo',       color: T.primary,  bg: T.primaryLo },
  recebido:          { label: 'Em Revisão', color: '#92710a',  bg: 'rgba(146,113,10,0.08)' },
  em_analise:        { label: 'Em Análise', color: '#92710a',  bg: 'rgba(146,113,10,0.08)' },
  solicitar_ajustes: { label: 'Ajustes',    color: T.accent,   bg: 'rgba(255,100,0,0.08)' },
  concluido:         { label: 'Aprovado',   color: '#1a6e40',  bg: 'rgba(26,110,64,0.08)' },
};

// ── Util ──────────────────────────────────────────────────────
const avatarSrc = (url: string | null | undefined, seed: string) =>
  url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;

// ── Custom hook: isMobile ─────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

// ── BookChecklist ─────────────────────────────────────────────
const BookChecklistContent = ({ bookId, onUpdate }: { bookId: string; onUpdate: (v: number) => void }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const s = localStorage.getItem(`checklist-${bookId}`);
    return s ? JSON.parse(s) : {};
  });
  const toggle = (item: string) => {
    const n = { ...checked, [item]: !checked[item] };
    setChecked(n);
    localStorage.setItem(`checklist-${bookId}`, JSON.stringify(n));
    const total = Object.values(CHECKLIST_DATA).flat().length;
    const done  = Object.values(n).filter(Boolean).length;
    onUpdate(Math.round((done / total) * 100));
  };
  return (
    <ScrollArea className="h-[50vh] pr-2">
      <Accordion type="multiple" className="w-full">
        {Object.entries(CHECKLIST_DATA).map(([cat, items]) => (
          <AccordionItem value={cat} key={cat} className="border-b" style={{ borderColor: T.border }}>
            <AccordionTrigger className="text-[10px] font-semibold uppercase tracking-widest py-4" style={{ color: T.primary }}>
              {cat}
            </AccordionTrigger>
            <AccordionContent className="space-y-1 pb-4">
              {items.map(item => (
                <div
                  key={item}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors"
                  style={{ background: checked[item] ? T.primaryLo : 'transparent' }}
                >
                  <Checkbox
                    id={`${bookId}-${item}`}
                    checked={!!checked[item]}
                    onCheckedChange={() => toggle(item)}
                  />
                  <label htmlFor={`${bookId}-${item}`} className="text-sm cursor-pointer select-none" style={{ color: checked[item] ? T.primary : T.muted }}>
                    {item}
                  </label>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );
};

// ── BookCard ──────────────────────────────────────────────────
const BookCard = ({ book, isSelected, onClick, onDelete, chaptersCount }: any) => {
  const [progress, setProgress] = useState(() => {
    const s = localStorage.getItem(`checklist-${book.id}`);
    if (!s) return 0;
    const c = JSON.parse(s);
    const t = Object.values(CHECKLIST_DATA).flat().length;
    return Math.round((Object.values(c).filter(Boolean).length / t) * 100);
  });
  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-36 sm:w-44 cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 group"
      style={{
        border:     `1.5px solid ${isSelected ? T.primary : T.border}`,
        background: isSelected ? T.card : 'rgba(255,255,255,0.7)',
        boxShadow:  isSelected ? `0 4px 20px rgba(0,50,35,0.12)` : `0 1px 4px rgba(0,0,0,0.04)`,
        transform:  isSelected ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      <div className="relative h-44 sm:h-56 overflow-hidden" style={{ background: T.soft }}>
        {book.cover_url ? (
          <img src={book.cover_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={book.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-10 w-10 opacity-25" style={{ color: T.primary }} />
          </div>
        )}
        <div className="absolute bottom-0 left-0 w-full h-[4px]" style={{ background: 'rgba(0,0,0,0.06)' }}>
          <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: progress === 100 ? '#1a6e40' : T.primary }} />
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-150">
          <button
            className="h-7 w-7 flex items-center justify-center rounded-lg"
            style={{ background: T.accent, color: '#fff' }}
            onClick={e => { e.stopPropagation(); onDelete(book.id); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-2.5 sm:p-3 space-y-2.5">
        <h3 className="font-semibold text-[11px] sm:text-[12px] leading-tight truncate" style={{ color: T.ink }}>{book.name}</h3>
        <p className="text-[9px] font-medium uppercase tracking-widest" style={{ color: T.muted }}>
          {chaptersCount} cap. · {progress}%
        </p>
        <ChecklistDialog>
          <ChecklistDialogTrigger asChild>
            <button
              className="w-full h-8 rounded-lg text-[9px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all hover:opacity-80"
              style={{ background: T.primaryLo, color: T.primary }}
              onClick={e => e.stopPropagation()}
            >
              <Layers className="h-3 w-3" /> Checklist
            </button>
          </ChecklistDialogTrigger>
          <ChecklistDialogContent className="rounded-2xl mx-4 sm:mx-0" style={{ background: T.bg, borderColor: T.border }}>
            <ChecklistDialogHeader>
              <ChecklistDialogTitle className="font-semibold text-base" style={{ color: T.ink }}>
                {book.name}
              </ChecklistDialogTitle>
            </ChecklistDialogHeader>
            <BookChecklistContent bookId={book.id} onUpdate={setProgress} />
          </ChecklistDialogContent>
        </ChecklistDialog>
      </div>
    </div>
  );
};

// ── New Project Dialog ────────────────────────────────────────
const NewProjectDialog = ({ onCreated }: { onCreated: () => void }) => {
  const [open,      setOpen]      = useState(false);
  const [name,      setName]      = useState('');
  const [coverUrl,  setCoverUrl]  = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected after an error
    e.target.value = '';
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `covers/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('book-covers').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('book-covers').getPublicUrl(path);
      setCoverUrl(urlData.publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({
        title: 'Erro ao enviar capa',
        description: err?.message ?? 'Verifique as permissões do bucket e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('books').insert({ name: name.trim(), cover_url: coverUrl || null });
    setSaving(false);
    if (!error) {
      toast({ title: 'Projeto criado' });
      setOpen(false);
      setName('');
      setCoverUrl('');
      onCreated();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all hover:opacity-80"
        style={{ background: T.primaryLo, color: T.primary }}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Novo Projeto</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md mx-4 sm:mx-auto" style={{ background: T.bg, borderColor: T.border }}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: T.ink }}>Novo Projeto</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: T.muted }}>
              Crie um projeto (livro) para organizar capítulos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                Nome do Projeto *
              </label>
              <Input
                className="h-10 rounded-xl border-0 text-sm"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.ink }}
                placeholder="Ex.: Gestão e Liderança 2025"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
                Capa do Livro
              </label>
              <div
                className="relative h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                style={{ borderColor: T.border, background: T.soft }}
                onClick={() => document.getElementById('cover-upload')?.click()}
              >
                {coverUrl ? (
                  <>
                    <img src={coverUrl} className="absolute inset-0 w-full h-full object-cover" alt="capa" />
                    <button
                      className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-lg z-10"
                      style={{ background: T.accent, color: '#fff' }}
                      onClick={e => { e.stopPropagation(); setCoverUrl(''); }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 opacity-40" style={{ color: T.primary }} />
                    <span className="text-[10px] font-medium" style={{ color: T.muted }}>
                      {uploading ? 'Enviando…' : 'Clique para enviar imagem'}
                    </span>
                  </>
                )}
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium"
                style={{ background: T.mutedLow, color: T.muted }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider disabled:opacity-40 transition-all hover:opacity-80"
                style={{ background: T.primary, color: '#fff' }}
              >
                {saving ? 'Criando…' : 'Criar Projeto'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── KPI Card ──────────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, trend, onClick,
  variant = 'default',
}: {
  icon: any; label: string; value: number | string;
  trend?: number;
  onClick?: () => void;
  variant?: 'default' | 'soft' | 'highlight' | 'accent';
}) => {
  const variants = {
    default:   { bg: T.card,      valueCo: T.primary, iconBg: T.primaryLo,           iconCo: T.primary },
    soft:      { bg: T.soft,      valueCo: T.primary, iconBg: 'rgba(0,50,35,0.08)',   iconCo: T.primary },
    highlight: { bg: T.highlight, valueCo: T.primary, iconBg: 'rgba(0,0,0,0.08)',     iconCo: T.primary },
    accent:    { bg: T.card,      valueCo: T.accent,  iconBg: 'rgba(255,100,0,0.08)', iconCo: T.accent  },
  };
  const v = variants[variant];
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-4 sm:p-5 flex flex-col gap-3 transition-all hover:shadow-md ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      style={{ background: v.bg, border: `1px solid ${T.border}`, boxShadow: variant === 'default' ? `0 1px 3px rgba(0,0,0,0.04)` : 'none' }}
    >
      <div className="flex items-start justify-between">
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center" style={{ background: v.iconBg }}>
          <Icon className="h-4 w-4" style={{ color: v.iconCo }} />
        </div>
        {trend !== undefined && (
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5"
            style={{ background: trend >= 0 ? 'rgba(26,110,64,0.08)' : 'rgba(255,100,0,0.08)', color: trend >= 0 ? '#1a6e40' : T.accent }}
          >
            <ArrowUpRight className="h-2.5 w-2.5" style={{ transform: trend < 0 ? 'rotate(90deg)' : 'none' }} />
            {trend >= 0 ? '+' : ''}{trend} sem.
          </span>
        )}
      </div>
      <div>
        <p className="text-xs mb-1" style={{ color: T.muted }}>{label}</p>
        <p className="text-2xl sm:text-3xl font-semibold leading-none" style={{ color: v.valueCo }}>{value}</p>
      </div>
    </div>
  );
};

// ── Priorities Section ────────────────────────────────────────
const PrioritiesSection = ({
  submissions,
  onFilter,
}: {
  submissions: Submission[];
  onFilter:    (key: string) => void;
}) => {
  const unassigned  = submissions.filter(s => !s.assigned_to).length;
  const stale       = submissions.filter(s =>
    (s.status === 'recebido' || s.status === 'em_analise') &&
    differenceInDays(new Date(), new Date(s.created_at)) > 5
  ).length;
  const adjustments = submissions.filter(s => s.status === 'solicitar_ajustes').length;

  const items = [
    { key: 'unassigned',  icon: UserX,        label: 'Sem Responsável', count: unassigned,  color: '#92710a', bg: 'rgba(146,113,10,0.06)' },
    { key: 'stale',       icon: TimerReset,    label: 'Em Revisão +5d',  count: stale,       color: T.accent,  bg: 'rgba(255,100,0,0.06)' },
    { key: 'adjustments', icon: TriangleAlert, label: 'Aguard. Ajustes', count: adjustments, color: '#b91c1c', bg: 'rgba(185,28,28,0.06)' },
  ];

  if (unassigned + stale + adjustments === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 mb-6"
      style={{ background: '#fffbf0', border: `1.5px solid rgba(146,113,10,0.15)`, boxShadow: `0 1px 3px rgba(0,0,0,0.03)` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-3.5 w-3.5" style={{ color: '#92710a' }} />
        <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#92710a' }}>
          Ações Prioritárias
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(({ key, icon: Icon, label, count, color, bg }) => (
          <button
            key={key}
            onClick={() => onFilter(key)}
            disabled={count === 0}
            className="flex items-center gap-3 p-3 sm:p-4 rounded-xl text-left transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-default"
            style={{ background: bg, border: `1px solid ${color}20` }}
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none" style={{ color }}>{count}</p>
              <p className="text-[9px] font-medium mt-1 leading-tight" style={{ color }}>{label}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Advanced Filters Bar ──────────────────────────────────────
const FilterBar = ({
  filters,
  profiles,
  onChange,
  onReset,
}: {
  filters:  FilterState;
  profiles: UserProfile[];
  onChange: (f: Partial<FilterState>) => void;
  onReset:  () => void;
}) => {
  const [open, setOpen] = useState(false);
  const hasFilters = Object.entries(filters).some(([k, v]) => v && k !== 'priorityKey');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-9 flex items-center gap-2 px-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all"
          style={{
            background: hasFilters ? T.primary : T.mutedLow,
            color:      hasFilters ? '#fff'     : T.muted,
            border:     `1px solid ${hasFilters ? T.primary : 'transparent'}`,
          }}
        >
          <Filter className="h-3 w-3" />
          <span className="hidden sm:inline">Filtros</span>
          {hasFilters && (
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[8px]" style={{ background: T.accent }}>
              !
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 rounded-2xl p-4 space-y-4"
        style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 8px 32px rgba(0,0,0,0.12)` }}
        align="end"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>Filtros</span>
          {hasFilters && (
            <button onClick={onReset} className="text-[9px] font-medium flex items-center gap-1" style={{ color: T.accent }}>
              <X className="h-2.5 w-2.5" /> Limpar
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>Status</label>
          <Select value={filters.status || '__all'} onValueChange={v => onChange({ status: v === '__all' ? '' : v })}>
            <SelectTrigger className="h-9 rounded-xl border-0 text-xs" style={{ background: T.bg }}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="rounded-xl" style={{ background: T.card, borderColor: T.border }}>
              <SelectItem value="__all">Todos</SelectItem>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>Responsável</label>
          <Select value={filters.assigneeId || '__all'} onValueChange={v => onChange({ assigneeId: v === '__all' ? '' : v })}>
            <SelectTrigger className="h-9 rounded-xl border-0 text-xs" style={{ background: T.bg }}>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="rounded-xl" style={{ background: T.card, borderColor: T.border }}>
              <SelectItem value="__all">Todos</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.user_id}>
                  {p.full_name ?? p.email ?? 'Usuário'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>De</label>
            <Input
              type="date"
              className="h-9 rounded-xl border-0 text-xs"
              style={{ background: T.bg }}
              value={filters.dateFrom}
              onChange={e => onChange({ dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: T.muted }}>Até</label>
            <Input
              type="date"
              className="h-9 rounded-xl border-0 text-xs"
              style={{ background: T.bg }}
              value={filters.dateTo}
              onChange={e => onChange({ dateTo: e.target.value })}
            />
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-full h-9 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all hover:opacity-80"
          style={{ background: T.primary, color: '#fff' }}
        >
          Aplicar
        </button>
      </PopoverContent>
    </Popover>
  );
};

// ── AssignDropdown ────────────────────────────────────────────
const AssignDropdown = ({
  currentAssigneeId,
  submissionId,
  onAssigned,
  compact = false,
}: {
  currentAssigneeId: string | null;
  submissionId:      string;
  onAssigned:        (profile: UserProfile) => void;
  compact?:          boolean;
}) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, user_id, full_name, email, avatar_url')
      .then(({ data }) => setProfiles((data as UserProfile[]) || []));
  }, []);

  const current = profiles.find(p => p.user_id === currentAssigneeId || p.id === currentAssigneeId);

  const handleChange = async (profileId: string) => {
    const chosen = profiles.find(p => p.id === profileId);
    if (!chosen) return;
    setLoading(true);
    await supabase
      .from('chapter_submissions')
      .update({ assigned_to: chosen.user_id })
      .eq('id', submissionId);
    setLoading(false);
    onAssigned(chosen);
  };

  return (
    <Select value={current?.id ?? ''} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger
        className={`h-9 rounded-xl border-0 text-[10px] font-medium gap-2 px-2.5 ${compact ? 'min-w-[120px]' : 'min-w-[140px]'}`}
        style={{ background: T.primaryLo, color: T.primary }}
        onClick={e => e.stopPropagation()}
      >
        {current ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <Avatar className="h-5 w-5 rounded-md overflow-hidden flex-shrink-0">
              <AvatarImage src={avatarSrc(current.avatar_url, current.full_name ?? 'U')} className="object-cover" />
              <AvatarFallback className="text-[8px] rounded-md" style={{ background: T.soft, color: T.primary }}>
                {(current.full_name ?? 'U').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!compact && (
              <div className="min-w-0 text-left">
                <p className="truncate text-[10px] font-semibold leading-none" style={{ color: T.primary }}>
                  {current.full_name ?? 'Usuário'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: T.muted }}>
            <UserPlus className="h-3 w-3" />
            {!compact && 'Atribuir…'}
          </div>
        )}
      </SelectTrigger>
      <SelectContent className="rounded-xl" style={{ background: T.card, borderColor: T.border }}>
        {profiles.map(p => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex items-center gap-2.5">
              <Avatar className="h-6 w-6 rounded-md overflow-hidden flex-shrink-0">
                <AvatarImage src={avatarSrc(p.avatar_url, p.full_name ?? 'U')} className="object-cover" />
                <AvatarFallback className="text-[8px] rounded-md" style={{ background: T.soft, color: T.primary }}>
                  {(p.full_name ?? 'U').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-medium" style={{ color: T.ink }}>{p.full_name ?? 'Usuário'}</p>
                {p.email && <p className="text-[9px]" style={{ color: T.muted }}>{p.email}</p>}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ── CommentThread ─────────────────────────────────────────────
const CommentThread = ({
  submissionId,
  currentUser,
}: {
  submissionId: string;
  currentUser:  UserProfile | null;
}) => {
  const [comments,   setComments]   = useState<string[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const { toast } = useToast();

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('chapter_submissions')
      .select('comments')
      .eq('id', submissionId)
      .single();
    setComments(data?.comments ?? []);
    setLoaded(true);
  }, [submissionId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async () => {
    const text = newComment.trim();
    if (!text || submitting) return;
    if (!currentUser) {
      toast({ title: 'Faça login para comentar', variant: 'destructive' });
      return;
    }
    const label     = currentUser.full_name ?? currentUser.email ?? 'Usuário';
    const timestamp = format(new Date(), 'dd/MM HH:mm');
    const entry     = `${label} (${timestamp}): ${text}`;
    setSubmitting(true);
    setNewComment('');
    setComments(prev => [...prev, entry]);
    const { error } = await supabase
      .from('chapter_submissions')
      .update({ comments: [...comments, entry] })
      .eq('id', submissionId);
    setSubmitting(false);
    if (error) {
      console.error('Comment error:', error);
      setComments(prev => prev.filter(c => c !== entry));
      setNewComment(text);
      toast({ title: 'Erro ao enviar comentário', variant: 'destructive' });
    } else {
      toast({ title: 'Comentário registrado' });
      await loadComments();
    }
  };

  return (
    <div className="h-full flex flex-col outline-none">
      <ScrollArea className="flex-1 p-4 sm:p-8">
        <div className="space-y-3 max-w-xl mx-auto">
          {!loaded && (
            <p className="text-center text-xs py-10" style={{ color: T.muted }}>Carregando comentários…</p>
          )}
          {loaded && comments.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <MessageSquare className="h-8 w-8 opacity-20" style={{ color: T.primary }} />
              <p className="text-xs" style={{ color: T.muted }}>Nenhum comentário ainda</p>
            </div>
          )}
          {comments.map((c, i) => {
            const match     = c.match(/^(.+?) \((\d{2}\/\d{2} \d{2}:\d{2})\): (.+)$/s);
            const name      = match?.[1] ?? 'Usuário';
            const timestamp = match?.[2] ?? '';
            const content   = match?.[3] ?? c;
            return (
              <div key={i} className="flex gap-3">
                <Avatar className="h-8 w-8 rounded-xl flex-shrink-0 overflow-hidden">
                  <AvatarFallback className="font-semibold text-[10px] rounded-xl" style={{ background: T.soft, color: T.primary }}>
                    {name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-xl p-3 sm:p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: T.primary }}>{name}</span>
                    <span className="text-[9px]" style={{ color: T.muted }}>{timestamp}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: T.ink }}>{content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="p-4 sm:p-5 flex gap-3 flex-shrink-0" style={{ borderTop: `1px solid ${T.border}`, background: T.card }}>
        <Input
          className="flex-1 h-11 rounded-xl text-sm border-0 focus-visible:ring-1"
          placeholder="Escrever comentário…"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          disabled={submitting}
          style={{ background: T.bg, color: T.ink } as React.CSSProperties}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          className="h-11 w-11 flex items-center justify-center rounded-xl flex-shrink-0 transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
          style={{ background: T.primary, color: '#fff', boxShadow: `0 4px 12px rgba(0,50,35,0.2)` }}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Activity Feed ─────────────────────────────────────────────
const ActivityFeed = ({ submissions }: { submissions: Submission[] }) => {
  const events = useMemo<ActivityEvent[]>(() => {
    const result: ActivityEvent[] = [];
    [...submissions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
      .forEach(s => {
        const actor = s.assigned_user?.full_name ?? s.author_name;
        let action = 'submeteu capítulo';
        if (s.status === 'concluido')         action = 'aprovou capítulo';
        if (s.status === 'solicitar_ajustes') action = 'solicitou ajustes em';
        if (s.assigned_to)                    action = `atribuiu responsável para`;
        result.push({
          id:         s.id,
          actor,
          action,
          target:     s.chapter_title ?? 'Sem título',
          created_at: s.created_at,
          avatar_url: s.assigned_user?.avatar_url ?? s.photo_file_url,
        });
      });
    return result;
  }, [submissions]);

  return (
    <div className="rounded-2xl p-4 sm:p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
      <div className="flex items-center gap-2 mb-5">
        <Activity className="h-3.5 w-3.5" style={{ color: T.primary }} />
        <h2 className="text-sm font-semibold" style={{ color: T.ink }}>Atividade Recente</h2>
      </div>
      <div className="space-y-1">
        {events.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: T.muted }}>Sem atividade ainda</p>
        )}
        {events.map(ev => (
          <div key={ev.id} className="flex items-start gap-3 py-2.5 px-2 rounded-xl hover:bg-gray-50 transition-colors">
            <Avatar className="h-7 w-7 rounded-lg flex-shrink-0 overflow-hidden mt-0.5">
              <AvatarImage src={avatarSrc(ev.avatar_url, ev.actor)} />
              <AvatarFallback className="text-[8px] font-semibold rounded-lg" style={{ background: T.soft, color: T.primary }}>
                {ev.actor.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-snug" style={{ color: T.ink }}>
                <span className="font-semibold">{ev.actor}</span>{' '}
                <span style={{ color: T.muted }}>{ev.action}</span>{' '}
                <span className="font-medium truncate">{ev.target}</span>
              </p>
              <p className="text-[9px] mt-0.5" style={{ color: T.muted }}>
                {format(new Date(ev.created_at), 'dd/MM HH:mm')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Pipeline Panel ────────────────────────────────────────────
const PipelinePanel = ({
  submissions,
  activeStatus,
  onFilterStatus,
}: {
  submissions:    Submission[];
  activeStatus:   string;
  onFilterStatus: (s: string) => void;
}) => {
  const weekStart = startOfWeek(new Date());
  const weekCounts = useMemo(() => {
    const m: Record<string, number> = {};
    submissions.forEach(s => {
      if (isAfter(new Date(s.created_at), weekStart)) {
        m[s.status] = (m[s.status] ?? 0) + 1;
      }
    });
    return m;
  }, [submissions, weekStart]);

  return (
    <div className="rounded-2xl p-4 sm:p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold" style={{ color: T.ink }}>Pipeline</h2>
        {activeStatus && (
          <button
            onClick={() => onFilterStatus('')}
            className="text-[9px] font-medium flex items-center gap-1"
            style={{ color: T.accent }}
          >
            <X className="h-2.5 w-2.5" /> Limpar
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {Object.entries(STATUS_MAP).map(([key, meta]) => {
          const count    = submissions.filter(s => s.status === key).length;
          const pct      = submissions.length ? Math.round((count / submissions.length) * 100) : 0;
          const week     = weekCounts[key] ?? 0;
          const isActive = activeStatus === key;
          return (
            <button
              key={key}
              onClick={() => onFilterStatus(isActive ? '' : key)}
              className="w-full text-left rounded-xl p-3 transition-all hover:scale-[1.01]"
              style={{
                background: isActive ? T.primaryLo : 'transparent',
                border:     `1px solid ${isActive ? T.primary : 'transparent'}`,
              }}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium" style={{ color: T.ink }}>{meta.label}</span>
                <div className="flex items-center gap-2">
                  {week > 0 && (
                    <span className="text-[8px] font-semibold" style={{ color: '#1a6e40' }}>+{week} sem.</span>
                  )}
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color: meta.color }}>{count}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.color }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── Assign to Project ─────────────────────────────────────────
const AssignProjectDropdown = ({
  submissionId,
  currentBookId,
  books,
  onAssigned,
}: {
  submissionId:  string;
  currentBookId: string | null;
  books:         Book[];
  onAssigned:    (bookId: string | null) => void;
}) => {
  const [saving, setSaving] = useState(false);

  const handleChange = async (val: string) => {
    const bookId = val === '__none' ? null : val;
    setSaving(true);
    await supabase.from('chapter_submissions').update({ book_id: bookId }).eq('id', submissionId);
    setSaving(false);
    onAssigned(bookId);
  };

  return (
    <Select value={currentBookId ?? '__none'} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger
        className="h-9 rounded-xl border-0 text-xs font-medium w-full"
        style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }}
      >
        <FolderOpen className="h-3.5 w-3.5 mr-2 flex-shrink-0" style={{ color: T.muted }} />
        <SelectValue placeholder="Selecionar projeto…" />
      </SelectTrigger>
      <SelectContent className="rounded-xl" style={{ background: T.card, borderColor: T.border }}>
        <SelectItem value="__none">
          <span style={{ color: T.muted }}>Sem projeto</span>
        </SelectItem>
        {books.map(b => (
          <SelectItem key={b.id} value={b.id}>
            <div className="flex items-center gap-2">
              {b.cover_url ? (
                <img src={b.cover_url} className="h-5 w-4 object-cover rounded" alt={b.name} />
              ) : (
                <BookOpen className="h-3.5 w-3.5" style={{ color: T.muted }} />
              )}
              <span className="text-xs">{b.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ── Mobile Submission Card ────────────────────────────────────
const MobileSubmissionCard = ({
  s,
  books,
  onOpen,
  onDownload,
  onAssigned,
}: {
  s:          Submission;
  books:      Book[];
  onOpen:     () => void;
  onDownload: () => void;
  onAssigned: (p: UserProfile) => void;
}) => {
  const st = STATUS_MAP[s.status] || STATUS_MAP.novo;
  return (
    <div
      className="rounded-2xl p-4 space-y-3 cursor-pointer transition-all active:scale-[0.99]"
      style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 rounded-xl flex-shrink-0 overflow-hidden">
            <AvatarImage src={avatarSrc(s.photo_file_url, s.author_name)} className="object-cover" />
            <AvatarFallback className="text-[10px] font-semibold rounded-xl" style={{ background: T.soft, color: T.primary }}>
              {s.author_name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: T.ink }}>{s.chapter_title || 'Sem título'}</p>
            <p className="text-[10px]" style={{ color: T.muted }}>{s.author_name}</p>
          </div>
        </div>
        <span
          className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wider"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {s.book_id && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md truncate" style={{ background: T.primaryLo, color: T.primary }}>
              {books.find(b => b.id === s.book_id)?.name ?? 'Projeto'}
            </span>
          )}
          <span className="text-[9px]" style={{ color: T.muted }}>{format(new Date(s.created_at), 'dd/MM/yyyy')}</span>
        </div>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <AssignDropdown
            currentAssigneeId={s.assigned_to}
            submissionId={s.id}
            onAssigned={onAssigned}
            compact
          />
          <button
            className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors hover:opacity-80 flex-shrink-0"
            style={{ background: T.mutedLow, color: T.muted }}
            onClick={onDownload}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Submission Detail Modal (responsive) ──────────────────────
const SubmissionModal = ({
  submission,
  books,
  currentUser,
  onClose,
  onStatusUpdate,
  onAssigned,
  onBookAssigned,
  onDownload,
}: {
  submission:    Submission;
  books:         Book[];
  currentUser:   UserProfile | null;
  onClose:       () => void;
  onStatusUpdate:(id: string, status: Submission['status']) => void;
  onAssigned:    (p: UserProfile) => void;
  onBookAssigned:(bookId: string | null) => void;
  onDownload:    () => void;
}) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('content');

  const tabs = [
    { value: 'content',  icon: BookOpen,      label: 'Leitura'     },
    { value: 'details',  icon: Info,          label: 'Autor'       },
    { value: 'activity', icon: MessageSquare, label: 'Comentários' },
  ];

  // ── Header (shared between mobile and desktop) ────────────
  const ModalHeader = () => (
    <div
      className="px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 flex-shrink-0"
      style={{ background: T.primary, borderRadius: isMobile ? '0' : '1.5rem 1.5rem 0 0' }}
    >
      {/* Left: author info */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {isMobile && (
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl overflow-hidden border-2 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          <AvatarImage src={avatarSrc(submission.photo_file_url, submission.author_email)} className="object-cover" />
          <AvatarFallback className="font-semibold text-sm rounded-xl" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            {submission.author_name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm sm:text-base font-semibold leading-tight truncate" style={{ color: '#fff' }}>
            {submission.chapter_title || 'Sem Título'}
          </p>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {submission.author_name} · {submission.author_email}
          </p>
          {submission.book_coordinator && (
            <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 flex items-center gap-1" style={{ color: '#bcc850' }}>
              <UserPlus className="h-3 w-3" /> Coord.: {submission.book_coordinator}
            </p>
          )}
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        <AssignDropdown
          currentAssigneeId={submission.assigned_to}
          submissionId={submission.id}
          onAssigned={onAssigned}
        />
        <Select value={submission.status} onValueChange={v => onStatusUpdate(submission.id, v as any)}>
          <SelectTrigger
            className="h-9 text-[10px] font-medium w-[130px] sm:w-[140px] rounded-xl border-0"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl" style={{ background: T.card, borderColor: T.border }}>
            <SelectItem value="novo">Novo</SelectItem>
            <SelectItem value="recebido">Em Revisão</SelectItem>
            <SelectItem value="solicitar_ajustes">Ajustes</SelectItem>
            <SelectItem value="concluido">Aprovado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // ── Tab nav ───────────────────────────────────────────────
  const TabNav = () => (
    <TabsList
      className={`
        ${isMobile
          ? 'flex flex-row h-auto p-2 gap-1 w-full border-b'
          : 'flex flex-col h-auto p-3 lg:w-44 gap-1 flex-shrink-0 border-r'
        }
      `}
      style={{
        background:   'rgba(255,255,255,0.6)',
        borderColor:  T.border,
        borderStyle:  'solid',
        borderWidth:  isMobile ? '0 0 1px 0' : '0 1px 0 0',
      }}
    >
      {tabs.map(({ value, icon: Icon, label }) => (
        <TabsTrigger
          key={value}
          value={value}
          className={`
            ${isMobile ? 'flex-1' : 'w-full justify-start'}
            flex items-center gap-2 py-2.5 px-3 text-[9px] sm:text-[10px] font-medium uppercase tracking-widest rounded-xl transition-all data-[state=active]:shadow-sm
          `}
          style={{ color: T.muted }}
        >
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className={isMobile ? 'hidden xs:inline' : ''}>{label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );

  // ── Tab: Leitura ──────────────────────────────────────────
  const ContentTab = () => (
    <TabsContent
      value="content"
      className="m-0 p-0 outline-none data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:h-full data-[state=active]:overflow-hidden"
    >
      <ScrollArea className="h-full p-4 sm:p-8">
        <div
          className="max-w-2xl mx-auto py-8 sm:py-14 px-5 sm:px-12 rounded-2xl"
          style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.04)`, fontFamily: '"Georgia", serif' }}
        >
          <div className="text-center mb-8 sm:mb-10 space-y-3">
            <div className="w-6 h-px mx-auto" style={{ background: T.accent }} />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: T.ink }}>
              {submission.chapter_title}
            </h1>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: T.muted }}>
              {submission.author_name}
            </p>
          </div>
          <div className="text-base sm:text-[1.05rem] leading-[1.85] text-justify whitespace-pre-wrap" style={{ color: T.ink }}>
            {submission.chapter_content}
          </div>
        </div>
      </ScrollArea>
    </TabsContent>
  );

  // ── Tab: Autor ────────────────────────────────────────────
  const DetailsTab = () => (
    <TabsContent
      value="details"
      className="m-0 p-0 outline-none data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:h-full data-[state=active]:overflow-hidden"
    >
      <ScrollArea className="h-full p-4 sm:p-8">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
          {submission.photo_file_url && (
            <div className="rounded-2xl overflow-hidden relative group" style={{ border: `1px solid ${T.border}` }}>
              <img
                src={submission.photo_file_url}
                alt={submission.author_name}
                className="w-full h-36 sm:h-48 object-cover"
              />
              <a
                href={submission.photo_file_url}
                download
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 right-3 h-9 px-4 flex items-center gap-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all"
                style={{ background: T.primary, color: '#fff' }}
                onClick={e => e.stopPropagation()}
              >
                <Download className="h-3.5 w-3.5" /> Baixar Foto
              </a>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: 'Palavras', value: submission.chapter_content.trim().split(/\s+/).length },
              { label: 'Tipo',     value: submission.submission_type.toUpperCase() },
              { label: 'Recebido', value: format(new Date(submission.created_at), 'dd/MM/yy') },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3 sm:p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: T.muted }}>{label}</p>
                <p className="text-lg sm:text-xl font-semibold" style={{ color: T.primary }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 sm:p-5 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <h3 className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: T.primary }}>
              <FolderOpen className="h-3.5 w-3.5" /> Projeto Vinculado
            </h3>
            <AssignProjectDropdown
              submissionId={submission.id}
              currentBookId={submission.book_id}
              books={books}
              onAssigned={onBookAssigned}
            />
          </div>

          {submission.assigned_user && (
            <div className="rounded-2xl p-4 sm:p-5 flex items-center gap-3" style={{ background: T.primaryLo, border: `1px solid ${T.border}` }}>
              <Avatar className="h-10 w-10 rounded-xl overflow-hidden flex-shrink-0">
                <AvatarImage src={avatarSrc(submission.assigned_user.avatar_url, submission.assigned_user.full_name ?? 'R')} className="object-cover" />
                <AvatarFallback className="font-semibold text-xs rounded-xl" style={{ background: T.soft, color: T.primary }}>
                  {(submission.assigned_user.full_name ?? 'R').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: T.muted }}>Responsável</p>
                <p className="text-sm font-medium" style={{ color: T.primary }}>
                  {submission.assigned_user.full_name ?? 'Usuário'}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4 sm:p-6 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <h3 className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: T.primary }}>
              <UserCheck className="h-3.5 w-3.5" /> Minibiografia
            </h3>
            <p className="text-sm leading-relaxed italic" style={{ color: T.muted }}>
              "{submission.curriculum || 'Não informado.'}"
            </p>
          </div>

          <div className="rounded-2xl p-4 sm:p-6 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
            <h3 className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: T.primary }}>
              <FileText className="h-3.5 w-3.5" /> Resumo Estruturado
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: T.ink }}>
              {submission.summary || 'Não informado.'}
            </p>
          </div>

          <button
            onClick={onDownload}
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium text-xs uppercase tracking-wider transition-all hover:opacity-80"
            style={{ background: T.primary, color: '#fff' }}
          >
            <Download className="h-4 w-4" /> Baixar Capítulo (.docx)
          </button>
        </div>
      </ScrollArea>
    </TabsContent>
  );

  // ── Tab: Comentários ──────────────────────────────────────
  const ActivityTab = () => (
    <TabsContent
      value="activity"
      className="m-0 p-0 outline-none data-[state=active]:flex data-[state=active]:flex-col data-[state=active]:h-full data-[state=active]:overflow-hidden"
    >
      <CommentThread submissionId={submission.id} currentUser={currentUser} />
    </TabsContent>
  );

  // ── Mobile: Sheet (bottom drawer) ────────────────────────
  if (isMobile) {
    return (
      <Sheet open onOpenChange={o => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="p-0 flex flex-col rounded-t-3xl overflow-hidden"
          style={{
            background:  T.bg,
            border:      `1px solid ${T.border}`,
            height:      '95dvh',
            maxHeight:   '95dvh',
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{submission.chapter_title || 'Submissão'}</SheetTitle>
            <SheetDescription>Detalhes da submissão</SheetDescription>
          </SheetHeader>
          <ModalHeader />
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabNav />
            <div className="flex-1 overflow-hidden">
              <ContentTab />
              <DetailsTab />
              <ActivityTab />
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop: Dialog ───────────────────────────────────────
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent
        className="max-w-6xl h-[92vh] p-0 flex flex-col overflow-hidden rounded-3xl"
        style={{ background: T.bg, border: `1px solid ${T.border}`, boxShadow: `0 24px 80px rgba(0,0,0,0.12)` }}
      >
        <DialogTitle className="sr-only">{submission.chapter_title || 'Submissão'}</DialogTitle>
        <DialogDescription className="sr-only">Detalhes da submissão</DialogDescription>
        <ModalHeader />
        <div className="flex-1 flex overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col lg:flex-row overflow-hidden"
          >
            <TabNav />
            <div className="flex-1 overflow-hidden">
              <ContentTab />
              <DetailsTab />
              <ActivityTab />
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [isLoading,          setIsLoading]          = useState(true);
  const [submissions,        setSubmissions]        = useState<Submission[]>([]);
  const [books,              setBooks]              = useState<Book[]>([]);
  const [selectedBookId,     setSelectedBookId]     = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [searchTerm,         setSearchTerm]         = useState('');
  const [currentUser,        setCurrentUser]        = useState<UserProfile | null>(null);
  const [profiles,           setProfiles]           = useState<UserProfile[]>([]);
  const [filters,            setFilters]            = useState<FilterState>(DEFAULT_FILTERS);
  const { toast }   = useToast();
  const [emblaRef]  = useEmblaCarousel({ align: 'start', dragFree: true });
  const isMobile    = useIsMobile();

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const applyPriorityFilter = useCallback((key: string) => {
    setFilters(prev => ({
      ...DEFAULT_FILTERS,
      priorityKey: prev.priorityKey === key ? '' : key,
    }));
  }, []);

  const applyStatusFilter = useCallback((s: string) => {
    updateFilters({ status: s, priorityKey: '' });
  }, [updateFilters]);

  // Logged user
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, avatar_url')
        .eq('user_id', user.id)
        .single();
      if (data) setCurrentUser(data as UserProfile);
    };
    load();
  }, []);

  // Profiles list
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, user_id, full_name, email, avatar_url')
      .then(({ data }) => setProfiles((data as UserProfile[]) || []));
  }, []);

  // Data fetch
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const { data: bks } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });
    setBooks(bks || []);

    let q = (supabase as any)
      .from('chapter_submissions')
      .select(`
        id,
        author_name,
        author_email,
        photo_file_url,
        book_coordinator,
        submission_type,
        chapter_title,
        chapter_content,
        curriculum,
        summary,
        status,
        created_at,
        book_id,
        assigned_to,
        assigned_user:profiles!chapter_submissions_assigned_to_fkey (
          full_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (selectedBookId) q = q.eq('book_id', selectedBookId);

    const { data: subs } = await q;
    setSubmissions(
      (subs || []).map((s: any) => ({
        ...s,
        assigned_user: Array.isArray(s.assigned_user) ? (s.assigned_user[0] ?? null) : (s.assigned_user ?? null),
      }))
    );
    setIsLoading(false);
  }, [selectedBookId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Status update
  const updateStatus = async (id: string, status: Submission['status']) => {
    const { error } = await supabase.from('chapter_submissions').update({ status }).eq('id', id);
    if (!error) {
      setSubmissions(p => p.map(s => s.id === id ? { ...s, status } : s));
      if (selectedSubmission?.id === id) setSelectedSubmission(p => p ? { ...p, status } : p);
      toast({ title: 'Status atualizado' });
    }
  };

  // Docx export
  const downloadDocx = async (s: Submission) => {
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ text: s.chapter_title || 'Título', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Autor: ${s.author_name}`, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 400 } }),
      ...s.chapter_content.split('\n').map(l => new Paragraph({ text: l, spacing: { after: 200 }, alignment: AlignmentType.JUSTIFIED })),
    ] }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${s.author_name.replace(/\s+/g, '_')}_capitulo.docx`);
  };

  const handleDeleteBook = async (id: string) => {
    await supabase.from('books').delete().eq('id', id);
    if (selectedBookId === id) setSelectedBookId(null);
    fetchData();
    toast({ title: 'Projeto removido' });
  };

  // Filtering logic
  const filtered = useMemo(() => {
    return submissions.filter(s => {
      const search = searchTerm.toLowerCase();
      if (search && !s.author_name.toLowerCase().includes(search) && !(s.chapter_title?.toLowerCase() ?? '').includes(search)) return false;
      if (filters.priorityKey === 'unassigned' && s.assigned_to) return false;
      if (filters.priorityKey === 'stale' && !(
        (s.status === 'recebido' || s.status === 'em_analise') &&
        differenceInDays(new Date(), new Date(s.created_at)) > 5
      )) return false;
      if (filters.priorityKey === 'adjustments' && s.status !== 'solicitar_ajustes') return false;
      if (filters.status     && s.status    !== filters.status)    return false;
      if (filters.assigneeId && s.assigned_to !== filters.assigneeId) return false;
      if (filters.dateFrom   && new Date(s.created_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo     && new Date(s.created_at) > new Date(filters.dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [submissions, searchTerm, filters]);

  // Stats with weekly trend
  const stats = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const thisWeek  = submissions.filter(s => isAfter(new Date(s.created_at), weekStart));
    return {
      total:        submissions.length,
      novo:         submissions.filter(s => s.status === 'novo').length,
      ajustes:      submissions.filter(s => s.status === 'solicitar_ajustes').length,
      aprovado:     submissions.filter(s => s.status === 'concluido').length,
      weekTotal:    thisWeek.length,
      weekNovo:     thisWeek.filter(s => s.status === 'novo').length,
      weekAjustes:  thisWeek.filter(s => s.status === 'solicitar_ajustes').length,
      weekAprovado: thisWeek.filter(s => s.status === 'concluido').length,
    };
  }, [submissions]);

  if (isLoading && books.length === 0) return <UiverseLoader />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg }}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <header className="flex justify-between items-start mb-6 sm:mb-8">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] mb-1" style={{ color: T.muted }}>
              Fluxo Editorial
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-none" style={{ color: T.ink }}>
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NewProjectDialog onCreated={fetchData} />
            <Link
              to="/submit"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider transition-all hover:scale-105 active:scale-[0.98]"
              style={{ background: T.accent, color: '#fff', boxShadow: `0 4px 14px rgba(255,100,0,0.28)` }}
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova Submissão</span>
              <span className="sm:hidden">Submeter</span>
            </Link>
          </div>
        </header>

        {/* Priorities */}
        <PrioritiesSection submissions={submissions} onFilter={applyPriorityFilter} />

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard icon={FileText}     label="Total"     value={stats.total}    trend={stats.weekTotal}    onClick={() => resetFilters()}                                                   variant="soft"     />
          <StatCard icon={Clock}        label="Novos"     value={stats.novo}     trend={stats.weekNovo}     onClick={() => updateFilters({ status: 'novo', priorityKey: '' })}               variant="default"  />
          <StatCard icon={AlertCircle}  label="Ajustes"   value={stats.ajustes}  trend={stats.weekAjustes}  onClick={() => updateFilters({ status: 'solicitar_ajustes', priorityKey: '' })} variant="accent"   />
          <StatCard icon={CheckCircle2} label="Aprovados" value={stats.aprovado} trend={stats.weekAprovado} onClick={() => updateFilters({ status: 'concluido', priorityKey: '' })}         variant="highlight"/>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

          {/* Left col */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">

            {/* Projects */}
            <div className="rounded-2xl p-4 sm:p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <h2 className="text-sm font-semibold" style={{ color: T.ink }}>Projetos Ativos</h2>
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ background: T.primaryLo, color: T.primary }}>
                  {books.length} projeto{books.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-hidden -mx-1" ref={emblaRef}>
                <div className="flex gap-3 py-1 px-1">
                  {/* All projects card */}
                  <div
                    onClick={() => setSelectedBookId(null)}
                    className="flex-shrink-0 w-36 sm:w-44 cursor-pointer rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all duration-200"
                    style={{
                      height:      isMobile ? '14rem' : '18.5rem',
                      borderStyle: 'dashed',
                      borderColor: !selectedBookId ? T.primary : 'rgba(0,0,0,0.12)',
                      background:  !selectedBookId ? T.primaryLo : 'rgba(0,0,0,0.02)',
                      transform:   !selectedBookId ? 'translateY(-3px)' : 'translateY(0)',
                    }}
                  >
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center"
                      style={{ background: !selectedBookId ? T.primary : T.mutedLow }}>
                      <TrendingUp className="h-6 w-6" style={{ color: !selectedBookId ? '#fff' : T.muted }} />
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: !selectedBookId ? T.primary : T.muted }}>
                      Geral
                    </span>
                  </div>
                  {books.map(b => (
                    <BookCard
                      key={b.id}
                      book={b}
                      isSelected={selectedBookId === b.id}
                      onClick={() => setSelectedBookId(b.id)}
                      onDelete={handleDeleteBook}
                      chaptersCount={submissions.filter(s => s.book_id === b.id).length}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Table — desktop */}
            {!isMobile && (
              <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
                <div className="flex items-center justify-between px-6 py-4 gap-3 flex-wrap" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <h2 className="text-sm font-semibold flex-shrink-0" style={{ color: T.ink }}>Submissões</h2>
                    {(filters.priorityKey || filters.status) && (
                      <span className="text-[9px] font-semibold px-2.5 py-1 rounded-full" style={{ background: T.accent + '18', color: T.accent }}>
                        {filtered.length} resultados
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-52">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: T.muted }} />
                      <Input
                        className="pl-9 h-9 rounded-xl text-sm border-0 focus-visible:ring-1"
                        placeholder="Buscar…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ background: T.bg, color: T.ink } as React.CSSProperties}
                      />
                    </div>
                    <FilterBar filters={filters} profiles={profiles} onChange={updateFilters} onReset={resetFilters} />
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow style={{ borderColor: T.border, background: 'rgba(0,0,0,0.015)' }}>
                      {['Capítulo / Título', 'Autor', 'Responsável', 'Status', 'Ações'].map((h, i) => (
                        <TableHead
                          key={h}
                          className={`py-4 text-[9px] font-semibold uppercase tracking-widest ${i === 0 ? 'pl-6' : ''} ${i === 4 ? 'text-right pr-6' : ''}`}
                          style={{ color: T.muted }}
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-16 text-xs font-medium" style={{ color: T.muted }}>
                          Nenhuma submissão encontrada
                        </TableCell>
                      </TableRow>
                    ) : filtered.map(s => {
                      const st = STATUS_MAP[s.status] || STATUS_MAP.novo;
                      return (
                        <TableRow
                          key={s.id}
                          onClick={() => setSelectedSubmission(s)}
                          className="cursor-pointer transition-colors"
                          style={{ borderColor: T.border }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,50,35,0.025)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <TableCell className="py-5 pl-6">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-sm" style={{ color: T.ink }}>{s.chapter_title || 'Sem título'}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px]" style={{ color: T.muted }}>{format(new Date(s.created_at), 'dd/MM/yyyy')}</span>
                                {s.book_id && (
                                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: T.primaryLo, color: T.primary }}>
                                    {books.find(b => b.id === s.book_id)?.name ?? 'Projeto'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-9 w-9 rounded-xl flex-shrink-0 overflow-hidden">
                                <AvatarImage src={avatarSrc(s.photo_file_url, s.author_name)} className="object-cover" />
                                <AvatarFallback className="text-[10px] font-semibold rounded-xl" style={{ background: T.soft, color: T.primary }}>
                                  {s.author_name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-medium" style={{ color: T.ink }}>{s.author_name}</p>
                                <p className="text-[9px] uppercase tracking-wider" style={{ color: T.muted }}>{s.submission_type}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell onClick={e => e.stopPropagation()}>
                            <AssignDropdown
                              currentAssigneeId={s.assigned_to}
                              submissionId={s.id}
                              onAssigned={p => {
                                const updated = { ...s, assigned_to: p.user_id, assigned_user: { full_name: p.full_name, avatar_url: p.avatar_url } };
                                setSubmissions(prev => prev.map(x => x.id === s.id ? updated : x));
                                if (selectedSubmission?.id === s.id) setSelectedSubmission(updated);
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <span
                              className="inline-flex items-center px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
                              style={{ background: st.bg, color: st.color }}
                            >
                              {st.label}
                            </span>
                          </TableCell>

                          <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              <button
                                className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors hover:opacity-80"
                                style={{ background: T.primaryLo, color: T.primary }}
                                onClick={() => setSelectedSubmission(s)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="h-9 w-9 flex items-center justify-center rounded-xl transition-colors hover:opacity-80"
                                style={{ background: T.mutedLow, color: T.muted }}
                                onClick={() => downloadDocx(s)}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Cards — mobile */}
            {isMobile && (
              <div className="space-y-3">
                {/* Search + filter bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: T.muted }} />
                    <Input
                      className="pl-9 h-10 rounded-xl text-sm border-0 focus-visible:ring-1 w-full"
                      placeholder="Buscar submissão…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ background: T.card, color: T.ink } as React.CSSProperties}
                    />
                  </div>
                  <FilterBar filters={filters} profiles={profiles} onChange={updateFilters} onReset={resetFilters} />
                </div>

                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold" style={{ color: T.ink }}>Submissões</h2>
                  {(filters.priorityKey || filters.status) && (
                    <span className="text-[9px] font-semibold px-2.5 py-1 rounded-full" style={{ background: T.accent + '18', color: T.accent }}>
                      {filtered.length} resultados
                    </span>
                  )}
                </div>

                {filtered.length === 0 ? (
                  <div className="rounded-2xl py-16 text-center text-xs font-medium" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted }}>
                    Nenhuma submissão encontrada
                  </div>
                ) : filtered.map(s => (
                  <MobileSubmissionCard
                    key={s.id}
                    s={s}
                    books={books}
                    onOpen={() => setSelectedSubmission(s)}
                    onDownload={() => downloadDocx(s)}
                    onAssigned={p => {
                      const updated = { ...s, assigned_to: p.user_id, assigned_user: { full_name: p.full_name, avatar_url: p.avatar_url } };
                      setSubmissions(prev => prev.map(x => x.id === s.id ? updated : x));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right col */}
          <div className="lg:col-span-1 space-y-4">
            <PipelinePanel submissions={submissions} activeStatus={filters.status} onFilterStatus={applyStatusFilter} />
            <ActivityFeed submissions={submissions} />
          </div>
        </div>
      </main>

      {/* ── Submission Detail Modal ── */}
      {selectedSubmission && (
        <SubmissionModal
          submission={selectedSubmission}
          books={books}
          currentUser={currentUser}
          onClose={() => setSelectedSubmission(null)}
          onStatusUpdate={updateStatus}
          onAssigned={p => {
            const updated = { ...selectedSubmission, assigned_to: p.user_id, assigned_user: { full_name: p.full_name, avatar_url: p.avatar_url } };
            setSelectedSubmission(updated);
            setSubmissions(prev => prev.map(x => x.id === updated.id ? updated : x));
          }}
          onBookAssigned={bookId => {
            const updated = { ...selectedSubmission, book_id: bookId };
            setSelectedSubmission(updated);
            setSubmissions(prev => prev.map(x => x.id === updated.id ? updated : x));
          }}
          onDownload={() => downloadDocx(selectedSubmission)}
        />
      )}
    </div>
  );
}