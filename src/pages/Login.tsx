import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import LogoHubEditorial from '@/assets/imgs/logotable.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard');
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
        return;
      }

      if (data.user) {
        toast({
          title: 'Bem-vindo de volta!',
          description: 'Acessando ambiente editorial...',
        });
        navigate('/dashboard');
      }
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex"
      style={{ backgroundColor: '#f6ebe1' }}
    >
      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between p-12 xl:p-16 relative overflow-hidden"
        style={{ backgroundColor: '#003223' }}
      >
        {/* Decorative circles */}
        <div
          className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full opacity-10"
          style={{ backgroundColor: '#f6ebe1' }}
        />
        <div
          className="absolute bottom-[-60px] left-[-60px] w-[260px] h-[260px] rounded-full opacity-10"
          style={{ backgroundColor: '#ff8400' }}
        />
        <div
          className="absolute bottom-[15%] right-[8%] w-[140px] h-[140px] rounded-full opacity-[0.07]"
          style={{ backgroundColor: '#f6ebe1' }}
        />

        {/* Top — Logo */}
        <div className="relative z-10">
          <img
            src={LogoHubEditorial}
            alt="Hub Editorial"
            className="h-12 xl:h-14 w-auto object-contain brightness-0 invert"
          />
        </div>

        {/* Middle — Big headline */}
        <div className="relative z-10 space-y-6">
          <div
            className="inline-block text-xs font-black uppercase tracking-[0.25em] px-3 py-1.5 rounded-full"
            style={{ backgroundColor: '#ff8400', color: '#fff' }}
          >
            Acesso Restrito
          </div>
          <h1
            className="text-4xl xl:text-5xl font-black leading-[1.15] tracking-tight"
            style={{ color: '#f6ebe1' }}
          >
            Plataforma de<br />Gestão<br />Editorial
          </h1>
          <p
            className="text-base font-medium max-w-xs leading-relaxed"
            style={{ color: 'rgba(243,236,214,0.65)' }}
          >
            Ambiente exclusivo para curadores e editores autorizados.
          </p>
        </div>

        {/* Bottom — Footer tag */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-[2px] rounded-full"
              style={{ backgroundColor: 'rgba(243,236,214,0.3)' }}
            />
            <span
              className="text-[10px] font-black uppercase tracking-[0.3em]"
              style={{ color: 'rgba(243,236,214,0.4)' }}
            >
              Hub Editorial System
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-16 xl:px-24"
        style={{ backgroundColor: '#f6ebe1' }}
      >
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="flex justify-center mb-10 lg:hidden">
            <img
              src={LogoHubEditorial}
              alt="Hub Editorial"
              className="h-10 w-auto object-contain"
            />
          </div>

          {/* Heading */}
          <div className="mb-9">
            <h2
              className="text-3xl font-black tracking-tight mb-2"
              style={{ color: '#2b2b2b' }}
            >
              Entrar
            </h2>
            <p
              className="text-sm font-medium"
              style={{ color: 'rgba(43,43,43,0.5)' }}
            >
              Use suas credenciais para acessar o painel.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error */}
            {error && (
              <Alert
                className="rounded-xl border py-2.5 px-3"
                style={{
                  backgroundColor: 'rgba(241,56,28,0.08)',
                  borderColor: 'rgba(241,56,28,0.2)',
                  color: '#f1381c',
                }}
              >
                <AlertCircle className="h-4 w-4" style={{ color: '#f1381c' }} />
                <AlertDescription className="font-bold text-xs ml-1">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: 'rgba(43,43,43,0.5)' }}
              >
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@editora.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl text-sm border-0 outline-none ring-0 focus-visible:ring-2 transition-all"
                style={{
                  backgroundColor: 'rgba(43,43,43,0.06)',
                  color: '#2b2b2b',
                  '--tw-ring-color': '#ff8400',
                } as React.CSSProperties}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label
                  htmlFor="password"
                  className="text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: 'rgba(43,43,43,0.5)' }}
                >
                  Senha
                </Label>
                <button
                  type="button"
                  className="text-[10px] font-black uppercase tracking-wide transition-opacity hover:opacity-70"
                  style={{ color: '#ff8400' }}
                >
                  Esqueceu?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-11 rounded-xl text-sm border-0 focus-visible:ring-2 transition-all"
                  style={{
                    backgroundColor: 'rgba(43,43,43,0.06)',
                    color: '#2b2b2b',
                    '--tw-ring-color': '#ff8400',
                  } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                  style={{ color: 'rgba(43,43,43,0.4)' }}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl font-black text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              style={{
                backgroundColor: '#ff8400',
                color: '#f6ebe1',
                boxShadow: '0 6px 24px rgba(28,83,186,0.30)',
              }}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                'Acessar Painel'
              )}
            </button>
          </form>

          {/* Back to home */}
          <div className="mt-4">
            <Link
              to="/"
              className="group flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm border-2 transition-all hover:opacity-75 active:scale-[0.98]"
              style={{
                borderColor: 'rgba(43,43,43,0.18)',
                color: '#2b2b2b',
                backgroundColor: 'transparent',
              }}
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Voltar à página inicial
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-10 flex items-center gap-3 justify-center">
            <div className="h-[1px] flex-1" style={{ backgroundColor: 'rgba(43,43,43,0.12)' }} />
            <span
              className="text-[9px] font-black uppercase tracking-[0.25em] whitespace-nowrap"
              style={{ color: 'rgba(43,43,43,0.3)' }}
            >
              Hub Editorial
            </span>
            <div className="h-[1px] flex-1" style={{ backgroundColor: 'rgba(43,43,43,0.12)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}