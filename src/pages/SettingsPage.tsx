import React, { useState } from 'react';
import { useNoesis } from '../context/NoesisContext';
import {
  Download,
  RotateCcw,
  Check,
  Type,
  Sliders,
  Database,
  Copy,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { INITIAL_NOTES, INITIAL_RELICS, INITIAL_PROJECTS } from '../data/mockData';
import { SUPABASE_SQL_SCRIPT } from '../data/supabaseSchema';
import { getSupabaseUrl, getSupabaseAnonKey } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const {
    notes,
    relics,
    isSupabaseConnected,
    syncAllToSupabase,
    isSemanticSearch,
    setIsSemanticSearch,
    semanticSensitivity,
    setSemanticSensitivity,
  } = useNoesis();
  const [copiedExport, setCopiedExport] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const [fontSize, setFontSize] = useState<'standard' | 'generous' | 'large'>('standard');
  const [showWordCount, setShowWordCount] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Supabase Credentials State
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [sbUrlInput, setSbUrlInput] = useState(getSupabaseUrl());
  const [sbKeyInput, setSbKeyInput] = useState(getSupabaseAnonKey());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (sbUrlInput.trim()) localStorage.setItem('noesis_supabase_url', sbUrlInput.trim());
    else localStorage.removeItem('noesis_supabase_url');

    if (sbKeyInput.trim()) localStorage.setItem('noesis_supabase_anon_key', sbKeyInput.trim());
    else localStorage.removeItem('noesis_supabase_anon_key');

    setSavedNotice('Kredensial Supabase tersimpan! Memuat ulang...');
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
      setSyncResult(`Tersinkron ${res.notesCount} catatan & ${res.fragmentsCount} fragments ke Supabase!`);
      setTimeout(() => setSyncResult(null), 4000);
    } else {
      setSyncResult('Supabase belum terhubung. Periksa kredensial URL & Key Anda.');
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  const handleExportJSON = () => {
    const data = {
      app: 'Noesis',
      exportDate: new Date().toISOString(),
      notes,
      fragments: relics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noesis-archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2500);
  };

  const handleResetData = () => {
    if (confirm('Reset semua catatan ke data kosong awal?')) {
      localStorage.setItem('noesis_notes', JSON.stringify(INITIAL_NOTES));
      localStorage.setItem('noesis_relics', JSON.stringify(INITIAL_RELICS));
      localStorage.setItem('noesis_projects', JSON.stringify(INITIAL_PROJECTS));
      setResetNotice(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF7F2] dark:bg-[#151413] px-3.5 sm:px-8 lg:px-14 py-5 sm:py-8">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        {/* Minimal Clean Header */}
        <div className="border-b border-[#E8E2D8] dark:border-[#2F2B28] pb-3 sm:pb-4">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#221F1D] dark:text-[#EDE8E1]">
            Settings
          </h1>
        </div>

        {/* Typography & Reading Rhythm */}
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center shrink-0">
              <Type size={16} />
            </div>
            <div>
              <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Typographic Scale
              </h2>
              <p className="text-xs text-[#6B635B] dark:text-[#A8A196]">
                Ukuran dan jarak baris saat membaca tulisan di editor.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { id: 'standard', label: 'Standard', sub: '16px / 1.75' },
              { id: 'generous', label: 'Generous', sub: '18px / 1.85' },
              { id: 'large', label: 'Large', sub: '20px / 1.9' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFontSize(opt.id as any)}
                className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
                  fontSize === opt.id
                    ? 'border-[#9A3412] bg-[#FAF7F2] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                    : 'border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#221F1E]'
                }`}
              >
                <div className="text-xs font-medium">{opt.label}</div>
                <div className="text-[10px] font-mono text-[#9C9388] mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60">
            <div>
              <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] block">
                Editor Telemetry Strip
              </span>
              <span className="text-[11px] text-[#6B635B] dark:text-[#A8A196]">
                Tampilkan statistik jumlah kata & karakter pada catatan.
              </span>
            </div>
            <button
              onClick={() => setShowWordCount((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                showWordCount ? 'bg-[#9A3412]' : 'bg-[#E8E2D8] dark:bg-[#3D3834]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showWordCount ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* AI Semantic Search Control */}
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              AI Semantic Search
            </h2>
          </div>

          {/* Default Mode Toggle */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60">
            <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Aktifkan AI Semantic Search Secara Default
            </span>
            <button
              type="button"
              onClick={() => setIsSemanticSearch(!isSemanticSearch)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                isSemanticSearch ? 'bg-[#9A3412] dark:bg-[#EA580C]' : 'bg-[#E8E2D8] dark:bg-[#3D3834]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSemanticSearch ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sensitivity Levels */}
          <div className="pt-3 border-t border-[#E8E2D8]/60 dark:border-[#2F2B28]/60 space-y-2.5">
            <span className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] block">
              Tingkat Sensitivitas Kemiripan
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-1">
              {[
                {
                  id: 'broad',
                  label: 'Santai (0.35)',
                  desc: 'Cakupan luas, ide & topik umum yang berkaitan.',
                },
                {
                  id: 'standard',
                  label: 'Standar (0.45)',
                  desc: 'Keseimbangan optimal konteks dan ketepatan.',
                },
                {
                  id: 'strict',
                  label: 'Ketat (0.60)',
                  desc: 'Hanya catatan dengan konsep yang sangat erat.',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSemanticSensitivity(opt.id as any)}
                  className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                    semanticSensitivity === opt.id
                      ? 'border-[#9A3412] bg-[#FAF7F2] dark:bg-[#272422] text-[#9A3412] dark:text-[#EA580C] shadow-2xs'
                      : 'border-[#E8E2D8] dark:border-[#2F2B28] text-[#6B635B] dark:text-[#A8A196] hover:bg-[#FAF7F2] dark:hover:bg-[#221F1E]'
                  }`}
                >
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[10px] text-[#9C9388] mt-0.5 leading-snug">
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Supabase & pgvector SQL Schema - Compact & Streamlined */}
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#9A3412]/10 dark:bg-[#EA580C]/20 text-[#9A3412] dark:text-[#EA580C] flex items-center justify-center shrink-0">
                <Database size={16} />
              </div>
              <div>
                <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                  Supabase & pgvector Schema
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSupabaseConnected ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-xs font-mono text-[#6B635B] dark:text-[#A8A196]">
                    {isSupabaseConnected ? 'Connected (Realtime Active)' : 'Offline Local Mode'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySQL}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-xs flex items-center gap-1.5 ${
                  copiedSql
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#9A3412] dark:bg-[#EA580C] text-white hover:bg-[#78280E] dark:hover:bg-[#C2410C]'
                }`}
              >
                {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedSql ? 'Tersalin!' : 'Copy SQL Script'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCredentialsForm((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#221F1E] text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1] hover:bg-[#ECE4DC] dark:hover:bg-[#272422] transition-colors flex items-center gap-1"
              >
                <Sliders size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                <span>{showCredentialsForm ? 'Tutup' : 'Kredensial'}</span>
              </button>
            </div>
          </div>

          {/* Sync status button when connected */}
          {isSupabaseConnected && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] dark:bg-[#221F1E] border border-[#E8E2D8] dark:border-[#2F2B28] text-xs">
              <span className="text-[#6B635B] dark:text-[#A8A196]">Sinkronisasi data lokal ke Supabase cloud:</span>
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={isSyncingAll}
                className="px-3 py-1 rounded-lg border border-[#9A3412] text-[#9A3412] dark:text-[#EA580C] hover:bg-[#9A3412]/10 text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Database size={12} />
                <span>{isSyncingAll ? 'Syncing...' : 'Sync All'}</span>
              </button>
            </div>
          )}

          {syncResult && (
            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
              {syncResult}
            </p>
          )}

          {/* Collapsible Supabase Credentials Form (Only URL & Key) */}
          {showCredentialsForm && (
            <form onSubmit={handleSaveCredentials} className="p-3.5 sm:p-4 rounded-xl bg-[#FAF7F2] dark:bg-[#151413] border border-[#E8E2D8] dark:border-[#2F2B28] space-y-3 animate-in fade-in duration-150">
              <div className="text-xs font-medium text-[#221F1D] dark:text-[#EDE8E1]">
                Kredensial Database Supabase
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Supabase URL */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1">
                    Project URL
                  </label>
                  <input
                    type="url"
                    value={sbUrlInput}
                    onChange={(e) => setSbUrlInput(e.target.value)}
                    placeholder="https://xyz.supabase.co"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                {/* Supabase Anon Key */}
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-[#9C9388] dark:text-[#736C62] mb-1">
                    Anon / Public Key
                  </label>
                  <input
                    type="password"
                    value={sbKeyInput}
                    onChange={(e) => setSbKeyInput(e.target.value)}
                    placeholder="eyJhbGciOi..."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-white dark:bg-[#1E1C1A] text-[#221F1D] dark:text-[#EDE8E1] focus:outline-none focus:border-[#9A3412]"
                  />
                </div>
              </div>

              {savedNotice && (
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  {savedNotice}
                </p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#9A3412] dark:bg-[#EA580C] text-white text-xs font-medium hover:bg-[#78280E] transition-colors shadow-xs"
                >
                  Simpan Kredensial
                </button>
              </div>
            </form>
          )}

          {/* Collapsible SQL Script Preview Box */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowSqlPreview((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs text-[#6B635B] dark:text-[#A8A196] hover:text-[#221F1D] dark:hover:text-[#EDE8E1] py-1 transition-colors"
            >
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <Code2 size={13} className="text-[#9A3412] dark:text-[#EA580C]" />
                <span>{showSqlPreview ? 'Sembunyikan Preview SQL' : 'Lihat Skrip SQL Supabase'}</span>
              </span>
              {showSqlPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showSqlPreview && (
              <div className="mt-2 relative rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] bg-[#FAF7F2] dark:bg-[#151413] p-3 max-h-48 overflow-y-auto animate-in fade-in duration-150">
                <pre className="text-[10px] font-mono leading-relaxed text-[#6B635B] dark:text-[#A8A196] whitespace-pre select-all">
                  {SUPABASE_SQL_SCRIPT}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Data Management & Preservation */}
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-[#E8E2D8] dark:border-[#2F2B28] shadow-xs space-y-4">
          <div>
            <h2 className="font-serif text-base sm:text-lg font-medium text-[#221F1D] dark:text-[#EDE8E1]">
              Data Archive & Backup
            </h2>
            <p className="text-xs text-[#6B635B] dark:text-[#A8A196] mt-0.5">
              Simpan cadangan data catatan atau kembalikan ke kondisi awal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={handleExportJSON}
              className="px-3.5 py-2 rounded-xl bg-[#221F1D] dark:bg-[#EDE8E1] text-white dark:text-[#151413] text-xs font-medium hover:bg-[#383330] dark:hover:bg-white transition-colors flex items-center gap-2 shadow-xs"
            >
              <Download size={13} />
              <span>{copiedExport ? 'Tersimpan!' : 'Export Backup (JSON)'}</span>
            </button>

            <button
              onClick={handleResetData}
              className="px-3.5 py-2 rounded-xl border border-[#E8E2D8] dark:border-[#2F2B28] text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={13} />
              <span>{resetNotice ? 'Resetting...' : 'Reset Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
