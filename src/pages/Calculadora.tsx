import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Copy, Info, Image as ImageIcon, BookOpen, Hash, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const CalculadoraEditorial: React.FC = () => {
  // Estados para os inputs
  const [tamanhoLivro, setTamanhoLivro] = useState<'16x23' | '14x21'>('16x23');
  const [numCaracteres, setNumCaracteres] = useState<string>('0');
  const [numImagensPequenas, setNumImagensPequenas] = useState<string>('0');
  const [numImagensMedias, setNumImagensMedias] = useState<string>('0');
  const [numImagensGrandes, setNumImagensGrandes] = useState<string>('0');
  const [numCapitulos, setNumCapitulos] = useState<string>('0');
  const [numAberturasParte, setNumAberturasParte] = useState<string>('0');
  const [numSubtitulos, setNumSubtitulos] = useState<string>('0');
  const [totalPaginas, setTotalPaginas] = useState<number>(32); // Mínimo inicial (16+16)
  
  const { toast } = useToast();

  // Helper para converter string formatada em número puro
  const parseNum = (val: string) => parseInt(val.replace(/\D/g, '')) || 0;

  // UX: Cálculo Automático (Reativo)
  useEffect(() => {
    let paginasCalculadas = 0;
    const caracteresPorPagina = tamanhoLivro === '16x23' ? 1500 : 1000;
    
    // 1. Caracteres
    paginasCalculadas += Math.ceil(parseNum(numCaracteres) / caracteresPorPagina);
    
    // 2. Imagens
    paginasCalculadas += parseNum(numImagensPequenas) * (1 / 3);
    paginasCalculadas += parseNum(numImagensMedias) * (1 / 2);
    paginasCalculadas += parseNum(numImagensGrandes);
    
    // 3. Estrutura
    paginasCalculadas += parseNum(numCapitulos) * 2;
    paginasCalculadas += parseNum(numAberturasParte) * 2;
    paginasCalculadas += parseNum(numSubtitulos) * (1 / 10);

    let paginasFinais = Math.ceil(paginasCalculadas);
    
    // Regra Editorial: Mínimo de 16 páginas de conteúdo + 16 de elementos pré-textuais
    paginasFinais = Math.max(paginasFinais, 16) + 16;
    
    // Arredondamento para múltiplo de 8 (padrão gráfico de cadernos)
    if (paginasFinais % 8 !== 0) {
      paginasFinais = paginasFinais + (8 - (paginasFinais % 8));
    }
    
    setTotalPaginas(paginasFinais);
  }, [tamanhoLivro, numCaracteres, numImagensPequenas, numImagensMedias, numImagensGrandes, numCapitulos, numAberturasParte, numSubtitulos]);

  const handleInputChange = (valor: string, setState: React.Dispatch<React.SetStateAction<string>>) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    setState(apenasNumeros ? parseInt(apenasNumeros).toLocaleString('pt-BR') : '0');
  };

  const copiarInformacoes = () => {
    const cadernos = totalPaginas / 8;
    const densidade = tamanhoLivro === '16x23' ? 'Baixa (1.500 car./pág.)' : 'Alta (1.000 car./pág.)';
    const totalImagens = parseNum(numImagensPequenas) + parseNum(numImagensMedias) + parseNum(numImagensGrandes);
    
    const texto = `
📊 **RELATÓRIO ESTIMADO DE PÁGINAS**
----------------------------------
📏 Formato: ${tamanhoLivro}
📝 Caracteres: ${numCaracteres}
🖼️ Total de Imagens: ${totalImagens}
📂 Capítulos: ${numCapitulos}
----------------------------------
📖 RESULTADO ESTIMADO: ${totalPaginas} páginas
📚 Cadernos de Impressão: ${cadernos} (múltiplos de 8)
📉 Densidade de Texto: ${densidade}
----------------------------------
*Gerado pela Calculadora Editorial Pro*
    `.trim();

    navigator.clipboard.writeText(texto);
    
    toast({ 
      title: "Copiado!", 
      description: "Relatório técnico copiado para a área de transferência.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Simples e Elegante */}
        <header className="flex flex-col items-center text-center space-y-2 mb-4">
          <div className="bg-primary/10 p-3 rounded-2xl mb-2">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Calculadora Editorial</h1>
          <p className="text-slate-500 max-w-md">Estime o volume final e especificações técnicas de impressão.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Coluna de Configurações (Esquerda) */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-xl shadow-slate-200/60 rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="border-b border-slate-50">
                <CardTitle className="text-lg flex items-center gap-2 font-bold text-slate-800">
                  <FileText className="h-5 w-5 text-primary" />
                  Corpo do Livro
                </CardTitle>
                <CardDescription>Defina o formato e a quantidade de texto</CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 md:p-8 space-y-8">
                {/* Linha 1: Formato e Caracteres */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Formato de Corte</label>
                    <Select value={tamanhoLivro} onValueChange={(v) => setTamanhoLivro(v as any)}>
                      <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-primary/20 transition-all">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16x23">16x23 cm (Padrão Editorial)</SelectItem>
                        <SelectItem value="14x21">14x21 cm (Pocket/Econômico)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Total de Caracteres</label>
                    <div className="relative group">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                      <Input
                        value={numCaracteres}
                        onChange={(e) => handleInputChange(e.target.value, setNumCaracteres)}
                        className="h-14 pl-12 rounded-2xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-primary/20"
                        placeholder="Ex: 250.000"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Linha 2: Estrutura */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400">Capítulos</label>
                    <Input value={numCapitulos} onChange={(e) => handleInputChange(e.target.value, setNumCapitulos)} className="h-12 rounded-xl border-slate-200 shadow-sm" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400">Aberturas de Parte</label>
                    <Input value={numAberturasParte} onChange={(e) => handleInputChange(e.target.value, setNumAberturasParte)} className="h-12 rounded-xl border-slate-200 shadow-sm" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400">Subtítulos</label>
                    <Input value={numSubtitulos} onChange={(e) => handleInputChange(e.target.value, setNumSubtitulos)} className="h-12 rounded-xl border-slate-200 shadow-sm" />
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Seção de Imagens */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-bold text-slate-800">Elementos Visuais</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400">Imagens (1/3 pág)</label>
                      <Input value={numImagensPequenas} onChange={(e) => handleInputChange(e.target.value, setNumImagensPequenas)} className="h-12 rounded-xl border-slate-200" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400">Imagens (1/2 pág)</label>
                      <Input value={numImagensMedias} onChange={(e) => handleInputChange(e.target.value, setNumImagensMedias)} className="h-12 rounded-xl border-slate-200" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase text-slate-400">Página Inteira</label>
                      <Input value={numImagensGrandes} onChange={(e) => handleInputChange(e.target.value, setNumImagensGrandes)} className="h-12 rounded-xl border-slate-200" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna de Resultados (Direita) - STICKY */}
          <div className="lg:col-span-4">
            <div className="sticky top-8 space-y-4">
              
              <Card className="border-none shadow-2xl bg-primary text-primary-foreground rounded-[2.5rem] overflow-hidden">
                <CardHeader className="pb-2 pt-8 px-8">
                  <span className="text-xs font-bold opacity-70 uppercase tracking-[0.2em]">Resultado Estimado</span>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-8xl font-black tracking-tighter leading-none">{totalPaginas}</span>
                    <span className="text-xl font-bold opacity-90">pág.</span>
                  </div>
                  
                  <div className="space-y-4 bg-black/10 p-6 rounded-3xl backdrop-blur-sm">
                    <div className="flex justify-between items-center text-sm">
                      <span className="opacity-70 font-medium">Cadernos de Impressão</span>
                      <span className="font-bold bg-white/20 px-3 py-1 rounded-full text-xs">
                        {totalPaginas / 8} unidades
                      </span>
                    </div>
                    <Separator className="bg-white/10" />
                    <div className="flex justify-between items-center text-sm">
                      <span className="opacity-70 font-medium">Densidade</span>
                      <span className="font-bold">{tamanhoLivro === '16x23' ? 'Baixa' : 'Alta'}</span>
                    </div>
                  </div>

                  <Button 
                    onClick={copiarInformacoes}
                    variant="secondary" 
                    className="w-full h-16 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.03] transition-all shadow-lg active:scale-95"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Relatório
                  </Button>
                </CardContent>
              </Card>

              {/* Box de Informação de Apoio */}
              <div className="p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  <p className="font-bold text-slate-700 mb-1 uppercase tracking-tighter">Observação Técnica</p>
                  O cálculo aplica arredondamento automático para cadernos de 8 páginas e inclui +16 páginas para créditos, sumário e capas internas.
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CalculadoraEditorial;