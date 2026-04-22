import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Send, User, FileText, ChevronLeft, CheckCircle, 
  Upload, Loader2, Sparkles, UserPlus 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function SubmitChapter() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados do Formulário
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    author_name: '',
    author_email: '',
    submission_type: 'solo' as 'solo' | 'coautoria',
    chapter_title: '',
    chapter_content: '',
    curriculum: '',
    summary: '',
    book_coordinator: '', // Campo solicitado para o Modal
    book_id: null as string | null
  });

  const analyzeContent = (text: string) => {
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    const issues = {
      doubleSpaces: (text.match(/  +/g) || []).length,
      multiplePunctuation: (text.match(/[!?.,]{2,}/g) || []).length,
      lowercaseAfterDot: (text.match(/\. [a-z]/g) || []).length,
      missingSpaceAfterComma: (text.match(/,[^\s]/g) || []).length,
      longParagraphs: paragraphs.filter(p => p.length > 800).length,
    };

    return {
      words: text.trim().split(/\s+/).length,
      chars: text.length,
      paragraphs: paragraphs.length,
      issues: issues,
      score: Object.values(issues).reduce((a, b) => a + b, 0),
      analyzed_at: new Date().toISOString()
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      let photoUrl = null;

      // 1. Upload da Foto para o Storage
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chapter-photos') 
          .upload(fileName, photoFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('chapter-photos')
            .getPublicUrl(fileName);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      // 2. Análise de Texto
      const textStats = analyzeContent(formData.chapter_content);

      // 3. Insert no Supabase (Mapeamento exato das colunas do seu banco)
      const { error: dbError } = await supabase.from('chapter_submissions').insert([
        {
          author_name: formData.author_name,
          author_email: formData.author_email,
          submission_type: formData.submission_type,
          chapter_title: formData.chapter_title,
          chapter_content: formData.chapter_content,
          curriculum: formData.curriculum,
          summary: formData.summary,
          photo_file_url: photoUrl,    // NOME CORRETO DA COLUNA
          book_coordinator: formData.book_coordinator || "Não informado", // NOME CORRETO DA COLUNA
          status: 'novo',
          references: { 
            analysis: textStats 
          },
          book_id: formData.book_id
        }
      ]);

      if (dbError) throw dbError;

      setIsSubmitted(true);
      setTimeout(() => navigate('/'), 4000);

    } catch (error: any) {
      console.error("Erro no envio:", error);
      toast({
        variant: "destructive",
        title: "Falha no envio",
        description: error.message || "Verifique sua conexão ou se a coluna existe no banco."
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="flex justify-center">
            <div className="h-24 w-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 shadow-inner">
              <CheckCircle className="h-12 w-12" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight">Recebido!</h1>
            <p className="text-muted-foreground text-lg">
              Parabéns, <strong>{formData.author_name.split(' ')[0]}</strong>! Seu manuscrito foi enviado com sucesso para análise editorial.
            </p>
          </div>
          <div className="pt-8 border-t border-border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center justify-center gap-3">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
              Redirecionando em instantes
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 selection:bg-[#ffb319]/30">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild className="gap-2 hover:bg-muted/50 rounded-xl">
            <Link to="/"><ChevronLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
          <div className="text-right">
            <h1 className="text-2xl font-black uppercase tracking-tighter">Portal do Autor</h1>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest bg-muted px-2 py-0.5 rounded mt-1 inline-block">Submissão Oficial</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA LATERAL (IDENTIDADE) */}
          <div className="space-y-6">
            <Card className="border-border shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-[#ffb319]" /> Identificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold opacity-70">Nome Completo</Label>
                  <Input required placeholder="Nome do autor" className="rounded-xl border-muted-foreground/20 focus-visible:ring-[#ffb319]" value={formData.author_name} onChange={e => setFormData({...formData, author_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold opacity-70">E-mail</Label>
                  <Input required type="email" placeholder="email@exemplo.com" className="rounded-xl border-muted-foreground/20 focus-visible:ring-[#ffb319]" value={formData.author_email} onChange={e => setFormData({...formData, author_email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold opacity-70">Formato</Label>
                  <Select value={formData.submission_type} onValueChange={(v: any) => setFormData({...formData, submission_type: v})}>
                    <SelectTrigger className="rounded-xl border-muted-foreground/20"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="solo">Individual</SelectItem>
                      <SelectItem value="coautoria">Em Coautoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold opacity-70 flex items-center gap-1">
                    <UserPlus className="h-3 w-3" /> Coordenador do Livro
                  </Label>
                  <Input placeholder="Quem te convidou?" className="rounded-xl border-muted-foreground/20 focus-visible:ring-[#ffb319]" value={formData.book_coordinator} onChange={e => setFormData({...formData, book_coordinator: e.target.value})} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm overflow-hidden rounded-2xl">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5 text-[#ffb319]" /> Sua Foto Editorial
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative h-48 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#ffb319]/50 hover:bg-[#ffb319]/5 transition-all overflow-hidden"
                >
                  {photoFile ? (
                    <img src={URL.createObjectURL(photoFile)} className="w-full h-full object-cover animate-in fade-in duration-300" alt="Preview" />
                  ) : (
                    <>
                      <div className="p-4 rounded-full bg-muted group-hover:bg-[#ffb319]/10 transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground group-hover:text-[#ffb319]" />
                      </div>
                      <span className="text-[9px] font-bold uppercase text-muted-foreground mt-3 tracking-tighter">Clique para selecionar</span>
                    </>
                  )}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
              </CardContent>
            </Card>
          </div>

          {/* COLUNA PRINCIPAL (CONTEÚDO) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#ffb319]/10 flex items-center justify-center text-[#ffb319]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Manuscrito Original</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold opacity-50 tracking-wider">O texto será processado pelo motor de análise.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Título do Capítulo</Label>
                  <Input required className="h-14 text-xl font-bold rounded-xl border-muted-foreground/20 focus-visible:ring-[#ffb319]" placeholder="Título da obra..." value={formData.chapter_title} onChange={e => setFormData({...formData, chapter_title: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                    Corpo do Texto <Sparkles className="h-3 w-3 text-[#ffb319]" />
                  </Label>
                  <Textarea required className="min-h-[500px] font-serif text-lg leading-relaxed p-8 bg-muted/10 rounded-2xl border-muted-foreground/20 focus-visible:ring-[#ffb319] resize-none" placeholder="Escreva ou cole seu capítulo aqui..." value={formData.chapter_content} onChange={e => setFormData({...formData, chapter_content: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Sinopse da Obra</Label>
                    <Textarea required className="h-32 text-xs rounded-xl border-muted-foreground/20 focus-visible:ring-[#ffb319]" placeholder="Resumo estruturado do conteúdo..." value={formData.summary} onChange={e => setFormData({...formData, summary: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase opacity-60">Minibiografia</Label>
                    <Textarea required className="h-32 text-xs rounded-xl border-muted-foreground/20 focus-visible:ring-[#ffb319]" placeholder="Quem é o autor?" value={formData.curriculum} onChange={e => setFormData({...formData, curriculum: e.target.value})} />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-16 text-lg font-black shadow-lg bg-[#ffb319] text-black hover:bg-[#e6a117] rounded-2xl transition-all active:scale-[0.98]"
                >
                  {isLoading ? (
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" /> PROCESSANDO ENVIO...</>
                  ) : (
                    <><Send className="h-5 w-5 mr-2" /> ENVIAR CAPÍTULO</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}