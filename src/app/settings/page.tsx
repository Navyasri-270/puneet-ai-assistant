'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { 
  Settings as SettingsIcon, 
  Brain, 
  Trash2, 
  Plus, 
  ShieldCheck, 
  Database, 
  Search, 
  Edit3, 
  Save, 
  X, 
  Check, 
  Cpu,
  Calendar as CalendarIcon,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export interface ExecutiveMemory {
  id: string;
  key: string;
  value: string;
  category: string;
  createdAt: string;
  updatedAt?: string;
}

export default function SettingsPage() {
  const [memories, setMemories] = useState<ExecutiveMemory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);

  // Add Memory Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('Preferences');

  // Edit Memory State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Notification state
  const [notification, setNotification] = useState<string | null>(null);

  // Google Status state
  const [googleStatus, setGoogleStatus] = useState<{ isConnected: boolean; email?: string; hasCredentials?: boolean }>({
    isConnected: false,
    hasCredentials: false
  });
  const [isConnecting, setIsConnecting] = useState(false);

  const categories = [
    'All',
    'Preferences',
    'People',
    'Clients',
    'Communication',
    'Business',
    'Instructions',
    'Other'
  ];

  useEffect(() => {
    fetchMemories();
    fetchGoogleStatus();
  }, [selectedCategory]);

  const fetchMemories = async () => {
    setIsLoadingMemories(true);
    try {
      const url = selectedCategory === 'All' 
        ? '/api/memories' 
        : `/api/memories?category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.memories) {
        setMemories(data.memories);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  const fetchGoogleStatus = async () => {
    try {
      const res = await fetch('/api/auth/google/status');
      const data = await res.json();
      setGoogleStatus(data);
    } catch (err) {
      console.warn("Failed to fetch Google status:", err);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Google Client ID is not configured. Please set GOOGLE_CLIENT_ID in environment variables.");
      }
    } catch (err) {
      console.error("Connect Google error:", err);
      alert("Unable to initiate Google OAuth login.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/status', { method: 'DELETE' });
      if (res.ok) {
        setGoogleStatus({ isConnected: false, email: undefined });
      }
    } catch (err) {
      console.error("Disconnect Google error:", err);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          value: newValue.trim(),
          category: newCategory
        })
      });
      const data = await res.json();
      if (data.success && data.memory) {
        setMemories(prev => [data.memory, ...prev.filter(m => m.key !== data.memory.key)]);
        setNewKey('');
        setNewValue('');
        setShowAddModal(false);
        setNotification(`Memory "${data.memory.key}" saved to SQLite.`);
      }
    } catch (err) {
      console.error("Failed to add memory:", err);
    }
  };

  const handleStartEdit = (mem: ExecutiveMemory) => {
    setEditingId(mem.id);
    setEditKey(mem.key);
    setEditValue(mem.value);
    setEditCategory(mem.category);
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: editKey.trim(),
          value: editValue.trim(),
          category: editCategory
        })
      });
      const data = await res.json();
      if (data.success && data.memory) {
        setMemories(prev => prev.map(m => m.id === id ? data.memory : m));
        setEditingId(null);
        setNotification("Memory updated.");
      }
    } catch (err) {
      console.error("Failed to edit memory:", err);
    }
  };

  const handleDeleteMemory = async (id: string, keyName: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMemories(prev => prev.filter(m => m.id !== id));
        setNotification(`Memory "${keyName}" deleted.`);
      }
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  const filteredMemories = memories.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.key.toLowerCase().includes(q) ||
      m.value.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
            Executive Settings & Assistant Memory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage long-term assistant context, system status, and Google Workspace connections
          </p>
        </div>

        {notification && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              {notification}
            </span>
            <button onClick={() => setNotification(null)} className="text-blue-600 hover:text-blue-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Column: Executive Memory */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-executive space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    Executive Memory ({filteredMemories.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saved context, preferences, and directives that guide AI Assistant logic.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add Memory
                </button>
              </div>

              {/* Memory Search & Category Filter Tabs */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search memories by keyword, key, or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`
                        px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all
                        ${selectedCategory === cat
                          ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                        }
                      `}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Memory Cards Grid */}
              {isLoadingMemories ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-400 text-xs">
                  Loading Executive Memories...
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-500 text-xs space-y-1">
                  <p className="font-semibold text-slate-700">No memories found matching your criteria.</p>
                  <p className="text-[11px] text-slate-400">Add a memory manually or ask the assistant "Remember that..."</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMemories.map((m) => {
                    const isEditingThis = editingId === m.id;
                    return (
                      <div 
                        key={m.id} 
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 transition-all"
                      >
                        {isEditingThis ? (
                          <div className="space-y-3 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input
                                type="text"
                                value={editKey}
                                onChange={(e) => setEditKey(e.target.value)}
                                className="bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-semibold"
                                placeholder="Key..."
                              />
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                              >
                                {categories.filter(c => c !== 'All').map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <textarea
                              rows={2}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-sans"
                              placeholder="Value..."
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-md"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(m.id)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4 text-xs">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{m.key}</span>
                                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                                  {m.category}
                                </span>
                              </div>
                              <p className="text-slate-700 leading-relaxed font-sans">{m.value}</p>
                              <p className="text-[10px] text-slate-400">
                                Saved on {new Date(m.createdAt).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartEdit(m)}
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded transition-colors"
                                title="Edit Memory"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMemory(m.id, m.key)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded transition-colors"
                                title="Delete Memory"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Google Workspace & System Architecture */}
          <div className="space-y-4">
            
            {/* Google Workspace Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-executive space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-2">
                <CalendarIcon className="w-4 h-4 text-blue-600" />
                Google Workspace Integration
              </h2>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">Google Calendar</p>
                    <p className="text-[11px] text-slate-500">Read-only Calendar OAuth Sync</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${googleStatus.isConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {googleStatus.isConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                {googleStatus.isConnected ? (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-700">
                      Connected Account: <span className="font-semibold text-slate-900">{googleStatus.email || 'puneet@workspace.com'}</span>
                    </p>
                    <button
                      onClick={handleDisconnectGoogle}
                      className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold py-2 rounded-lg transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-600">
                      Connect Puneet&apos;s Google Workspace Calendar to read live appointments alongside executive task deadlines.
                    </p>
                    <button
                      onClick={handleConnectGoogle}
                      disabled={isConnecting}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isConnecting ? 'Initiating OAuth...' : 'Connect Google Calendar'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* System Health */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-executive space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b border-slate-100 pb-2">
                <Cpu className="w-4 h-4 text-blue-600" />
                System Health & Architecture
              </h2>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-emerald-900">SQLite + Prisma Storage</p>
                      <p className="text-[10px] text-emerald-700">Zero-config Local Database Active</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-900">Server Action Validator</p>
                      <p className="text-[10px] text-blue-700">Natural Language Intent Verification</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Add Memory Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-xl overflow-hidden space-y-4">
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold tracking-tight">Add Executive Memory</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddMemory} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Key / Topic:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Email Style, Apex Holdings, Meeting Time"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Memory Detail / Value:</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Enter the explicit directive or preference detail..."
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    <Save className="w-4 h-4" /> Save Memory
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
