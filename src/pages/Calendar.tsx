import React, { useState, useMemo, useEffect, useRef } from 'react';
// import { supabase } from '@/integrations/supabase/client'; // Uncomment for Supabase

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CalendarUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  initials: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  color: EventColor;
  participantIds: string[];
  category: FilterCategory;
  description?: string;
  ownerId: string;
}

export interface Notification {
  id: string;
  type: 'invite' | 'update' | 'cancel';
  eventId: string;
  eventTitle: string;
  fromUserId: string;
  toUserId: string;
  read: boolean;
  timestamp: number;
}

type EventColor     = 'primary' | 'accent' | 'secondary' | 'teal' | 'rose' | 'amber';
type FilterCategory = 'reunioes' | 'tarefas' | 'marcos' | 'prazos' | 'pessoal' | 'aniversarios';
type ViewMode       = 'diario' | 'semanal' | 'mensal';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      '#f5f6f4',
  card:    '#ffffff',
  primary: '#003223',
  pLo:     'rgba(0,50,35,0.06)',
  pMd:     'rgba(0,50,35,0.14)',
  pHi:     'rgba(0,50,35,0.22)',
  accent:  '#ff6400',
  aLo:     'rgba(255,100,0,0.08)',
  border:  'rgba(0,50,35,0.08)',
  muted:   'rgba(0,50,35,0.40)',
  today:   'rgba(0,50,35,0.04)',
};

const EC: Record<EventColor, { bg: string; border: string; text: string; bar: string }> = {
  primary:   { bg: '#eaf2ee', border: '#b3cfc4', text: '#003223', bar: '#003223' },
  accent:    { bg: '#fff1eb', border: '#ffc4a0', text: '#b84000', bar: '#ff6400' },
  secondary: { bg: '#f2f5dc', border: '#d4dc90', text: '#484e10', bar: '#7a8a20' },
  teal:      { bg: '#e5f5f3', border: '#96dad4', text: '#096059', bar: '#0d9488' },
  rose:      { bg: '#fce9ed', border: '#f5b0c0', text: '#900020', bar: '#e11d48' },
  amber:     { bg: '#fef4e3', border: '#f5c87a', text: '#723300', bar: '#b45309' },
};

const AVATAR_COLORS = [
  '#003223','#cc5000','#5a6315','#0f766e','#be123c',
  '#92400e','#1d4ed8','#7c3aed','#0e7490','#15803d',
];
function avatarColor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// ─── Calendar constants ───────────────────────────────────────────────────────
const FIRST_HOUR = 7;
const LAST_HOUR  = 21;
const HOUR_H     = 64; // px per hour — 1 min ≈ 1.067px
const HORAS      = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => i + FIRST_HOUR);
const GRID_H     = HORAS.length * HOUR_H; // total grid height in px

const DIAS_PT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const FILTROS: { key: FilterCategory; label: string; icon: string }[] = [
  { key: 'reunioes',     label: 'Reuniões',     icon: '◎' },
  { key: 'tarefas',      label: 'Tarefas',      icon: '✓' },
  { key: 'marcos',       label: 'Marcos',       icon: '⚑' },
  { key: 'prazos',       label: 'Prazos',       icon: '◷' },
  { key: 'pessoal',      label: 'Pessoal',      icon: '♡' },
  { key: 'aniversarios', label: 'Aniversários', icon: '✦' },
];

const COLOR_LABELS: Record<EventColor, string> = {
  primary: 'Verde', accent: 'Laranja', secondary: 'Lima',
  teal: 'Ciano', rose: 'Rosa', amber: 'Âmbar',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseTime = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtHora   = (t: string) => { const [h, m] = t.split(':').map(Number); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };
const toDateStr = (d: Date)   => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const hoje    = new Date();
const hojeStr = toDateStr(hoje);

function getWeekDates(anchor: Date): Date[] {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i); return x;
  });
}

function getMiniDias(year: number, month: number) {
  const first    = new Date(year, month, 1).getDay();
  const total    = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: { day: number; m: 'p' | 'c' | 'n' }[] = [];
  for (let i = first - 1; i >= 0; i--) cells.push({ day: prevDays - i, m: 'p' });
  for (let i = 1; i <= total; i++)     cells.push({ day: i, m: 'c' });
  while (cells.length < 42)            cells.push({ day: cells.length - total - first + 1, m: 'n' });
  return cells;
}

// ─── Event overlap layout ─────────────────────────────────────────────────────
// Greedy column assignment: overlapping events share available width side-by-side
function computeEventLayout(events: CalendarEvent[]) {
  const sorted = [...events].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  const cols: CalendarEvent[][] = [];

  for (const ev of sorted) {
    const evStart = parseTime(ev.startTime);
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      const last = cols[c][cols[c].length - 1];
      if (parseTime(last.endTime) <= evStart) {
        cols[c].push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) cols.push([ev]);
  }

  const result: Record<string, { colIdx: number; totalCols: number }> = {};
  const total = cols.length || 1;
  cols.forEach((col, colIdx) => col.forEach(ev => {
    result[ev.id] = { colIdx, totalCols: total };
  }));
  return result;
}

// ─── Compute pixel position for a single event ───────────────────────────────
function eventPx(ev: CalendarEvent, layout: { colIdx: number; totalCols: number }) {
  const startMin = parseTime(ev.startTime) - FIRST_HOUR * 60;
  const durMin   = parseTime(ev.endTime) - parseTime(ev.startTime);
  const gapPx    = 3; // inner gap
  const colW     = 1 / layout.totalCols;

  return {
    top:    (startMin / 60) * HOUR_H,
    height: Math.max((durMin / 60) * HOUR_H - gapPx, 22),
    left:   layout.colIdx * colW,
    width:  colW,
  };
}

// ─── Mock users — swap with Supabase query in production ─────────────────────
const MOCK_USERS: CalendarUser[] = [
  { id: 'p1', user_id: 'u1', name: 'Ana Lima',       email: 'ana@empresa.com',   avatar_url: null, initials: 'AL', color: avatarColor('u1') },
  { id: 'p2', user_id: 'u2', name: 'Bruno Carvalho', email: 'bruno@empresa.com', avatar_url: null, initials: 'BC', color: avatarColor('u2') },
  { id: 'p3', user_id: 'u3', name: 'Carla Dias',     email: 'carla@empresa.com', avatar_url: null, initials: 'CD', color: avatarColor('u3') },
  { id: 'p4', user_id: 'u4', name: 'Diego Santos',   email: 'diego@empresa.com', avatar_url: null, initials: 'DS', color: avatarColor('u4') },
];

// ─── AvatarGroup ──────────────────────────────────────────────────────────────
function AvatarGroup({ ids, users, max = 3, size = 20 }: {
  ids: string[]; users: CalendarUser[]; max?: number; size?: number;
}) {
  const shown = ids.slice(0, max);
  const extra = ids.length - max;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((uid, i) => {
        const u = users.find(x => x.user_id === uid);
        if (!u) return null;
        return (
          <div key={uid} title={u.name} style={{
            width: size, height: size, borderRadius: '50%', background: u.color,
            border: '1.5px solid #fff', marginLeft: i > 0 ? -(size * 0.28) : 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.36, fontWeight: 700, color: '#fff',
            flexShrink: 0, overflow: 'hidden', position: 'relative', zIndex: shown.length - i,
          }}>
            {u.avatar_url
              ? <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : u.initials}
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{
          width: size, height: size, borderRadius: '50%', background: C.pLo,
          border: '1.5px solid #fff', marginLeft: -(size * 0.28),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.36, fontWeight: 700, color: C.primary,
        }}>+{extra}</div>
      )}
    </div>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────
function EventCard({ event, users, onClick, top, height, left, width, isOwn }: {
  event: CalendarEvent; users: CalendarUser[];
  onClick: () => void;
  top: number; height: number; left: number; width: number;
  isOwn: boolean;
}) {
  const c = EC[event.color];
  const compact = height < 40;
  const showAvatar = height >= 54 && event.participantIds.length > 0;

  const GAP = 3; // gap between adjacent events (px)
  const PAD = 4; // outer padding from column edge

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        position: 'absolute',
        top:    top,
        height: height,
        left:   `calc(${left * 100}% + ${PAD}px)`,
        width:  `calc(${width * 100}% - ${PAD * 2 + (width < 1 ? GAP : 0)}px)`,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.bar}`,
        borderRadius: 8,
        padding: compact ? '2px 6px' : '5px 8px',
        cursor: 'pointer',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        transition: 'box-shadow 0.12s, transform 0.1s',
        zIndex: 1,
        opacity: isOwn ? 1 : 0.85,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(0,50,35,0.16)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
        (e.currentTarget as HTMLDivElement).style.zIndex = '10';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.transform = 'none';
        (e.currentTarget as HTMLDivElement).style.zIndex = '1';
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        color: c.text,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexShrink: 0,
      }}>
        {event.title}
      </div>

      {/* Time — hidden when very compact */}
      {!compact && (
        <div style={{
          fontSize: 11,
          color: c.bar,
          marginTop: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          {fmtHora(event.startTime)} – {fmtHora(event.endTime)}
        </div>
      )}

      {/* Avatars */}
      {showAvatar && (
        <div style={{ marginTop: 4, flexShrink: 0 }}>
          <AvatarGroup ids={event.participantIds} users={users} max={4} size={18} />
        </div>
      )}
    </div>
  );
}

// ─── NotificationBell ─────────────────────────────────────────────────────────
function NotificationBell({ notifications, users, onRead, onOpen }: {
  notifications: Notification[];
  users: CalendarUser[];
  onRead: (id: string) => void;
  onOpen: (notif: Notification) => void;
}) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read).length;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'relative', border: `1.5px solid ${C.border}`, background: 'none',
        borderRadius: 10, width: 36, height: 36, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 16, height: 16, borderRadius: '50%',
            background: C.accent, border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff',
          }}>{unread}</div>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 42, right: 0, width: 300, maxHeight: 360,
          background: C.card, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,50,35,0.18)',
          border: `1px solid ${C.border}`, overflow: 'hidden', zIndex: 200,
        }}>
          <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>Notificações</span>
            {unread > 0 && (
              <span style={{ fontSize: 11, background: C.aLo, color: C.accent,
                padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
                {unread} nova{unread !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 300 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: C.muted }}>
                Sem notificações
              </div>
            ) : notifications.map(n => {
              const from = users.find(u => u.user_id === n.fromUserId);
              return (
                <div key={n.id} onClick={() => { onRead(n.id); onOpen(n); setOpen(false); }}
                  style={{
                    padding: '11px 16px', borderBottom: `1px solid ${C.border}`,
                    background: n.read ? 'transparent' : C.pLo,
                    cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.pLo}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = n.read ? 'transparent' : C.pLo}
                >
                  {from && (
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: from.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>{from.initials}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.primary, fontWeight: 600, lineHeight: 1.4 }}>
                      {from?.name || 'Alguém'} adicionou você ao evento
                    </div>
                    <div style={{ fontSize: 11, color: C.accent, marginTop: 2, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.eventTitle}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%',
                      background: C.accent, flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EventModal ───────────────────────────────────────────────────────────────
function EventModal({ event, users, currentUserId, onSave, onDelete, onClose, initialDate }: {
  event?: CalendarEvent | null;
  users: CalendarUser[];
  currentUserId: string;
  onSave: (e: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  initialDate?: string;
}) {
  const [title,  setTitle]  = useState(event?.title       || '');
  const [date,   setDate]   = useState(event?.date        || initialDate || hojeStr);
  const [start,  setStart]  = useState(event?.startTime   || '09:00');
  const [end,    setEnd]    = useState(event?.endTime     || '10:00');
  const [color,  setColor]  = useState<EventColor>(event?.color    || 'primary');
  const [cat,    setCat]    = useState<FilterCategory>(event?.category || 'reunioes');
  const [parts,  setParts]  = useState<string[]>(event?.participantIds ?? [currentUserId]);
  const [desc,   setDesc]   = useState(event?.description || '');
  const [busca,  setBusca]  = useState('');

  const filtrados = users.filter(u =>
    u.name.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  );
  const toggle = (uid: string) =>
    setParts(p => p.includes(uid) ? p.filter(x => x !== uid) : [...p, uid]);

  const salvar = () => {
    if (!title.trim()) return;
    onSave({
      id: event?.id || `ev_${Date.now()}`,
      title, date, startTime: start, endTime: end,
      color, category: cat, participantIds: parts,
      description: desc, ownerId: event?.ownerId || currentUserId,
    });
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontFamily: 'inherit',
    border: `1.5px solid ${C.border}`, fontSize: 13, outline: 'none',
    background: C.bg, color: C.primary, boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: C.muted, display: 'block',
    marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.6px',
  };

  return (
    <div
      style={{
        position: 'absolute', inset: 0, background: 'rgba(0,26,18,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 20, width: 540, maxWidth: '96vw',
          maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,50,35,0.22)',
          padding: '26px 28px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.primary }}>
            {event ? 'Editar Compromisso' : 'Novo Compromisso'}
          </h2>
          <button onClick={onClose} style={{
            border: 'none', background: C.pLo, borderRadius: 9,
            width: 32, height: 32, cursor: 'pointer', color: C.muted, fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Título */}
          <div>
            <label style={lbl}>Título *</label>
            <input
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Nome do compromisso…" style={inp} autoFocus
              onFocus={e => (e.target.style.borderColor = C.primary)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            />
          </div>

          {/* Data + Horas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={lbl}>Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp}
                onFocus={e => (e.target.style.borderColor = C.primary)}
                onBlur={e  => (e.target.style.borderColor = C.border)} />
            </div>
            <div>
              <label style={lbl}>Início</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)} style={inp}
                onFocus={e => (e.target.style.borderColor = C.primary)}
                onBlur={e  => (e.target.style.borderColor = C.border)} />
            </div>
            <div>
              <label style={lbl}>Fim</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={inp}
                onFocus={e => (e.target.style.borderColor = C.primary)}
                onBlur={e  => (e.target.style.borderColor = C.border)} />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label style={lbl}>Categoria</label>
            <select
              value={cat} onChange={e => setCat(e.target.value as FilterCategory)}
              style={{ ...inp, appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23003223' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              onFocus={e => (e.target.style.borderColor = C.primary)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            >
              {FILTROS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>

          {/* Cor */}
          <div>
            <label style={lbl}>Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              {(Object.keys(EC) as EventColor[]).map(key => {
                const c = EC[key];
                const sel = color === key;
                return (
                  <button key={key} onClick={() => setColor(key)} title={COLOR_LABELS[key]} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                    borderRadius: 99, cursor: 'pointer',
                    border: `1.5px solid ${sel ? c.bar : c.border}`,
                    background: sel ? c.bg : 'transparent',
                    transition: 'all 0.12s',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.bar, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{COLOR_LABELS[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Participantes */}
          <div>
            <label style={lbl}>Participantes ({parts.length})</label>
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              style={{ ...inp, marginBottom: 8 }}
              onFocus={e => (e.target.style.borderColor = C.primary)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            />
            <div style={{ border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', maxHeight: 192, overflowY: 'auto' }}>
              {filtrados.length === 0 && (
                <div style={{ padding: 14, fontSize: 12, color: C.muted, textAlign: 'center' }}>
                  Nenhum usuário encontrado
                </div>
              )}
              {filtrados.map((u, i) => {
                const sel = parts.includes(u.user_id);
                return (
                  <div
                    key={u.user_id}
                    onClick={() => toggle(u.user_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      cursor: 'pointer', background: sel ? C.pLo : '#fff',
                      borderBottom: i < filtrados.length - 1 ? `1px solid ${C.border}` : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLDivElement).style.background = C.pLo; }}
                    onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', background: u.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : u.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.primary,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.name}
                        {u.user_id === currentUserId && (
                          <span style={{ fontSize: 10, color: C.muted, fontWeight: 400, marginLeft: 6 }}>
                            (você)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.email}
                      </div>
                    </div>
                    <div style={{
                      width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${sel ? C.primary : C.pMd}`,
                      background: sel ? C.primary : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.1s',
                    }}>
                      {sel && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5">
                          <polyline points="2 6 5 9 10 3"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tags dos selecionados */}
            {parts.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {parts.map(uid => {
                  const u = users.find(x => x.user_id === uid);
                  if (!u) return null;
                  return (
                    <span key={uid} style={{
                      background: C.pLo, borderRadius: 99, padding: '3px 10px',
                      fontSize: 11, fontWeight: 600, color: C.primary,
                      display: 'flex', alignItems: 'center', gap: 5,
                      border: `1px solid ${C.pMd}`,
                    }}>
                      {u.initials}
                      {uid !== currentUserId && (
                        <button onClick={e => { e.stopPropagation(); toggle(uid); }} style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: C.muted, fontSize: 12, padding: 0, lineHeight: 1,
                          display: 'flex', alignItems: 'center',
                        }}>×</button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label style={lbl}>Descrição</label>
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)} rows={3}
              placeholder="Detalhes adicionais…"
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={e => (e.target.style.borderColor = C.primary)}
              onBlur={e  => (e.target.style.borderColor = C.border)}
            />
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            {event && onDelete ? (
              <button onClick={() => { onDelete(event.id); onClose(); }} style={{
                background: 'rgba(225,29,72,0.07)', border: '1.5px solid rgba(225,29,72,0.18)',
                color: '#be123c', borderRadius: 10, padding: '9px 16px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                </svg>
                Excluir
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{
                background: C.pLo, border: `1.5px solid ${C.border}`, color: C.primary,
                borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={!title.trim()} style={{
                background: title.trim() ? C.accent : C.pLo,
                border: 'none', color: title.trim() ? '#fff' : C.muted,
                borderRadius: 10, padding: '9px 22px', fontSize: 13, fontWeight: 700,
                cursor: title.trim() ? 'pointer' : 'default',
                boxShadow: title.trim() ? '0 4px 12px rgba(255,100,0,0.3)' : 'none',
                transition: 'all 0.15s',
              }}>
                {event ? 'Salvar alterações' : '+ Criar evento'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CurrentTimeLine ──────────────────────────────────────────────────────────
function CurrentTimeLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < FIRST_HOUR * 60 || minutes > (LAST_HOUR + 1) * 60) return null;
  const top = ((minutes - FIRST_HOUR * 60) / 60) * HOUR_H;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, zIndex: 5, pointerEvents: 'none' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, flexShrink: 0, marginLeft: -4 }} />
        <div style={{ flex: 1, height: 1.5, background: C.accent }} />
      </div>
    </div>
  );
}

// ─── Main Calendar ────────────────────────────────────────────────────────────
export default function Calendar() {
  // ── Auth & users ──
  // In production, swap MOCK_USERS with Supabase profiles query
  // and INITIAL_CURRENT_USER with supabase.auth.getUser()
  const [users,         setUsers]         = useState<CalendarUser[]>(MOCK_USERS);
  const [currentUserId, setCurrentUserId] = useState('u1');
  const [loadingUsers]                    = useState(false);

  // ── Calendar state ──
  const [events,      setEvents]      = useState<CalendarEvent[]>([]);
  const [anchor,      setAnchor]      = useState(hoje);
  const [view,        setView]        = useState<ViewMode>('semanal');
  const [selectedDate,setSelectedDate]= useState(hojeStr);
  const [miniYear,    setMiniYear]    = useState(hoje.getFullYear());
  const [miniMonth,   setMiniMonth]   = useState(hoje.getMonth());
  const [busca,       setBusca]       = useState('');
  const [filtros,     setFiltros]     = useState<Set<FilterCategory>>(
    new Set(['reunioes', 'tarefas', 'marcos', 'prazos', 'pessoal', 'aniversarios'])
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifs]    = useState<Notification[]>([]);

  // ── Modal state ──
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editEvent,   setEditEvent]   = useState<CalendarEvent | null>(null);
  const [clickDate,   setClickDate]   = useState<string | undefined>();

  // ── Seed demo events ──
  useEffect(() => {
    if (events.length > 0) return;
    const uids = users.map(u => u.user_id);
    const ds = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return toDateStr(d); };
    const seed: CalendarEvent[] = [
      { id: 's1', title: 'Reunião de Planejamento',  date: ds(0), startTime: '09:00', endTime: '09:45', color: 'primary',   participantIds: [uids[0], uids[1], uids[2]], category: 'reunioes', ownerId: uids[0] },
      { id: 's2', title: 'Revisão Editorial',        date: ds(0), startTime: '09:00', endTime: '10:00', color: 'teal',      participantIds: [uids[0], uids[3]],           category: 'reunioes', ownerId: uids[0] },
      { id: 's3', title: 'Alinhamento de Design',    date: ds(0), startTime: '11:00', endTime: '12:00', color: 'secondary', participantIds: [uids[0], uids[1]],           category: 'tarefas',  ownerId: uids[0] },
      { id: 's4', title: 'Check-in Semanal',         date: ds(1), startTime: '14:00', endTime: '14:30', color: 'accent',    participantIds: uids,                         category: 'reunioes', ownerId: uids[1] },
      { id: 's5', title: 'Marco: v2.0 Lançamento',   date: ds(1), startTime: '09:00', endTime: '09:30', color: 'rose',      participantIds: [uids[0], uids[2]],           category: 'marcos',   ownerId: uids[0] },
      { id: 's6', title: 'Entrega do Capítulo',      date: ds(2), startTime: '10:00', endTime: '11:00', color: 'amber',     participantIds: [uids[0]],                    category: 'prazos',   ownerId: uids[0] },
      { id: 's7', title: 'Demo para Cliente',        date: ds(2), startTime: '14:00', endTime: '15:30', color: 'teal',      participantIds: [uids[0], uids[1], uids[3]],  category: 'reunioes', ownerId: uids[0] },
      { id: 's8', title: 'Alinhamento de Logística', date: ds(3), startTime: '11:30', endTime: '12:00', color: 'primary',   participantIds: [uids[0], uids[2]],           category: 'reunioes', ownerId: uids[0] },
      { id: 's9', title: 'Sprint Planning',          date: ds(4), startTime: '10:00', endTime: '12:00', color: 'accent',    participantIds: uids,                         category: 'reunioes', ownerId: uids[1] },
    ];
    setEvents(seed);
  }, [users]);

  // ── Navigation ──
  const navegar = (dir: -1 | 1) => {
    const d = new Date(anchor);
    if (view === 'diario')  d.setDate(d.getDate() + dir);
    if (view === 'semanal') d.setDate(d.getDate() + dir * 7);
    if (view === 'mensal')  d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const toggleFiltro = (cat: FilterCategory) =>
    setFiltros(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  // ── Visible events (filtered to current user's agenda) ──
  const visibleEvents = useMemo(() =>
    events.filter(e =>
      filtros.has(e.category) &&
      (!busca || e.title.toLowerCase().includes(busca.toLowerCase())) &&
      (e.participantIds.includes(currentUserId) || e.ownerId === currentUserId)
    ), [events, filtros, busca, currentUserId]);

  const eventsForDate = (d: string) => visibleEvents.filter(e => e.date === d);

  // ── CRUD handlers ──
  const abrirCriar  = (d?: string)             => { setEditEvent(null); setClickDate(d); setModalOpen(true); };
  const abrirEditar = (ev: CalendarEvent)      => { setEditEvent(ev); setModalOpen(true); };

  const salvarEvento = (ev: CalendarEvent) => {
    const isNew    = !events.some(e => e.id === ev.id);
    const oldEvent = events.find(e => e.id === ev.id);

    setEvents(p => p.some(e => e.id === ev.id) ? p.map(e => e.id === ev.id ? ev : e) : [...p, ev]);

    // Generate notifications for newly invited participants
    const oldParts = oldEvent?.participantIds ?? [];
    const newParts = ev.participantIds.filter(uid => uid !== currentUserId);
    const toNotify = isNew
      ? newParts
      : newParts.filter(uid => !oldParts.includes(uid));

    if (toNotify.length > 0) {
      const newNotifs: Notification[] = toNotify.map(uid => ({
        id:         `n_${Date.now()}_${uid}`,
        type:       'invite' as const,
        eventId:    ev.id,
        eventTitle: ev.title,
        fromUserId: currentUserId,
        toUserId:   uid,
        read:       false,
        timestamp:  Date.now(),
      }));
      setNotifs(p => [...newNotifs, ...p]);
    }

    setModalOpen(false);
  };

  const excluirEvento = (id: string) => {
    setEvents(p => p.filter(e => e.id !== id));
    setNotifs(p => p.filter(n => n.eventId !== id));
  };

  const markRead    = (id: string) => setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
  const openNotif   = (n: Notification) => {
    const ev = events.find(e => e.id === n.eventId);
    if (ev) abrirEditar(ev);
  };

  // ── Column/week data ──
  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);
  const colunas = view === 'semanal'
    ? weekDates.map(d => ({ date: toDateStr(d), label: DIAS_PT[d.getDay()], dayNum: d.getDate(), isToday: toDateStr(d) === hojeStr }))
    : [{ date: toDateStr(anchor), label: DIAS_PT[anchor.getDay()], dayNum: anchor.getDate(), isToday: toDateStr(anchor) === hojeStr }];

  const miniDias = useMemo(() => getMiniDias(miniYear, miniMonth), [miniYear, miniMonth]);

  // ── Header label ──
  const headerLabel = () => {
    if (view === 'semanal') {
      const s = weekDates[0], e = weekDates[6];
      return s.getMonth() === e.getMonth()
        ? `${s.getDate()}–${e.getDate()} de ${MESES_PT[e.getMonth()]}, ${e.getFullYear()}`
        : `${s.getDate()} ${MESES_PT[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MESES_PT[e.getMonth()].slice(0,3)}, ${e.getFullYear()}`;
    }
    if (view === 'diario') {
      return `${DIAS_PT[anchor.getDay()]}, ${anchor.getDate()} de ${MESES_PT[anchor.getMonth()]} de ${anchor.getFullYear()}`;
    }
    return `${MESES_PT[anchor.getMonth()]} de ${anchor.getFullYear()}`;
  };

  const currentUser = users.find(u => u.user_id === currentUserId);
  // Notifications for the current user
  const myNotifications = notifications.filter(n => n.toUserId === currentUserId);

  if (loadingUsers) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg }}>
      <div style={{ textAlign: 'center', color: C.primary }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Carregando calendário…</div>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', height: '100vh', position: 'relative', overflow: 'hidden',
      fontFamily: "'DM Sans', system-ui, sans-serif", background: C.bg, color: C.primary,
    }}>

      {/* ══ SIDEBAR ══ */}
      <div style={{
        width: sidebarOpen ? 232 : 0, flexShrink: 0, background: C.card,
        borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', transition: 'width 0.22s ease',
      }}>
        <div style={{ width: 232, overflowY: 'auto', flex: 1, padding: '20px 0', userSelect: 'none' }}>

          {/* Mini calendar */}
          <div style={{ padding: '0 14px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>
                {MESES_PT[miniMonth].slice(0,3)} {miniYear}
              </span>
              <div style={{ display: 'flex', gap: 2 }}>
                {(['‹', '›'] as const).map((ch, i) => (
                  <button key={ch} onClick={() => {
                    const m = miniMonth + (i === 0 ? -1 : 1);
                    if (m < 0)       { setMiniMonth(11); setMiniYear(y => y - 1); }
                    else if (m > 11) { setMiniMonth(0);  setMiniYear(y => y + 1); }
                    else              setMiniMonth(m);
                  }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: C.muted, padding: '0 4px', lineHeight: 1 }}>
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 2 }}>
              {['D','S','T','Q','Q','S','S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: C.muted, padding: '2px 0' }}>{d}</div>
              ))}
              {miniDias.map((cell, i) => {
                const offset = cell.m === 'p' ? -1 : cell.m === 'n' ? 1 : 0;
                const dStr = toDateStr(new Date(miniYear, miniMonth + offset, cell.day));
                const isToday = dStr === hojeStr;
                const isSel   = dStr === selectedDate;
                return (
                  <div key={i} onClick={() => { setSelectedDate(dStr); setAnchor(new Date(dStr + 'T12:00:00')); }} style={{
                    textAlign: 'center', fontSize: 11, padding: '3px 0', cursor: 'pointer',
                    borderRadius: 6, fontWeight: isToday || isSel ? 700 : 400,
                    color: cell.m !== 'c' ? C.pMd : isToday ? '#fff' : C.primary,
                    background: isToday ? C.primary : isSel ? C.pLo : 'transparent',
                    transition: 'background 0.1s',
                  }}>
                    {cell.day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* New event button */}
          <div style={{ padding: '0 14px 20px' }}>
            <button onClick={() => abrirCriar(selectedDate)} style={{
              width: '100%', background: C.primary, border: 'none', color: '#fff',
              borderRadius: 10, padding: '9px 0', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              + Novo Evento
            </button>
          </div>

          {/* Filters */}
          <div style={{ padding: '0 14px 20px', borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
              letterSpacing: '0.8px', display: 'block', marginBottom: 10 }}>
              Meu Calendário
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {FILTROS.map(f => {
                const on = filtros.has(f.key);
                return (
                  <label key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
                    padding: '5px 8px', borderRadius: 8,
                    background: on ? C.pLo : 'transparent',
                    transition: 'background 0.1s',
                  }}>
                    <div onClick={() => toggleFiltro(f.key)} style={{
                      width: 15, height: 15, borderRadius: 5, flexShrink: 0,
                      border: `1.5px solid ${on ? C.primary : C.pMd}`,
                      background: on ? C.primary : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.1s',
                    }}>
                      {on && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="2 6 5 9 10 3"/></svg>}
                    </div>
                    <span style={{ fontSize: 12, color: on ? C.primary : C.muted, fontWeight: on ? 600 : 400 }}>
                      {f.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Other users */}
          <div style={{ padding: '0 14px', borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
              letterSpacing: '0.8px', display: 'block', marginBottom: 10 }}>
              Outros Calendários
            </span>
            {users.filter(u => u.user_id !== currentUserId).map(u => (
              <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, padding: '3px 0' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: u.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
              </div>
            ))}
          </div>

          {/* Demo: switch user */}
          <div style={{ padding: '16px 14px 0', borderTop: `1px solid ${C.border}`, marginTop: 16 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
              letterSpacing: '0.8px', display: 'block', marginBottom: 10 }}>
              Simular usuário (demo)
            </span>
            {users.map(u => (
              <div key={u.user_id} onClick={() => setCurrentUserId(u.user_id)} style={{
                display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, padding: '5px 8px',
                borderRadius: 8, cursor: 'pointer',
                background: currentUserId === u.user_id ? C.pLo : 'transparent',
                border: `1px solid ${currentUserId === u.user_id ? C.pMd : 'transparent'}`,
                transition: 'all 0.1s',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: u.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>{u.initials}</div>
                <span style={{ fontSize: 12, color: C.primary, fontWeight: currentUserId === u.user_id ? 700 : 400 }}>
                  {u.name}
                </span>
                {currentUserId === u.user_id && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: C.accent, fontWeight: 700 }}>●</span>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ══ MAIN AREA ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', background: C.card, borderBottom: `1px solid ${C.border}`,
          flexShrink: 0, gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <button onClick={() => setSidebarOpen(o => !o)} style={{
              border: 'none', background: C.pLo, borderRadius: 8, width: 34, height: 34,
              cursor: 'pointer', color: C.primary, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6"  x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button onClick={() => navegar(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, padding: '0 2px', lineHeight: 1 }}>‹</button>
            <button onClick={() => navegar(1)}  style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, padding: '0 2px', lineHeight: 1 }}>›</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {headerLabel()}
            </span>
            <button onClick={() => setAnchor(new Date())} style={{
              border: `1.5px solid ${C.border}`, background: 'none', color: C.primary,
              borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>Hoje</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar…"
                style={{
                  paddingLeft: 30, paddingRight: 12, height: 34, borderRadius: 8,
                  border: `1.5px solid ${C.border}`, fontSize: 12, background: C.bg,
                  color: C.primary, outline: 'none', width: 160, fontFamily: 'inherit',
                }}
              />
            </div>

            {/* View switcher */}
            <div style={{ display: 'flex', background: C.pLo, borderRadius: 10, padding: 3 }}>
              {([['diario', 'Diário'], ['semanal', 'Semanal'], ['mensal', 'Mensal']] as [ViewMode, string][]).map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} style={{
                  border: 'none', borderRadius: 7, padding: '5px 12px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  background: view === v ? C.primary : 'transparent',
                  color:      view === v ? '#fff' : C.muted,
                  boxShadow:  view === v ? '0 1px 4px rgba(0,50,35,0.18)' : 'none',
                }}>{label}</button>
              ))}
            </div>

            {/* Notifications */}
            <NotificationBell
              notifications={myNotifications}
              users={users}
              onRead={markRead}
              onOpen={openNotif}
            />

            {/* Current user avatar */}
            {currentUser && (
              <div title={currentUser.name} style={{
                width: 34, height: 34, borderRadius: '50%', background: currentUser.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden',
                border: `2px solid ${C.primary}`,
              }}>
                {currentUser.avatar_url
                  ? <img src={currentUser.avatar_url} alt={currentUser.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : currentUser.initials}
              </div>
            )}
          </div>
        </div>

        {/* ── Grid view ── */}
        {view !== 'mensal' ? (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Day header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `52px repeat(${colunas.length}, minmax(0,1fr))`,
              borderBottom: `1px solid ${C.border}`,
              background: C.card, flexShrink: 0, position: 'sticky', top: 0, zIndex: 20,
            }}>
              <div style={{ padding: '10px 0', borderRight: `1px solid ${C.border}` }} />
              {colunas.map(col => (
                <div key={col.date} onClick={() => { setSelectedDate(col.date); setAnchor(new Date(col.date + 'T12:00:00')); }} style={{
                  padding: '10px 8px 8px', textAlign: 'center',
                  borderLeft: `1px solid ${C.border}`,
                  background: col.isToday ? C.today : C.card,
                  cursor: 'pointer', transition: 'background 0.1s',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
                    color: col.isToday ? C.primary : C.muted }}>
                    {col.label}
                  </div>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', margin: '3px auto 0',
                    background: col.isToday ? C.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 700,
                      color: col.isToday ? '#fff' : C.primary, opacity: col.isToday ? 1 : 0.7 }}>
                      {col.dayNum}
                    </span>
                  </div>
                  {/* Event count badge */}
                  {eventsForDate(col.date).length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 4 }}>
                      {eventsForDate(col.date).slice(0, 4).map(ev => (
                        <div key={ev.id} style={{ width: 5, height: 5, borderRadius: '50%', background: EC[ev.color].bar }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `52px repeat(${colunas.length}, minmax(0,1fr))`,
                height: GRID_H,
              }}>
                {/* Hour labels */}
                <div style={{ borderRight: `1px solid ${C.border}`, position: 'relative' }}>
                  {HORAS.map(h => (
                    <div key={h} style={{
                      height: HOUR_H, display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4,
                      boxSizing: 'border-box',
                    }}>
                      <span style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap' }}>
                        {String(h).padStart(2,'0')}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {colunas.map(col => {
                  const dayEvents  = eventsForDate(col.date);
                  const layout     = computeEventLayout(dayEvents);
                  const isToday    = col.date === hojeStr;

                  return (
                    <div key={col.date} style={{
                      borderLeft: `1px solid ${C.border}`,
                      position: 'relative',
                      height: GRID_H,
                      background: isToday ? C.today : 'transparent',
                    }}>
                      {/* Hour grid lines */}
                      {HORAS.map((h, i) => (
                        <div key={h} style={{
                          position: 'absolute', left: 0, right: 0,
                          top: i * HOUR_H, height: HOUR_H,
                          borderTop: `1px solid ${C.border}`,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          const clickedDate = col.date;
                          const clickedTime = `${String(h).padStart(2,'0')}:00`;
                          setClickDate(clickedDate);
                          setEditEvent(null);
                          setModalOpen(true);
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,50,35,0.025)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        />
                      ))}

                      {/* Current time line */}
                      {isToday && <CurrentTimeLine />}

                      {/* Events */}
                      {dayEvents.map(ev => {
                        const l   = layout[ev.id] ?? { colIdx: 0, totalCols: 1 };
                        const px  = eventPx(ev, l);
                        const isOwn = ev.ownerId === currentUserId;
                        return (
                          <EventCard
                            key={ev.id} event={ev} users={users}
                            onClick={() => abrirEditar(ev)}
                            top={px.top} height={px.height} left={px.left} width={px.width}
                            isOwn={isOwn}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ── Monthly view ── */
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0 2px', marginBottom: 6 }}>
              {DIAS_PT.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700,
                  color: C.muted, padding: '4px 0', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {getMiniDias(anchor.getFullYear(), anchor.getMonth()).map((cell, i) => {
                const offset = cell.m === 'p' ? -1 : cell.m === 'n' ? 1 : 0;
                const dStr   = toDateStr(new Date(anchor.getFullYear(), anchor.getMonth() + offset, cell.day));
                const dayEvents = eventsForDate(dStr);
                const isToday   = dStr === hojeStr;
                const isSelected = dStr === selectedDate;
                return (
                  <div key={i} onClick={() => { setSelectedDate(dStr); abrirCriar(dStr); }} style={{
                    minHeight: 90, background: C.card,
                    borderRadius: 10, padding: '7px 7px 5px',
                    border: isToday
                      ? `1.5px solid ${C.primary}`
                      : isSelected
                        ? `1.5px solid ${C.pHi}`
                        : `1px solid ${C.border}`,
                    cursor: 'pointer', transition: 'box-shadow 0.1s',
                    opacity: cell.m !== 'c' ? 0.35 : 1,
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,50,35,0.1)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      width: 22, height: 22, borderRadius: '50%',
                      background: isToday ? C.primary : 'transparent',
                      color: isToday ? '#fff' : C.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 4,
                    }}>
                      {cell.day}
                    </div>
                    {dayEvents.slice(0, 3).map(ev => {
                      const c = EC[ev.color];
                      return (
                        <div key={ev.id} onClick={e => { e.stopPropagation(); abrirEditar(ev); }} style={{
                          background: c.bg, borderRadius: 5, padding: '2px 6px 2px 4px',
                          fontSize: 10, fontWeight: 600, color: c.text, marginBottom: 2,
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          cursor: 'pointer', borderLeft: `3px solid ${c.bar}`,
                          transition: 'opacity 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '0.8'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, marginTop: 1 }}>
                        +{dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal overlay ── */}
      {modalOpen && (
        <EventModal
          event={editEvent}
          users={users}
          currentUserId={currentUserId}
          onSave={salvarEvento}
          onDelete={excluirEvento}
          onClose={() => setModalOpen(false)}
          initialDate={clickDate}
        />
      )}
    </div>
  );
}