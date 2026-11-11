import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import {
  Download,
  RotateCcw,
  Check,
  Type,
  BookOpen,
  Sliders,
  ShieldCheck,
  Database,
  Copy,
  Code2,
  Sparkles,
} from 'lucide-react';
import { INITIAL_NOTES, INITIAL_NOTEBOOKS, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';
import { SUPABASE_SQL_SCRIPT } from '../data/supabaseSchema';
import { getSupabaseUrl, getSupabaseAnonKey } from '../lib/supabase';
import { getCloudflareAccountId, getCloudflareApiToken } from '../lib/cloudflareEmbedding';

export const SettingsPage: React.FC = () => {
  const {
    notes,
    relics,
    isSupabaseConnected,
    isCloudflareConnected,
    syncStatus,
    syncAllToSupabase,
  } = useNoesis();
  const [copiedExport, setCopiedExport] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const [fontSize, setFontSize] = useState<'standard' | 'generous' | 'large'>('standard');
  const [showWordCount, setShowWordCount] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // API Credentials Input State
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [sbUrlInput, setSbUrlInput] = useState(getSupabaseUrl());
  const [sbKeyInput, setSbKeyInput] = useState(getSupabaseAnonKey());
  const [cfAccountInput, setCfAccountInput] = useState(getCloudflareAccountId());
  const [cfTokenInput, setCfTokenInput] = useState(getCloudflareApiToken());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (sbUrlInput.trim()) localStorage.setItem('noesis_supabase_url', sbUrlInput.trim());
    else localStorage.removeItem('noesis_supabase_url');

    if (sbKeyInput.trim()) localStorage.setItem('noesis_supabase_anon_key', sbKeyInput.trim());
    else localStorage.removeItem('noesis_supabase_anon_key');

    if (cfAccountInput.trim()) localStorage.setItem('noesis_cf_account_id', cfAccountInput.trim());
    else localStorage.removeItem('noesis_cf_account_id');

    if (cfTokenInput.trim()) localStorage.setItem('noesis_cf_api_token', cfTokenInput.trim());
    else localStorage.removeItem('noesis_cf_api_token');

    setSavedNotice('Kredensial tersimpan! Memuat ulang koneksi...');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleCopySQL = () => {
    navigator.clipboard?.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2200);
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncResult(null);
    const res = await syncAllToSupabase();
    setIsSyncingAll(false);
    if (res.success) {
      setSyncResult(`Tersinkron ${res.notesCount} notes & ${res.fragmentsCount} fragments ke Supabase!`);
      setTimeout(() => setSyncResult(null), 4000);
    } else {
      setSyncResult('Supabase belum aktif di .env. Jalankan SQL terlebih dahulu lalu masukkan kredensial.');
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleExportJSON = () => {
    const data = {
      app: 'Noesis',
      version: 'Phase 1 - UI/UX Foundation',
      exportDate: new Date().toISOString(),
      notes,
      relics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noesis-library-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2500);
  };

  const handleResetData = () => {
    if (confirm('Reset all notes and relics to default editorial sample content?')) {
      localStorage.setItem('noesis_notes', JSON.stringify(INITIAL_NOTES));
      localStorage.setItem('noesis_notebooks', JSON.stringify(INITIAL_NOTEBOOKS));
      localStorage.setItem('noesis_relics', JSON.stringify(INITIAL_RELICS));
      localStorage.setItem('noesis_projects', JSON.stringify(INITIAL_PROJECTS));
      setResetNotice(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-6 sm:px-10 lg:px-14 py-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#9A3412] dark:text-[#EA580C]">
            Workspace Configuration
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1] mt-1">
            Settings & Aesthetics
          </h1>
          <p className="text-sm text-[#6B635B] dark:text-[#A8A196] mt-1">
            Customize typography and manage your local offline archive. Theme preference is controlled via the header/sidebar toggle.
          </p>
        </div>

        {/* Typography & Reading Rhythm */}
        <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          <div>
            <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Typographic Scale
            </h2>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1">
              Fine-tune the measure and baseline cadence for comfortable long-form reading.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'standard', label: 'Standard (16px / 1.75)' },
              { id: 'generous', label: 'Generous (18px / 1.85)' },
              { id: 'large', label: 'Large (20px / 1.9)' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFontSize(opt.id as any)}
                className={`p-3 rounded-xl border text-xs font-medium text-center transition-all ${
                  fontSize === opt.id
                    ? 'border-[#9A3412] bg-[#FAF7F2] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60">
            <div>
              <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] block">
                Editor Telemetry Strip
              </span>
              <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">
                Show word and character statistics in the lower editor footer.
              </span>
            </div>

            <button
              onClick={() => setShowWordCount((prev) => !prev)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                showWordCount ? 'bg-[#9A3412]' : 'bg-[#E8E2D8] dark:bg-[#332F2C]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  showWordCount ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Supabase & Cloudflare BGE-M3 Schema Setup */}
        <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center shrink-0">
                <Database size={18} />
              </div>
              <div>
                <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Supabase & pgvector SQL Schema
                </h2>
                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5">
                  Optimized for Cloudflare Workers AI <span className="font-mono text-[#9A3412] dark:text-[#EA580C]">bge-m3</span> (1024 dimensions)
                </p>
              </div>
            </div>

            <button
              onClick={handleCopySQL}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-xs flex items-center gap-2 shrink-0 ${
                copiedSql
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#9A3412] dark:bg-[#EA580C] text-white hover:bg-[#78280E] dark:hover:bg-[#C2410C]'
              }`}
            >
              {copiedSql ? (
                <>
                  <Check size={14} />
                  <span>SQL Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy SQL Script</span>
                </>
              )}
            </button>
          </div>

          {/* Live Connection Status & Sync Action */}
          <div className="p-4 rounded-xl bg-[#F5EFEB]/70 dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#6B635B] dark:text-[#A8A196]">Supabase Database:</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-md text-[11px] ${
                    isSupabaseConnected
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSupabaseConnected ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  {isSupabaseConnected ? 'Connected (Realtime Active)' : 'Local Offline Mode'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#6B635B] dark:text-[#A8A196]">Cloudflare Workers AI:</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-md text-[11px] ${
                    isCloudflareConnected
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-stone-200 dark:bg-stone-800 text-[#6B635B] dark:text-[#A8A196]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCloudflareConnected ? 'bg-emerald-500' : 'bg-stone-400'
                    }`}
                  />
                  {isCloudflareConnected ? 'bge-m3 Active (1024 Dim)' : 'Awaiting CF credentials'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCredentialsForm((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:bg-[#FAF7F2] dark:hover:bg-[#272422] transition-colors flex items-center gap-1.5"
              >
                <Sliders size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                <span>{showCredentialsForm ? 'Sembunyikan Form Kredensial' : 'Atur Kredensial API'}</span>
              </button>

              {isSupabaseConnected && (
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncingAll}
                  className="px-3.5 py-1.5 rounded-xl border border-[#9A3412] dark:border-[#EA580C] text-[#9A3412] dark:text-[#EA580C] hover:bg-[#9A3412]/10 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Database size={13} />
                  <span>{isSyncingAll ? 'Syncing...' : 'Sync Local to Supabase'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible API Credentials Form */}
          {showCredentialsForm && (
            <form onSubmit={handleSaveCredentials} className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 pb-3">
                <h3 className="font-serif text-base font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Pengaturan Kredensial Supabase & Cloudflare AI
                </h3>
                <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5">
                  Masukkan kredensial di bawah ini untuk menghubungkan database Supabase dan Cloudflare Workers AI (<code className="font-mono text-[#9A3412]">bge-m3</code>).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Supabase URL */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={sbUrlInput}
                    onChange={(e) => setSbUrlInput(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                {/* Supabase Anon Key */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1">
                    Supabase Anon Key
                  </label>
                  <input
                    type="password"
                    value={sbKeyInput}
                    onChange={(e) => setSbKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                {/* Cloudflare Account ID */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1">
                    Cloudflare Account ID
                  </label>
                  <input
                    type="text"
                    value={cfAccountInput}
                    onChange={(e) => setCfAccountInput(e.target.value)}
                    placeholder="Salin dari dashboard Cloudflare..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                {/* Cloudflare API Token */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1">
                    Cloudflare API Token (Workers AI)
                  </label>
                  <input
                    type="password"
                    value={cfTokenInput}
                    onChange={(e) => setCfTokenInput(e.target.value)}
                    placeholder="Token dengan izin Workers AI Read/Run..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
              </div>

              {savedNotice && (
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  {savedNotice}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] transition-colors shadow-xs"
                >
                  Simpan Kredensial
                </button>
              </div>
            </form>
          )}

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-[#F5EFEB] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] border border-[#E8E2D8] dark:border-[#2F2B28]">
              vector(1024)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F5EFEB] dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] border border-[#E8E2D8] dark:border-[#2F2B28]">
              Supabase Realtime Pub/Sub
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F5EFEB] dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] border border-[#E8E2D8] dark:border-[#2F2B28]">
              Idempotent (Safe Re-run)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F5EFEB] dark:bg-[#272422] text-[#6B635B] dark:text-[#A8A196] border border-[#E8E2D8] dark:border-[#2F2B28]">
              HNSW Cosine Index
            </span>
          </div>

          <p className="text-xs text-[#6B635B] dark:text-[#A8A196] leading-relaxed">
            Salin skrip SQL ini lalu jalankan di <strong>Supabase SQL Editor</strong>. Skrip ini aman dijalankan berulang kali (tidak akan menghapus data yang ada) dan otomatis mengaktifkan ekstensi <code className="font-mono text-[#9A3412] dark:text-[#EA580C]">pgvector</code>, tabel <code className="font-mono">notes</code>, <code className="font-mono">fragments</code>, publikasi realtime, dan fungsi pencarian semantik <code className="font-mono">match_notes</code> & <code className="font-mono">match_fragments</code>.
          </p>

          {/* Monospace Code Preview Box */}
          <div className="relative rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] p-3.5 max-h-56 overflow-y-auto">
            <pre className="text-[11px] font-mono leading-relaxed text-[#6B635B] dark:text-[#A8A196] whitespace-pre select-all">
              {SUPABASE_SQL_SCRIPT}
            </pre>
          </div>
        </div>

        {/* Data Management & Preservation */}
        <div className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          <div>
            <h2 className="font-serif text-xl font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Data Management & Local Persistence
            </h2>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-1">
              Phase 1 runs strictly on local state and browser memory. Export your thoughts at any time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleExportJSON}
              className="px-4 py-2.5 rounded-xl bg-[#221F1D] dark:bg-[#EDE8E1] text-white dark:text-[#151413] text-xs font-medium hover:bg-[#383330] dark:hover:bg-white transition-colors flex items-center gap-2 shadow-xs"
            >
              <Download size={14} />
              <span>{copiedExport ? 'Archive Downloaded!' : 'Export Knowledge Archive (JSON)'}</span>
            </button>

            <button
              onClick={handleResetData}
              className="px-4 py-2.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={14} />
              <span>{resetNotice ? 'Resetting...' : 'Restore Sample Data'}</span>
            </button>
          </div>
        </div>

        {/* Phase 1 Architecture Notice */}
        <div className="p-5 rounded-2xl bg-[#F5EFEB] dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] flex items-start gap-3">
          <ShieldCheck size={18} className="text-[#9A3412] dark:text-[#EA580C] shrink-0 mt-0.5" />
          <div className="text-xs text-[#6B635B] dark:text-[#A8A196] space-y-1">
            <p className="font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Phase 1: UI/UX Foundation Active
            </p>
            <p>
              Strictly limited to frontend visual design, Tiptap rich text editing, responsive layout systems, and mock state demonstrations. No external databases, Supabase, or AI backend services are invoked in this phase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
