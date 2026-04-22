// src/pages/comercial.tsx
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, subDays, subWeeks, subMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { CalendarIcon, Plus, Download, Edit3 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format as formatCurrency } from 'currency-formatter';

// === RECHARTS ===
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine
} from 'recharts';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

// === TIPOS ===
interface Vendedora { id: string; nome: string; foto_url: string | null; meta_mensal: number; }
interface Venda {
  id: string;
  vendedora_id: string;
  tipo_venda: 'solo' | 'coautoria';
  valor: number;
  data_venda: string;
  cliente_nome: string;
  projeto: string | null;
  forma_pagto: string | null;
  parcelas: number | null;
  observacoes: string | null;
  ultimos_digitos_cartao: string | null;
  cpf_cliente: string | null;
  ano: number;
  mes: string;
}
interface AggregatedSales {
  vendedora_id: string;
  total_vendas: number;
  total_valor: number;
  solos: number;
  coautorias: number;
  valor_sol: number;
  valor_coaut: number;
}

// === FUNÇÃO CENTRAL: FORMATA DATA NO FUSO DE SÃO PAULO ===
const formatarDataSP = (isoString: string, pattern = 'dd/MM HH:mm') => {
  return format(new Date(isoString), pattern, {
    locale: ptBR,
    timeZone: 'America/Sao_Paulo'
  });
};

// === ESTILOS ===
const adesivos = ['/adesivos/1.png', '/adesivos/2.png', '/adesivos/3.png', '/adesivos/4.png'];
const COLORS = { primary: '#ffb319', solo: '#10b981', coaut: '#3b82f6', prev: '#888888' };

export default function Comercial() {
  const [vendedoras, setVendedoras] = useState<Vendedora[]>([]);
  const [vendasAgregadas, setVendasAgregadas] = useState<AggregatedSales[]>([]);
  const [vendasAgregadasPrev, setVendasAgregadasPrev] = useState<AggregatedSales[]>([]);
  const [todasVendas, setTodasVendas] = useState<Venda[]>([]);
  const [todasVendasPrev, setTodasVendasPrev] = useState<Venda[]>([]);
  const [historico, setHistorico] = useState<Venda[]>([]);
  const [periodo, setPeriodo] = useState<'diario' | 'semanal' | 'mensal' | 'custom'>('mensal');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [vendedoraSelecionada, setVendedoraSelecionada] = useState<Vendedora | null>(null);
  const [showAddVenda, setShowAddVenda] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [metaInputK, setMetaInputK] = useState('');
  const { toast } = useToast();

  // === FORM NOVA VENDA ===
  const [novaVenda, setNovaVenda] = useState({
    vendedora_id: '',
    tipo_venda: 'solo' as 'solo' | 'coautoria',
    valor: '',
    cliente_nome: '',
    projeto: '',
    forma_pagto: '',
    parcelas: '',
    observacoes: '',
    ultimos_digitos_cartao: '',
    cpf_cliente: '',
  });

  // === INTERVALO DE DATAS (em SP) ===
  const { startDate, endDate, prevStart, prevEnd } = useMemo(() => {
    const now = new Date();

    // 🔸 Intervalo personalizado
    let currStart = startOfDay(now);
    let currEnd = endOfDay(now);
    if (periodo === "custom" && dateRange?.from && dateRange?.to) {
      currStart = startOfDay(dateRange.from);
      currEnd = endOfDay(dateRange.to);
    } else {
      switch (periodo) {
        case "diario":
          break;
        case "semanal":
          currStart = startOfWeek(now, { locale: ptBR });
          currEnd = endOfWeek(now, { locale: ptBR });
          break;
        case "mensal":
          currStart = startOfMonth(now);
          currEnd = endOfMonth(now);
          break;
      }
    }

    const startSP = new Date(currStart.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const endSP = new Date(currEnd.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

    // 🔸 Período anterior
    let pStart = currStart;
    let pEnd = currEnd;
    switch (periodo) {
      case 'diario':
        pStart = subDays(currStart, 1);
        pEnd = subDays(currEnd, 1);
        break;
      case 'semanal':
        pStart = subWeeks(currStart, 1);
        pEnd = subWeeks(currEnd, 1);
        break;
      case 'mensal':
        pStart = subMonths(currStart, 1);
        pEnd = subMonths(currEnd, 1);
        break;
      case 'custom':
        if (dateRange?.from && dateRange.to) {
          const diff = differenceInDays(currEnd, currStart) + 1;
          pStart = subDays(currStart, diff);
          pEnd = subDays(currEnd, diff);
        }
        break;
    }

    const prevStartSP = new Date(pStart.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const prevEndSP = new Date(pEnd.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

    return { startDate: startSP, endDate: endSP, prevStart: prevStartSP, prevEnd: prevEndSP };
  }, [periodo, dateRange]);

  // 🧭 Resetar range ao mudar de período
  useEffect(() => {
    if (periodo !== "custom") setDateRange(undefined);
  }, [periodo]);

  // === BUSCAR VENDEDORES ===
  useEffect(() => {
    supabase.from('vendedoras').select('*').eq('ativo', true).order('nome')
      .then(({ data, error }) => {
        if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        else setVendedoras(data || []);
      });
  }, [toast]);

  // === BUSCAR TODAS AS VENDAS (com filtro SP) ===
  const fetchTodasVendas = async () => {
    const { data, error } = await supabase
      .from('vendas')
      .select('*')
      .gte('data_venda', startDate.toISOString())
      .lte('data_venda', endDate.toISOString())
      .order('data_venda', { ascending: false });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else setTodasVendas(data || []);
  };

  const fetchTodasVendasPrev = async () => {
    const { data, error } = await supabase
      .from('vendas')
      .select('*')
      .gte('data_venda', prevStart.toISOString())
      .lte('data_venda', prevEnd.toISOString())
      .order('data_venda', { ascending: false });
    if (error) toast({ title: 'Erro anterior', description: error.message, variant: 'destructive' });
    else setTodasVendasPrev(data || []);
  };

  // === AGREGAR VENDAS ===
  const fetchVendasAgregadas = async () => {
    const { data, error } = await supabase
      .from('vendas')
      .select('vendedora_id, tipo_venda, valor')
      .gte('data_venda', startDate.toISOString())
      .lte('data_venda', endDate.toISOString());

    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

    const agregados = vendedoras.map(v => {
      const vendas = data?.filter(x => x.vendedora_id === v.id) || [];
      const solos = vendas.filter(x => x.tipo_venda === 'solo');
      const coauts = vendas.filter(x => x.tipo_venda === 'coautoria');
      return {
        vendedora_id: v.id,
        total_vendas: vendas.length,
        total_valor: vendas.reduce((s, x) => s + x.valor, 0),
        solos: solos.length,
        coautorias: coauts.length,
        valor_sol: solos.reduce((s, x) => s + x.valor, 0),
        valor_coaut: coauts.reduce((s, x) => s + x.valor, 0),
      };
    });
    setVendasAgregadas(agregados);
  };

  const fetchVendasAgregadasPrev = async () => {
    const { data, error } = await supabase
      .from('vendas')
      .select('vendedora_id, tipo_venda, valor')
      .gte('data_venda', prevStart.toISOString())
      .lte('data_venda', prevEnd.toISOString());

    if (error) { toast({ title: 'Erro anterior', description: error.message, variant: 'destructive' }); return; }

    const agregados = vendedoras.map(v => {
      const vendas = data?.filter(x => x.vendedora_id === v.id) || [];
      const solos = vendas.filter(x => x.tipo_venda === 'solo');
      const coauts = vendas.filter(x => x.tipo_venda === 'coautoria');
      return {
        vendedora_id: v.id,
        total_vendas: vendas.length,
        total_valor: vendas.reduce((s, x) => s + x.valor, 0),
        solos: solos.length,
        coautorias: coauts.length,
        valor_sol: solos.reduce((s, x) => s + x.valor, 0),
        valor_coaut: coauts.reduce((s, x) => s + x.valor, 0),
      };
    });
    setVendasAgregadasPrev(agregados);
  };

  useEffect(() => {
    if (vendedoras.length) {
      fetchVendasAgregadas();
      fetchVendasAgregadasPrev();
      fetchTodasVendas();
      fetchTodasVendasPrev();
    }
  }, [vendedoras, startDate, endDate, prevStart, prevEnd]);

  // === MODAL DETALHES ===
  const abrirModal = async (v: Vendedora) => {
    setVendedoraSelecionada(v);
    setMetaInputK((v.meta_mensal / 1000).toString());
    setEditMeta(false);
    setModalOpen(true);

    const { data } = await supabase
      .from('vendas')
      .select('*')
      .eq('vendedora_id', v.id)
      .gte('data_venda', startDate.toISOString())
      .lte('data_venda', endDate.toISOString())
      .order('data_venda', { ascending: false });
    setHistorico(data || []);
  };

  // === SALVAR META ===
  const salvarMeta = async () => {
    const k = parseFloat(metaInputK);
    if (isNaN(k) || k <= 0) return toast({ title: 'Erro', description: 'Meta inválida', variant: 'destructive' });
    const meta = k * 1000;
    const { error } = await supabase.from('vendedoras').update({ meta_mensal: meta }).eq('id', vendedoraSelecionada?.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      setVendedoras(prev => prev.map(x => x.id === vendedoraSelecionada?.id ? { ...x, meta_mensal: meta } : x));
      toast({ title: 'Meta atualizada!', description: `R$ ${k}K` });
      setEditMeta(false);
    }
  };

  // === MÁSCARAS ===
  const maskValor = (v: string) => v.replace(/\D/g, '').replace(/(\d)(\d{2})$/, '$1,$2').replace(/(?=(\d{3})+(\D))\B/g, '.');
  const maskCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);

  // === REGISTRAR VENDA (já salva em SP) ===
  const registrarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(novaVenda.valor.replace(/\./g, '').replace(',', '.'));
    const parcelas = parseInt(novaVenda.parcelas) || null;

    if (!novaVenda.vendedora_id || isNaN(valor) || valor <= 0 || !novaVenda.cliente_nome.trim()) {
      toast({ title: 'Erro', description: 'Preencha os campos obrigatórios (*)', variant: 'destructive' });
      return;
    }

    const agora = new Date();
    const dataISO = agora.toLocaleString('sv', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + 'Z';

    const { error } = await supabase.from('vendas').insert({
      vendedora_id: novaVenda.vendedora_id,
      tipo_venda: novaVenda.tipo_venda,
      valor,
      data_venda: dataISO,
      cliente_nome: novaVenda.cliente_nome.trim(),
      projeto: novaVenda.projeto.trim() || null,
      forma_pagto: novaVenda.forma_pagto || null,
      parcelas,
      observacoes: novaVenda.observacoes.trim() || null,
      ultimos_digitos_cartao: novaVenda.ultimos_digitos_cartao || null,
      cpf_cliente: novaVenda.cpf_cliente || null,
      ano: agora.getFullYear(),
      mes: format(agora, 'MMMM', { locale: ptBR }),
    });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Venda registrada!', description: `R$ ${valor.toLocaleString('pt-BR')}` });
      setNovaVenda({ vendedora_id: '', tipo_venda: 'solo', valor: '', cliente_nome: '', projeto: '', forma_pagto: '', parcelas: '', observacoes: '', ultimos_digitos_cartao: '', cpf_cliente: '' });
      setShowAddVenda(false);
      fetchVendasAgregadas();
      fetchTodasVendas();
      fetchVendasAgregadasPrev();
      fetchTodasVendasPrev();
    }
  };

  // === TOTAIS GERAIS ===
  const totais = useMemo(() => vendasAgregadas.reduce((a, v) => ({
    total: a.total + v.total_vendas,
    total_valor: a.total_valor + v.total_valor,
    solos: a.solos + v.solos,
    coautorias: a.coautorias + v.coautorias,
    valor_sol: a.valor_sol + v.valor_sol,
    valor_coaut: a.valor_coaut + v.valor_coaut,
  }), { total: 0, total_valor: 0, solos: 0, coautorias: 0, valor_sol: 0, valor_coaut: 0 }), [vendasAgregadas]);

  const totaisPrev = useMemo(() => vendasAgregadasPrev.reduce((a, v) => ({
    total: a.total + v.total_vendas,
    total_valor: a.total_valor + v.total_valor,
    solos: a.solos + v.solos,
    coautorias: a.coautorias + v.coautorias,
    valor_sol: a.valor_sol + v.valor_sol,
    valor_coaut: a.valor_coaut + v.valor_coaut,
  }), { total: 0, total_valor: 0, solos: 0, coautorias: 0, valor_sol: 0, valor_coaut: 0 }), [vendasAgregadasPrev]);

  // === PROGRESSO ===
  const progresso = (v: Vendedora) => {
    const agg = vendasAgregadas.find(x => x.vendedora_id === v.id);
    const valor = agg?.total_valor || 0;
    const meta = periodo === 'mensal' ? v.meta_mensal : v.meta_mensal / 4;
    const pct = meta > 0 ? Math.min((valor / meta) * 100, 100) : 0;
    return { valor, pct, meta, bateu: valor >= meta };
  };

  const fmtK = (n: number) => `R$ ${(n / 1000).toFixed(0)}K`;

  // === GRÁFICOS (agora com fuso SP) ===
  const Graficos = () => {
    const [tab, setTab] = useState<'geral' | 'vendedora' | 'comparativo'>('geral');
    const [vendedoraId, setVendedoraId] = useState('todas');
    const [modo, setModo] = useState<'quantidade' | 'valor'>('valor');

    const formatTick = (value: number) => {
      if (modo !== 'valor') return value;
      if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
      return `R$ ${value.toFixed(0)}`;
    };

    const porDia = useMemo(() => {
      const dias = eachDayOfInterval({ start: startDate, end: endDate });
      return dias.map(d => {
        const key = format(d, 'dd/MM', { locale: ptBR });
        const vendasDia = todasVendas.filter(v => {
          const dataVendaSP = formatarDataSP(v.data_venda, 'dd/MM');
          return dataVendaSP === key;
        });
        return {
          label: key,
          valor: vendasDia.reduce((s, v) => s + v.valor, 0),
          qtd: vendasDia.length
        };
      });
    }, [todasVendas, startDate, endDate]);

    const porDiaPrev = useMemo(() => {
      const dias = eachDayOfInterval({ start: prevStart, end: prevEnd });
      return dias.map(d => {
        const key = format(d, 'dd/MM', { locale: ptBR });
        const vendasDia = todasVendasPrev.filter(v => {
          const dataVendaSP = formatarDataSP(v.data_venda, 'dd/MM');
          return dataVendaSP === key;
        });
        return {
          label: key,
          valor: vendasDia.reduce((s, v) => s + v.valor, 0),
          qtd: vendasDia.length
        };
      });
    }, [todasVendasPrev, prevStart, prevEnd]);

    const pie = useMemo(() => {
      const agg = vendedoraId === 'todas' ? totais : vendasAgregadas.find(v => v.vendedora_id === vendedoraId);
      if (!agg) return [];
      return [
        { name: 'Solo', value: modo === 'valor' ? agg.valor_sol : agg.solos, fill: COLORS.solo },
        { name: 'Coautoria', value: modo === 'valor' ? agg.valor_coaut : agg.coautorias, fill: COLORS.coaut },
      ];
    }, [vendedoraId, modo, totais, vendasAgregadas]);

    const piePrev = useMemo(() => {
      const agg = vendedoraId === 'todas' ? totaisPrev : vendasAgregadasPrev.find(v => v.vendedora_id === vendedoraId);
      if (!agg) return [];
      return [
        { name: 'Solo', value: modo === 'valor' ? agg.valor_sol : agg.solos, fill: COLORS.solo },
        { name: 'Coautoria', value: modo === 'valor' ? agg.valor_coaut : agg.coautorias, fill: COLORS.coaut },
      ];
    }, [vendedoraId, modo, totaisPrev, vendasAgregadasPrev]);

    const barData = vendedoras.map(v => {
      const a = vendasAgregadas.find(x => x.vendedora_id === v.id) || { total_vendas: 0, total_valor: 0 };
      const aPrev = vendasAgregadasPrev.find(x => x.vendedora_id === v.id) || { total_vendas: 0, total_valor: 0 };
      return {
        nome: v.nome.split(' ')[0],
        atual: modo === 'valor' ? a.total_valor : a.total_vendas,
        anterior: modo === 'valor' ? aPrev.total_valor : aPrev.total_vendas
      };
    }).sort((a, b) => b.atual - a.atual);

    const area = porDia.reduce((acc, cur, i) => {
      acc.push({ label: cur.label, acumulado: (acc[i - 1]?.acumulado || 0) + (modo === 'valor' ? cur.valor : cur.qtd) });
      return acc;
    }, [] as { label: string; acumulado: number }[]);

    const areaPrev = porDiaPrev.reduce((acc, cur, i) => {
      acc.push({ label: cur.label, acumulado: (acc[i - 1]?.acumulado || 0) + (modo === 'valor' ? cur.valor : cur.qtd) });
      return acc;
    }, [] as { label: string; acumulado: number }[]);

    const TooltipCustom = ({ active, payload, label }: any) => {
      if (!active || !payload) return null;
      return (
        <div className="bg-white p-3 rounded shadow border">
          <p className="font-bold">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.fill }}>
              {p.name}: {modo === 'valor' ? formatCurrency(p.value, { code: 'BRL' }) : p.value}
            </p>
          ))}
        </div>
      );
    };

    return (
      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
          <TabsList className="grid grid-cols-3 w-full lg:w-auto">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="vendedora">Por Vendedora</TabsTrigger>
            <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-3 items-center">
            {tab !== 'geral' && (
              <Select value={vendedoraId} onValueChange={setVendedoraId}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {vendedoras.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button variant={modo === 'quantidade' ? 'default' : 'outline'} size="sm" onClick={() => setModo('quantidade')}>Qtd</Button>
              <Button variant={modo === 'valor' ? 'default' : 'outline'} size="sm" onClick={() => setModo('valor')}>R$</Button>
            </div>
          </div>
        </div>

        <TabsContent value="geral" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Evolução Diária - Atual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={porDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Line type="monotone" dataKey={modo === 'valor' ? 'valor' : 'qtd'} stroke={COLORS.primary} strokeWidth={3} name="Atual" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Evolução Diária - Anterior</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={porDiaPrev}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Line type="monotone" dataKey={modo === 'valor' ? 'valor' : 'qtd'} stroke={COLORS.prev} strokeWidth={3} name="Anterior" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Solo × Coautoria - Atual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {pie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => modo === 'valor' ? formatCurrency(v as number, { code: 'BRL' }) : v} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Solo × Coautoria - Anterior</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={piePrev} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {piePrev.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => modo === 'valor' ? formatCurrency(v as number, { code: 'BRL' }) : v} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Acumulado - Atual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={area}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Area type="monotone" dataKey="acumulado" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} name="Atual" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Acumulado - Anterior</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={areaPrev}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Area type="monotone" dataKey="acumulado" stroke={COLORS.prev} fill={COLORS.prev} fillOpacity={0.6} name="Anterior" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vendedora" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Evolução – {vendedoras.find(v => v.id === vendedoraId)?.nome || 'Todas'} - Atual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart
                    data={porDia.map(d => {
                      const vendas = todasVendas.filter(v => (vendedoraId === 'todas' || v.vendedora_id === vendedoraId) && formatarDataSP(v.data_venda, 'dd/MM') === d.label);
                      return { label: d.label, valor: vendas.reduce((s, x) => s + x.valor, 0), qtd: vendas.length };
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Line type="monotone" dataKey={modo === 'valor' ? 'valor' : 'qtd'} stroke={COLORS.primary} strokeWidth={3} name="Atual" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Evolução – {vendedoras.find(v => v.id === vendedoraId)?.nome || 'Todas'} - Anterior</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart
                    data={porDiaPrev.map(d => {
                      const vendas = todasVendasPrev.filter(v => (vendedoraId === 'todas' || v.vendedora_id === vendedoraId) && formatarDataSP(v.data_venda, 'dd/MM') === d.label);
                      return { label: d.label, valor: vendas.reduce((s, x) => s + x.valor, 0), qtd: vendas.length };
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Line type="monotone" dataKey={modo === 'valor' ? 'valor' : 'qtd'} stroke={COLORS.prev} strokeWidth={3} name="Anterior" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Solo × Coautoria - Atual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {pie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => modo === 'valor' ? formatCurrency(v as number, { code: 'BRL' }) : v} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Solo × Coautoria - Anterior</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={piePrev} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                      {piePrev.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => modo === 'valor' ? formatCurrency(v as number, { code: 'BRL' }) : v} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Acumulado - Atual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={area}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Area type="monotone" dataKey="acumulado" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} name="Atual" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Acumulado - Anterior</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={areaPrev}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} />
                    <YAxis tickFormatter={formatTick} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend />
                    <Area type="monotone" dataKey="acumulado" stroke={COLORS.prev} fill={COLORS.prev} fillOpacity={0.6} name="Anterior" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparativo">
          <Card>
            <CardHeader><CardTitle>Ranking - Atual vs Anterior</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(300, vendedoras.length * 60)}>
                <BarChart data={barData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatTick} />
                  <YAxis dataKey="nome" type="category" width={110} />
                  <Tooltip formatter={v => modo === 'valor' ? formatCurrency(v as number, { code: 'BRL' }) : v} />
                  <Legend />
                  <Bar dataKey="atual" fill={COLORS.primary} radius={8} name="Atual" />
                  <Bar dataKey="anterior" fill={COLORS.prev} radius={8} name="Anterior" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <h1 className="text-3xl font-bold">Painel Comercial</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={v => setPeriodo(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {periodo === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-64 justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(dateRange.to, 'dd/MM', { locale: ptBR })}`
                    : 'Escolha as datas...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button onClick={() => setShowAddVenda(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova Venda
          </Button>
        </div>
      </div>

      {/* TOTAIS GERAIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Vendido</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">R$ {formatCurrency(totais.total_valor, { code: 'BRL' })}</p>
            <p className="text-sm text-muted-foreground">{totais.total} vendas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Solos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{totais.solos}</p>
            <p className="text-sm text-green-600">R$ {formatCurrency(totais.valor_sol, { code: 'BRL' })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Coautorias</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{totais.coautorias}</p>
            <p className="text-sm text-blue-600">R$ {formatCurrency(totais.valor_coaut, { code: 'BRL' })}</p>
          </CardContent>
        </Card>
      </div>

      {/* CARDS VENDEDORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {vendedoras.map(v => {
          const { valor, pct, bateu } = progresso(v);
          const agg = vendasAgregadas.find(x => x.vendedora_id === v.id);
          const adesivo = bateu ? adesivos[Math.floor(Math.random() * adesivos.length)] : null;

          return (
            <div key={v.id} className="relative">
              {adesivo && (
                <div className="absolute -top-4 right-4 z-10 animate-bounce">
                  <img src={adesivo} alt="Meta batida!" className="w-20 h-20 drop-shadow-2xl" />
                </div>
              )}
              <Card className="border-2 shadow-lg hover:shadow-2xl transition-all pt-8 cursor-pointer" onClick={() => abrirModal(v)}>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={v.foto_url || undefined} />
                      <AvatarFallback>{v.nome.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-lg">{v.nome}</p>
                      <p className="text-2xl font-bold">{agg?.total_vendas || 0}</p>
                      <p className="text-sm text-muted-foreground">R$ {formatCurrency(valor, { code: 'BRL' })}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Meta: {fmtK(progresso(v).meta)}</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <Progress value={pct} className="h-3" />
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* GRÁFICOS */}
      <Card className="mt-12">
        <CardHeader><CardTitle className="text-2xl">Gráficos</CardTitle></CardHeader>
        <CardContent><Graficos /></CardContent>
      </Card>

      {/* MODAL NOVA VENDA */}
      <Dialog open={showAddVenda} onOpenChange={setShowAddVenda}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Venda</DialogTitle></DialogHeader>
          <form onSubmit={registrarVenda} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Vendedora *</Label>
                <Select value={novaVenda.vendedora_id} onValueChange={v => setNovaVenda(p => ({ ...p, vendedora_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{vendedoras.map(v => <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={novaVenda.tipo_venda} onValueChange={v => setNovaVenda(p => ({ ...p, tipo_venda: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">Solo</SelectItem>
                    <SelectItem value="coautoria">Coautoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input placeholder="30.000,00" value={novaVenda.valor} onChange={e => setNovaVenda(p => ({ ...p, valor: maskValor(e.target.value) }))} />
              </div>
              <div>
                <Label>Cliente *</Label>
                <Input placeholder="Nome completo" value={novaVenda.cliente_nome} onChange={e => setNovaVenda(p => ({ ...p, cliente_nome: e.target.value }))} />
              </div>
              <div>
                <Label>Projeto</Label>
                <Input placeholder="Ex: Casa Azul" value={novaVenda.projeto} onChange={e => setNovaVenda(p => ({ ...p, projeto: e.target.value }))} />
              </div>
              <div>
                <Label>Forma de Pagto</Label>
                <Select value={novaVenda.forma_pagto} onValueChange={v => setNovaVenda(p => ({ ...p, forma_pagto: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="financiamento">Financiamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input type="number" placeholder="24" value={novaVenda.parcelas} onChange={e => setNovaVenda(p => ({ ...p, parcelas: e.target.value }))} />
              </div>
              <div>
                <Label>Últimos 4 dígitos</Label>
                <Input placeholder="1234" maxLength={4} value={novaVenda.ultimos_digitos_cartao} onChange={e => setNovaVenda(p => ({ ...p, ultimos_digitos_cartao: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div>
                <Label>CPF do Cliente</Label>
                <Input placeholder="000.000.000-00" value={novaVenda.cpf_cliente} onChange={e => setNovaVenda(p => ({ ...p, cpf_cliente: maskCPF(e.target.value) }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea placeholder="Detalhes..." rows={3} value={novaVenda.observacoes} onChange={e => setNovaVenda(p => ({ ...p, observacoes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddVenda(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#ffb319] hover:bg-[#e5a017]">Registrar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALHES */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          {vendedoraSelecionada && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={vendedoraSelecionada.foto_url || undefined} />
                      <AvatarFallback>{vendedoraSelecionada.nome[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-2xl font-bold">{vendedoraSelecionada.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {periodo === 'diario' ? 'Hoje' : periodo === 'semanal' ? 'Esta semana' : 'Este mês'} (Horário de SP)
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditMeta(!editMeta)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* RESUMO DE VENDAS */}
                {(() => {
                  const agg = vendasAgregadas.find(x => x.vendedora_id === vendedoraSelecionada.id) || {
                    total_valor: 0, total_vendas: 0, solos: 0, coautorias: 0, valor_sol: 0, valor_coaut: 0
                  };
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="border-2 border-primary/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary"></div>
                            Total Vendido
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-primary">
                            R$ {formatCurrency(agg.total_valor, { code: 'BRL' })}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {agg.total_vendas} venda{agg.total_vendas !== 1 ? 's' : ''}
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-green-500/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            Solos
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-600">{agg.solos}</p>
                          <p className="text-sm text-green-600">
                            R$ {formatCurrency(agg.valor_sol, { code: 'BRL' })}
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-blue-500/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            Coautorias
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-blue-600">{agg.coautorias}</p>
                          <p className="text-sm text-blue-600">
                            R$ {formatCurrency(agg.valor_coaut, { code: 'BRL' })}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* META */}
                <Card>
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-sm">Meta Mensal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editMeta ? (
                      <div className="flex items-center gap-2">
                        <Input value={metaInputK} onChange={e => setMetaInputK(e.target.value.replace(/\D/g, ''))} className="w-28" />
                        <span className="font-medium">K</span>
                        <Button size="sm" onClick={salvarMeta}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditMeta(false)}>Cancelar</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-3xl font-bold">{fmtK(vendedoraSelecionada.meta_mensal)}</p>
                        <Badge variant={progresso(vendedoraSelecionada).bateu ? 'default' : 'secondary'}>
                          {progresso(vendedoraSelecionada).pct.toFixed(0)}%
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* TABELA COM HORÁRIO DE SP */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Histórico de Vendas</h3>
                  {historico.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma venda neste período.</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Projeto</TableHead>
                            <TableHead>Pagto</TableHead>
                            <TableHead>Parcelas</TableHead>
                            <TableHead>CPF/Cartão</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historico.map(v => (
                            <TableRow key={v.id}>
                              <TableCell className="text-xs">
                                {formatarDataSP(v.data_venda)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={v.tipo_venda === 'solo' ? 'default' : 'secondary'}>{v.tipo_venda}</Badge>
                              </TableCell>
                              <TableCell>{v.cliente_nome}</TableCell>
                              <TableCell className="max-w-32 truncate" title={v.projeto || '-'}>{v.projeto || '-'}</TableCell>
                              <TableCell>{v.forma_pagto || '-'}</TableCell>
                              <TableCell>{v.parcelas || '-'}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {v.cpf_cliente || v.ultimos_digitos_cartao ? `**** ${v.ultimos_digitos_cartao}` : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                R$ {formatCurrency(v.valor, { code: 'BRL' })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}