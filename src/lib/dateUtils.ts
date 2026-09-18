export const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST) — Asia/Kolkata' },
  { value: 'America/New_York', label: 'Eastern Time (EST/EDT) — New York' },
  { value: 'America/Chicago', label: 'Central Time (CST/CDT) — Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MST/MDT) — Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PST/PDT) — Los Angeles' },
  { value: 'Europe/London', label: 'Greenwich / British Time (GMT/BST) — London' },
  { value: 'Europe/Paris', label: 'Central European Time (CET/CEST) — Paris' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST) — Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT) — Singapore' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST) — Tokyo' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST) — Sydney' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

/**
 * Get browser's native IANA timezone
 */
export function getBrowserTimezone(): string {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    }
  } catch (e) {
    console.warn('Failed to resolve browser timezone:', e);
  }
  return 'Asia/Kolkata';
}

/**
 * Get user selected timezone from localStorage or browser default
 */
export function getUserTimezone(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('puneet_executive_timezone');
    if (saved && saved.trim()) {
      return saved.trim();
    }
  }
  return getBrowserTimezone();
}

/**
 * Set user timezone in localStorage and broadcast update event
 */
export function setUserTimezone(tz: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('puneet_executive_timezone', tz);
    window.dispatchEvent(new CustomEvent('executive-timezone-change', { detail: { timezone: tz } }));
  }
}

/**
 * Calculate greeting strictly based on local hour in specified timezone:
 * 5:00 AM – 11:59 AM → Good Morning
 * 12:00 PM – 4:59 PM → Good Afternoon
 * 5:00 PM – 8:59 PM → Good Evening
 * 9:00 PM – 4:59 AM → Good Night
 */
export function getGreetingForTimezone(targetDate: Date = new Date(), timeZone?: string): string {
  const tz = timeZone || (typeof window !== 'undefined' ? getUserTimezone() : 'Asia/Kolkata');
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(targetDate);
    const hourPart = parts.find((p) => p.type === 'hour')?.value || '9';
    let hour = parseInt(hourPart, 10);
    if (hour === 24) hour = 0;

    if (hour >= 5 && hour < 12) {
      return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good Afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'Good Evening';
    } else {
      return 'Good Night';
    }
  } catch (e) {
    console.warn('Error computing timezone greeting:', e);
    return 'Good Morning';
  }
}

/**
 * Format time in specified timezone with 12-hour AM/PM format
 */
export function formatTime(dateInput?: Date | string | number | null, timeZone?: string): string {
  if (!dateInput) return '--:--';
  const d = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '--:--';

  const tz = timeZone || (typeof window !== 'undefined' ? getUserTimezone() : 'Asia/Kolkata');
  try {
    const timeStr = d.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return timeStr.replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
  } catch (e) {
    const fallbackStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return fallbackStr.replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
  }
}

/**
 * Format date in specified timezone
 */
export function formatDate(
  dateInput?: Date | string | number | null,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  timeZone?: string
): string {
  if (!dateInput) return '--';
  const d = typeof dateInput === 'object' ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '--';

  const tz = timeZone || (typeof window !== 'undefined' ? getUserTimezone() : 'Asia/Kolkata');
  try {
    return d.toLocaleDateString('en-US', { ...options, timeZone: tz });
  } catch (e) {
    return d.toLocaleDateString('en-US', options);
  }
}


