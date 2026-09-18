import { TaskItem } from './taskStore';

export type AIActionIntent = 
  | 'conversation'
  | 'query_tasks'
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'complete_task'
  | 'calendar_query'
  | 'email_query'
  | 'create_calendar_event'
  | 'create_reminder'
  | 'list_reminders'
  | 'cancel_reminder'
  | 'save_memory'
  | 'forget_memory'
  | 'list_memories'
  | 'draft_email'
  | 'update_push_frequency'
  | 'clarify_priority'
  | 'clarify'
  | 'general'
  | 'summarize_tasks'
  | 'list_tasks';

export interface AIActionResponse {
  intent: AIActionIntent;
  actionSummary: string;
  data?: any;
  clarificationQuestion?: string;
  options?: { id: string; title: string }[];
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  isFallbackEngine?: boolean;
}

export function parseNaturalDateTimeAndDetails(prompt: string) {
  const lower = prompt.toLowerCase().trim();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. EXTRACT DATE
  let extractedDate = todayStr;

  const isoMatch = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    extractedDate = isoMatch[1];
  } else if (/\btomorrow\b/i.test(prompt)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    extractedDate = d.toISOString().split('T')[0];
  } else if (/\btoday\b|\btonight\b/i.test(prompt)) {
    extractedDate = todayStr;
  } else {
    // Check days of week
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayMatch = lower.match(/\b(next\s+|this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) {
      const targetDayName = dayMatch[2].toLowerCase();
      const targetDayIndex = daysOfWeek.indexOf(targetDayName);
      if (targetDayIndex !== -1) {
        const d = new Date(now);
        let diff = targetDayIndex - d.getDay();
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        extractedDate = d.toISOString().split('T')[0];
      }
    } else {
      // Month-day patterns ("September 25", "Sep 25th", "25th September", "25 Sep")
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const shortMonthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

      const monthDayMatch = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
      const dayMonthMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);

      if (monthDayMatch) {
        const mStr = monthDayMatch[1].toLowerCase();
        let monthIndex = monthNames.indexOf(mStr);
        if (monthIndex === -1) monthIndex = shortMonthNames.indexOf(mStr);
        const dayNum = parseInt(monthDayMatch[2], 10);
        if (monthIndex !== -1 && dayNum >= 1 && dayNum <= 31) {
          const d = new Date(now.getFullYear(), monthIndex, dayNum);
          if (d < now) d.setFullYear(now.getFullYear() + 1);
          extractedDate = d.toISOString().split('T')[0];
        }
      } else if (dayMonthMatch) {
        const dayNum = parseInt(dayMonthMatch[1], 10);
        const mStr = dayMonthMatch[3].toLowerCase();
        let monthIndex = monthNames.indexOf(mStr);
        if (monthIndex === -1) monthIndex = shortMonthNames.indexOf(mStr);
        if (monthIndex !== -1 && dayNum >= 1 && dayNum <= 31) {
          const d = new Date(now.getFullYear(), monthIndex, dayNum);
          if (d < now) d.setFullYear(now.getFullYear() + 1);
          extractedDate = d.toISOString().split('T')[0];
        }
      }
    }
  }

  // 2. EXTRACT TIME
  let extractedTime = "10:00 AM";
  const timeMatch = prompt.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i) || prompt.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (timeMatch) {
    let tStr = timeMatch[1].toUpperCase().trim();
    if (!tStr.includes('AM') && !tStr.includes('PM')) {
      const num = parseInt(tStr, 10);
      if (num >= 1 && num <= 7) tStr += " PM";
      else tStr += " AM";
    }
    extractedTime = tStr;
  }

  // 3. EXTRACT REASON / DESCRIPTION / DURATION
  let duration = "30 mins";
  const durationMatch = lower.match(/\bfor\s+(\d+)\s+(hour|hours|hr|hrs|min|mins|minutes)\b/i);
  if (durationMatch) {
    duration = `${durationMatch[1]} ${durationMatch[2]}`;
  }

  let description = "";
  const reasonMatch = prompt.match(/\b(to discuss|regarding|about|for|to review|to follow up on)\s+([^.,;]+)/i);
  if (reasonMatch) {
    description = reasonMatch[0].trim();
  }

  return {
    date: extractedDate,
    time: extractedTime,
    duration,
    description
  };
}

export function parseNaturalLanguageRequest(prompt: string, existingTasks: TaskItem[]): AIActionResponse {
  const lower = prompt.toLowerCase().trim();
  const parsedDetails = parseNaturalDateTimeAndDetails(prompt);

  // Explicit creation trigger check
  const hasCreationTrigger = /^(create|add|remind|schedule|make\s+a\s+task|put\s+a\s+task|set\s+a\s+reminder)\b/i.test(lower) ||
    /\b(create\s+(a\s+)?task|add\s+(a\s+)?task|remind\s+me(\s+to)?|schedule\s+(a\s+)?task|create\s+reminder|add\s+reminder)\b/i.test(lower);

  // 1. QUERY TASKS INTENT (`query_tasks`)
  // Must catch all questions asking about tasks, to-dos, reminders, and schedule without creation triggers
  const isTaskQuery = !hasCreationTrigger && (
    /what\s+(do\s+i|should\s+i|have\s+i\s+got|is\s+there)\s+(need\s+to\s+do|have\s+to\s+do|do|complete|pending)/i.test(lower) ||
    /what\s+are\s+my\s+(tasks|reminders|to-?dos|pending\s+items|items|scheduled)/i.test(lower) ||
    /show\s+(my\s+)?(pending\s+tasks|tasks|to-?do\s+list|reminders|schedule)/i.test(lower) ||
    /what\s+is\s+(scheduled|pending|due)\s*(for\s+today|today|now)?/i.test(lower) ||
    /do\s+i\s+have\s+any\s+(reminders|tasks|to-?dos|scheduled\s+items)/i.test(lower) ||
    /what\s+should\s+i\s+(complete|do|focus\s+on)\s*(today|now)?/i.test(lower) ||
    /what\s+tasks?\s+(are\s+)?(remaining|pending|left|due)/i.test(lower) ||
    /show\s+my\s+to-?do\s+list/i.test(lower) ||
    /what\s+is\s+pending/i.test(lower) ||
    /what\s+are\s+my\s+reminders/i.test(lower) ||
    /can\s+you\s+show\s+(my\s+)?(tasks|reminders|to-?dos)/i.test(lower) ||
    lower === 'what do i need to do?' ||
    lower === 'what do i need to do' ||
    lower === 'what should i do' ||
    lower === 'what is pending' ||
    lower === 'show my tasks' ||
    lower === 'what are my tasks'
  );

  if (isTaskQuery) {
    return {
      intent: 'query_tasks',
      actionSummary: 'Queried existing pending tasks',
      requiresConfirmation: false,
      isFallbackEngine: true
    };
  }

  // 2. CALENDAR QUERY INTENT (`calendar_query`)
  if (!hasCreationTrigger && (/calendar/i.test(lower) || /meetings?/i.test(lower)) && (lower.includes('show') || lower.includes('what') || lower.includes('view') || lower.includes('my'))) {
    return {
      intent: 'calendar_query',
      actionSummary: 'Queried upcoming calendar meetings',
      requiresConfirmation: false,
      isFallbackEngine: true
    };
  }

  // 3. EMAIL QUERY INTENT (`email_query`)
  if (!hasCreationTrigger && (/email/i.test(lower) || /drafts?/i.test(lower)) && (lower.includes('show') || lower.includes('what') || lower.includes('view') || lower.includes('my'))) {
    return {
      intent: 'email_query',
      actionSummary: 'Queried email drafts',
      requiresConfirmation: false,
      isFallbackEngine: true
    };
  }

  // 4. CONVERSATION INTENT (`conversation`)
  if (!hasCreationTrigger && (
    lower.includes('can you help me') ||
    lower === 'hello' || lower === 'hi' || lower === 'hey' ||
    lower.includes('who are you') || lower.includes('what can you do') ||
    lower.includes('help me')
  )) {
    return {
      intent: 'conversation',
      actionSummary: 'General assistant interaction',
      requiresConfirmation: false,
      isFallbackEngine: true
    };
  }

  // 5. PUSH NOTIFICATION FREQUENCY INTENT
  if (lower.includes('remind me every') || lower.includes('notification frequency') || lower.includes('push notifications every')) {
    let hours = 3;
    if (lower.includes('1 hour') || lower.includes('every hour')) hours = 1;
    else if (lower.includes('3 hours') || lower.includes('every 3 hours')) hours = 3;
    else if (lower.includes('6 hours') || lower.includes('every 6 hours')) hours = 6;
    else if (lower.includes('daily') || lower.includes('24 hours')) hours = 24;

    return {
      intent: 'update_push_frequency',
      actionSummary: `Updated mobile push notification frequency to every ${hours} hour(s)`,
      data: { frequencyHours: hours },
      isFallbackEngine: true,
    };
  }

  // 6. REMINDER INTENTS
  if (/^(remind\s+me|create\s+(a\s+)?reminder|set\s+(a\s+)?reminder|add\s+(a\s+)?reminder)\b/i.test(lower)) {
    let reminderText = prompt
      .replace(/^(remind me\s+to\b|remind me\s+about\b|remind me\b|create\s+(a\s+)?reminder\b|set\s+(a\s+)?reminder\b|add\s+(a\s+)?reminder\b)\s*/i, '')
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      .replace(/\btomorrow\b|\btoday\b|\bnext\s+\w+|\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?/gi, '')
      .replace(/^\s*(to|about|for|at|on)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (reminderText.endsWith('.')) reminderText = reminderText.slice(0, -1);
    if (reminderText.length < 2) reminderText = "Executive Reminder";
    reminderText = reminderText.charAt(0).toUpperCase() + reminderText.slice(1);

    const rTime = new Date(`${parsedDetails.date}T10:00:00.000Z`);
    const timeMatch = parsedDetails.time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      rTime.setUTCHours(hours, mins, 0, 0);
    }

    const matchingTask = existingTasks.find(t => 
      t.status !== 'Completed' && (
        reminderText.toLowerCase().includes(t.title.toLowerCase()) || 
        t.title.toLowerCase().includes(reminderText.toLowerCase())
      )
    );

    return {
      intent: 'create_reminder',
      actionSummary: `Set reminder "${reminderText}" for ${parsedDetails.date} at ${parsedDetails.time}`,
      requiresConfirmation: true,
      confirmationMessage: `Create this reminder?\n\n• Title: ${reminderText}\n• Date: ${parsedDetails.date}\n• Time: ${parsedDetails.time}`,
      data: {
        title: reminderText,
        reminderTime: rTime.toISOString(),
        taskId: matchingTask ? matchingTask.id : undefined
      },
      isFallbackEngine: true
    };
  }

  // CANCEL REMINDER
  if (lower.startsWith('cancel reminder') || lower.startsWith('delete reminder') || lower.includes('cancel my reminder')) {
    let query = prompt.replace(/^(cancel my reminder about|cancel reminder about|cancel reminder|delete reminder|remove reminder)\s*/i, '').trim();
    if (query.endsWith('.')) query = query.slice(0, -1);

    return {
      intent: 'cancel_reminder',
      actionSummary: `Request to cancel reminder regarding "${query}"`,
      data: { query },
      isFallbackEngine: true
    };
  }

  // LIST REMINDERS
  if (lower.includes('reminders') && (lower.includes('show') || lower.includes('list') || lower.includes('what') || lower.includes('view') || lower.includes('my'))) {
    let filter = 'all';
    if (lower.includes('today')) filter = 'today';
    else if (lower.includes('upcoming') || lower.includes('next')) filter = 'upcoming';

    return {
      intent: 'list_reminders',
      actionSummary: `Queried reminders [Filter: ${filter}]`,
      data: { filter },
      isFallbackEngine: true
    };
  }

  // MEMORY INTENTS
  if (lower.startsWith('remember') || lower.includes('save this as a preference') || lower.includes('save preference')) {
    let rawText = prompt.replace(/^(remember that|remember|save this as a preference:?|save preference:?)\s*/i, '').trim();
    if (rawText.endsWith('.')) rawText = rawText.slice(0, -1);

    return {
      intent: 'save_memory',
      actionSummary: `Saved to Executive Memory: "${rawText.substring(0, 30)}"`,
      requiresConfirmation: false,
      confirmationMessage: `Saved to Executive Memory.`,
      data: { key: rawText.substring(0, 30), value: rawText, category: 'Preferences' },
      isFallbackEngine: true
    };
  }

  // CREATE CALENDAR EVENT INTENT (Outlook / Local Calendar)
  if (lower.startsWith('schedule a meeting') || lower.startsWith('schedule a call') || lower.startsWith('schedule meeting') || lower.startsWith('schedule call') || lower.includes('calendar event')) {
    let eventTitle = prompt
      .replace(/^(schedule a meeting|schedule meeting|schedule a call|schedule call|schedule a sync|schedule sync|schedule)\b\s*/i, '')
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      .replace(/\btomorrow\b|\btoday\b|\bnext\s+\w+|\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?/gi, '')
      .replace(/^\s*(with|for|at|on)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (eventTitle.length < 3) {
      eventTitle = "Executive Meeting";
    } else {
      if (!eventTitle.toLowerCase().startsWith('meeting with')) {
        eventTitle = "Meeting with " + eventTitle;
      }
      eventTitle = eventTitle.charAt(0).toUpperCase() + eventTitle.slice(1);
    }
    if (eventTitle.endsWith('.')) eventTitle = eventTitle.slice(0, -1);

    return {
      intent: 'create_calendar_event',
      actionSummary: `Scheduled "${eventTitle}" for ${parsedDetails.date} at ${parsedDetails.time}`,
      requiresConfirmation: true,
      confirmationMessage: `Schedule this meeting?\n\n• Title: ${eventTitle}\n• Date: ${parsedDetails.date}\n• Time: ${parsedDetails.time}\n• Description: ${parsedDetails.description || 'Executive Meeting'}`,
      data: {
        title: eventTitle,
        date: parsedDetails.date,
        startTime: parsedDetails.time,
        description: parsedDetails.description || 'Executive Meeting',
        location: "Executive Office / Online Sync",
        category: "Client Meeting",
        isOutlook: true,
      },
      isFallbackEngine: true
    };
  }

  // DRAFT EMAIL INTENT
  if (lower.startsWith('draft an email') || lower.startsWith('draft email') || lower.startsWith('write an email')) {
    let recipient = "Executive Contact";
    const toMatch = prompt.match(/\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (toMatch) recipient = toMatch[1].trim();

    return {
      intent: 'draft_email',
      actionSummary: `Prepared draft email for ${recipient}`,
      requiresConfirmation: true,
      confirmationMessage: `Email draft created for ${recipient}.`,
      data: { recipient, subject: "Executive Communication", body: "Please find the requested update attached." },
      isFallbackEngine: true
    };
  }

  // COMPLETE TASK INTENT
  if (lower.includes('complete') && (lower.includes('task') || lower.includes('item'))) {
    const matchingTasks = existingTasks.filter(t => t.status !== 'Completed' && lower.includes(t.title.toLowerCase()));
    if (matchingTasks.length > 0) {
      const target = matchingTasks[0];
      return {
        intent: 'complete_task',
        actionSummary: `Marked "${target.title}" as completed`,
        data: { taskId: target.id, taskTitle: target.title },
        isFallbackEngine: true
      };
    }
  }

  // MORNING BRIEFING
  if (lower.includes('briefing') || lower.includes('summarize my day') || lower.includes('what should i focus on')) {
    return {
      intent: 'summarize_tasks',
      actionSummary: 'Generated Executive Daily AI Briefing',
      data: { scope: 'today' },
      isFallbackEngine: true
    };
  }

  // CREATE TASK INTENT - STRICT SAFETY VERIFICATION
  if (hasCreationTrigger) {
    let taskTitle = prompt
      .replace(/^(create task|add task|new task|create a task|add a task|remind me to|remind me|schedule a task|schedule task|todo)\b\s*/i, '')
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      .replace(/\bon\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?/gi, '')
      .replace(/\bby tomorrow\b|\btomorrow\b|\btoday\b|\btonight\b|\bnext\s+\w+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (taskTitle.endsWith('.')) taskTitle = taskTitle.slice(0, -1);

    const isQuestionTitle = /^(what|how|why|when|where|who|can\s+you|show|do\s+i|is\s+there)\b/i.test(taskTitle.toLowerCase()) || taskTitle.toLowerCase() === lower;

    if (!taskTitle || taskTitle.length < 2 || isQuestionTitle) {
      return {
        intent: 'clarify',
        actionSummary: 'Ambiguous task creation request',
        clarificationQuestion: 'Would you like me to create this as a task?',
        requiresConfirmation: false,
        isFallbackEngine: true
      };
    }

    taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);

    let explicitPriority = "Medium";
    if (/\b(urgent|asap|critical)\b/i.test(lower)) explicitPriority = "Urgent";
    else if (/\b(high priority|important)\b/i.test(lower)) explicitPriority = "High";
    else if (/\b(low priority)\b/i.test(lower)) explicitPriority = "Low";

    const structuredIntent = {
      type: 'task',
      title: taskTitle,
      description: parsedDetails.description || '',
      date: parsedDetails.date,
      time: parsedDetails.time,
      recurrence: 'none',
      priority: explicitPriority,
      category: 'General',
      status: 'To Do'
    };

    return {
      intent: 'create_task',
      actionSummary: `Create task "${taskTitle}" for ${parsedDetails.date} at ${parsedDetails.time} [Priority: ${explicitPriority}]`,
      requiresConfirmation: true,
      confirmationMessage: `Create this task?\n\n• Title: ${taskTitle}\n• Date: ${parsedDetails.date}\n• Time: ${parsedDetails.time}\n• Priority: ${explicitPriority}`,
      data: {
        structuredIntent,
        ...structuredIntent
      },
      isFallbackEngine: true
    };
  }

  // DEFAULT FALLBACK: Treat non-creation inputs as General Conversation
  return {
    intent: 'conversation',
    actionSummary: 'General assistant conversation',
    requiresConfirmation: false,
    isFallbackEngine: true
  };
}
