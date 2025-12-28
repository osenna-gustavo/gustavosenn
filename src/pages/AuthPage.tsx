import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Mail, Lock, Loader2 } from 'lucide-react';

type AuthMode = 'login' | 'signup';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha email e senha.',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A senha e a confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          let message = 'Erro ao fazer login.';
          if (error.message.includes('Invalid login credentials')) {
            message = 'Email ou senha incorretos.';
          } else if (error.message.includes('Email not confirmed')) {
            message = 'Email não confirmado. Verifique sua caixa de entrada.';
          }
          toast({ title: 'Erro', description: message, variant: 'destructive' });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          let message = 'Erro ao criar conta.';
          if (error.message.includes('User already registered')) {
            message = 'Este email já está cadastrado. Tente fazer login.';
          }
          toast({ title: 'Erro', description: message, variant: 'destructive' });
        } else {
          toast({
            title: 'Conta criada!',
            description: 'Você já está logado. Aproveite o FluxoCaixa!',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold gradient-text">FluxoCaixa</h1>
          </div>
          <p className="text-muted-foreground">
            Gestão financeira pessoal inteligente
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card rounded-2xl p-6 lg:p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold">
              {mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'login' 
                ? 'Acesse sua conta para continuar' 
                : 'Crie uma conta para começar'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm text-primary hover:underline"
              disabled={isLoading}
            >
              {mode === 'login' 
                ? 'Não tem conta? Criar uma' 
                : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Seus dados são armazenados de forma segura na nuvem.
        </p>
      </div>
    </div>
  );
}
