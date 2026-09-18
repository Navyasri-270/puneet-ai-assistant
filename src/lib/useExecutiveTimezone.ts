'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserTimezone, getGreetingForTimezone, setUserTimezone } from './dateUtils';

/**
 * Hook to detect whether component has mounted on client-side.
 * Used to avoid SSR vs client hydration mismatches for dates/times.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * Hook to supply reactive timezone, greeting, and updater
 */
export function useExecutiveTimezone() {
  const mounted = useMounted();
  const [timezone, setTimezoneState] = useState<string>('Asia/Kolkata');
  const [greeting, setGreeting] = useState<string>('Good Morning');

  const refreshTimezoneAndGreeting = useCallback(() => {
    const tz = getUserTimezone();
    const g = getGreetingForTimezone(new Date(), tz);
    setTimezoneState(tz);
    setGreeting(g);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    refreshTimezoneAndGreeting();

    // 1. Listen for custom timezone change events
    const handleTzChange = (e: any) => {
      const newTz = e.detail?.timezone || getUserTimezone();
      setTimezoneState(newTz);
      setGreeting(getGreetingForTimezone(new Date(), newTz));
    };
    window.addEventListener('executive-timezone-change', handleTzChange);

    // 2. Listen for tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshTimezoneAndGreeting();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Periodic timer to update greeting when time period shifts (every 30s)
    const interval = setInterval(() => {
      refreshTimezoneAndGreeting();
    }, 30000);

    return () => {
      window.removeEventListener('executive-timezone-change', handleTzChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [mounted, refreshTimezoneAndGreeting]);

  const updateTimezone = (newTz: string) => {
    setUserTimezone(newTz);
    setTimezoneState(newTz);
    setGreeting(getGreetingForTimezone(new Date(), newTz));
  };

  return {
    timezone,
    greeting,
    updateTimezone,
    mounted,
  };
}
