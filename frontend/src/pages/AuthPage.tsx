import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Key, Mail, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../utils/api';

export const AuthPage: React.FC = () => {
  const { login, register, forgotPassword, refreshUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  const isGoogleConfigured = 
    !!import.meta.env.VITE_GOOGLE_CLIENT_ID && 
    import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'your-google-client-id.apps.googleusercontent.com';
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleGoogleCredentialResponse = async (response: any) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/google', { credential: response.credential });
      const { token: receivedToken } = res.data;
      localStorage.setItem('study_assistant_token', receivedToken);
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if ((window as any).google?.accounts?.id && isGoogleConfigured) {
        (window as any).google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
        });
        const btnElement = document.getElementById('google-signin-btn');
        if (btnElement) {
          (window as any).google.accounts.id.renderButton(
            btnElement,
            { 
              theme: 'outline', 
              size: 'large', 
              text: 'continue_with', 
              shape: 'rectangular',
              width: btnElement.clientWidth || 300,
            }
          );
        }
      }
    };

    initializeGoogleSignIn();

    const timer = setInterval(() => {
      if ((window as any).google?.accounts?.id) {
        initializeGoogleSignIn();
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [mode]);

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/guest');
      const { token: receivedToken } = res.data;
      localStorage.setItem('study_assistant_token', receivedToken);
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Guest login failed');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setName('');
    setEmail('');
    setPassword('');
    setError('');
    setSuccess('');
  };

  const handleToggleMode = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    resetState();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'register') {
        if (!name.trim()) throw new Error('Name is required');
        await register(name, email, password);
      } else {
        await forgotPassword(email, password);
        setSuccess('Password updated successfully. You can now log in.');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-950 via-slate-950 to-zinc-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background ambient glowing balls */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-fuchsia-600/10 rounded-full blur-[120px] animate-pulse-glow" />

      <div className="max-w-md w-full space-y-8 glass p-8 rounded-2xl relative z-10 border border-white/5 shadow-2xl shadow-violet-950/20">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            AI Study Assistant
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {mode === 'login' && 'Access your digital workspace'}
            {mode === 'register' && 'Create a new account to begin studying'}
            {mode === 'forgot' && 'Reset your password instantly'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg text-center">
            {success}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <label className="sr-only">Full Name</label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <User className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-sm"
                  placeholder="Full Name"
                />
              </div>
            )}

            <div className="relative">
              <label className="sr-only">Email Address</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-sm"
                placeholder="Email Address"
              />
            </div>

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div className="relative">
                <label className="sr-only">
                  {mode === 'forgot' ? 'New Password' : 'Password'}
                </label>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Key className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-sm"
                  placeholder={mode === 'forgot' ? 'New Password (min 6 chars)' : 'Password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}
          </div>

          {mode === 'login' && (
            <div className="flex items-center justify-between text-sm">
              <div />
              <button
                type="button"
                onClick={() => handleToggleMode('forgot')}
                className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                Forgot your password?
              </button>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-55 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all"
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5 text-white" />
              ) : (
                <>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'register' && 'Sign Up'}
                  {mode === 'forgot' && 'Reset Password'}
                </>
              )}
            </button>
          </div>
        </form>

        {(mode === 'login' || mode === 'register') && (
          <>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-2 text-zinc-500 font-bold tracking-wider">Or continue with</span>
              </div>
            </div>

            {!isGoogleConfigured ? (
              <div className="relative group w-full">
                <button
                  type="button"
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-zinc-800 rounded-xl text-sm font-semibold text-zinc-500 bg-zinc-900/20 cursor-not-allowed opacity-50 transition-all"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 -top-12 w-72 p-2 bg-zinc-950/95 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 text-center leading-normal opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl z-20">
                  Google SSO client ID is unconfigured. Set <code className="bg-zinc-900 px-1 py-0.5 rounded text-fuchsia-400">VITE_GOOGLE_CLIENT_ID</code> in the frontend to enable, or use Guest Login.
                </div>
              </div>
            ) : (
              <div id="google-signin-btn" className="w-full flex justify-center h-10 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all"></div>
            )}
            
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-zinc-800 rounded-xl text-sm font-semibold text-zinc-300 bg-zinc-900/40 hover:bg-zinc-900/60 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue as Guest
            </button>
          </>
        )}

        <div className="text-center mt-6">
          {mode === 'login' ? (
            <p className="text-sm text-zinc-400">
              Don't have an account?{' '}
              <button
                onClick={() => handleToggleMode('register')}
                className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                Sign up free
              </button>
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              Already have an account?{' '}
              <button
                onClick={() => handleToggleMode('login')}
                className="font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                Sign in instead
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
