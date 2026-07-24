import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';
import { Boxes, Lock, Mail, Eye, EyeOff, AlertCircle, ExternalLink } from 'lucide-react';

export default function Login() {
  const { setAuth } = useAuthStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data.data;

      setAuth(user, accessToken, refreshToken);
      addToast(`Welcome, ${user.name}.`, 'success');
      navigate('/');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Invalid credentials. Please try again.';
      setErrorMessage(message);
      addToast('Authentication failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage('');
  };

  const demoAccounts = [
    { label: 'Super Admin', email: 'admin@aerostock.aai.aero', pass: 'Admin@1234' },
    { label: 'Delhi Manager', email: 'delhi.mgr@aerostock.aai.aero', pass: 'Manager@1234' },
    { label: 'Auditor', email: 'auditor@aerostock.aai.aero', pass: 'Auditor@1234' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-aai-dark">
      <a href="#login-form" className="gov-skip-link">
        Skip to login form
      </a>

      {/* Official header */}
      <header className="bg-aai-header text-white" role="banner">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2 text-xs border-b border-white/10">
          <span className="font-medium opacity-90">Government of India</span>
          <span className="mx-2 opacity-40" aria-hidden="true">|</span>
          <span className="opacity-80">Airport Authority of India</span>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div
            className="w-11 h-11 bg-white/10 border border-white/20 rounded flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <Boxes className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">AeroStock Portal</h1>
            <p className="text-xs text-white/70">Secure employee access — Inventory Management System</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="gov-card p-6 sm:p-8">
            <div className="mb-6">
              <h2 id="login-heading" className="text-xl font-semibold text-aai-foreground">
                Sign in to your account
              </h2>
              <p className="text-sm text-aai-muted mt-1">
                Use your authorised AAI work email and password.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-6 p-4 bg-red-50 border border-aai-error/30 rounded flex gap-3 items-start text-sm text-aai-error"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p>{errorMessage}</p>
              </div>
            )}

            <form id="login-form" onSubmit={handleLogin} className="space-y-5" aria-labelledby="login-heading">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-aai-foreground mb-1.5">
                  Work email address <span className="text-aai-error" aria-label="required">*</span>
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-aai-muted pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="employee@aai.aero"
                    className="gov-input pl-10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-aai-foreground mb-1.5">
                  Password <span className="text-aai-error" aria-label="required">*</span>
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-aai-muted pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="gov-input pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-aai-muted hover:text-aai-foreground p-1 rounded"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="gov-btn-primary w-full mt-2">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Demo accounts — development only */}
            <div className="mt-8 pt-6 border-t border-aai-border">
              <p className="text-xs text-center text-aai-muted mb-3">
                Demo accounts (development environment)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.label}
                    type="button"
                    onClick={() => handleQuickLogin(acc.email, acc.pass)}
                    className="px-3 py-2 text-xs font-medium bg-aai-surface border border-aai-border rounded text-aai-foreground hover:border-aai-blue hover:text-aai-blue text-center"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-aai-muted mt-6">
            <a
              href="https://www.aai.aero"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-aai-blue hover:underline"
            >
              Visit AAI official website
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          </p>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-aai-muted border-t border-aai-border bg-white" role="contentinfo">
        &copy; {new Date().getFullYear()} Airport Authority of India. Authorized personnel only.
      </footer>
    </div>
  );
}
