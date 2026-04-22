// src/components/ProtectedRoute.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
      }
    };
    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate('/login', { replace: true });
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  return <>{children}</>;
}