import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, Minus, Search, Package, TrendingUp,
  BookOpen, AlertCircle, CheckCircle2,
} from 'lucide-react';

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
};

interface EstoqueItem {
  id: string;
  isbn: string;
  titulo: string;
  gaveta: string;
  quantidade: number;
  ultima_atualizacao: string;
}

// ── Stat Card ─────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: string }) => (
  <div
    className="rounded-2xl p-5 flex items-center gap-4"
    style={{ background: C.white, border: `1px solid ${C.inkLow}` }}
  >
    <div
      className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: accent ? `${accent}15` : C.navyMid }}
    >
      <Icon className="h-5 w-5" style={{ color: accent || C.navy }} />
    </div>
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: C.inkMid }}>{label}</p>
      <p className="text-2xl font-black leading-none mt-0.5" style={{ color: C.ink }}>{value}</p>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
export default function Estoque() {
  const [itens,              setItens]              = useState<EstoqueItem[]>([]);
  const [loading,            setLoading]            = useState(true);
  const [form,               setForm]               = useState({ isbn: '', titulo: '', gaveta: '', quantidade: '' });
  const [busca,              setBusca]              = useState('');
  const [modalOpen,          setModalOpen]          = useState(false);
  const [livroSelecionado,   setLivroSelecionado]   = useState<EstoqueItem | null>(null);
  const [quantidadeAdicionar,setQuantidadeAdicionar]= useState('');
  const [quantidadeRetirar,  setQuantidadeRetirar]  = useState('');
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({ title: 'Acesso negado', description: 'Faça login para acessar o estoque.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      fetchEstoque();
    });
  }, []);

  async function fetchEstoque() {
    try {
      const { data, error } = await supabase
        .from('estoque')
        .select('*')
        .order('ultima_atualizacao', { ascending: false });
      if (error) throw error;
      setItens(data || []);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isbn   = form.isbn.trim();
    const titulo = form.titulo.trim();
    const gaveta = form.gaveta.trim();
    const qtd    = parseInt(form.quantidade);
    if (!isbn || !titulo || !gaveta || isNaN(qtd) || qtd <= 0) {
      toast({ title: 'Erro', description: 'Preencha todos os campos corretamente.', variant: 'destructive' });
      return;
    }
    try {
      const { data: existing, error: selectError } = await supabase
        .from('estoque').select('id,quantidade').eq('isbn', isbn).maybeSingle();
      if (selectError && selectError.code !== 'PGRST116') throw selectError;
      if (existing) {
        await supabase.from('estoque').update({ quantidade: existing.quantidade + qtd, ultima_atualizacao: new Date().toISOString() }).eq('id', existing.id);
        toast({ title: 'Sucesso', description: `+${qtd} unidade(s) adicionada(s)` });
      } else {
        await supabase.from('estoque').insert({ isbn, titulo, gaveta, quantidade: qtd });
        toast({ title: 'Livro cadastrado', description: titulo });
      }
      setForm({ isbn: '', titulo: '', gaveta: '', quantidade: '' });
      fetchEstoque();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  }

  const abrirModal = (item: EstoqueItem) => {
    setLivroSelecionado(item);
    setQuantidadeAdicionar('');
    setQuantidadeRetirar('');
    setModalOpen(true);
  };

  const handleAdicionar = async () => {
    if (!livroSelecionado) return;
    const qtd = parseInt(quantidadeAdicionar);
    if (isNaN(qtd) || qtd <= 0) { toast({ title: 'Erro', description: 'Quantidade inválida.', variant: 'destructive' }); return; }
    try {
      await supabase.from('estoque').update({ quantidade: livroSelecionado.quantidade + qtd, ultima_atualizacao: new Date().toISOString() }).eq('id', livroSelecionado.id);
      toast({ title: 'Adicionado', description: `+${qtd} unidade(s)` });
      fetchEstoque();
      setModalOpen(false);
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleRetirar = async () => {
    if (!livroSelecionado) return;
    const qtd = parseInt(quantidadeRetirar);
    if (isNaN(qtd) || qtd <= 0)                    { toast({ title: 'Erro', description: 'Quantidade inválida.', variant: 'destructive' }); return; }
    if (qtd > livroSelecionado.quantidade)          { toast({ title: 'Erro', description: 'Quantidade maior que o estoque.', variant: 'destructive' }); return; }
    try {
      await supabase.from('estoque').update({ quantidade: livroSelecionado.quantidade - qtd, ultima_atualizacao: new Date().toISOString() }).eq('id', livroSelecionado.id);
      toast({ title: 'Retirado', description: `-${qtd} unidade(s)` });
      fetchEstoque();
      setModalOpen(false);
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const itensFiltrados = itens.filter(item => {
    const t = busca.toLowerCase().trim();
    return !t || item.isbn.toLowerCase().includes(t) || item.titulo.toLowerCase().includes(t);
  });

  const isIsbnMatch = (b: string, isbn: string) => b.trim() === isbn;

  const totalUnidades = itens.reduce((sum, i) => sum + i.quantidade, 0);
  const semEstoque    = itens.filter(i => i.quantidade === 0).length;

  return (
    <div className="min-h-screen md:pl-20 pb-20 md:pb-0" style={{ backgroundColor: C.bg }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 xl:px-12 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────── */}
        <header className="space-y-1">
          <div className="flex items-end gap-3">
            <h1 className="text-4xl font-black tracking-tight leading-none" style={{ color: C.ink }}>
              Estoque
            </h1>
            <div className="mb-1.5 h-2 w-2 rounded-full" style={{ background: C.red }} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: C.inkMid }}>
            Controle de Logística Editorial
          </p>
        </header>

        {/* ── Stats ─────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BookOpen}     label="Títulos"     value={itens.length}  />
          <StatCard icon={Package}      label="Unidades"    value={totalUnidades} accent={C.navy} />
          <StatCard icon={AlertCircle}  label="Sem Estoque" value={semEstoque}    accent={C.red} />
          <StatCard icon={CheckCircle2} label="Resultados"  value={itensFiltrados.length} accent="#1a7a4a" />
        </div>

        {/* ── Form ──────────────────────────────────── */}
        <div
          className="rounded-2xl p-6"
          style={{ background: C.white, border: `1px solid ${C.inkLow}`, boxShadow: `0 2px 16px rgba(43,43,43,0.05)` }}
        >
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] mb-5" style={{ color: C.inkMid }}>
            Adicionar ao Estoque
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: 'isbn',       placeholder: 'ISBN',   type: 'text'   },
              { key: 'titulo',     placeholder: 'Título', type: 'text'   },
              { key: 'gaveta',     placeholder: 'Gaveta', type: 'text'   },
              { key: 'quantidade', placeholder: 'Qtd.',   type: 'number' },
            ].map(({ key, placeholder, type }) => (
              <Input
                key={key}
                type={type}
                placeholder={placeholder}
                value={(form as any)[key]}
                min={type === 'number' ? '1' : undefined}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                required
                className="h-11 rounded-xl border-0 text-sm focus-visible:ring-2"
                style={{
                  background: C.bg,
                  color: C.ink,
                  ['--tw-ring-color' as any]: C.navy,
                }}
              />
            ))}
            <button
              type="submit"
              className="h-11 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: C.navy, color: C.bg, boxShadow: `0 4px 12px rgba(28,83,186,0.25)` }}
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </form>
        </div>

        {/* ── Search + Table ─────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: C.white, border: `1px solid ${C.inkLow}`, boxShadow: `0 2px 16px rgba(43,43,43,0.05)` }}
        >
          {/* Search bar */}
          <div
            className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ borderBottom: `1px solid ${C.inkLow}`, background: C.navyLow }}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: C.inkMid }}>
                Estoque Atual
              </h2>
              <span
                className="text-[9px] font-black px-2.5 py-1 rounded-full"
                style={{ background: C.navyMid, color: C.navy }}
              >
                {itens.length} título{itens.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.inkMid }} />
              <Input
                placeholder="ISBN ou título…"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-10 h-10 rounded-xl border-0 text-sm w-full sm:w-64 focus-visible:ring-2"
                style={{
                  background: C.white,
                  color: C.ink,
                  boxShadow: `0 1px 4px ${C.inkLow}`,
                  ['--tw-ring-color' as any]: C.navy,
                }}
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-16 text-center">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto"
                style={{ borderColor: `${C.navy} transparent ${C.navy} ${C.navy}` }}
              />
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-8 w-8 mx-auto mb-3 opacity-20" style={{ color: C.navy }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.inkMid }}>
                Nenhum item encontrado
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: C.inkLow, background: C.navyLow }}>
                    {['ISBN','Título','Gaveta','Qtd.','Atualizado em'].map((h, i) => (
                      <TableHead
                        key={h}
                        className={`text-[9px] font-black uppercase tracking-[0.2em] py-4 ${i === 0 ? 'pl-8' : ''} ${i === 3 ? 'text-center' : ''}`}
                        style={{ color: C.inkMid }}
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltrados.map((item, idx) => {
                    const isMatch = isIsbnMatch(busca, item.isbn);
                    const isEmpty = item.quantidade === 0;
                    return (
                      <TableRow
                        key={item.id}
                        onClick={() => abrirModal(item)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderColor:  C.inkLow,
                          background:   isMatch
                            ? 'rgba(26,122,74,0.06)'
                            : idx % 2 === 0 ? 'transparent' : 'rgba(243,236,214,0.3)',
                          borderLeft:   isMatch ? `3px solid #1a7a4a` : '3px solid transparent',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.navyLow)}
                        onMouseLeave={e => (e.currentTarget.style.background = isMatch ? 'rgba(26,122,74,0.06)' : idx % 2 === 0 ? 'transparent' : 'rgba(243,236,214,0.3)')}
                      >
                        <TableCell className="pl-8">
                          <span className="font-mono text-xs font-bold" style={{ color: C.inkMid }}>
                            {item.isbn}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="font-bold text-sm truncate" style={{ color: C.ink }}>{item.titulo}</p>
                        </TableCell>
                        <TableCell>
                          <span
                            className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
                            style={{ background: C.navyMid, color: C.navy }}
                          >
                            {item.gaveta}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className="text-xl font-black"
                            style={{ color: isEmpty ? C.red : C.ink }}
                          >
                            {item.quantidade}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs" style={{ color: C.inkMid }}>
                            {format(new Date(item.ultima_atualizacao), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="sm:max-w-md rounded-3xl p-0 overflow-hidden"
          style={{ background: C.bg, border: `1px solid ${C.inkLow}` }}
        >
          {/* Modal header */}
          <div className="px-7 py-5" style={{ background: C.navy }}>
            <DialogHeader>
              <DialogTitle
                className="text-lg font-black uppercase tracking-tight leading-tight"
                style={{ color: C.bg }}
              >
                {livroSelecionado?.titulo}
              </DialogTitle>
              <DialogDescription className="sr-only">Gerenciar estoque</DialogDescription>
            </DialogHeader>
          </div>

          {livroSelecionado && (
            <div className="p-6 space-y-6">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'ISBN',         value: livroSelecionado.isbn,     mono: true  },
                  { label: 'Gaveta',       value: livroSelecionado.gaveta,   mono: false },
                  { label: 'Atualizado',   value: format(new Date(livroSelecionado.ultima_atualizacao), 'dd MMM yyyy', { locale: ptBR }), mono: false },
                ].map(({ label, value, mono }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3"
                    style={{ background: C.white, border: `1px solid ${C.inkLow}` }}
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: C.inkMid }}>{label}</p>
                    <p className={`text-sm font-bold ${mono ? 'font-mono' : ''}`} style={{ color: C.ink }}>{value}</p>
                  </div>
                ))}
                {/* Quantidade destaque */}
                <div
                  className="rounded-xl p-3"
                  style={{ background: C.navyMid, border: `1px solid ${C.navy}20` }}
                >
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: C.navy }}>Estoque</p>
                  <p className="text-3xl font-black leading-none" style={{ color: C.navy }}>
                    {livroSelecionado.quantidade}
                  </p>
                </div>
              </div>

              <div className="h-px" style={{ background: C.inkLow }} />

              {/* Adicionar */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: '#1a7a4a' }}>
                  <Plus className="h-3 w-3" /> Adicionar ao estoque
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Quantidade"
                    value={quantidadeAdicionar}
                    onChange={e => setQuantidadeAdicionar(e.target.value)}
                    className="flex-1 h-11 rounded-xl border-0 text-sm focus-visible:ring-2"
                    style={{ background: C.white, color: C.ink, ['--tw-ring-color' as any]: '#1a7a4a' }}
                  />
                  <button
                    onClick={handleAdicionar}
                    className="h-11 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:opacity-80"
                    style={{ background: '#1a7a4a', color: '#fff' }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Retirar */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: C.red }}>
                  <Minus className="h-3 w-3" /> Retirar do estoque
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max={livroSelecionado.quantidade}
                    placeholder={`Máx: ${livroSelecionado.quantidade}`}
                    value={quantidadeRetirar}
                    onChange={e => setQuantidadeRetirar(e.target.value)}
                    className="flex-1 h-11 rounded-xl border-0 text-sm focus-visible:ring-2"
                    style={{ background: C.white, color: C.ink, ['--tw-ring-color' as any]: C.red }}
                  />
                  <button
                    onClick={handleRetirar}
                    disabled={!quantidadeRetirar || parseInt(quantidadeRetirar) > livroSelecionado.quantidade}
                    className="h-11 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:opacity-80 disabled:opacity-30"
                    style={{ background: C.red, color: '#fff' }}
                  >
                    Retirar
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 pb-5">
            <button
              onClick={() => setModalOpen(false)}
              className="w-full h-11 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:opacity-80"
              style={{ background: C.inkLow, color: C.ink }}
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}