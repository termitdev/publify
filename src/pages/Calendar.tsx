import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface CalendarUser {
  id: string;          // profiles.id
  user_id: string;     // profiles.user_id
  name: string;        // profiles.full_name
  email: string;       // profiles.email
  avatar_url: string | null;
  initials: string;
  color: string;       // gerada deterministicamente do user_id
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;             // 'YYYY-MM-DD'
  startTime: string;        // 'HH:MM'
  endTime: string;          // 'HH:MM'
  color: EventColor;
  participantIds: string[]; // profiles.user_id
  category: FilterCategory;
  description?: string;
  ownerId: string;
}

type EventColor     = 'primary' | 'accent' | 'secondary' | 'teal' | 'rose' | 'amber';
type FilterCategory = 'reunioes' | 'tarefas' | 'marcos' | 'prazos' | 'pessoal' | 'aniversarios';
type ViewMode       = 'diario' | 'semanal' | 'mensal';

// ─── Cores alinhadas ao design system (#003223 / #ff6400 / #bcc850) ───────────
const EC: Record<EventColor, { bg: string; border: string; text: string; time: string }> = {
  primary:   { bg: 'rgba(0,50,35,0.08)',    border: 'rgba(0,50,35,0.20)',    text: '#003223', time: '#003223' },
  accent:    { bg: 'rgba(255,100,0,0.09)',  border: 'rgba(255,100,0,0.25)',  text: '#cc5000', time: '#ff6400' },
  secondary: { bg: 'rgba(188,200,80,0.13)', border: 'rgba(188,200,80,0.32)', text: '#5a6315', time: '#6b7a1a' },
  teal:      { bg: 'rgba(13,148,136,0.09)', border: 'rgba(13,148,136,0.22)', text: '#0f766e', time: '#0d9488' },
  rose:      { bg: 'rgba(225,29,72,0.08)',  border: 'rgba(225,29,72,0.20)',  text: '#be123c', time: '#e11d48' },
  amber:     { bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.20)',   text: '#92400e', time: '#b45309' },
};

const COLOR_LABELS: Record<EventColor, string> = {
  primary: 'Verde', accent: 'Laranja', secondary: 'Lima',
  teal: 'Ciano', rose: 'Rosa', amber: 'Âmbar',
};

// Paleta de avatar determinística
const AVATAR_BG = [
  '#003223','#cc5000','#5a6315','#0f766e','#be123c',
  '#92400e','#1d4ed8','#7c3aed','#0e7490','#15803d',
];
function avatarColor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}
function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// ─── PT-BR ────────────────────────────────────────────────────────────────────
const HORAS    = Array.from({ length: 15 }, (_, i) => i + 7); // 07h–21h
const DIAS_PT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const FILTROS: { key: FilterCategory; label: string }[] = [
  { key: 'reunioes',     label: 'Reuniões'     },
  { key: 'tarefas',      label: 'Tarefas'      },
  { key: 'marcos',       label: 'Marcos'       },
  { key: 'prazos',       label: 'Prazos'       },
  { key: 'pessoal',      label: 'Pessoal'      },
  { key: 'aniversarios', label: 'Aniversários' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseTime  = (t: string) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
const fmtHora    = (t: string) => { const [h,m] = t.split(':').map(Number); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; };
const toDateStr  = (d: Date)   => d.toISOString().slice(0, 10);
const hoje       = new Date();
const hojeStr    = toDateStr(hoje);

function getWeekDates(anchor: Date): Date[] {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate()+i); return x; });
}

function getMiniDias(year: number, month: number) {
  const first    = new Date(year, month, 1).getDay();
  const total    = new Date(year, month+1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: { day: number; m: 'p'|'c'|'n' }[] = [];
  for (let i = first-1; i >= 0; i--) cells.push({ day: prevDays-i, m:'p' });
  for (let i = 1; i <= total; i++)   cells.push({ day: i, m:'c' });
  while (cells.length < 42)          cells.push({ day: cells.length-total-first+1, m:'n' });
  return cells;
}

// ─── Design tokens locais ─────────────────────────────────────────────────────
const C = {
  bg:        '#fcfcfc',
  card:      '#ffffff',
  primary:   '#003223',
  pLo:       'rgba(0,50,35,0.07)',
  pMd:       'rgba(0,50,35,0.15)',
  accent:    '#ff6400',
  aLo:       'rgba(255,100,0,0.09)',
  border:    'rgba(0,50,35,0.09)',
  muted:     'rgba(0,50,35,0.42)',
};

// ─── AvatarGroup ──────────────────────────────────────────────────────────────
function AvatarGroup({ ids, users, max=3 }: { ids: string[]; users: CalendarUser[]; max?: number }) {
  const shown = ids.slice(0, max), extra = ids.length - max;
  return (
    <div style={{ display:'flex', marginTop:4 }}>
      {shown.map((uid, i) => {
        const u = users.find(x => x.user_id === uid);
        if (!u) return null;
        return (
          <div key={uid} title={u.name} style={{
            width:20, height:20, borderRadius:'50%', background:u.color,
            border:'2px solid #fff', marginLeft: i>0 ? -6 : 0,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:7, fontWeight:700, color:'#fff', zIndex:shown.length-i,
            flexShrink:0, overflow:'hidden',
          }}>
            {u.avatar_url
              ? <img src={u.avatar_url} alt={u.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : u.initials}
          </div>
        );
      })}
      {extra > 0 && (
        <div style={{
          width:20, height:20, borderRadius:'50%', background:C.pLo,
          border:'2px solid #fff', marginLeft:-6,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:7, fontWeight:700, color:C.primary,
        }}>+{extra}</div>
      )}
    </div>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────
function EventCard({ event, users, onClick, style }: {
  event: CalendarEvent; users: CalendarUser[];
  onClick: () => void; style?: React.CSSProperties;
}) {
  const c = EC[event.color];
  return (
    <div onClick={e => { e.stopPropagation(); onClick(); }} style={{
      background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:10,
      padding:'6px 8px', cursor:'pointer', overflow:'hidden',
      transition:'box-shadow .15s, transform .12s', ...style,
    }}
    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow='0 4px 16px rgba(0,50,35,0.14)'; el.style.transform='translateY(-1px)'; }}
    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow='none'; el.style.transform='none'; }}
    >
      <div style={{ fontSize:12, fontWeight:600, color:c.text, lineHeight:1.3 }}>{event.title}</div>
      <div style={{ fontSize:11, color:c.time, marginTop:2, display:'flex', alignItems:'center', gap:3 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        {fmtHora(event.startTime)} – {fmtHora(event.endTime)}
      </div>
      {event.participantIds.length > 0 && <AvatarGroup ids={event.participantIds} users={users} />}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function EventModal({ event, users, currentUserId, onSave, onDelete, onClose, initialDate }: {
  event?: CalendarEvent|null; users: CalendarUser[]; currentUserId: string;
  onSave:(e:CalendarEvent)=>void; onDelete?:(id:string)=>void;
  onClose:()=>void; initialDate?:string;
}) {
  const [title,    setTitle]   = useState(event?.title       || '');
  const [date,     setDate]    = useState(event?.date        || initialDate || hojeStr);
  const [start,    setStart]   = useState(event?.startTime   || '09:00');
  const [end,      setEnd]     = useState(event?.endTime     || '10:00');
  const [color,    setColor]   = useState<EventColor>(event?.color    || 'primary');
  const [cat,      setCat]     = useState<FilterCategory>(event?.category || 'reunioes');
  const [parts,    setParts]   = useState<string[]>(event?.participantIds ?? [currentUserId]);
  const [desc,     setDesc]    = useState(event?.description || '');
  const [busca,    setBusca]   = useState('');

  const filtrados = users.filter(u =>
    u.name.toLowerCase().includes(busca.toLowerCase()) ||
    u.email.toLowerCase().includes(busca.toLowerCase())
  );
  const toggle = (uid: string) =>
    setParts(p => p.includes(uid) ? p.filter(x=>x!==uid) : [...p, uid]);

  const salvar = () => {
    if (!title.trim()) return;
    onSave({ id: event?.id||`ev_${Date.now()}`, title, date, startTime:start, endTime:end,
             color, category:cat, participantIds:parts, description:desc,
             ownerId: event?.ownerId||currentUserId });
    onClose();
  };

  const inp: React.CSSProperties = {
    width:'100%', padding:'8px 12px', borderRadius:10, fontFamily:'inherit',
    border:`1.5px solid ${C.border}`, fontSize:13, outline:'none',
    background:C.bg, color:C.primary, boxSizing:'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize:10, fontWeight:700, color:C.muted, display:'block',
    marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px',
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,26,18,0.5)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(6px)' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, width:540, maxWidth:'96vw', maxHeight:'92vh',
        overflow:'auto', boxShadow:'0 24px 64px rgba(0,50,35,0.2)', padding:28 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:C.primary }}>
            {event ? 'Editar Compromisso' : 'Novo Compromisso'}
          </h2>
          <button onClick={onClose} style={{ border:'none', background:C.pLo, borderRadius:8,
            width:32, height:32, cursor:'pointer', color:C.primary, fontSize:16,
            display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Título */}
          <div>
            <label style={lbl}>Título *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)}
              placeholder="Nome do compromisso…" style={inp} autoFocus />
          </div>

          {/* Data + Horas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div><label style={lbl}>Data</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Início</label><input type="time" value={start} onChange={e=>setStart(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Fim</label><input type="time" value={end} onChange={e=>setEnd(e.target.value)} style={inp} /></div>
          </div>

          {/* Categoria */}
          <div>
            <label style={lbl}>Categoria</label>
            <select value={cat} onChange={e=>setCat(e.target.value as FilterCategory)}
              style={{ ...inp, appearance:'none', cursor:'pointer' }}>
              {FILTROS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>

          {/* Cor */}
          <div>
            <label style={lbl}>Cor</label>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:2 }}>
              {(Object.keys(EC) as EventColor[]).map(key => {
                const c = EC[key]; const sel = color === key;
                return (
                  <button key={key} onClick={()=>setColor(key)} title={COLOR_LABELS[key]} style={{
                    display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
                    borderRadius:99, cursor:'pointer', border:`1.5px solid ${sel?c.text:c.border}`,
                    background: sel ? c.bg : 'transparent', transition:'all .12s',
                  }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:c.text }} />
                    <span style={{ fontSize:11, fontWeight:600, color:c.text }}>{COLOR_LABELS[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Participantes */}
          <div>
            <label style={lbl}>Participantes ({parts.length})</label>
            <input value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              style={{ ...inp, marginBottom:8 }} />
            <div style={{ maxHeight:180, overflowY:'auto', border:`1.5px solid ${C.border}`, borderRadius:10 }}>
              {filtrados.length === 0 && (
                <div style={{ padding:14, fontSize:12, color:C.muted, textAlign:'center' }}>
                  Nenhum usuário encontrado
                </div>
              )}
              {filtrados.map((u, i) => {
                const sel = parts.includes(u.user_id);
                return (
                  <div key={u.user_id} onClick={()=>toggle(u.user_id)} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                    cursor:'pointer', background: sel ? C.pLo : '#fff',
                    borderBottom: i < filtrados.length-1 ? `1px solid ${C.border}` : 'none',
                    transition:'background .1s',
                  }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:u.color,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:700, color:'#fff', flexShrink:0, overflow:'hidden' }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt={u.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : u.initials}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.primary,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</div>
                      <div style={{ fontSize:11, color:C.muted,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{u.email}</div>
                    </div>
                    <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                      border:`2px solid ${sel ? C.primary : C.pMd}`,
                      background: sel ? C.primary : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all .1s' }}>
                      {sel && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="2 6 5 9 10 3"/></svg>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Tags dos selecionados */}
            {parts.length > 0 && (
              <div style={{ marginTop:6, display:'flex', gap:4, flexWrap:'wrap' }}>
                {parts.map(uid => {
                  const u = users.find(x => x.user_id === uid);
                  if (!u) return null;
                  return (
                    <span key={uid} style={{ background:C.pLo, borderRadius:99,
                      padding:'3px 10px', fontSize:11, fontWeight:600, color:C.primary,
                      display:'flex', alignItems:'center', gap:5 }}>
                      {u.initials}
                      <button onClick={()=>toggle(uid)} style={{ border:'none', background:'none',
                        cursor:'pointer', color:C.primary, fontSize:12, padding:0, lineHeight:1 }}>✕</button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label style={lbl}>Descrição</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
              placeholder="Detalhes adicionais…"
              style={{ ...inp, resize:'vertical' }} />
          </div>

          {/* Ações */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
            {event && onDelete
              ? <button onClick={()=>{ onDelete(event.id); onClose(); }} style={{
                  background:'rgba(225,29,72,0.08)', border:'1.5px solid rgba(225,29,72,0.2)',
                  color:'#be123c', borderRadius:10, padding:'9px 16px',
                  fontSize:13, fontWeight:600, cursor:'pointer' }}>Excluir</button>
              : <div />}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onClose} style={{ background:C.pLo, border:'none', color:C.primary,
                borderRadius:10, padding:'9px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={!title.trim()} style={{
                background: title.trim() ? C.accent : C.pLo,
                border:'none', color: title.trim() ? '#fff' : C.muted,
                borderRadius:10, padding:'9px 22px', fontSize:13, fontWeight:700,
                cursor: title.trim() ? 'pointer' : 'default',
                boxShadow: title.trim() ? '0 4px 12px rgba(255,100,0,0.3)' : 'none',
                transition:'all .15s' }}>
                {event ? 'Salvar' : '+ Criar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Calendário Principal ─────────────────────────────────────────────────────
export default function Calendar() {
  // ── Supabase: sessão + perfis ──
  const [currentUserId, setCurrentUserId] = useState('');
  const [users,         setUsers]         = useState<CalendarUser[]>([]);
  const [loadingUsers,  setLoadingUsers]  = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoadingUsers(true);

      // Usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      // Todos os perfis cadastrados
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, avatar_url')
        .order('full_name');

      if (!error && profiles) {
        setUsers(profiles.map(p => ({
          id:        p.id,
          user_id:   p.user_id,
          name:      p.full_name  || p.email || 'Sem nome',
          email:     p.email      || '',
          avatar_url:p.avatar_url || null,
          initials:  getInitials(p.full_name || p.email || 'SN'),
          color:     avatarColor(p.user_id),
        })));
      }
      setLoadingUsers(false);
    };

    init();

    // Realtime: atualiza se algum perfil mudar
    const ch = supabase.channel('profiles-cal')
      .on('postgres_changes', { event:'*', schema:'public', table:'profiles' }, init)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── Estado do calendário ──
  const [events,       setEvents]       = useState<CalendarEvent[]>([]);
  const [anchor,       setAnchor]       = useState(new Date());
  const [view,         setView]         = useState<ViewMode>('semanal');
  const [selectedDate, setSelectedDate] = useState(hojeStr);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editEvent,    setEditEvent]    = useState<CalendarEvent|null>(null);
  const [clickDate,    setClickDate]    = useState<string|undefined>();
  const [busca,        setBusca]        = useState('');
  const [filtros,      setFiltros]      = useState<Set<FilterCategory>>(new Set(['reunioes']));
  const [reminder,     setReminder]     = useState<CalendarEvent|null>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [miniYear,     setMiniYear]     = useState(hoje.getFullYear());
  const [miniMonth,    setMiniMonth]    = useState(hoje.getMonth());

  // ── Seed de eventos de exemplo (roda uma vez após carregar usuários) ──
  useEffect(() => {
    if (users.length === 0 || events.length > 0) return;
    const uids = users.map(u => u.user_id);
    const pick = (n: number) => uids.slice(0, Math.min(n, uids.length));
    const ds   = (o: number) => { const d=new Date(); d.setDate(d.getDate()+o); return toDateStr(d); };
    const seed: CalendarEvent[] = [
      { id:'s1', title:'Reunião de Planejamento', date:ds(0), startTime:'09:00', endTime:'09:45', color:'primary',   participantIds:pick(4), category:'reunioes', ownerId:uids[0]??'' },
      { id:'s2', title:'Revisão Editorial',       date:ds(0), startTime:'11:00', endTime:'12:00', color:'teal',      participantIds:pick(2), category:'reunioes', ownerId:uids[0]??'' },
      { id:'s3', title:'Entrega do Capítulo',     date:ds(1), startTime:'10:00', endTime:'11:00', color:'accent',    participantIds:pick(3), category:'prazos',   ownerId:uids[0]??'' },
      { id:'s4', title:'Check-in Semanal',        date:ds(1), startTime:'14:00', endTime:'14:30', color:'secondary', participantIds:pick(5), category:'reunioes', ownerId:uids[0]??'' },
      { id:'s5', title:'Marco: v2.0 Lançamento',  date:ds(2), startTime:'09:00', endTime:'10:00', color:'rose',      participantIds:pick(2), category:'marcos',   ownerId:uids[0]??'' },
      { id:'s6', title:'Alinhamento de Logística',date:ds(2), startTime:'11:30', endTime:'12:00', color:'amber',     participantIds:pick(3), category:'reunioes', ownerId:uids[0]??'' },
      { id:'s7', title:'Revisão de Design',       date:ds(3), startTime:'10:00', endTime:'10:45', color:'primary',   participantIds:pick(2), category:'tarefas',  ownerId:uids[0]??'' },
      { id:'s8', title:'Demo para Cliente',       date:ds(3), startTime:'13:00', endTime:'14:00', color:'teal',      participantIds:pick(4), category:'reunioes', ownerId:uids[0]??'' },
    ];
    // Garante que o usuário logado está em todos os eventos de seed
    const com = seed.map(e => ({
      ...e,
      participantIds: e.participantIds.includes(currentUserId) || !currentUserId
        ? e.participantIds
        : [currentUserId, ...e.participantIds],
    }));
    setEvents(com);
    if (com[0]) setReminder(com[0]);
  }, [users]);

  // ── Navegação ──
  const navegar = (dir: -1|1) => {
    const d = new Date(anchor);
    if (view==='diario')  d.setDate(d.getDate()+dir);
    if (view==='semanal') d.setDate(d.getDate()+dir*7);
    if (view==='mensal')  d.setMonth(d.getMonth()+dir);
    setAnchor(d);
  };

  const toggleFiltro = (cat: FilterCategory) =>
    setFiltros(prev => { const n=new Set(prev); n.has(cat)?n.delete(cat):n.add(cat); return n; });

  // ── Eventos visíveis ──
  const visibleEvents = useMemo(() =>
    events.filter(e =>
      filtros.has(e.category) &&
      (!busca || e.title.toLowerCase().includes(busca.toLowerCase())) &&
      (e.participantIds.includes(currentUserId) || !currentUserId)
    ), [events, filtros, busca, currentUserId]);

  const eventsForDate = (d: string) => visibleEvents.filter(e => e.date === d);

  // ── CRUD ──
  const abrirCriar  = (d?: string) => { setEditEvent(null); setClickDate(d); setModalOpen(true); };
  const abrirEditar = (ev: CalendarEvent) => { setEditEvent(ev); setModalOpen(true); };
  const salvar      = (ev: CalendarEvent) =>
    setEvents(p => p.some(e=>e.id===ev.id) ? p.map(e=>e.id===ev.id?ev:e) : [...p,ev]);
  const excluir     = (id: string) => {
    setEvents(p => p.filter(e=>e.id!==id));
    if (reminder?.id===id) setReminder(null);
  };

  // ── Posição dos eventos na grade (1px = 1min, âncora 07:00) ──
  const eventStyle = (ev: CalendarEvent): React.CSSProperties => ({
    position:'absolute',
    top:    parseTime(ev.startTime) - 7*60,
    height: Math.max(parseTime(ev.endTime)-parseTime(ev.startTime)-4, 28),
    left:4, right:4,
  });

  // ── Colunas da grade ──
  const weekDates = useMemo(()=>getWeekDates(anchor),[anchor]);
  const colunas = view==='semanal'
    ? weekDates.map(d=>({ date:toDateStr(d), label:DIAS_PT[d.getDay()], dayNum:d.getDate(), isToday:toDateStr(d)===hojeStr }))
    : [{ date:toDateStr(anchor), label:DIAS_PT[anchor.getDay()], dayNum:anchor.getDate(), isToday:toDateStr(anchor)===hojeStr }];

  const miniDias = useMemo(()=>getMiniDias(miniYear,miniMonth),[miniYear,miniMonth]);

  // ── Header label PT-BR ──
  const headerLabel = () => {
    if (view==='semanal') {
      const s=weekDates[0], e=weekDates[6];
      return s.getMonth()===e.getMonth()
        ? `${s.getDate()} – ${e.getDate()} de ${MESES_PT[e.getMonth()]}, ${e.getFullYear()}`
        : `${s.getDate()} ${MESES_PT[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MESES_PT[e.getMonth()].slice(0,3)}, ${e.getFullYear()}`;
    }
    if (view==='diario') {
      const d=anchor;
      return `${DIAS_PT[d.getDay()]}, ${d.getDate()} de ${MESES_PT[d.getMonth()]} de ${d.getFullYear()}`;
    }
    return `${MESES_PT[anchor.getMonth()]} de ${anchor.getFullYear()}`;
  };

  const currentUser = users.find(u=>u.user_id===currentUserId);

  if (loadingUsers) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:C.bg }}>
      <div style={{ textAlign:'center', color:C.primary }}>
        <div style={{ fontSize:28, marginBottom:8 }}></div>
        <div style={{ fontSize:14, fontWeight:600 }}>Carregando</div>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif",
      background:C.bg, color:C.primary, overflow:'hidden' }}>

      {/* ══ SIDEBAR ══ */}
      <div style={{ width:sidebarOpen?228:0, flexShrink:0, background:C.card,
        borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column',
        overflow:'hidden', transition:'width .25s ease' }}>
        <div style={{ width:228, overflowY:'auto', flex:1, padding:'20px 0' }}>

          {/* Mini calendário */}
          <div style={{ padding:'0 16px 18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.primary }}>
                {MESES_PT[miniMonth].slice(0,3)} {miniYear}
              </span>
              <div style={{ display:'flex', gap:4 }}>
                {(['‹','›'] as const).map((ch,i)=>(
                  <button key={ch} onClick={()=>{
                    const m=miniMonth+(i===0?-1:1);
                    if (m<0)       { setMiniMonth(11); setMiniYear(y=>y-1); }
                    else if (m>11) { setMiniMonth(0);  setMiniYear(y=>y+1); }
                    else            setMiniMonth(m);
                  }} style={{ border:'none', background:'none', cursor:'pointer', fontSize:16, color:C.muted, padding:'0 2px' }}>
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px 0' }}>
              {['D','S','T','Q','Q','S','S'].map((d,i)=>(
                <div key={i} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:C.muted, padding:'2px 0' }}>{d}</div>
              ))}
              {miniDias.map((cell,i)=>{
                const dStr=toDateStr(new Date(miniYear, miniMonth+(cell.m==='p'?-1:cell.m==='n'?1:0), cell.day));
                const isToday=dStr===hojeStr, isSel=dStr===selectedDate;
                return (
                  <div key={i} onClick={()=>{ setSelectedDate(dStr); setAnchor(new Date(dStr+'T12:00:00')); }}
                    style={{ textAlign:'center', fontSize:11, padding:'3px 0', cursor:'pointer',
                      borderRadius:6, fontWeight:isToday||isSel?700:400,
                      color: cell.m!=='c'?C.pMd : isToday?'#fff':C.primary,
                      background: isToday?C.primary : isSel?C.pLo:'transparent',
                      transition:'background .1s' }}>
                    {cell.day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lembrete */}
          {reminder && (
            <div style={{ margin:'0 12px 18px', background:C.primary, borderRadius:14, padding:14 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.55)',
                marginBottom:6, letterSpacing:1, textTransform:'uppercase' }}>Lembrete</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:4, lineHeight:1.3 }}>
                {reminder.title}
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', display:'flex',
                alignItems:'center', gap:4, marginBottom:10 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                {fmtHora(reminder.startTime)} – {fmtHora(reminder.endTime)}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <AvatarGroup ids={reminder.participantIds} users={users} max={4} />
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>setReminder(null)} style={{ width:26,height:26,borderRadius:'50%',
                    border:'none', background:'rgba(255,255,255,0.15)', color:'#fff',
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>✕</button>
                  <button onClick={()=>{ abrirEditar(reminder); setReminder(null); }} style={{
                    width:26,height:26,borderRadius:'50%', border:'none',
                    background:C.accent, color:'#fff',
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:700 }}>✓</button>
                </div>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div style={{ padding:'0 16px 18px' }}>
            <span style={{ fontSize:10, fontWeight:700, color:C.primary, textTransform:'uppercase',
              letterSpacing:'.5px', display:'block', marginBottom:10 }}>Filtros</span>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {FILTROS.map(f=>{
                const on=filtros.has(f.key);
                return (
                  <label key={f.key} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', userSelect:'none' }}>
                    <div onClick={()=>toggleFiltro(f.key)} style={{ width:16,height:16,borderRadius:5,
                      flexShrink:0, border:`2px solid ${on?C.primary:C.pMd}`,
                      background:on?C.primary:'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all .1s' }}>
                      {on && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="2 6 5 9 10 3"/></svg>}
                    </div>
                    <span style={{ fontSize:12, color:on?C.primary:C.muted, fontWeight:on?600:400 }}>
                      {f.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Outros calendários */}
          <div style={{ padding:'0 16px', borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
            <span style={{ fontSize:10, fontWeight:700, color:C.primary, textTransform:'uppercase',
              letterSpacing:'.5px', display:'block', marginBottom:10 }}>Outros Calendários</span>
            {users.filter(u=>u.user_id!==currentUserId).map(u=>(
              <div key={u.user_id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:10,height:10,borderRadius:'50%',background:u.color,flexShrink:0 }} />
                <span style={{ fontSize:12, color:C.muted, whiteSpace:'nowrap',
                  overflow:'hidden', textOverflow:'ellipsis' }}>{u.name}</span>
              </div>
            ))}
            {users.filter(u=>u.user_id!==currentUserId).length===0 && (
              <p style={{ fontSize:11, color:C.muted, margin:0 }}>Sem outros usuários.</p>
            )}
          </div>
        </div>
      </div>

      {/* ══ ÁREA PRINCIPAL ══ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 20px', background:C.card, borderBottom:`1px solid ${C.border}`,
          flexShrink:0, gap:12, flexWrap:'wrap' }}>

          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
            <button onClick={()=>setSidebarOpen(o=>!o)} style={{ border:'none', background:C.pLo,
              borderRadius:8, width:34,height:34, cursor:'pointer', color:C.primary,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>☰</button>
            <button onClick={()=>navegar(-1)} style={{ border:'none',background:'none',cursor:'pointer',color:C.muted,fontSize:18,padding:'0 3px' }}>‹</button>
            <span style={{ fontSize:15, fontWeight:700, color:C.primary, whiteSpace:'nowrap',
              overflow:'hidden', textOverflow:'ellipsis', maxWidth:340 }}>{headerLabel()}</span>
            <button onClick={()=>navegar(1)} style={{ border:'none',background:'none',cursor:'pointer',color:C.muted,fontSize:18,padding:'0 3px' }}>›</button>
            <button onClick={()=>setAnchor(new Date())} style={{ border:`1.5px solid ${C.border}`,
              background:'none', color:C.primary, borderRadius:8, padding:'5px 12px',
              fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>Hoje</button>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, flexWrap:'wrap' }}>
            {/* Busca */}
            <div style={{ position:'relative' }}>
              <svg style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none' }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={busca} onChange={e=>setBusca(e.target.value)}
                placeholder="Buscar compromissos…"
                style={{ paddingLeft:30, paddingRight:12, height:34, borderRadius:8,
                  border:`1.5px solid ${C.border}`, fontSize:12, background:C.bg,
                  color:C.primary, outline:'none', width:190, fontFamily:'inherit' }} />
            </div>

            {/* View switcher */}
            <div style={{ display:'flex', background:C.pLo, borderRadius:10, padding:3 }}>
              {([['diario','Diário'],['semanal','Semanal'],['mensal','Mensal']] as [ViewMode,string][]).map(([v,label])=>(
                <button key={v} onClick={()=>setView(v)} style={{ border:'none', borderRadius:7,
                  padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                  background: view===v ? C.primary:'transparent',
                  color:      view===v ? '#fff':C.muted,
                  boxShadow:  view===v ? '0 1px 4px rgba(0,50,35,0.2)':'none' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Criar */}
            <button onClick={()=>abrirCriar()} style={{ background:C.accent, border:'none', color:'#fff',
              borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:700,
              cursor:'pointer', display:'flex', alignItems:'center', gap:6,
              boxShadow:'0 4px 14px rgba(255,100,0,0.3)', transition:'opacity .15s', whiteSpace:'nowrap' }}
              onMouseEnter={e=>(e.currentTarget.style.opacity='.85')}
              onMouseLeave={e=>(e.currentTarget.style.opacity='1')}>
              + Novo Evento
            </button>

            {/* Avatar usuário atual */}
            {currentUser && (
              <div title={currentUser.name} style={{ width:34,height:34,borderRadius:'50%',
                background:currentUser.color, display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff',
                flexShrink:0, overflow:'hidden', border:`2px solid ${C.border}` }}>
                {currentUser.avatar_url
                  ? <img src={currentUser.avatar_url} alt={currentUser.name}
                      style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                  : currentUser.initials}
              </div>
            )}
          </div>
        </div>

        {/* ── Grade ── */}
        {view !== 'mensal' ? (
          <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
            {/* Cabeçalho dos dias */}
            <div style={{ display:'grid', gridTemplateColumns:`56px repeat(${colunas.length},1fr)`,
              borderBottom:`1px solid ${C.border}`, background:C.card, flexShrink:0 }}>
              <div style={{ padding:'10px 0', textAlign:'right', paddingRight:10,
                fontSize:9, color:C.muted, alignSelf:'flex-end', paddingBottom:12 }}>
                GMT-03
              </div>
              {colunas.map(col=>(
                <div key={col.date} style={{ padding:'10px 8px', textAlign:'center',
                  borderLeft:`1px solid ${C.border}`,
                  background: col.isToday ? C.pLo : C.card }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.6,
                    color: col.isToday ? C.primary : C.muted }}>
                    {col.label}
                  </div>
                  <div style={{ fontSize:26, fontWeight:700, marginTop:2,
                    color:C.primary, opacity: col.isToday?1:.65 }}>
                    {col.dayNum}
                  </div>
                  {col.isToday && (
                    <div style={{ width:5,height:5,borderRadius:'50%',
                      background:C.accent,margin:'2px auto 0' }} />
                  )}
                </div>
              ))}
            </div>

            {/* Grade de horas */}
            <div style={{ flex:1, overflow:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:`56px repeat(${colunas.length},1fr)`,
                minHeight:`${HORAS.length*60}px` }}>
                {/* Labels */}
                <div>
                  {HORAS.map(h=>(
                    <div key={h} style={{ height:60, display:'flex', alignItems:'flex-start',
                      justifyContent:'flex-end', paddingRight:10, paddingTop:3 }}>
                      <span style={{ fontSize:10, color:C.muted, whiteSpace:'nowrap' }}>
                        {`${String(h).padStart(2,'0')}:00`}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Colunas */}
                {colunas.map(col=>(
                  <div key={col.date} style={{ borderLeft:`1px solid ${C.border}`, position:'relative',
                    background: col.isToday ? 'rgba(0,50,35,0.018)' : 'transparent' }}>
                    {HORAS.map(h=>(
                      <div key={h} style={{ height:60, borderTop:`1px solid ${C.border}`, cursor:'pointer', transition:'background .1s' }}
                        onClick={()=>abrirCriar(col.date)}
                        onMouseEnter={e=>(e.currentTarget.style.background=C.pLo)}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')} />
                    ))}
                    {eventsForDate(col.date).map(ev=>(
                      <EventCard key={ev.id} event={ev} users={users}
                        onClick={()=>abrirEditar(ev)} style={eventStyle(ev)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Vista Mensal ── */
          <div style={{ flex:1, overflow:'auto', padding:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'0 2px', marginBottom:4 }}>
              {DIAS_PT.map(d=>(
                <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700,
                  color:C.muted, padding:'4px 0', textTransform:'uppercase', letterSpacing:.4 }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
              {getMiniDias(anchor.getFullYear(), anchor.getMonth()).map((cell,i)=>{
                const dStr=toDateStr(new Date(
                  anchor.getFullYear(),
                  anchor.getMonth()+(cell.m==='p'?-1:cell.m==='n'?1:0),
                  cell.day));
                const dayEvents=eventsForDate(dStr), isToday=dStr===hojeStr;
                return (
                  <div key={i} onClick={()=>abrirCriar(dStr)} style={{ minHeight:88, background:C.card,
                    borderRadius:10, padding:7,
                    border: isToday?`1.5px solid ${C.primary}`:`1px solid ${C.border}`,
                    cursor:'pointer', transition:'box-shadow .1s', opacity: cell.m!=='c'?.35:1 }}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.boxShadow='0 2px 10px rgba(0,50,35,0.1)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.boxShadow='none'}>
                    <div style={{ fontSize:12, fontWeight:700,
                      color: isToday?'#fff':C.primary,
                      background: isToday?C.primary:'transparent',
                      width:22,height:22,borderRadius:'50%',
                      display:'flex',alignItems:'center',justifyContent:'center',marginBottom:4 }}>
                      {cell.day}
                    </div>
                    {dayEvents.slice(0,2).map(ev=>{
                      const c=EC[ev.color];
                      return (
                        <div key={ev.id} onClick={e=>{ e.stopPropagation(); abrirEditar(ev); }}
                          style={{ background:c.bg, borderRadius:5, padding:'2px 6px',
                            fontSize:10, fontWeight:600, color:c.text, marginBottom:2,
                            overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                            cursor:'pointer', border:`1px solid ${c.border}` }}>
                          {ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length>2 && (
                      <div style={{ fontSize:9, color:C.muted, fontWeight:600 }}>+{dayEvents.length-2} mais</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <EventModal event={editEvent} users={users} currentUserId={currentUserId}
          onSave={salvar} onDelete={excluir}
          onClose={()=>setModalOpen(false)} initialDate={clickDate} />
      )}
    </div>
  );
}