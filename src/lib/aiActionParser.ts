import { TaskItem } from './taskStore';

export interface AIActionResponse {
  intent: 'create_task' | 'update_task' | 'complete_task' | 'delete_task' | 'list_tasks' | 'summarize_tasks' | 'draft_email' | 'create_calendar_event' | 'clarify_priority' | 'save_memory' | 'forget_memory' | 'list_memories' | 'create_reminder' | 'list_reminders' | 'cancel_reminder' | 'clarify' | 'general';
  actionSummary: string;
  data?: any;
  clarificationQuestion?: string;
  options?: { id: string; title: string }[];
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  isFallbackEngine?: boolean;
}

export function parseNaturalLanguageRequest(prompt: string, existingTasks: TaskItem[]): AIActionResponse {
  const lower = prompt.toLowerCase().trim();
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Calculate relative dates (tomorrow, next Monday, etc.)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const friday = new Date();
  const daysUntilFriday = (5 - friday.getDay() + 7) % 7 || 7;
  friday.setDate(friday.getDate() + daysUntilFriday);
  const fridayStr = friday.toISOString().split('T')[0];

  // 000. REMINDER INTENTS
  // A. CREATE REMINDER
  if (lower.startsWith('remind me') || lower.startsWith('create reminder') || lower.startsWith('set reminder') || lower.startsWith('add reminder')) {
    let reminderText = prompt.replace(/^(remind me\s+to\b|remind me\s+about\b|remind me\b|create reminder\b|set reminder\b|add reminder\b)\s*/i, '').trim();

    const targetTime = new Date();
    const inHoursMatch = lower.match(/\bin\s+(\d+)\s+hour(s)?\b/i);
    const inMinsMatch = lower.match(/\bin\s+(\d+)\s+min(s|ute|utes)?\b/i);

    if (inHoursMatch) {
      targetTime.setHours(targetTime.getHours() + parseInt(inHoursMatch[1], 10));
    } else if (inMinsMatch) {
      targetTime.setMinutes(targetTime.getMinutes() + parseInt(inMinsMatch[1], 10));
    } else {
      if (/\btomorrow\b/i.test(prompt)) {
        targetTime.setDate(targetTime.getDate() + 1);
      } else if (/\bfriday\b/i.test(prompt)) {
        const daysUntilFriday = (5 - targetTime.getDay() + 7) % 7 || 7;
        targetTime.setDate(targetTime.getDate() + daysUntilFriday);
      }

      const timeMatch = prompt.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i) || prompt.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
      if (timeMatch) {
        let tStr = timeMatch[1].toUpperCase().trim();
        let hours = 10;
        let mins = 0;
        if (tStr.includes('PM')) {
          const h = parseInt(tStr.replace('PM', '').trim(), 10);
          hours = h === 12 ? 12 : h + 12;
        } else if (tStr.includes('AM')) {
          const h = parseInt(tStr.replace('AM', '').trim(), 10);
          hours = h === 12 ? 0 : h;
        }
        targetTime.setHours(hours, mins, 0, 0);
      } else {
        targetTime.setHours(10, 0, 0, 0);
      }
    }

    let title = reminderText
      .replace(/\bin\s+\d+\s+hour(s)?\b/gi, '')
      .replace(/\bin\s+\d+\s+min(s|ute|utes)?\b/gi, '')
      .replace(/\bby tomorrow\b|\btomorrow\b|\btoday\b|\bfriday\b/gi, '')
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      .replace(/^\s*(to|about|for|at|on)\s+/i, '')
      .trim();

    if (title.endsWith('.')) title = title.slice(0, -1);
    if (title.length < 2) title = "Executive Reminder";
    title = title.charAt(0).toUpperCase() + title.slice(1);

    const matchingTask = existingTasks.find(t => 
      t.status !== 'Completed' && (
        title.toLowerCase().includes(t.title.toLowerCase()) || 
        t.title.toLowerCase().includes(title.toLowerCase())
      )
    );

    return {
      intent: 'create_reminder',
      actionSummary: `Set reminder "${title}"`,
      data: {
        title,
        reminderTime: targetTime.toISOString(),
        taskId: matchingTask ? matchingTask.id : undefined
      },
      isFallbackEngine: true
    };
  }

  // B. CANCEL REMINDER
  if (lower.startsWith('cancel reminder') || lower.startsWith('delete reminder') || lower.includes('cancel my reminder') || lower.includes('delete my reminder')) {
    let query = prompt.replace(/^(cancel my reminder about|cancel reminder about|cancel reminder|delete reminder|remove reminder)\s*/i, '').trim();
    if (query.endsWith('.')) query = query.slice(0, -1);

    return {
      intent: 'cancel_reminder',
      actionSummary: `Request to cancel reminder regarding "${query}"`,
      data: {
        query
      },
      isFallbackEngine: true
    };
  }

  // C. LIST REMINDERS
  if (lower.includes('reminders') && (lower.includes('show') || lower.includes('list') || lower.includes('what') || lower.includes('view') || lower.includes('my'))) {
    let filter = 'all';
    if (lower.includes('today')) filter = 'today';
    else if (lower.includes('upcoming') || lower.includes('next')) filter = 'upcoming';

    return {
      intent: 'list_reminders',
      actionSummary: `Queried reminders [Filter: ${filter}]`,
      data: {
        filter
      },
      isFallbackEngine: true
    };
  }

  // 00. MEMORY INTENTS
  // A. SAVE MEMORY
  if (lower.startsWith('remember') || lower.includes('save this as a preference') || lower.includes('save preference') || lower.startsWith('save memory')) {
    let rawText = prompt.replace(/^(remember that|remember|save this as a preference:?|save preference:?|save memory:?)\s*/i, '').trim();
    if (rawText.endsWith('.')) rawText = rawText.slice(0, -1);

    let category = "Preferences";
    let key = "Executive Preference";
    let value = rawText;

    if (/concise|email|communication|report/i.test(rawText)) {
      category = "Communication";
      key = "Email Style & Communication";
      value = "Prefer concise emails";
    } else if (/priority client|client|apex|dubai/i.test(rawText)) {
      category = "Clients";
      key = rawText.toLowerCase().includes('apex') ? "Apex Holdings Priority" : "Priority Client";
      value = rawText;
    } else if (/meeting|3 PM|after 3|duration|time/i.test(rawText)) {
      category = "Preferences";
      key = "Meeting Scheduling Preference";
      value = rawText;
    } else {
      key = rawText.length > 30 ? rawText.substring(0, 30) + '...' : rawText;
    }

    return {
      intent: 'save_memory',
      actionSummary: `Saved to Executive Memory: "${key}"`,
      requiresConfirmation: false,
      confirmationMessage: `Saved to Executive Memory [Category: ${category}].`,
      data: {
        key,
        value,
        category
      },
      isFallbackEngine: true
    };
  }

  // B. FORGET MEMORY
  if (lower.startsWith('forget') || lower.startsWith('delete memory') || lower.startsWith('remove memory')) {
    let target = prompt.replace(/^(forget that|forget the preference about|forget|delete memory|remove memory)\s*/i, '').trim();
    if (target.endsWith('.')) target = target.slice(0, -1);

    return {
      intent: 'forget_memory',
      actionSummary: `Request to forget memory regarding "${target}"`,
      data: {
        targetQuery: target
      },
      isFallbackEngine: true
    };
  }

  // C. LIST / QUERY MEMORIES
  if (lower.includes('what do you remember') || lower.startsWith('show memories') || lower.startsWith('list memories') || lower.includes('remember about')) {
    let queryTerm = prompt.replace(/^(what do you remember about|what do you remember|show memories about|list memories about|show me what you remember about)\s*/i, '').trim();
    if (queryTerm.endsWith('?')) queryTerm = queryTerm.slice(0, -1);

    return {
      intent: 'list_memories',
      actionSummary: `Queried memories regarding "${queryTerm}"`,
      data: {
        queryTerm
      },
      isFallbackEngine: true
    };
  }

  // 0. CREATE CALENDAR EVENT INTENT
  if (lower.startsWith('schedule') || lower.includes('schedule a meeting') || lower.includes('schedule a call') || lower.includes('calendar event')) {
    const timeMatch = prompt.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i) || prompt.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);

    let eventDate = todayStr;
    if (/\btomorrow\b/i.test(prompt)) {
      eventDate = tomorrowStr;
    } else if (/\bfriday\b/i.test(prompt)) {
      eventDate = fridayStr;
    }

    // Extract title
    let eventTitle = prompt
      .replace(/^(schedule a meeting|schedule meeting|schedule a call|schedule call|schedule a sync|schedule sync|schedule)\b\s*/i, '')
      .replace(/\bby tomorrow\b|\btomorrow\b|\btoday\b|\btonight\b|\bfriday\b/gi, '')
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
      .replace(/^\s*(with|for|at|on)\s+/i, '')
      .trim();

    if (eventTitle.length < 3) {
      eventTitle = "Executive Meeting";
    } else {
      eventTitle = "Meeting with " + eventTitle.replace(/^meeting with /i, '');
      eventTitle = eventTitle.charAt(0).toUpperCase() + eventTitle.slice(1);
    }

    if (!timeMatch) {
      return {
        intent: 'clarify',
        actionSummary: `Calendar request received for "${eventTitle}". Start time missing.`,
        clarificationQuestion: `What time should I schedule the meeting?`,
        options: [
          { id: '10:00 AM', title: '10:00 AM' },
          { id: '01:00 PM', title: '01:00 PM' },
          { id: '03:00 PM', title: '03:00 PM' },
          { id: '04:00 PM', title: '04:00 PM' }
        ],
        data: {
          pendingEvent: {
            title: eventTitle,
            date: eventDate
          }
        },
        isFallbackEngine: true
      };
    }

    let startTime = timeMatch[1].toUpperCase().trim();
    if (!startTime.includes('AM') && !startTime.includes('PM')) {
      startTime += " PM";
    }

    return {
      intent: 'create_calendar_event',
      actionSummary: `Scheduled "${eventTitle}" for ${eventDate === todayStr ? 'Today' : 'Tomorrow'} at ${startTime}`,
      data: {
        title: eventTitle,
        date: eventDate,
        startTime,
        location: "Executive Office / Online Sync",
        category: "Client Meeting"
      },
      isFallbackEngine: true
    };
  }


  // 1. DRAFT EMAIL INTENT
  if (lower.startsWith('draft an email') || lower.startsWith('draft email') || lower.startsWith('write an email') || lower.startsWith('write email') || lower.includes('draft an email') || lower.includes('draft email') || lower.includes('write an email')) {
    let recipient = "";
    let subject = "Executive Communication";

    // Extract recipient if specified
    const toMatch = prompt.match(/\bto\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|the\s+[a-z\s]+)/i);
    if (toMatch) {
      recipient = toMatch[1].trim();
      if (recipient.toLowerCase().startsWith('the ')) {
        recipient = recipient.charAt(0).toUpperCase() + recipient.slice(1);
      }
    } else if (lower.includes('john')) {
      recipient = "John Miller";
    } else if (lower.includes('dubai') || lower.includes('tariq')) {
      recipient = "Tariq Al-Mansoor <tariq@dubaiholdings.ae>";
    } else if (lower.includes('team')) {
      recipient = "Team";
    }

    // Determine subject based on topic
    if (lower.includes('proposal')) {
      subject = "Update on Client Proposal & Strategic Next Steps";
    } else if (lower.includes('dubai') || lower.includes('meeting')) {
      subject = "Follow-up: Commercial Sync & Dubai Q4 Rollout";
    } else if (lower.includes('thank') || lower.includes('project')) {
      subject = "Thank You: Outstanding Effort on Project Completion";
    } else {
      subject = "Executive Update & Action Items";
    }

    const greeting = recipient ? `Hi ${recipient.split(' ')[0]}` : "Hello";
    let bodyText = "";
    if (lower.includes('proposal')) {
      bodyText = `${greeting},\n\nI am writing to request a brief status update on the client proposal.\n\nCould you please share the current progress, key deliverables, and expected timeline for final review?\n\nBest regards,\nPuneet`;
    } else if (lower.includes('thank') || lower.includes('project')) {
      bodyText = `${greeting},\n\nI wanted to extend my sincere gratitude for your hard work and dedication in completing the project.\n\nYour efforts are greatly appreciated and contributed significantly to this milestone.\n\nBest regards,\nPuneet`;
    } else {
      bodyText = `${greeting},\n\nI am following up on our recent discussion regarding upcoming priorities and action items.\n\nPlease let me know your availability for a quick alignment call this week.\n\nBest regards,\nPuneet`;
    }

    return {
      intent: 'draft_email',
      actionSummary: recipient ? `Prepared draft email for ${recipient}` : `Prepared draft email (Recipient required)`,
      requiresConfirmation: true,
      confirmationMessage: recipient ? `Email draft created for ${recipient}.` : `Email draft created. Please add recipient in Email Assistant.`,
      data: {
        recipient: recipient || "",
        subject,
        body: bodyText
      },
      isFallbackEngine: true
    };
  }

  // 2. COMPLETE TASK INTENT
  if ((lower.includes('complete') && (lower.includes('task') || lower.includes('item') || lower.includes('proposal'))) || (lower.includes('mark') && lower.includes('completed')) || lower.startsWith('complete ') || lower.startsWith('finish ')) {
    // Search matching tasks
    const matchingTasks = existingTasks.filter(t => 
      t.status !== 'Completed' && (
        lower.includes(t.title.toLowerCase()) || 
        t.title.toLowerCase().split(' ').some(word => word.length > 3 && lower.includes(word))
      )
    );

    if (matchingTasks.length === 0) {
      return {
        intent: 'clarify',
        actionSummary: 'Could not find matching active task to complete',
        clarificationQuestion: 'I could not find an active task matching that description. Which task would you like to mark as completed?',
        options: existingTasks.filter(t => t.status !== 'Completed').map(t => ({ id: t.id, title: t.title })),
        isFallbackEngine: true
      };
    }

    if (matchingTasks.length > 1) {
      return {
        intent: 'clarify',
        actionSummary: 'Multiple matching tasks found',
        clarificationQuestion: 'Which task would you like me to mark as completed?',
        options: matchingTasks.map(t => ({ id: t.id, title: t.title })),
        isFallbackEngine: true
      };
    }

    const target = matchingTasks[0];
    return {
      intent: 'complete_task',
      actionSummary: `Marked "${target.title}" as completed`,
      data: { taskId: target.id, taskTitle: target.title },
      isFallbackEngine: true
    };
  }

  // 3. UPDATE / MOVE TASK INTENT
  if (lower.startsWith('move') || lower.includes('reschedule') || lower.includes('postpone')) {
    const proposalTasks = existingTasks.filter(t => lower.includes('proposal') && t.title.toLowerCase().includes('proposal'));
    if (proposalTasks.length > 1) {
      return {
        intent: 'clarify',
        actionSummary: 'Multiple proposal tasks detected',
        clarificationQuestion: 'Which proposal task would you like me to move?',
        options: proposalTasks.map(t => ({ id: t.id, title: t.title })),
        isFallbackEngine: true
      };
    }

    // Search for single match or default match
    const matching = existingTasks.find(t => 
      lower.includes(t.title.toLowerCase()) || 
      t.title.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w))
    );

    const targetDate = lower.includes('friday') ? fridayStr : lower.includes('tomorrow') ? tomorrowStr : fridayStr;
    const dateLabel = lower.includes('friday') ? 'Friday' : 'tomorrow';

    if (matching) {
      return {
        intent: 'update_task',
        actionSummary: `Moved "${matching.title}" to ${dateLabel} (${targetDate})`,
        data: { taskId: matching.id, taskTitle: matching.title, updates: { dueDate: targetDate } },
        isFallbackEngine: true
      };
    }
  }

  // 4. SUMMARIZE / MORNING BRIEFING / WHAT SHOULD I FOCUS ON INTENT
  if (lower.includes('morning briefing') || lower.includes('what\'s important today') || lower.includes('what is important today') || lower.includes('important today') || lower.includes('what should i focus on today') || lower.includes('summarize my day') || lower.includes('what do i need to do') || lower.includes('daily briefing') || lower.includes('summary')) {
    return {
      intent: 'summarize_tasks',
      actionSummary: 'Generated Executive Daily AI Briefing',
      data: { scope: 'today' },
      isFallbackEngine: true
    };
  }

  if (lower.includes('overdue')) {
    return {
      intent: 'list_tasks',
      actionSummary: 'Filtered overdue tasks',
      data: { filter: 'overdue' },
      isFallbackEngine: true
    };
  }

  // 5. CREATE TASK INTENT (Default natural language extraction)
  // Extract Time
  let dueTime = "10:00 AM";
  const timeMatch = prompt.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i) || 
                    prompt.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (timeMatch) {
    let tStr = timeMatch[1].toUpperCase().trim();
    if (!tStr.includes('AM') && !tStr.includes('PM')) {
      tStr += " AM";
    }
    dueTime = tStr;
  }

  // Extract Date
  let dueDate = todayStr;
  if (/\btomorrow\b/i.test(prompt)) {
    dueDate = tomorrowStr;
  } else if (/\bfriday\b/i.test(prompt)) {
    dueDate = fridayStr;
  } else if (/\btoday\b/i.test(prompt) || /\btonight\b/i.test(prompt)) {
    dueDate = todayStr;
  }

  // Extract Priority - check if explicitly provided in request
  let explicitPriority: string | null = null;
  if (/\b(urgent|asap|critical|immediately)\b/i.test(lower)) {
    explicitPriority = "Urgent";
  } else if (/\b(high priority|high-priority|important)\b/i.test(lower) || /\bwith high priority\b/i.test(lower)) {
    explicitPriority = "High";
  } else if (/\b(medium priority|medium-priority)\b/i.test(lower) || /\bwith medium priority\b/i.test(lower)) {
    explicitPriority = "Medium";
  } else if (/\b(low priority|low-priority)\b/i.test(lower) || /\bwith low priority\b/i.test(lower)) {
    explicitPriority = "Low";
  }

  // Extract Category
  let category = "General";
  if (/\b(dubai|client|leads|lead)\b/i.test(lower)) {
    category = "Clients";
  } else if (/\b(presentation|board|cfo|executive)\b/i.test(lower)) {
    category = "Executive";
  } else if (/\b(proposal|strategy)\b/i.test(lower)) {
    category = "Strategy";
  }

  // Clean Task Title
  let taskTitle = prompt;

  // 1. Remove command prefixes
  taskTitle = taskTitle.replace(/^(remind me|create task|create a task|add task|add a task|schedule task|schedule a task)\b\s*/i, '');

  // 2. Remove date phrases using word boundaries
  taskTitle = taskTitle
    .replace(/\bby tomorrow\b/gi, '')
    .replace(/\bby friday\b/gi, '')
    .replace(/\bby monday\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .replace(/\btoday\b/gi, '')
    .replace(/\btonight\b/gi, '')
    .replace(/\bnext week\b/gi, '');

  // 3. Remove time phrases
  taskTitle = taskTitle
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');

  // 4. Remove explicitly stated priority phrases
  taskTitle = taskTitle
    .replace(/\bwith high priority\b/gi, '')
    .replace(/\bhigh priority\b/gi, '')
    .replace(/\bwith medium priority\b/gi, '')
    .replace(/\bmedium priority\b/gi, '')
    .replace(/\bwith low priority\b/gi, '')
    .replace(/\blow priority\b/gi, '')
    .replace(/\burgent\b/gi, '')
    .replace(/\basap\b/gi, '')
    .replace(/\bimportant\b/gi, '');

  // 5. Clean leading prepositions ("to ", "for ", "at ") and excess spaces
  taskTitle = taskTitle
    .replace(/^\s*(to|for|at|on)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 6. Capitalize title cleanly
  if (taskTitle.length > 0) {
    taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);
  } else {
    taskTitle = "Executive Action Item";
  }

  const pendingTaskData = {
    title: taskTitle,
    dueDate,
    dueTime,
    category,
    status: "To Do"
  };

  // If priority was NOT explicitly provided, ask for priority before saving task!
  if (!explicitPriority) {
    const dateLabel = dueDate === todayStr ? 'Today' : 'Tomorrow';
    return {
      intent: 'clarify_priority' as any,
      actionSummary: `Task details extracted for "${taskTitle}". Awaiting priority decision.`,
      clarificationQuestion: `I have the task details:\n• ${taskTitle}\n• ${dateLabel} at ${dueTime}\n\nWhat priority should I set?`,
      options: [
        { id: 'Urgent', title: 'Urgent' },
        { id: 'High', title: 'High' },
        { id: 'Medium', title: 'Medium' },
        { id: 'Low', title: 'Low' }
      ],
      data: {
        pendingTask: pendingTaskData
      },
      isFallbackEngine: true
    };
  }

  return {
    intent: 'create_task',
    actionSummary: `Created task "${taskTitle}" for ${dueDate === todayStr ? 'Today' : 'Tomorrow'} at ${dueTime} [Priority: ${explicitPriority}]`,
    data: {
      ...pendingTaskData,
      priority: explicitPriority
    },
    isFallbackEngine: true
  };
}


