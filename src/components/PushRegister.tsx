'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle2, AlertCircle, RefreshCw, Send } from 'lucide-react';

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
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frequencyHours, setFrequencyHours] = useState(3);
  const [enabled, setEnabled] = useState(true);
  const [fetchedVapidKey, setFetchedVapidKey] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true);
      ensureServiceWorkerRegistered().then(() => {
        checkExistingSubscription();
        fetchSettings();
      });
    }
  }, []);

  const ensureServiceWorkerRegistered = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          await navigator.serviceWorker.register('/sw.js');
        }
      }
    } catch (e) {
      console.warn('Service worker registration attempt:', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/push/settings');
      if (res.ok) {
        const data = await res.json();
        setFrequencyHours(data.frequencyHours ?? 3);
        setEnabled(data.enabled ?? true);
        if (data.vapidPublicKey) {
          setFetchedVapidKey(data.vapidPublicKey);
        }
      }
    } catch (e) {
      console.error('Error fetching push settings:', e);
    }
  };

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch (e) {
      console.error('Error checking push subscription:', e);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    setMessage(null);

    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'denied') {
          setMessage({
            text: 'Notification permission was denied in your browser settings. Please reset site permissions in your browser address bar to allow notifications.',
            type: 'error',
          });
          setLoading(false);
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setMessage({
            text: 'Notification permission was denied in your browser.',
            type: 'error',
          });
          setLoading(false);
          return;
        }
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || fetchedVapidKey;
      if (!vapidPublicKey) {
        setMessage({
          text: 'VAPID public key is not configured in production environment variables.',
          type: 'error',
        });
        setLoading(false);
        return;
      }

      await ensureServiceWorkerRegistered();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subObj = sub.toJSON();

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subObj.endpoint,
          keys: subObj.keys,
          frequencyHours,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save subscription on server');
      }

      setSubscribed(true);
      setMessage({ text: 'Push notifications registered successfully on this device!', type: 'success' });
    } catch (err: any) {
      console.error('Push registration error:', err);
      setMessage({ text: err.message || 'Failed to subscribe to push notifications.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFrequency = async (newFreq: number) => {
    setFrequencyHours(newFreq);
    try {
      await fetch('/api/push/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, frequencyHours: newFreq }),
      });
      setMessage({ text: `Notification frequency updated to every ${newFreq} hour${newFreq > 1 ? 's' : ''}.`, type: 'success' });
    } catch (e) {
      console.error('Error updating push frequency:', e);
    }
  };

  const handleToggleEnable = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    try {
      await fetch('/api/push/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled, frequencyHours }),
      });
      setMessage({ text: newEnabled ? 'Mobile push notifications enabled.' : 'Mobile push notifications disabled.', type: 'success' });
    } catch (e) {
      console.error('Error toggling push notifications:', e);
    }
  };

  const handleTestNotification = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // 1. Dispatch backend cron notification
      const res = await fetch('/api/cron/push-notifications?force=true');
      const data = await res.json();

      // 2. Also trigger direct local ServiceWorker notification for immediate browser feedback
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('🔔 Local Test Push (Puneet AI)', {
          body: 'This is a test Web Push notification for Puneet AI Assistant.',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: 'test-push-local',
          data: { url: '/tasks' },
        });
      }

      if (res.ok && data.success) {
        setMessage({ text: data.message || 'Test push notification dispatched successfully!', type: 'success' });
      } else {
        setMessage({ text: data.error || data.message || 'Local test notification triggered directly in browser.', type: 'success' });
      }
    } catch (e: any) {
      // If server dispatch errors out locally, show fallback local SW notification
      if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('🔔 Local Test Push (Puneet AI)', {
            body: 'Local fallback test notification.',
            icon: '/icons/icon-192.png',
            tag: 'test-push-local',
            data: { url: '/tasks' },
          });
          setMessage({ text: 'Local test notification displayed via Service Worker.', type: 'success' });
        } catch (swErr: any) {
          setMessage({ text: e.message || 'Failed to send test notification.', type: 'error' });
        }
      } else {
        setMessage({ text: e.message || 'Failed to send test notification.', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const activeVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || fetchedVapidKey;

  if (!supported) {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-400 text-sm">
        Web Push Notifications are not supported in this browser environment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

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
                  ? 'Active on Puneet’s device (PWA background push)'
                  : 'Notifications currently disabled'
                : 'Click enable to register device push alerts'}
            </p>
            {activeVapidKey ? (
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> VAPID key pair configured
              </p>
            ) : (
              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> VAPID key pair pending configuration
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subscribed ? (
            <button
              onClick={() => handleToggleEnable(!enabled)}
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
              disabled={loading || !activeVapidKey}
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

      {subscribed && (
        <div className="p-4 bg-slate-800/20 border border-slate-700/40 rounded-xl space-y-3">
          <label className="block text-xs font-medium text-slate-300">Notification Frequency</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Every 1 hr', hours: 1 },
              { label: 'Every 3 hrs (Default)', hours: 3 },
              { label: 'Every 6 hrs', hours: 6 },
              { label: 'Daily (24 hrs)', hours: 24 },
            ].map((item) => (
              <button
                key={item.hours}
                onClick={() => handleUpdateFrequency(item.hours)}
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
      )}
    </div>
  );
}

