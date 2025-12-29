
import React, { useState } from 'react';
import { Save, Server, ShieldOff, EyeOff, ShieldCheck, Database, RefreshCw, Layers, Wind, ShieldAlert, Download, Upload, Trash2, Key } from 'lucide-react';
import { LLMSettings } from '../types';
import { getSettings, saveSettings, getStorageUsage, triggerSync, runColdStorageMaintenance, exportData, importData, factoryReset } from '../services/storage';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<LLMSettings>(getSettings());
  const [isSaved, setIsSaved] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSave = () => {
    saveSettings(settings);
    setIsSaved(true);
    window.dispatchEvent(new Event('settings-changed'));
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSyncManual = async () => {
      setIsSyncing(true);
      await triggerSync();
      setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleColdMaintenance = () => {
      runColdStorageMaintenance();
      alert("Maintenance complete. Inactive synpases migrated to Cold Storage.");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const success = await importData(e.target.files[0]);
          if (success) alert("Neural state restored successfully.");
          else alert("Restoration failed: Invalid archive format.");
      }
  };

  const handleReset = () => {
      if (confirm("SYSTEM CRITICAL: This will erase ALL memories, people, and settings. This cannot be undone. Proceed?")) {
          factoryReset();
      }
  };

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full overflow-y-auto max-w-4xl mx-auto space-y-8 scrollbar-thin scrollbar-thumb-slate-700 pb-32">
      <header>
        <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Server className="text-indigo-400" /> Infrastructure
        </h2>
        <p className="text-slate-400 mt-1">Advanced cognitive tiers and synchronization parameters.</p>
      </header>

      {/* ORIN / LOCAL RUNTIME */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
              <div>
                  <h3 className="font-bold text-slate-100">NVIDIA Orin / Local Models</h3>
                  <p className="text-[11px] text-slate-500">Prefer the Orin 8GB board for inference and keep Gemini as optional fallback.</p>
              </div>
              <div className="flex gap-2">
                  <button
                    onClick={() => setSettings({ ...settings, provider: 'local', orinMode: true, cloud_disabled: true })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${settings.provider === 'local' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                  >
                      Local Only
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, provider: 'gemini', orinMode: false, cloud_disabled: false })}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border ${settings.provider === 'gemini' ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                  >
                      Gemini Cloud
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Local LLM Endpoint (Mistral/Triton)</label>
                  <input
                    type="text"
                    value={settings.local_llm_endpoint || ''}
                    onChange={e => setSettings({ ...settings, local_llm_endpoint: e.target.value })}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs outline-none text-slate-300"
                    placeholder="http://orin:8000/generate"
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Local Model Name</label>
                  <input
                    type="text"
                    value={settings.local_llm_model || ''}
                    onChange={e => setSettings({ ...settings, local_llm_model: e.target.value })}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs outline-none text-slate-300"
                    placeholder="mistral-3b-instruct"
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Local Whisper/Transcription Endpoint</label>
                  <input
                    type="text"
                    value={settings.local_transcription_endpoint || ''}
                    onChange={e => setSettings({ ...settings, local_transcription_endpoint: e.target.value })}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs outline-none text-slate-300"
                    placeholder="http://orin:8000/transcribe"
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Local API Key (optional)</label>
                  <input
                    type="password"
                    value={settings.local_api_key || ''}
                    onChange={e => setSettings({ ...settings, local_api_key: e.target.value })}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs outline-none text-slate-300"
                    placeholder="Bearer secret for local gateway"
                  />
              </div>
          </div>
      </div>

      {/* CLUSTER SELECTION */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-6">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" /> Neural Isolation Cluster
          </h3>
          <div className="flex gap-4">
              <button 
                onClick={() => setSettings({...settings, active_cluster: 'main'})}
                className={`flex-1 p-6 rounded-2xl border transition-all text-left ${settings.active_cluster === 'main' ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800/50 border-slate-700 opacity-50'}`}
              >
                  <div className="font-bold mb-1">Mainline</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest">Primary Identity State</div>
              </button>
              <button 
                onClick={() => setSettings({...settings, active_cluster: 'experimental'})}
                className={`flex-1 p-6 rounded-2xl border transition-all text-left ${settings.active_cluster === 'experimental' ? 'bg-amber-600/20 border-amber-500' : 'bg-slate-800/50 border-slate-700 opacity-50'}`}
              >
                  <div className="font-bold mb-1 text-amber-400">Experimental</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest">Sandbox A/B Isolation</div>
              </button>
          </div>
      </div>

      {/* PRIVACY & SECURITY (Section 9.3 & 15.2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-emerald-400"/> PII Filter</h3>
                  <button onClick={() => setSettings({...settings, pii_filter_enabled: !settings.pii_filter_enabled})} className={`w-10 h-5 rounded-full transition-colors relative ${settings.pii_filter_enabled ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.pii_filter_enabled ? 'left-6' : 'left-1'}`}></div>
                  </button>
              </div>
              <p className="text-[10px] text-slate-500">Automatically block passwords, API keys, and credit cards from memory ingestion.</p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2"><Key className="w-4 h-4 text-cyan-400"/> Local Encryption</h3>
                  <button onClick={() => setSettings({...settings, encryption_at_rest: !settings.encryption_at_rest})} className={`w-10 h-5 rounded-full transition-colors relative ${settings.encryption_at_rest ? 'bg-cyan-500' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.encryption_at_rest ? 'left-6' : 'left-1'}`}></div>
                  </button>
              </div>
              <p className="text-[10px] text-slate-500">Encrypt memory bank at-rest using AES-GCM (obfuscation only without master key).</p>
          </div>
      </div>

      {/* SYNC & MAINTENANCE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-indigo-400"/> Remote Sync</h3>
                  <button onClick={() => setSettings({...settings, sync_enabled: !settings.sync_enabled})} className={`w-10 h-5 rounded-full transition-colors relative ${settings.sync_enabled ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.sync_enabled ? 'left-6' : 'left-1'}`}></div>
                  </button>
              </div>
              <input 
                type="text" 
                placeholder="https://brain-sync.remote/v1"
                value={settings.sync_endpoint || ''}
                onChange={e => setSettings({...settings, sync_endpoint: e.target.value})}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs outline-none text-slate-300"
              />
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-500 uppercase">App-Level Sync Key</label>
                <input 
                    type="password" 
                    placeholder="Sync Encryption Secret"
                    value={settings.sync_encryption_key || ''}
                    onChange={e => setSettings({...settings, sync_encryption_key: e.target.value})}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs outline-none text-slate-300"
                />
              </div>
              <button 
                onClick={handleSyncManual}
                disabled={!settings.sync_enabled || isSyncing}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-20"
              >
                  {isSyncing ? "Connecting..." : "Bidirectional Sync"}
              </button>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2"><Wind className="w-4 h-4 text-indigo-400"/> Cold Storage</h3>
                  <button onClick={() => setSettings({...settings, deep_recall_enabled: !settings.deep_recall_enabled})} className={`w-10 h-5 rounded-full transition-colors relative ${settings.deep_recall_enabled ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${settings.deep_recall_enabled ? 'left-6' : 'left-1'}`}></div>
                  </button>
              </div>
              <p className="text-[10px] text-slate-500">Enable "Deep Recall" to allow Jarvis to access Tier-2 memories. Warning: This increases latency.</p>
              <button 
                onClick={handleColdMaintenance}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                  Purge Inactive Synapses
              </button>
          </div>
      </div>

      {/* RECOVERY & DISASTER MGMT (Section 16.1 & 16.2) */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 space-y-6">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" /> Data Portability
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button onClick={exportData} className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col items-center gap-3 hover:border-indigo-500 transition-all group">
                  <Download className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest">Export Neural State</span>
              </button>
              
              <label className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col items-center gap-3 hover:border-emerald-500 transition-all group cursor-pointer">
                  <Upload className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest">Import Neural State</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>

              <button onClick={handleReset} className="p-6 bg-slate-800/50 border border-slate-700 rounded-2xl flex flex-col items-center gap-3 hover:border-red-500 transition-all group">
                  <Trash2 className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest">Factory Reset</span>
              </button>
          </div>
      </div>

      <div className="flex justify-end pt-4">
          <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-xl">
              {isSaved ? 'Synchronized' : 'Commit Changes'}
          </button>
      </div>
    </div>
  );
};

export default Settings;
