import { useState, useEffect } from 'react';

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
 * Format time with explicit 12-hour format ('en-US') and uppercase AM/PM
 * to eliminate server "pm" vs client "PM" hydration mismatches.
 */
export function formatTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '--:--';
  const d = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '--:--';
  
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Explicitly uppercase AM/PM to eliminate Node.js ("pm") vs Browser ("PM") mismatches
  return timeStr.replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
}

/**
 * Format date with explicit locale ('en-US') and configurable options.
 */
export function formatDate(
  dateInput?: Date | string | number | null,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  if (!dateInput) return '--';
  const d = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '--';
  
  return d.toLocaleDateString('en-US', options);
}
