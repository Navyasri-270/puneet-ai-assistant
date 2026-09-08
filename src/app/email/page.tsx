'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { 
  Mail, 
  Plus, 
  Search, 
  Edit3, 
  Save, 
  Trash2, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Clock, 
  Check, 
  Ban,
  FileText
} from 'lucide-react';

export interface EmailDraft {
  id: string;
  recipient: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  status: string; // "Draft", "Approved", "Cancelled"
  createdAt: string;
  updatedAt: string;
}

export default function EmailPage() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<EmailDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // New / AI Draft Modal State
  const [showModal, setShowModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [newDraftForm, setNewDraftForm] = useState({
    recipient: '',
    cc: '',
    bcc: '',
    subject: '',
    body: ''
  });

  // Edit draft form state
  const [editForm, setEditForm] = useState<Partial<EmailDraft>>({});

  useEffect(() => {
    fetchDrafts();
  }, [statusFilter]);

  const fetchDrafts = async () => {
    setIsLoading(true);
    try {
      const url = statusFilter === 'All' 
        ? '/api/emails' 
        : `/api/emails?status=${encodeURIComponent(statusFilter)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.drafts) {
        setDrafts(data.drafts);
        if (data.drafts.length > 0 && !activeDraft) {
          setActiveDraft(data.drafts[0]);
          setEditForm(data.drafts[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch drafts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDraft = (draft: EmailDraft) => {
    setActiveDraft(draft);
    setEditForm(draft);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!activeDraft) return;
    try {
      const res = await fetch(`/api/emails/${activeDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: editForm.recipient,
          cc: editForm.cc,
          bcc: editForm.bcc,
          subject: editForm.subject,
          body: editForm.body,
          status: editForm.status || activeDraft.status
        })
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setDrafts(prev => prev.map(d => d.id === data.draft.id ? data.draft : d));
        setActiveDraft(data.draft);
        setEditForm(data.draft);
        setIsEditing(false);
        setNotification("Draft updated and saved to SQLite.");
      }
    } catch (err) {
      console.error("Failed to save draft edit:", err);
    }
  };

  const handleUpdateStatus = async (draftId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/emails/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setDrafts(prev => prev.map(d => d.id === draftId ? data.draft : d));
        if (activeDraft?.id === draftId) {
          setActiveDraft(data.draft);
          setEditForm(data.draft);
        }
        setNotification(`Draft status updated to "${newStatus}".`);
      }
    } catch (err) {
      console.error("Failed to update draft status:", err);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const res = await fetch(`/api/emails/${draftId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const remaining = drafts.filter(d => d.id !== draftId);
        setDrafts(remaining);
        if (activeDraft?.id === draftId) {
          const next = remaining[0] || null;
          setActiveDraft(next);
          setEditForm(next || {});
        }
        setNotification("Draft deleted.");
      }
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  };

  const handleCreateManualDraft = async () => {
    if (!newDraftForm.subject.trim() && !newDraftForm.body.trim()) return;
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDraftForm)
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setDrafts(prev => [data.draft, ...prev]);
        setActiveDraft(data.draft);
        setEditForm(data.draft);
        setShowModal(false);
        setNewDraftForm({ recipient: '', cc: '', bcc: '', subject: '', body: '' });
        setNotification("New draft saved.");
      }
    } catch (err) {
      console.error("Failed to create draft:", err);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.startsWith('Draft') ? aiPrompt : `Draft an email ${aiPrompt}` })
      });
      const data = await res.json();
      if (data.data && (data.data.draft || data.data.body)) {
        const draftObj = data.data.draft || {
          recipient: data.data.recipient || '',
          subject: data.data.subject || 'Executive Update',
          body: data.data.body || ''
        };
        
        // Refresh drafts list from server
        const refreshRes = await fetch('/api/emails');
        const refreshData = await refreshRes.json();
        if (refreshData.success && refreshData.drafts) {
          setDrafts(refreshData.drafts);
          const found = refreshData.drafts.find((d: EmailDraft) => d.id === draftObj.id) || refreshData.drafts[0];
          setActiveDraft(found);
          setEditForm(found);
        }

        setAiPrompt('');
        setShowModal(false);
        setNotification("AI draft created and saved to SQLite.");
      }
    } catch (err) {
      console.error("AI draft generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredDrafts = drafts.filter(d => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.recipient.toLowerCase().includes(q) ||
      d.subject.toLowerCase().includes(q) ||
      d.body.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Mail className="w-6 h-6 text-blue-600" />
              Email Assistant
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft, review, and prepare executive communications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              Gmail OAuth Integration Pending (Draft Mode Only)
            </span>

            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Draft
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              {notification}
            </span>
            <button onClick={() => setNotification(null)} className="text-blue-600 hover:text-blue-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {['All', 'Draft', 'Approved', 'Cancelled'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                  ${statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                  }
                `}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recipient, subject, or body..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Main Content: Split Queue & Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Draft Queue List */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Draft Queue ({filteredDrafts.length})
              </h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                Loading drafts...
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                No email drafts found. Click "New Draft" to create one.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[650px] overflow-y-auto pr-1">
                {filteredDrafts.map((d) => {
                  const isSelected = activeDraft?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDraft(d)}
                      className={`
                        p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 relative
                        ${isSelected 
                          ? 'bg-white border-blue-600 shadow-md ring-1 ring-blue-600' 
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {d.recipient || '(No Recipient Specified)'}
                        </span>
                        <span className={`
                          text-[10px] font-bold px-2 py-0.5 rounded shrink-0
                          ${d.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : ''}
                          ${d.status === 'Draft' ? 'bg-amber-100 text-amber-800' : ''}
                          ${d.status === 'Cancelled' ? 'bg-slate-100 text-slate-600' : ''}
                        `}>
                          {d.status}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {d.subject || '(No Subject)'}
                      </p>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-sans">
                        {d.body || 'Empty message body...'}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(d.updatedAt || d.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDraft(d.id); }}
                          className="hover:text-red-600 p-0.5 rounded transition-colors"
                          title="Delete Draft"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Draft Preview & Editor */}
          <div className="lg:col-span-8 space-y-4">
            {activeDraft ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                
                {/* Editor Top Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
                    <span className={`
                      text-xs font-bold px-2.5 py-0.5 rounded
                      ${activeDraft.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : ''}
                      ${activeDraft.status === 'Draft' ? 'bg-amber-100 text-amber-800' : ''}
                      ${activeDraft.status === 'Cancelled' ? 'bg-slate-100 text-slate-600' : ''}
                    `}>
                      {activeDraft.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <button
                        onClick={handleSaveEdit}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Draft
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Draft
                      </button>
                    )}
                  </div>
                </div>

                {/* Draft Fields */}
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">To (Recipient):</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      placeholder="e.g. John Miller <john@example.com>"
                      value={isEditing ? editForm.recipient || '' : activeDraft.recipient}
                      onChange={(e) => setEditForm({ ...editForm, recipient: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium disabled:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-500 block mb-1">CC (Optional):</label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        placeholder="Optional CC recipients..."
                        value={isEditing ? editForm.cc || '' : activeDraft.cc || ''}
                        onChange={(e) => setEditForm({ ...editForm, cc: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 disabled:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-500 block mb-1">BCC (Optional):</label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        placeholder="Optional BCC recipients..."
                        value={isEditing ? editForm.bcc || '' : activeDraft.bcc || ''}
                        onChange={(e) => setEditForm({ ...editForm, bcc: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 disabled:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Subject:</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      placeholder="Email Subject..."
                      value={isEditing ? editForm.subject || '' : activeDraft.subject}
                      onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold text-sm disabled:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Message Body:</label>
                    <textarea
                      rows={10}
                      disabled={!isEditing}
                      placeholder="Write your email body here..."
                      value={isEditing ? editForm.body || '' : activeDraft.body}
                      onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 font-sans leading-relaxed disabled:bg-slate-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Safety Control Banner & Actions */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium">
                      <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
                      Sending emails will be enabled after Gmail integration is configured.
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Safety Locked
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleDeleteDraft(activeDraft.id)}
                      className="text-red-600 hover:text-red-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Draft
                    </button>

                    <div className="flex items-center gap-2">
                      {activeDraft.status !== 'Cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(activeDraft.id, 'Cancelled')}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Cancel Draft
                        </button>
                      )}

                      {activeDraft.status !== 'Approved' && (
                        <button
                          onClick={() => handleUpdateStatus(activeDraft.id, 'Approved')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Mark Approved
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-16 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-600">No Draft Selected</p>
                <p>Select a draft from the queue or click "New Draft" to create one.</p>
              </div>
            )}
          </div>

        </div>

        {/* New / AI Draft Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-xl border border-slate-200 shadow-xl overflow-hidden space-y-4">
              
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold tracking-tight">Create Email Draft</h3>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5 text-xs">
                
                {/* AI Draft Generator Box */}
                <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl space-y-2.5">
                  <label className="font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    AI Natural Language Drafter
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder='e.g. "Draft an email to John asking for a proposal update."'
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAiGenerate}
                      disabled={isGenerating || !aiPrompt.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 transition-colors shrink-0"
                    >
                      {isGenerating ? "Drafting..." : "Generate AI Draft"}
                    </button>
                  </div>
                </div>

                <div className="relative text-center">
                  <hr className="border-slate-200" />
                  <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    Or Manual Draft
                  </span>
                </div>

                {/* Manual Draft Form */}
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">To (Recipient):</label>
                    <input
                      type="text"
                      placeholder="e.g. John Miller <john@example.com>"
                      value={newDraftForm.recipient}
                      onChange={(e) => setNewDraftForm({ ...newDraftForm, recipient: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">CC (Optional):</label>
                      <input
                        type="text"
                        placeholder="CC emails..."
                        value={newDraftForm.cc}
                        onChange={(e) => setNewDraftForm({ ...newDraftForm, cc: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">BCC (Optional):</label>
                      <input
                        type="text"
                        placeholder="BCC emails..."
                        value={newDraftForm.bcc}
                        onChange={(e) => setNewDraftForm({ ...newDraftForm, bcc: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Subject:</label>
                    <input
                      type="text"
                      placeholder="Email subject..."
                      value={newDraftForm.subject}
                      onChange={(e) => setNewDraftForm({ ...newDraftForm, subject: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Message Body:</label>
                    <textarea
                      rows={5}
                      placeholder="Write message..."
                      value={newDraftForm.body}
                      onChange={(e) => setNewDraftForm({ ...newDraftForm, body: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 font-sans focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateManualDraft}
                  disabled={!newDraftForm.subject.trim() && !newDraftForm.body.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Draft
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
