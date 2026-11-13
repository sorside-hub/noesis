import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  isSupabaseConfigured,
} from '../lib/supabase';
import {
  Sun,
  Moon,
  Monitor,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Database,
  ChevronDown,
  ChevronUp,
  LogIn,
  UserPlus,
} from 'lucide-react';

const translateAuthError = (raw: string): string => {
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Email atau password salah.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Cek kotak masuk/spam Anda, atau matikan opsi "Confirm email" di Supabase Auth jika ingin login langsung.';
  }
  if (lower.includes('user already registered')) {
    return 'Email ini sudah terdaftar. Silakan pindah ke tab Masuk.';
  }
  if (lower.includes('password should be at least')) {
    return 'Password minimal harus terdiri dari 6 karakter.';
  }
  if (lower.includes('signups not allowed')) {
    return 'Pendaftaran akun baru saat ini dinonaktifkan di Supabase Project ini.';
  }
  if (lower.includes('unable to validate email address')) {
    return 'Format alamat email tidak valid.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  }
  return raw;
};

export const AuthScreen: React.FC = () => {
  const {
    theme,
    setTheme,
    signIn,
    signUp,
    enterOfflineMode,
    refreshSupabaseConfig,
  } = useNoesis();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const configured = isSupabaseConfigured();
  const [showServerConfig, setShowServerConfig] = useState(!configured);
  const [sbUrl, setSbUrl] = useState(getSupabaseUrl());
  const [sbKey, setSbKey] = useState(getSupabaseAnonKey());
  const [serverSavedMsg, setServerSavedMsg] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSupabaseConfigured()) {
      setShowServerConfig(true);
      setErrorMsg('Masukkan Project URL & Anon Key Supabase terlebih dahulu.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Email dan password wajib diisi.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMsg('Password minimal harus 6 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Konfirmasi password tidak cocok.');
        return;
      }
    }

    setIsSubmitting(true);
    if (mode === 'login') {
      const res = await signIn(email, password);
      if (!res.ok) {
        setErrorMsg(translateAuthError(res.error || 'Gagal masuk.'));
      }
    } else {
      const res = await signUp(email, password);
      if (!res.ok) {
        setErrorMsg(translateAuthError(res.error || 'Gagal mendaftar.'));
      } else if (res.needsConfirmation) {
        setSuccessMsg(
          'Akun dibuat! Cek email Anda untuk tautan konfirmasi sebelum masuk (atau nonaktifkan Confirm Email di Supabase Auth untuk login instan).'
        );
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    }
    setIsSubmitting(false);
  };

  const handleSaveServerConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setServerSavedMsg(null);

    const trimmedUrl = sbUrl.trim();
    const trimmedKey = sbKey.trim();

    if (trimmedUrl) localStorage.setItem('noesis_supabase_url', trimmedUrl);
    else localStorage.removeItem('noesis_supabase_url');

    if (trimmedKey) localStorage.setItem('noesis_supabase_anon_key', trimmedKey);
    else localStorage.removeItem('noesis_supabase_anon_key');

    refreshSupabaseConfig();

    if (trimmedUrl && trimmedKey) {
      setServerSavedMsg('Konfigurasi Supabase disimpan. Silakan masuk dengan akun Anda.');
      setShowServerConfig(false);
    } else {
      setServerSavedMsg('Konfigurasi Supabase dibersihkan.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] flex flex-col justify-between px-4 py-6 sm:px-6">
      {/* Top Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <span className="font-serif text-2xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
            Noesis
          </span>
          <span className="text-xs font-mono text-[#9C9388] dark:text-[#736C62] hidden sm:inline">
            Personal Knowledge Sanctuary
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (theme === 'light') setTheme('dark');
            else if (theme === 'dark') setTheme('system');
            else setTheme('light');
          }}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors text-xs font-medium whitespace-nowrap"
          aria-label={`Toggle theme (current: ${theme})`}
          title={`Tema: ${theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}`}
        >
          {theme === 'dark' ? (
            <Moon size={15} className="text-[#EA580C]" />
          ) : theme === 'system' ? (
            <Monitor size={15} className="text-[#9A3412] dark:text-[#EA580C]" />
          ) : (
            <Sun size={15} className="text-[#9A3412]" />
          )}
          <span>{theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </div>

      {/* Centered Single-Elevation Auth Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <div className="bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
              {mode === 'login' ? 'Masuk ke Ruang Kerja' : 'Buat Akun Baru'}
            </h1>
            <p className="text-xs leading-relaxed text-[#6B635B] dark:text-[#A8A196]">
              {mode === 'login'
                ? 'Sinkronkan catatan, fragments, dan peta pengetahuan Anda di seluruh perangkat.'
                : 'Daftarkan email & password untuk mengunci dan menyinkronkan data pribadi Anda.'}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[#F5EFEB] dark:bg-[#151413] rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                  : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'signup'
                  ? 'bg-white dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-xs'
                  : 'text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1]'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          {/* Feedback Notices */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-start gap-2 leading-relaxed">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 leading-relaxed">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {serverSavedMsg && !errorMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 leading-relaxed">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              <span>{serverSavedMsg}</span>
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196] mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-3 text-[#9C9388]" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full text-sm pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-3 text-[#9C9388]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimal 6 karakter' : 'Masukkan password'}
                  className="w-full text-sm pl-10 pr-10 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 p-0.5 text-[#9C9388] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-mono text-[#6B635B] dark:text-[#A8A196] mb-1.5">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-3 text-[#9C9388]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password"
                    className="w-full text-sm pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] placeholder:text-[#9C9388] focus:outline-none focus:border-[#9A3412] dark:focus:border-[#EA580C] transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-sm font-medium hover:bg-[#78280E] dark:hover:bg-[#C2410C] disabled:opacity-60 transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <LogIn size={16} />
                  <span>Masuk</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Daftar &amp; Masuk</span>
                </>
              )}
            </button>
          </form>

          {/* Multi-device Supabase Server Credentials Accordion */}
          <div className="pt-4 border-t border-[#E8E2D8] dark:border-[#2F2B28] space-y-3">
            <button
              type="button"
              onClick={() => setShowServerConfig((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Database size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                <span>
                  {configured
                    ? 'Konfigurasi Server Supabase'
                    : 'Hubungkan Server Supabase (Wajib untuk Sync)'}
                </span>
              </span>
              {showServerConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showServerConfig && (
              <form onSubmit={handleSaveServerConfig} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[10px] font-mono text-[#9C9388] mb-1">
                    Project URL
                  </label>
                  <input
                    type="url"
                    value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)}
                    placeholder="https://xyz.supabase.co"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-[#9C9388] mb-1">
                    Anon / Public Key
                  </label>
                  <input
                    type="password"
                    value={sbKey}
                    onChange={(e) => setSbKey(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#272422] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:border-[#9A3412] transition-colors"
                >
                  Simpan Koneksi Supabase
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={enterOfflineMode}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#D6CEBE] dark:border-[#3D3834] text-center text-xs font-medium text-[#6B635B] dark:text-[#A8A196] hover:text-[#9A3412] dark:hover:text-[#EA580C] hover:border-[#9A3412] transition-colors"
            >
              Lewati Login Dulu (Masuk Mode Lokal)
            </button>
          </div>
        </div>
      </div>

      {/* Subtle Footer */}
      <div className="max-w-5xl w-full mx-auto text-center text-[11px] text-[#9C9388] dark:text-[#736C62]">
        Dilindungi oleh Supabase Auth &amp; Per-User Row Level Security
      </div>
    </div>
  );
};
