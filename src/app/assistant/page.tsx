'use client';

import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Mail, 
  Calendar, 
  Clock, 
  ArrowRight, 
  Bot, 
  User, 
  FileText, 
  Check, 
  X,
  RefreshCw,
  Info
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  actionSummary?: string;
  intent?: string;
  clarificationQuestion?: string;
  options?: { id: string; title: string }[];
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  emailDraft?: { recipient: string; subject: string; body: string; draftId?: string };
  isFallbackEngine?: boolean;
  timestamp: string;
}

export default function AssistantPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: "Good morning, Puneet. I am your executive assistant. Tell me what you need to get done, and I will organize, update, or summarize your priorities.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [activePendingTask, setActivePendingTask] = useState<any | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (customPrompt?: string, selectedOptionId?: string, taskContextOverride?: any) => {
    const promptToSubmit = customPrompt || input;
    if (!promptToSubmit.trim()) return;

    const userMsgId = `user-${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: promptToSubmit,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setMessages(newMessages);
    if (!customPrompt) setInput("");
    setLoading(true);

    const taskCtx = taskContextOverride || activePendingTask;
    const isPriorityWord = ['urgent', 'high', 'medium', 'low'].includes(promptToSubmit.trim().toLowerCase());

    const reqPayload: any = { 
      prompt: promptToSubmit, 
      selectedOptionId 
    };

    if (taskCtx) {
      reqPayload.pendingTask = taskCtx;
      reqPayload.selectedPriority = selectedOptionId || (isPriorityWord ? promptToSubmit.trim() : 'Medium');
    }

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqPayload)
      });
      const data = await res.json();

      if (data.intent === 'clarify_priority' && data.data?.pendingTask) {
        setActivePendingTask(data.data.pendingTask);
      } else {
        setActivePendingTask(null);
      }

      const assistantMsg: ChatMessage & { pendingTaskData?: any } = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.message || data.actionSummary || "Request processed.",
        actionSummary: data.actionSummary,
        intent: data.intent,
        clarificationQuestion: data.clarificationQuestion,
        options: data.options,
        requiresConfirmation: data.requiresConfirmation,
        confirmationMessage: data.confirmationMessage,
        emailDraft: data.intent === 'draft_email' ? data.data : undefined,
        pendingTaskData: data.data?.pendingTask,
        isFallbackEngine: data.isFallbackEngine,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: "I encountered a communication issue. Please check your network and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };


  const handleConfirmAction = (msgId: string, approved: boolean) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        return {
          ...m,
          requiresConfirmation: false,
          text: approved ? `${m.text} ✓ Approved & Confirmed.` : `${m.text} (Cancelled by user)`
        };
      }
      return m;
    }));
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Executive AI Assistant
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Natural language task command center with server-validated execution
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Server Validation Active
          </span>
        </div>

        {/* Suggested Actions Prompt Chips */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-executive space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suggested Executive Prompts</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Remind me tomorrow at 10 AM to follow up with the Dubai leads.",
              "Move the client proposal to Friday.",
              "Mark the Dubai follow-up as completed.",
              "What do I need to do today?",
              "Show me my overdue tasks.",
              "Draft an email to John asking for an update on the proposal."
            ].map((promptText, i) => (
              <button
                key={i}
                onClick={() => handleSend(promptText)}
                className="text-xs bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 px-3 py-1.5 rounded-lg transition-colors text-left"
              >
                &ldquo;{promptText}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Chat Feed */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-executive min-h-[420px] flex flex-col justify-between overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto max-h-[500px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-2xl space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  
                  {/* Message Bubble */}
                  <div className={`
                    p-4 rounded-2xl text-sm leading-relaxed
                    ${msg.sender === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-slate-50 text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                    }
                  `}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    
                    {/* Timestamp */}
                    <div className={`text-[10px] mt-2 font-medium ${msg.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* Clarification Chips if AI needs explicit decision or priority */}
                  {msg.clarificationQuestion && msg.options && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                      <p className="text-xs font-semibold text-amber-950 flex items-center gap-1.5 whitespace-pre-wrap">
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        {msg.clarificationQuestion}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => handleSend(opt.title, opt.id, (msg as any).pendingTaskData)}
                            className="text-xs bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-3.5 py-1.5 rounded-md transition-colors shadow-sm"
                          >
                            {opt.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* Confirmation Workflow for Draft Email or High Risk Actions */}
                  {msg.requiresConfirmation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-blue-600" />
                        Confirmation Required Before Action Execution
                      </p>
                      {msg.emailDraft && (
                        <div className="bg-white p-3 rounded-lg border border-blue-100 text-xs text-slate-800 space-y-1 font-mono">
                          <p><span className="font-bold font-sans text-slate-500">To:</span> {msg.emailDraft.recipient}</p>
                          <p><span className="font-bold font-sans text-slate-500">Subject:</span> {msg.emailDraft.subject}</p>
                          <p className="pt-1 text-slate-700 font-sans whitespace-pre-wrap">{msg.emailDraft.body}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConfirmAction(msg.id, true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve & Confirm
                        </button>
                        <button
                          onClick={() => handleConfirmAction(msg.id, false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    P
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3.5 items-center text-slate-400 text-xs">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-blue-400 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <p>AI is parsing request & validating task action...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Interactive Assistant Input Area */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell Puneet AI what to schedule, complete, update, or summarize..."
                className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
