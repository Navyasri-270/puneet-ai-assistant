'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  BellOff, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  Moon, 
  Calendar, 
  CheckSquare,
  Shield,
  Smartphone,
  Info
} from 'lucide-react';
import { useMounted } from '@/lib/useExecutiveTimezone';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushRegister() {
  const mounted = useMounted();

  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Settings state
  const [enabled, setEnabled] = useState(true);
  const [taskNotificationsEnabled, setTaskNotificationsEnabled] = useState(true);
  const [reminderNotificationsEnabled, setReminderNotificationsEnabled] = useState(true);
  const [frequencyHours, setFrequencyHours] = useState(3);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');

  const [fetchedVapidKey, setFetchedVapidKey] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Status Panel States
  const [permissionStatus, setPermissionStatus] = useState<string>('Checking...');
  const [swStatus, setSwStatus] = useState<string>('Checking...');
  const [subStatus, setSubStatus] = useState<string>('Checking...');
  const [testStatus, setTestStatus] = useState<string>('Not tested');
  const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/push/settings');
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled ?? true);
        setTaskNotificationsEnabled(data.taskNotificationsEnabled ?? true);
        setReminderNotificationsEnabled(data.reminderNotificationsEnabled ?? true);
        setFrequencyHours(data.frequencyHours ?? 3);
        setQuietHoursEnabled(data.quietHoursEnabled ?? false);
        setQuietHoursStart(data.quietHoursStart ?? '22:00');
        setQuietHoursEnd(data.quietHoursEnd ?? '07:00');
        if (data.vapidPublicKey) {
          setFetchedVapidKey(data.vapidPublicKey);
        }
      }
    } catch (e: any) {
      console.error('Error fetching push settings:', e);
    }
  }, []);

  const checkExistingStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // 1. Permission Status
    if ('Notification' in window) {
      const perm = Notification.permission;
      if (perm === 'granted') setPermissionStatus('Granted');
      else if (perm === 'denied') setPermissionStatus('Denied');
      else setPermissionStatus('Not requested');
    } else {
      setPermissionStatus('Unsupported');
    }

    // 2. Service Worker Status
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          setSwStatus('Registered');
        } else {
          setSwStatus('Not registered');
        }
      } catch (err) {
        setSwStatus('Failed');
      }
    } else {
      setSwStatus('Unsupported');
    }

    // 3. Push Subscription Status
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setSubscribed(true);
          setSubStatus('Active');
        } else {
          setSubscribed(false);
          setSubStatus('Missing');
        }
      } catch (err) {
        setSubscribed(false);
        setSubStatus('Missing');
      }
    } else {
      setSubStatus('Unsupported');
    }
  }, []);

  const ensureServiceWorkerRegistered = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          await navigator.serviceWorker.register('/sw.js');
        }
        setSwStatus('Registered');
      }
    } catch (e: any) {
      setSwStatus('Failed');
      setLastErrorMsg(`Service Worker registration failed: ${e.message || 'sw.js could not be loaded'}`);
      throw new Error(`Service Worker registration failed: ${e.message || 'sw.js could not be loaded'}`);
    }
  };

  useEffect(() => {
    if (!mounted) return;

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true);
      ensureServiceWorkerRegistered().then(() => {
        checkExistingStatus();
        fetchSettings();
      });
    } else {
      setSupported(false);
      setPermissionStatus('Unsupported');
      setSwStatus('Unsupported');
      setSubStatus('Unsupported');
    }
  }, [mounted, checkExistingStatus, fetchSettings]);

  const saveSettings = async (updates: Record<string, any>) => {
    try {
      const payload = {
        enabled,
        taskNotificationsEnabled,
        reminderNotificationsEnabled,
        frequencyHours,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        ...updates,
      };

      const res = await fetch('/api/push/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage({ text: 'Notification preferences updated successfully.', type: 'success' });
      }
    } catch (e: any) {
      console.error('Error updating settings:', e);
      setLastErrorMsg(e.message || 'Failed to save settings');
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    setMessage(null);
    setLastErrorMsg(null);

    try {
      // Stage 1: Browser Support Check
      if (typeof window === 'undefined' || !('Notification' in window)) {
        throw new Error('Web Push Notifications are not supported on this browser.');
      }

      // Stage 2: Notification Permission Request
      if (Notification.permission === 'denied') {
        setPermissionStatus('Denied');
        throw new Error('Notification permission was blocked in your browser settings. Please click the lock icon in your browser address bar and set Notifications to "Allow".');
      }

      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission === 'granted' ? 'Granted' : permission === 'denied' ? 'Denied' : 'Not requested');
        if (permission !== 'granted') {
          throw new Error('Notification permission was denied by user.');
        }
      } else {
        setPermissionStatus('Granted');
      }

      // Stage 3: VAPID Public Key Verification
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || fetchedVapidKey;
      if (!vapidPublicKey) {
        throw new Error('VAPID Public Key is not configured in production environment variables (NEXT_PUBLIC_VAPID_PUBLIC_KEY missing).');
      }

      // Stage 4: Service Worker Registration
      await ensureServiceWorkerRegistered();
      const reg = await navigator.serviceWorker.ready;

      // Stage 5: PushManager Subscription
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subObj = sub.toJSON();

      // Stage 6: Database Persistence
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subObj.endpoint,
          keys: subObj.keys,
          frequencyHours,
          taskNotificationsEnabled,
          reminderNotificationsEnabled,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to persist push subscription to database.');
      }

      setSubscribed(true);
      setSubStatus('Active');
      setMessage({ text: '✓ Mobile Push Notifications registered successfully! Device saved to database.', type: 'success' });
    } catch (err: any) {
      console.error('Push registration error:', err);
      const errText = err.message || 'Failed to subscribe to push notifications.';
      setLastErrorMsg(errText);
      setMessage({ text: `❌ Enable Notifications Error: ${errText}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setLoading(true);
    setMessage(null);
    setTestStatus('Sending...');
    setLastErrorMsg(null);

    try {
      // Direct call to POST /api/push/test
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setTestStatus('Sent successfully');
        setMessage({ text: data.message || '✓ Test Web Push notification delivered!', type: 'success' });
      } else {
        const errorText = data.error || 'Failed to send test notification';
        setTestStatus('Failed');
        setLastErrorMsg(errorText);
        setMessage({ text: `❌ Test Push Error: ${errorText}`, type: 'error' });
      }
    } catch (e: any) {
      const errorText = e.message || 'Failed to send test notification.';
      setTestStatus('Failed');
      setLastErrorMsg(errorText);
      setMessage({ text: `❌ Test Push Error: ${errorText}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 1. SSR / Hydration Loading Guard (Identical Server & First Client Render)
  if (!mounted) {
    return (
      <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-center justify-between text-slate-400 text-xs">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Loading Push Notification Controls...</span>
        </div>
      </div>
    );
  }

  const activeVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || fetchedVapidKey;

  if (!supported) {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-amber-400 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        Web Push Notifications are not supported in this browser. Please use Chrome, Edge, Safari, or a Mobile PWA.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Switch Card */}
      <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${subscribed && enabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700/40 text-slate-400'}`}>
            {subscribed && enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Mobile Push Notifications</h4>
            <p className="text-xs text-slate-400">
              {subscribed
                ? enabled
                  ? 'Active on Puneet’s device (PWA background push enabled)'
                  : 'Notifications currently disabled'
                : 'Click enable to register device push alerts'}
            </p>
            {activeVapidKey ? (
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> VAPID key pair configured
              </p>
            ) : (
              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> NEXT_PUBLIC_VAPID_PUBLIC_KEY required for push
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subscribed ? (
            <button
              onClick={() => {
                const nextVal = !enabled;
                setEnabled(nextVal);
                saveSettings({ enabled: nextVal });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                enabled
                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              {enabled ? 'Disable' : 'Enable'}
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Enable Notifications
            </button>
          )}

          <button
            onClick={handleTestNotification}
            disabled={loading}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 border border-slate-600"
            title="Send Test Notification"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-indigo-400" />}
            Send Test Push
          </button>
        </div>
      </div>

      {/* Visible Push Diagnostic Status Panel (Manual Test without DevTools) */}
      <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
          <h5 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Push System Diagnostics & Status
          </h5>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-400" /> Real-time status
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block mb-0.5">Notification Permission</span>
            <span className={`font-semibold ${
              permissionStatus === 'Granted' ? 'text-emerald-400' :
              permissionStatus === 'Denied' ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {permissionStatus}
            </span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block mb-0.5">Service Worker</span>
            <span className={`font-semibold ${
              swStatus === 'Registered' ? 'text-emerald-400' :
              swStatus === 'Failed' ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {swStatus}
            </span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block mb-0.5">Push Subscription</span>
            <span className={`font-semibold ${
              subStatus === 'Active' ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {subStatus}
            </span>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/40">
            <span className="text-[10px] text-slate-400 block mb-0.5">Test Notification</span>
            <span className={`font-semibold ${
              testStatus === 'Sent successfully' ? 'text-emerald-400' :
              testStatus === 'Failed' ? 'text-rose-400' :
              testStatus === 'Sending...' ? 'text-indigo-400 animate-pulse' : 'text-slate-400'
            }`}>
              {testStatus}
            </span>
          </div>
        </div>

        {lastErrorMsg && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[11px] font-mono break-all flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
            <span><strong>Last Error:</strong> {lastErrorMsg}</span>
          </div>
        )}
      </div>

      {/* Extended Notification Controls */}
      {subscribed && (
        <div className="p-4 bg-slate-800/20 border border-slate-700/40 rounded-xl space-y-4">
          {/* Notification Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-700/40">
            <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-medium text-slate-200">Task Notifications</span>
              </div>
              <input
                type="checkbox"
                checked={taskNotificationsEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setTaskNotificationsEnabled(val);
                  saveSettings({ taskNotificationsEnabled: val });
                }}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-slate-200">Reminder Notifications</span>
              </div>
              <input
                type="checkbox"
                checked={reminderNotificationsEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setReminderNotificationsEnabled(val);
                  saveSettings({ reminderNotificationsEnabled: val });
                }}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Quiet Hours Settings */}
          <div className="space-y-2 pb-3 border-b border-slate-700/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-amber-400" />
                <label className="text-xs font-medium text-slate-200">Quiet Hours (Overnight Suppression)</label>
              </div>
              <input
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setQuietHoursEnabled(val);
                  saveSettings({ quietHoursEnabled: val });
                }}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={quietHoursStart}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuietHoursStart(val);
                      saveSettings({ quietHoursStart: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">End Time</label>
                  <input
                    type="time"
                    value={quietHoursEnd}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuietHoursEnd(val);
                      saveSettings({ quietHoursEnd: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pending Task Frequency */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Pending Executive Summary Frequency</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Every 1 hr', hours: 1 },
                { label: 'Every 3 hrs (Default)', hours: 3 },
                { label: 'Every 6 hrs', hours: 6 },
                { label: 'Daily (24 hrs)', hours: 24 },
              ].map((item) => (
                <button
                  key={item.hours}
                  onClick={() => {
                    setFrequencyHours(item.hours);
                    saveSettings({ frequencyHours: item.hours });
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    frequencyHours === item.hours
                      ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
