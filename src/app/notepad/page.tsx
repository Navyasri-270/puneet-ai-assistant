'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Pin, 
  PinOff, 
  Trash2, 
  Edit3, 
  Tag, 
  Clock, 
  Check, 
  X,
  Sparkles,
  Loader2
} from 'lucide-react';
import VoiceInput from '@/components/VoiceInput';
import { formatDate } from '@/lib/dateUtils';
import { useExecutiveTimezone } from '@/lib/useExecutiveTimezone';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  tags?: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = ['All', 'General', 'Work', 'Personal', 'Ideas', 'Meeting Notes'];

export default function NotepadPage() {
  const { timezone } = useExecutiveTimezone();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'General',
    pinned: false,
    tags: '',
  });
  
  // Voice note creation confirmation preview state
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{
    title: string;
    content: string;
    category: string;
  } | null>(null);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      let url = '/api/notes?';
      if (selectedCategory !== 'All') url += `category=${encodeURIComponent(selectedCategory)}&`;
      if (searchQuery.trim()) url += `search=${encodeURIComponent(searchQuery.trim())}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.notes) {
        setNotes(data.notes);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [selectedCategory, searchQuery]);

  const handleOpenModal = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        title: note.title,
        content: note.content,
        category: note.category,
        pinned: note.pinned,
        tags: note.tags || '',
      });
    } else {
      setEditingNote(null);
      setFormData({
        title: '',
        content: '',
        category: 'General',
        pinned: false,
        tags: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      if (editingNote) {
        // PUT update
        const res = await fetch('/api/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingNote.id,
            ...formData,
          }),
        });
        if (res.ok) {
          setIsModalOpen(false);
          fetchNotes();
        }
      } else {
        // POST create
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          setIsModalOpen(false);
          fetchNotes();
        }
      }
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const res = await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: note.id,
          pinned: !note.pinned,
        }),
      });
      if (res.ok) fetchNotes();
    } catch (err) {
      console.error('Failed to pin/unpin note:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Voice Input handlers for Voice-to-Note
  const handleVoiceTranscript = (transcript: string) => {
    // Stage in confirmation preview before saving
    setPendingVoiceNote({
      title: transcript.length > 40 ? transcript.slice(0, 40) + '...' : transcript,
      content: transcript,
      category: 'General',
    });
  };

  const handleConfirmVoiceNote = async () => {
    if (!pendingVoiceNote) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingVoiceNote.title,
          content: pendingVoiceNote.content,
          category: pendingVoiceNote.category,
          pinned: false,
        }),
      });
      if (res.ok) {
        setPendingVoiceNote(null);
        fetchNotes();
      }
    } catch (err) {
      console.error('Failed to save voice note:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Executive Workspace</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span className="text-xs text-slate-400">Notes & Briefings</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" /> Executive Notepad
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Store quick notes, meeting minutes, thoughts, and voice dictations. Synchronized across devices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Voice-to-Note Microphone Button */}
          <VoiceInput
            onTranscript={handleVoiceTranscript}
            buttonText="Voice Note"
            size="md"
          />

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Confirmation Preview Modal for Voice-to-Note */}
      {pendingVoiceNote && (
        <div className="bg-gradient-to-r from-indigo-900/90 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Voice Note Detected</span>
                <span className="text-xs text-slate-400">Requires Confirmation</span>
              </div>
              <h4 className="font-semibold text-white mt-1 text-sm">{pendingVoiceNote.title}</h4>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl bg-slate-800/60 p-2 rounded-lg border border-slate-700">
                "{pendingVoiceNote.content}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleConfirmVoiceNote}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all shadow"
            >
              <Check className="w-4 h-4" /> Create Note
            </button>
            <button
              onClick={() => setPendingVoiceNote(null)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Controls Bar: Search & Category Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
          />
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-xs font-medium">Loading executive notes...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <FileText className="w-10 h-10 text-slate-300" />
          <h3 className="font-semibold text-slate-700 text-sm">No notes found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchQuery || selectedCategory !== 'All'
              ? 'No notes matched your active search filters.'
              : 'You haven\'t created any notes yet. Dictate one with voice or click "New Note".'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`
                bg-white rounded-xl border p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between relative group
                ${note.pinned ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'}
              `}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    {note.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePin(note)}
                      className={`p-1.5 rounded-md transition-colors ${
                        note.pinned
                          ? 'text-amber-600 bg-amber-100 hover:bg-amber-200'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title={note.pinned ? 'Unpin note' : 'Pin note to top'}
                    >
                      {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleOpenModal(note)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                      title="Edit note"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-base mt-3 group-hover:text-blue-600 transition-colors">
                  {note.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap line-clamp-4">
                  {note.content || '(No content)'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {formatDate(note.updatedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }, timezone)}
                </span>
                {note.pinned && (
                  <span className="text-amber-600 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Pin className="w-3 h-3 fill-amber-500 text-amber-600" /> Pinned
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Note Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {editingNote ? 'Edit Executive Note' : 'New Executive Note'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Enter note title..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <VoiceInput
                    onTranscript={(t) => setFormData((prev) => ({ ...prev, title: t }))}
                    size="sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Content
                  </label>
                  <VoiceInput
                    onTranscript={(t) =>
                      setFormData((prev) => ({
                        ...prev,
                        content: prev.content ? prev.content + ' ' + t : t,
                      }))
                    }
                    buttonText="Dictate Content"
                    size="sm"
                  />
                </div>
                <textarea
                  rows={6}
                  placeholder="Write your note content here..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinnedCheckbox"
                  checked={formData.pinned}
                  onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="pinnedCheckbox" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Pin to top of Notepad
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all"
                >
                  {editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
