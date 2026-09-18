import { getTasks, getEmailDrafts, getRelevantMemories, getReminders } from './taskStore';
import { getUnifiedSchedule } from './calendarService';
import { getGreetingForTimezone } from './dateUtils';

export interface DailyBriefingData {
  todayStr: string;
  greeting: string;
  summaryText: string;
  todayTaskCount: number;
  highPriorityCount: number;
  overdueCount: number;
  agendaCount: number;
  topPriorities: {
    id: string;
    title: string;
    priority: string;
    dueTime?: string;
    category?: string;
  }[];
  todaySchedule: {
    id: string;
    title: string;
    time: string;
    category: string;
    type: string;
  }[];
  overdueTasks: {
    id: string;
    title: string;
    dueDate?: string;
    priority: string;
  }[];
  pendingDrafts: {
    id: string;
    recipient: string;
    subject: string;
  }[];
  upcomingReminders?: {
    id: string;
    title: string;
    reminderTime: string;
    channel: string;
  }[];
  relevantMemories: {
    key: string;
    value: string;
    category: string;
  }[];
  recommendation: string;
  formattedMarkdown: string;
  updatedAt: string;
}

/**
 * Helper to get local date string YYYY-MM-DD
 */
export function getLocalDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate Factual, Data-Driven Executive Daily AI Briefing
 */
export async function generateDailyBriefing(): Promise<DailyBriefingData> {
  const todayStr = getLocalDateStr();
  const tasks = await getTasks();
  const drafts = await getEmailDrafts();

  // 1. Task Data Extraction
  const todayTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate === todayStr);
  const overdueTasksList = tasks.filter(t => t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr);

  const priorityRank: Record<string, number> = { Urgent: 1, High: 2, Medium: 3, Low: 4 };

  const sortedTodayTasks = [...todayTasks].sort((a, b) => {
    const pA = priorityRank[a.priority] || 5;
    const pB = priorityRank[b.priority] || 5;
    if (pA !== pB) return pA - pB;
    return (a.dueTime || '23:59').localeCompare(b.dueTime || '23:59');
  });

  const highPriorityTasks = sortedTodayTasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');

  // 2. Calendar Schedule Data Extraction (Google Calendar when connected, local DB when disconnected)
  let scheduleEvents: any[] = [];
  try {
    scheduleEvents = await getUnifiedSchedule(todayStr);
  } catch (err) {
    console.warn("Unified schedule fetch in briefing service warning:", err);
  }

  // 3. Relevant Executive Memories Extraction
  let relevantMems: any[] = [];
  try {
    relevantMems = await getRelevantMemories("today schedule priority focus briefing executive meeting email");
  } catch (err) {
    console.warn("Memory fetch in briefing service warning:", err);
  }

  // 4. Pending Drafts & Reminders Needing Attention
  const pendingDraftsList = drafts.filter(d => d.status === 'Draft');
  
  let activeRemindersList: any[] = [];
  try {
    const allReminders = await getReminders('all');
    activeRemindersList = allReminders.filter(r => !r.triggered);
  } catch (err) {
    console.warn("Reminder fetch in briefing service warning:", err);
  }

  // 5. Factual Recommendation Generation
  let recommendation = "No specific recommendation at this time.";
  if (overdueTasksList.length > 0) {
    const topOverdue = overdueTasksList[0];
    recommendation = `Resolve overdue task "${topOverdue.title}" before proceeding with new items today.`;
  } else if (highPriorityTasks.length > 0) {
    const topPriority = highPriorityTasks[0];
    recommendation = `Prioritize "${topPriority.title}" (${topPriority.priority} priority${topPriority.dueTime ? ` · due at ${topPriority.dueTime}` : ''}).`;
  } else if (scheduleEvents.length > 0) {
    const topEvent = scheduleEvents[0];
    recommendation = `Prepare for scheduled appointment "${topEvent.title}" at ${topEvent.time}.`;
  } else if (activeRemindersList.length > 0) {
    const topRem = activeRemindersList[0];
    const remDt = new Date(topRem.reminderTime);
    recommendation = `Upcoming reminder: "${topRem.title}" scheduled for ${remDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`;
  } else if (pendingDraftsList.length > 0) {
    const topDraft = pendingDraftsList[0];
    recommendation = `Review pending email draft for ${topDraft.recipient || 'recipient'}.`;
  }

  // 6. Factual Executive Summary & Formatted Markdown
  const greeting = `${getGreetingForTimezone(new Date())}, Puneet.`;
  let summaryText = `You have ${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} and ${scheduleEvents.length} schedule item${scheduleEvents.length !== 1 ? 's' : ''} for today (${todayStr}).`;

  if (highPriorityTasks.length > 0) {
    summaryText += ` Top priority: "${highPriorityTasks[0].title}".`;
  }
  if (overdueTasksList.length > 0) {
    summaryText += ` Note: ${overdueTasksList.length} overdue task${overdueTasksList.length > 1 ? 's' : ''} require attention.`;
  }

  // Build markdown for Assistant output
  let markdownLines: string[] = [
    `**${greeting}**`,
    '',
    `You have **${todayTasks.length} item${todayTasks.length !== 1 ? 's' : ''}** scheduled for today (${todayStr}).`,
    ''
  ];

  if (highPriorityTasks.length > 0) {
    markdownLines.push('**TOP PRIORITIES**');
    highPriorityTasks.slice(0, 3).forEach(t => {
      markdownLines.push(`• **${t.title}** — *${t.priority}* ${t.dueTime ? `(${t.dueTime})` : ''}`);
    });
    markdownLines.push('');
  }

  if (scheduleEvents.length > 0) {
    markdownLines.push('**TODAY\'S SCHEDULE**');
    scheduleEvents.slice(0, 4).forEach(e => {
      markdownLines.push(`• **${e.time}** — ${e.title} *(${e.category})*`);
    });
    markdownLines.push('');
  }

  if (activeRemindersList.length > 0) {
    markdownLines.push('**UPCOMING REMINDERS**');
    activeRemindersList.slice(0, 3).forEach(r => {
      const rDt = new Date(r.reminderTime);
      markdownLines.push(`• **${r.title}** — *${rDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${rDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}*`);
    });
    markdownLines.push('');
  }

  if (overdueTasksList.length > 0) {
    markdownLines.push(`⚠️ **ATTENTION**: ${overdueTasksList.length} overdue task${overdueTasksList.length > 1 ? 's' : ''} pending.`);
    markdownLines.push('');
  }

  markdownLines.push(`💡 **AI RECOMMENDATION**: ${recommendation}`);

  return {
    todayStr,
    greeting,
    summaryText,
    todayTaskCount: todayTasks.length,
    highPriorityCount: highPriorityTasks.length,
    overdueCount: overdueTasksList.length,
    agendaCount: scheduleEvents.length,
    topPriorities: sortedTodayTasks.slice(0, 4).map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueTime: t.dueTime || undefined,
      category: t.category
    })),
    todaySchedule: scheduleEvents.map(e => ({
      id: e.id,
      title: e.title,
      time: e.time,
      category: e.category,
      type: e.type
    })),
    overdueTasks: overdueTasksList.map(t => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate || undefined,
      priority: t.priority
    })),
    pendingDrafts: pendingDraftsList.map(d => ({
      id: d.id,
      recipient: d.recipient,
      subject: d.subject
    })),
    upcomingReminders: activeRemindersList.slice(0, 4).map(r => ({
      id: r.id,
      title: r.title,
      reminderTime: r.reminderTime,
      channel: r.channel || 'IN_APP'
    })),
    relevantMemories: relevantMems.map(m => ({
      key: m.key,
      value: m.value,
      category: m.category
    })),
    recommendation,
    formattedMarkdown: markdownLines.join('\n'),
    updatedAt: new Date().toISOString()
  };
}
