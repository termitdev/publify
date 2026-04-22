import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Send, FileText, Download, Eye,
  Trash2, Layers, Search,
  History, Info, TrendingUp, UserCheck, UserPlus,
  Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
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

interface Comment {
  id:         string;
  content:    string;
  created_at: string;
  user_id:    string;
  author:     { full_name: string | null; avatar_url: string | null } | null;
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
      className="flex-shrink-0 w-40 cursor-pointer rounded-2xl overflow-hidden transition-all duration-200 group"
      style={{
        border:     `1.5px solid ${isSelected ? T.primary : T.border}`,
        background: isSelected ? T.card : 'rgba(255,255,255,0.7)',
        boxShadow:  isSelected ? `0 4px 20px rgba(0,50,35,0.12)` : `0 1px 4px rgba(0,0,0,0.04)`,
        transform:  isSelected ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      <div className="relative h-52 overflow-hidden" style={{ background: T.soft }}>
        {book.cover_url ? (
          <img src={book.cover_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={book.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-8 w-8 opacity-25" style={{ color: T.primary }} />
          </div>
        )}
        <div className="absolute bottom-0 left-0 w-full h-[3px]" style={{ background: 'rgba(0,0,0,0.06)' }}>
          <div className="h-full transition-all duration-700" style={{ width: `${progress}%`, background: progress === 100 ? '#1a6e40' : T.primary }} />
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-150">
          <button
            className="h-6 w-6 flex items-center justify-center rounded-lg"
            style={{ background: T.accent, color: '#fff' }}
            onClick={e => { e.stopPropagation(); onDelete(book.id); }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-[11px] leading-tight truncate" style={{ color: T.ink }}>{book.name}</h3>
        <p className="text-[9px] font-medium uppercase tracking-widest" style={{ color: T.muted }}>
          {chaptersCount} cap. · {progress}%
        </p>
        <ChecklistDialog>
          <ChecklistDialogTrigger asChild>
            <button
              className="w-full h-7 rounded-lg text-[9px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all hover:opacity-80"
              style={{ background: T.primaryLo, color: T.primary }}
              onClick={e => e.stopPropagation()}
            >
              <Layers className="h-3 w-3" /> Checklist
            </button>
          </ChecklistDialogTrigger>
          <ChecklistDialogContent className="rounded-2xl" style={{ background: T.bg, borderColor: T.border }}>
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

// ── KPI Card ──────────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value,
  variant = 'default',
}: {
  icon: any; label: string; value: number | string;
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
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all hover:shadow-sm"
      style={{ background: v.bg, border: `1px solid ${T.border}`, boxShadow: variant === 'default' ? `0 1px 3px rgba(0,0,0,0.04)` : 'none' }}
    >
      <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: v.iconBg }}>
        <Icon className="h-4 w-4" style={{ color: v.iconCo }} />
      </div>
      <div>
        <p className="text-xs mb-1" style={{ color: T.muted }}>{label}</p>
        <p className="text-2xl font-semibold leading-none" style={{ color: v.valueCo }}>{value}</p>
      </div>
    </div>
  );
};

// ── AssignDropdown ────────────────────────────────────────────
// Loads all profiles, updates tasks.assigned_to on change, shows avatar + name.
const AssignDropdown = ({
  currentAssigneeId,
  submissionId,
  onAssigned,
}: {
  currentAssigneeId: string | null;
  submissionId:      string;
  onAssigned:        (profile: UserProfile) => void;
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
        className="h-8 rounded-xl border-0 text-[10px] font-medium gap-2 px-2 min-w-[120px]"
        style={{ background: T.primaryLo, color: T.primary }}
        onClick={e => e.stopPropagation()}
      >
        {current ? (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Avatar className="h-5 w-5 rounded-md overflow-hidden flex-shrink-0">
              <AvatarImage src={avatarSrc(current.avatar_url, current.full_name ?? 'U')} className="object-cover" />
              <AvatarFallback className="text-[8px] rounded-md" style={{ background: T.soft, color: T.primary }}>
                {(current.full_name ?? 'U').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[72px]">{current.full_name ?? 'Usuário'}</span>
          </div>
        ) : (
          <SelectValue placeholder="Atribuir…" />
        )}
      </SelectTrigger>
      <SelectContent className="rounded-xl" style={{ background: T.card, borderColor: T.border }}>
        {profiles.map(p => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 rounded-md overflow-hidden flex-shrink-0">
                <AvatarImage src={avatarSrc(p.avatar_url, p.full_name ?? 'U')} className="object-cover" />
                <AvatarFallback className="text-[8px] rounded-md" style={{ background: T.soft, color: T.primary }}>
                  {(p.full_name ?? 'U').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{p.full_name ?? p.email ?? 'Usuário'}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ── CommentThread ─────────────────────────────────────────────
// Fetches from `comments` table with a profiles join. Inserts with user_id + task_id.
const CommentThread = ({
  submissionId,
  currentUser,
}: {
  submissionId: string;
  currentUser:  UserProfile | null;
}) => {
  const [comments,   setComments]   = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        author:profiles!comments_user_id_fkey (
          full_name,
          avatar_url
        )
      `)
      .eq('task_id', submissionId)
      .order('created_at', { ascending: true });

    if (data) {
      setComments(
        data.map((c: any) => ({
          id:         c.id,
          content:    c.content,
          created_at: c.created_at,
          user_id:    c.user_id,
          // Supabase returns the joined row as object or array depending on cardinality hint
          author: Array.isArray(c.author) ? (c.author[0] ?? null) : (c.author ?? null),
        }))
      );
    }
  }, [submissionId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !currentUser) return;
    setSubmitting(true);
    const { error } = await supabase.from('comments').insert({
      content: newComment.trim(),
      task_id: submissionId,
      user_id: currentUser.user_id,
    });
    if (!error) {
      setNewComment('');
      await loadComments();
      toast({ title: 'Feedback registrado' });
    }
    setSubmitting(false);
  };

  return (
    <div className="h-full flex flex-col outline-none">
      {/* Thread scroll */}
      <ScrollArea className="flex-1 p-8">
        <div className="space-y-3 max-w-xl mx-auto">
          {comments.length === 0 && (
            <p className="text-center text-xs py-10" style={{ color: T.muted }}>
              Nenhum feedback ainda
            </p>
          )}
          {comments.map(c => {
            const name = c.author?.full_name ?? 'Usuário';
            return (
              <div key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8 rounded-xl flex-shrink-0 overflow-hidden">
                  <AvatarImage src={avatarSrc(c.author?.avatar_url, name)} className="object-cover" />
                  <AvatarFallback className="font-semibold text-[10px] rounded-xl" style={{ background: T.soft, color: T.primary }}>
                    {name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: T.primary }}>
                      {name}
                    </span>
                    <span className="text-[9px]" style={{ color: T.muted }}>
                      {format(new Date(c.created_at), 'dd/MM HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: T.ink }}>{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Input bar */}
      <div className="p-5 flex gap-3 flex-shrink-0" style={{ borderTop: `1px solid ${T.border}`, background: T.card }}>
        <Input
          className="flex-1 h-10 rounded-xl text-sm border-0 focus-visible:ring-1"
          placeholder={currentUser ? 'Escrever feedback…' : 'Faça login para comentar'}
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          disabled={submitting || !currentUser}
          style={{ background: T.bg, color: T.ink, ['--tw-ring-color' as any]: T.primary }}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim() || !currentUser}
          className="h-10 w-10 flex items-center justify-center rounded-xl flex-shrink-0
            transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
          style={{ background: T.primary, color: '#fff', boxShadow: `0 4px 12px rgba(0,50,35,0.2)` }}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
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
  const { toast }   = useToast();
  const [emblaRef]  = useEmblaCarousel({ align: 'start', dragFree: true });

  // ── Logged user ────────────────────────────────────────────
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

  // ── Data fetch — relational select ────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    const { data: bks } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });
    setBooks(bks || []);

    // Single query with joined assigned_user profile
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

  // ── Status update ──────────────────────────────────────────
  const updateStatus = async (id: string, status: Submission['status']) => {
    const { error } = await supabase.from('chapter_submissions').update({ status }).eq('id', id);
    if (!error) {
      setSubmissions(p => p.map(s => s.id === id ? { ...s, status } : s));
      if (selectedSubmission?.id === id) setSelectedSubmission(p => p ? { ...p, status } : p);
      toast({ title: 'Status atualizado' });
    }
  };

  // ── Docx ──────────────────────────────────────────────────
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

  const filtered = submissions.filter(s =>
    s.author_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.chapter_title?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const stats = {
    total:    submissions.length,
    novo:     submissions.filter(s => s.status === 'novo').length,
    ajustes:  submissions.filter(s => s.status === 'solicitar_ajustes').length,
    aprovado: submissions.filter(s => s.status === 'concluido').length,
  };

  if (isLoading && books.length === 0) return <UiverseLoader />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg }}>
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex justify-between items-start mb-8">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] mb-1" style={{ color: T.muted }}>
              Fluxo Editorial
            </p>
            <h1 className="text-3xl font-semibold tracking-tight leading-none" style={{ color: T.ink }}>
              Dashboard
            </h1>
          </div>
          <Link
            to="/submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold
              uppercase tracking-wider transition-all hover:scale-105 active:scale-[0.98]"
            style={{ background: T.accent, color: '#fff', boxShadow: `0 4px 14px rgba(255,100,0,0.28)` }}
          >
            <Send className="h-3.5 w-3.5" />
            Nova Submissão
          </Link>
        </header>

        {/* ── KPI Grid ───────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={FileText}     label="Total"     value={stats.total}    variant="soft"      />
          <StatCard icon={Clock}        label="Novos"     value={stats.novo}     variant="default"   />
          <StatCard icon={AlertCircle}  label="Ajustes"   value={stats.ajustes}  variant="accent"    />
          <StatCard icon={CheckCircle2} label="Aprovados" value={stats.aprovado} variant="highlight" />
        </div>

        {/* ── Main Grid ──────────────────────────────── */}
        <div className="grid grid-cols-3 gap-6">

          {/* Left col */}
          <div className="col-span-3 lg:col-span-2 space-y-6">

            {/* Projetos */}
            <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-semibold" style={{ color: T.ink }}>Projetos Ativos</h2>
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ background: T.primaryLo, color: T.primary }}>
                  {books.length} projeto{books.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-hidden -mx-1" ref={emblaRef}>
                <div className="flex gap-3 py-1 px-1">
                  <div
                    onClick={() => setSelectedBookId(null)}
                    className="flex-shrink-0 w-40 h-[17.5rem] cursor-pointer rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all duration-200"
                    style={{
                      borderStyle: 'dashed',
                      borderColor: !selectedBookId ? T.primary : 'rgba(0,0,0,0.12)',
                      background:  !selectedBookId ? T.primaryLo : 'rgba(0,0,0,0.02)',
                      transform:   !selectedBookId ? 'translateY(-3px)' : 'translateY(0)',
                    }}
                  >
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ background: !selectedBookId ? T.primary : T.mutedLow }}>
                      <TrendingUp className="h-5 w-5" style={{ color: !selectedBookId ? '#fff' : T.muted }} />
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

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
                <h2 className="text-sm font-semibold" style={{ color: T.ink }}>Submissões</h2>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: T.muted }} />
                  <Input
                    className="pl-9 h-9 rounded-xl text-sm border-0 focus-visible:ring-1"
                    placeholder="Buscar autor ou título…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ background: T.bg, color: T.ink, ['--tw-ring-color' as any]: T.primary }}
                  />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: T.border, background: 'rgba(0,0,0,0.015)' }}>
                    {['Capítulo / Título', 'Autor', 'Responsável', 'Status', 'Ações'].map((h, i) => (
                      <TableHead
                        key={h}
                        className={`py-3 text-[9px] font-semibold uppercase tracking-widest ${i === 0 ? 'pl-6' : ''} ${i === 4 ? 'text-right pr-6' : ''}`}
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
                      <TableCell colSpan={5} className="text-center py-14 text-xs font-medium" style={{ color: T.muted }}>
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
                        {/* Chapter title */}
                        <TableCell className="py-4 pl-6">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-sm" style={{ color: T.ink }}>{s.chapter_title || 'Sem título'}</span>
                            <span className="text-[10px]" style={{ color: T.muted }}>{format(new Date(s.created_at), 'dd/MM/yyyy')}</span>
                          </div>
                        </TableCell>

                        {/* Author */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8 rounded-xl flex-shrink-0 overflow-hidden">
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

                        {/* Assignment dropdown — stops row click */}
                        <TableCell onClick={e => e.stopPropagation()}>
                          <AssignDropdown
                            currentAssigneeId={s.assigned_to}
                            submissionId={s.id}
                            onAssigned={p => {
                              const updated = {
                                ...s,
                                assigned_to:   p.user_id,
                                assigned_user: { full_name: p.full_name, avatar_url: p.avatar_url },
                              };
                              setSubmissions(prev => prev.map(x => x.id === s.id ? updated : x));
                              if (selectedSubmission?.id === s.id) setSelectedSubmission(updated);
                            }}
                          />
                        </TableCell>

                        {/* Status badge */}
                        <TableCell>
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wider"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors hover:opacity-80"
                              style={{ background: T.primaryLo, color: T.primary }}
                              onClick={() => setSelectedSubmission(s)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors hover:opacity-80"
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
          </div>

          {/* Right col */}
          <div className="col-span-3 lg:col-span-1 space-y-4">

            {/* Pipeline */}
            <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
              <h2 className="text-sm font-semibold mb-5" style={{ color: T.ink }}>Pipeline</h2>
              <div className="space-y-3">
                {Object.entries(STATUS_MAP).map(([key, meta]) => {
                  const count = submissions.filter(s => s.status === key).length;
                  const pct   = submissions.length ? Math.round((count / submissions.length) * 100) : 0;
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium" style={{ color: T.ink }}>{meta.label}</span>
                        <span className="text-[10px] font-semibold tabular-nums" style={{ color: meta.color }}>{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recentes */}
            <div className="rounded-2xl p-6" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 3px rgba(0,0,0,0.04)` }}>
              <h2 className="text-sm font-semibold mb-5" style={{ color: T.ink }}>Recentes</h2>
              <div className="space-y-1">
                {submissions.slice(0, 5).map(s => {
                  const st = STATUS_MAP[s.status] || STATUS_MAP.novo;
                  return (
                    <div
                      key={s.id}
                      className="flex justify-between items-center p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => setSelectedSubmission(s)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-7 w-7 rounded-lg flex-shrink-0 overflow-hidden">
                          <AvatarImage src={avatarSrc(s.photo_file_url, s.author_name)} />
                          <AvatarFallback className="text-[9px] font-semibold rounded-lg" style={{ background: T.soft, color: T.primary }}>
                            {s.author_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: T.ink }}>{s.author_name}</p>
                          <p className="text-[9px] truncate" style={{ color: T.muted }}>{s.chapter_title || 'Sem título'}</p>
                        </div>
                      </div>
                      <span className="flex-shrink-0 ml-2 text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
                {submissions.length === 0 && (
                  <p className="text-xs text-center py-6" style={{ color: T.muted }}>Sem submissões ainda</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* ══════════════════════════════════════════════════════════
          MODAL DETALHADO
      ══════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedSubmission} onOpenChange={o => !o && setSelectedSubmission(null)}>
        <DialogContent
          className="max-w-6xl h-[92vh] p-0 flex flex-col overflow-hidden rounded-3xl"
          style={{ background: T.bg, border: `1px solid ${T.border}`, boxShadow: `0 24px 80px rgba(0,0,0,0.12)` }}
        >
          {selectedSubmission && (
            <>
              {/* Modal header */}
              <div
                className="px-8 py-5 flex justify-between items-center flex-shrink-0"
                style={{ background: T.primary, borderRadius: '1.5rem 1.5rem 0 0' }}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-11 w-11 rounded-xl overflow-hidden border-2 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                    <AvatarImage src={avatarSrc(selectedSubmission.photo_file_url, selectedSubmission.author_email)} className="object-cover" />
                    <AvatarFallback className="font-semibold text-sm rounded-xl" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                      {selectedSubmission.author_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-base font-semibold leading-tight" style={{ color: '#fff' }}>
                      {selectedSubmission.chapter_title || 'Sem Título'}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Detalhes da submissão</DialogDescription>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {selectedSubmission.author_name} · {selectedSubmission.author_email}
                    </p>
                    {selectedSubmission.book_coordinator && (
                      <p className="text-[9px] font-semibold uppercase tracking-widest mt-0.5 flex items-center gap-1" style={{ color: T.highlight }}>
                        <UserPlus className="h-3 w-3" /> Coord.: {selectedSubmission.book_coordinator}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium hidden xl:block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Responsável:
                    </span>
                    <AssignDropdown
                      currentAssigneeId={selectedSubmission.assigned_to}
                      submissionId={selectedSubmission.id}
                      onAssigned={p => {
                        const updated = {
                          ...selectedSubmission,
                          assigned_to:   p.user_id,
                          assigned_user: { full_name: p.full_name, avatar_url: p.avatar_url },
                        };
                        setSelectedSubmission(updated);
                        setSubmissions(prev => prev.map(x => x.id === updated.id ? updated : x));
                      }}
                    />
                  </div>
                  <Select value={selectedSubmission.status} onValueChange={v => updateStatus(selectedSubmission.id, v as any)}>
                    <SelectTrigger
                      className="h-9 text-[10px] font-medium w-[140px] rounded-xl border-0"
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

              {/* Modal body */}
              <div className="flex-1 flex overflow-hidden">
                <Tabs defaultValue="content" className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                  <TabsList
                    className="flex lg:flex-col h-auto p-3 lg:w-44 gap-1 flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.6)', borderRight: `1px solid ${T.border}` }}
                  >
                    {[
                      { value: 'content',  icon: BookOpen, label: 'Leitura'  },
                      { value: 'details',  icon: Info,     label: 'Autor'    },
                      { value: 'activity', icon: History,  label: 'Feedback' },
                    ].map(({ value, icon: Icon, label }) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="w-full justify-start gap-3 py-3 px-4 text-[10px] font-medium uppercase tracking-widest rounded-xl transition-all data-[state=active]:shadow-sm"
                        style={{ color: T.muted }}
                      >
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="flex-1 overflow-hidden">

                    {/* Leitura */}
                    <TabsContent value="content" className="h-full m-0 p-0 outline-none">
                      <ScrollArea className="h-full p-8">
                        <div
                          className="max-w-2xl mx-auto py-14 px-12 rounded-2xl"
                          style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: `0 1px 4px rgba(0,0,0,0.04)`, fontFamily: '"Georgia", serif' }}
                        >
                          <div className="text-center mb-10 space-y-3">
                            <div className="w-6 h-px mx-auto" style={{ background: T.accent }} />
                            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: T.ink }}>
                              {selectedSubmission.chapter_title}
                            </h1>
                            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: T.muted }}>
                              {selectedSubmission.author_name}
                            </p>
                          </div>
                          <div className="text-[1.05rem] leading-[1.85] text-justify whitespace-pre-wrap" style={{ color: T.ink }}>
                            {selectedSubmission.chapter_content}
                          </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    {/* Detalhes */}
                    <TabsContent value="details" className="h-full m-0 p-0 outline-none">
                      <ScrollArea className="h-full p-8">
                        <div className="max-w-2xl mx-auto space-y-5">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'Palavras', value: selectedSubmission.chapter_content.trim().split(/\s+/).length },
                              { label: 'Tipo',     value: selectedSubmission.submission_type.toUpperCase() },
                              { label: 'Recebido', value: format(new Date(selectedSubmission.created_at), 'dd/MM/yy') },
                            ].map(({ label, value }) => (
                              <div key={label} className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                                <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: T.muted }}>{label}</p>
                                <p className="text-xl font-semibold" style={{ color: T.primary }}>{value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Assigned user card */}
                          {selectedSubmission.assigned_user && (
                            <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: T.primaryLo, border: `1px solid ${T.border}` }}>
                              <Avatar className="h-10 w-10 rounded-xl overflow-hidden flex-shrink-0">
                                <AvatarImage src={avatarSrc(selectedSubmission.assigned_user.avatar_url, selectedSubmission.assigned_user.full_name ?? 'R')} className="object-cover" />
                                <AvatarFallback className="font-semibold text-xs rounded-xl" style={{ background: T.soft, color: T.primary }}>
                                  {(selectedSubmission.assigned_user.full_name ?? 'R').substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: T.muted }}>Responsável</p>
                                <p className="text-sm font-medium" style={{ color: T.primary }}>
                                  {selectedSubmission.assigned_user.full_name ?? 'Usuário'}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="rounded-2xl p-6 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                            <h3 className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: T.primary }}>
                              <UserCheck className="h-3.5 w-3.5" /> Minibiografia
                            </h3>
                            <p className="text-sm leading-relaxed italic" style={{ color: T.muted }}>
                              "{selectedSubmission.curriculum || 'Não informado.'}"
                            </p>
                          </div>

                          <div className="rounded-2xl p-6 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                            <h3 className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: T.primary }}>
                              <FileText className="h-3.5 w-3.5" /> Resumo Estruturado
                            </h3>
                            <p className="text-sm leading-relaxed" style={{ color: T.ink }}>
                              {selectedSubmission.summary || 'Não informado.'}
                            </p>
                          </div>

                          <button
                            onClick={() => downloadDocx(selectedSubmission)}
                            className="flex items-center gap-2.5 px-5 py-3 rounded-xl font-medium text-xs uppercase tracking-wider transition-all hover:opacity-80"
                            style={{ background: T.primary, color: '#fff' }}
                          >
                            <Download className="h-4 w-4" /> Baixar Capítulo (.docx)
                          </button>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    {/* Feedback — CommentThread with `comments` table + profiles join */}
                    <TabsContent value="activity" className="h-full m-0 p-0 outline-none">
                      <CommentThread
                        submissionId={selectedSubmission.id}
                        currentUser={currentUser}
                      />
                    </TabsContent>

                  </div>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}