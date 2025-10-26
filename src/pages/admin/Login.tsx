import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminLoginSchema } from '@/lib/validation-schemas';
import { cn } from '@/lib/utils';

export default function AdminLogin() {
  const { isAdmin, loading, signIn } = useAdmin();
  const [email, setEmail] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-background via-primary-50/20 to-background">
        <div className="text-center">
          <div className="relative mx-auto mb-6">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
            <div className="absolute inset-0 h-12 w-12 animate-pulse rounded-full bg-primary/10"></div>
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate inputs
    const validation = adminLoginSchema.safeParse({ email, adminCode });
    if (!validation.success) {
      const firstError = validation.error.errors[0].message;
      setError(firstError);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error('Validation failed', { description: firstError });
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, adminCode);

    if (error) {
      setError(error.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error('Login failed', {
        description: error.message,
      });
    } else {
      toast.success('Welcome back!', {
        description: 'Redirecting to dashboard...',
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary-50/20 to-background">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-primary-glow/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        </div>
      </div>

      {/* Noise Texture */}
      <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      ></div>

      {/* Login Card */}
      <Card className={cn(
        "relative w-full max-w-md shadow-2xl border-border/50 bg-card/80 backdrop-blur-xl animate-scale-in",
        shake && "animate-[shake_0.5s_ease-in-out]"
      )}>
        <CardHeader className="space-y-4 text-center pb-8">
          {/* Logo with Glow */}
          <div className="relative inline-flex mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-glow opacity-20 blur-2xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-600 shadow-glow">
              <ShieldCheck className="h-8 w-8 text-primary-foreground animate-bounce-subtle" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight">
              Admin Login
            </CardTitle>
            <CardDescription className="text-base">
              Sign in to access the Homara admin panel
            </CardDescription>
          </div>

          {/* Decorative Line */}
          <div className="h-0.5 w-16 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"></div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="animate-fade-down border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">{error}</AlertDescription>
              </Alert>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@homara.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Admin Code Field */}
            <div className="space-y-2">
              <Label htmlFor="adminCode" className="text-sm font-medium">
                Admin Code
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  id="adminCode"
                  type="password"
                  placeholder="Enter your admin code"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700 text-primary-foreground font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden" 
                disabled={isLoading}
              >
                {/* Shimmer Effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </Button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Protected by enterprise-grade security
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Back to Home Link */}
      <a 
        href="/"
        className="absolute top-6 left-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group"
      >
        <svg 
          className="w-4 h-4 group-hover:-translate-x-1 transition-transform" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Home
      </a>
    </div>
  );
}

// Add shake animation to CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
`;
document.head.appendChild(style);
