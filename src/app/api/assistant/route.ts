import { NextResponse } from 'next/server';
import { getTasks, createTask, updateTask, deleteTask, createEmailDraft, createMemory, getMemories, deleteMemory, getRelevantMemories, createReminder, getReminders, deleteReminder } from '@/lib/taskStore';
import { generateDailyBriefing } from '@/lib/briefingService';
import { parseNaturalLanguageRequest, AIActionResponse } from '@/lib/aiActionParser';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, selectedOptionId, pendingTask, selectedPriority } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Valid prompt is required' }, { status: 400 });
    }

    const currentTasks = await getTasks();

    // Handle priority selection for pending task (e.g. user selected "High", "Urgent", "Medium", "Low")
    if (pendingTask && (selectedPriority || selectedOptionId)) {
      const priorityChoice = selectedPriority || selectedOptionId;
      const validPriorities = ['Urgent', 'High', 'Medium', 'Low'];
      if (validPriorities.includes(priorityChoice)) {
        const created = await createTask({
          title: pendingTask.title,
          dueDate: pendingTask.dueDate,
          dueTime: pendingTask.dueTime,
          category: pendingTask.category,
          priority: priorityChoice,
          status: 'To Do'
        });

        const allTasks = await getTasks();
        return NextResponse.json({
          success: true,
          intent: 'create_task',
          message: `Done. I've created the task with ${created.priority} priority.`,
          actionSummary: `Created task "${created.title}" with ${created.priority} priority`,
          tasks: allTasks,
          isFallbackEngine: true
        });
      }
    }

    // Handle clarification choice option if user selected a specific memory or task to remove/update
    if (selectedOptionId && !pendingTask) {
      // Check if selectedOptionId is a reminder
      const allReminders = await getReminders('all');
      const targetReminder = allReminders.find(r => r.id === selectedOptionId);
      if (targetReminder) {
        await deleteReminder(targetReminder.id);
        return NextResponse.json({
          success: true,
          intent: 'cancel_reminder',
          message: `Done. I have cancelled the reminder: "${targetReminder.title}".`,
          actionSummary: `Deleted reminder "${targetReminder.title}"`,
          isFallbackEngine: true
        });
      }

      if (prompt.toLowerCase().includes('forget') || prompt.toLowerCase().includes('remove') || prompt.toLowerCase().includes('delete')) {
        await deleteMemory(selectedOptionId);
        return NextResponse.json({
          success: true,
          intent: 'forget_memory',
          message: `Done. I have removed the selected memory.`,
          actionSummary: `Deleted memory ${selectedOptionId}`,
          isFallbackEngine: true
        });
      }
      const targetTask = currentTasks.find(t => t.id === selectedOptionId);
      if (targetTask) {
        if (prompt.toLowerCase().includes('complete') || prompt.toLowerCase().includes('mark')) {
          const updated = await updateTask(targetTask.id, { status: 'Completed' });
          const allTasks = await getTasks();
          return NextResponse.json({
            success: true,
            intent: 'complete_task',
            message: `Completed "${targetTask.title}".`,
            actionSummary: `Marked "${targetTask.title}" as completed`,
            tasks: allTasks,
            isFallbackEngine: true
          });
        } else if (prompt.toLowerCase().includes('move') || prompt.toLowerCase().includes('reschedule')) {
          const fridayStr = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
          await updateTask(targetTask.id, { dueDate: fridayStr });
          const allTasks = await getTasks();
          return NextResponse.json({
            success: true,
            intent: 'update_task',
            message: `Rescheduled "${targetTask.title}" to Friday.`,
            actionSummary: `Moved "${targetTask.title}" to Friday`,
            tasks: allTasks,
            isFallbackEngine: true
          });
        }
      }
    }

    // Parse natural language request
    const parsedAction: AIActionResponse = parseNaturalLanguageRequest(prompt, currentTasks);

    // SERVER-SIDE VALIDATION & EXECUTION LAYER
    let executionMessage = "";
    let updatedTaskList = currentTasks;
    let extraData = parsedAction.data;

    switch (parsedAction.intent as string) {
      case 'create_reminder':
        const newReminder = await createReminder({
          title: parsedAction.data.title,
          reminderTime: parsedAction.data.reminderTime,
          taskId: parsedAction.data.taskId
        });
        const rDateObj = new Date(newReminder.reminderTime);
        const formattedDate = rDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const formattedTime = rDateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        executionMessage = `I've set a reminder for ${formattedDate} at ${formattedTime}: "${newReminder.title}".`;
        extraData = { ...extraData, reminder: newReminder };
        break;

      case 'list_reminders':
        const reminderFilter = parsedAction.data?.filter || 'all';
        const fetchedReminders = await getReminders(reminderFilter as any);
        const activeReminders = fetchedReminders.filter(r => !r.triggered);
        if (activeReminders.length > 0) {
          const listStr = activeReminders.map(r => {
            const dt = new Date(r.reminderTime);
            return `• ${r.title} — ${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
          }).join('\n');
          executionMessage = `Here are your ${reminderFilter === 'today' ? "today's" : reminderFilter === 'upcoming' ? "upcoming" : ""} active reminders:\n${listStr}`;
        } else {
          executionMessage = `You have no active reminders scheduled${reminderFilter === 'today' ? " for today" : ""}.`;
        }
        extraData = { ...extraData, reminders: activeReminders };
        break;

      case 'cancel_reminder':
        const remQuery = (parsedAction.data?.query || '').toLowerCase();
        const allActiveReminders = (await getReminders('all')).filter(r => !r.triggered);
        
        let matchingReminders = allActiveReminders.filter(r => 
          r.title.toLowerCase().includes(remQuery) || 
          remQuery.includes(r.title.toLowerCase())
        );

        if (matchingReminders.length === 0 && remQuery) {
          // Fallback search
          const words = remQuery.split(' ').filter((w: string) => w.length > 2);
          matchingReminders = allActiveReminders.filter(r => 
            words.some((w: string) => r.title.toLowerCase().includes(w))
          );
        }

        if (matchingReminders.length === 1) {
          const targetRem = matchingReminders[0];
          await deleteReminder(targetRem.id);
          executionMessage = `I have cancelled your reminder: "${targetRem.title}".`;
        } else if (matchingReminders.length > 1) {
          executionMessage = `I found ${matchingReminders.length} reminders matching "${parsedAction.data?.query}". Which reminder would you like to cancel?`;
          parsedAction.options = matchingReminders.map(r => {
            const dt = new Date(r.reminderTime);
            return {
              id: r.id,
              title: `${r.title} (${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})`
            };
          });
        } else {
          executionMessage = `I couldn't find any active reminder matching "${parsedAction.data?.query}".`;
        }
        break;

      case 'save_memory':
        const savedMem = await createMemory({
          key: parsedAction.data.key,
          value: parsedAction.data.value,
          category: parsedAction.data.category
        });
        executionMessage = `I've saved this preference to your Executive Memory: "${savedMem.key}: ${savedMem.value}".`;
        break;

      case 'forget_memory':
        const targetQuery = (parsedAction.data?.targetQuery || '').toLowerCase();
        const allMems = await getMemories();
        const matchingMems = allMems.filter(m => 
          m.key.toLowerCase().includes(targetQuery) || 
          m.value.toLowerCase().includes(targetQuery) ||
          targetQuery.includes(m.key.toLowerCase()) ||
          targetQuery.includes(m.value.toLowerCase())
        );

        if (matchingMems.length === 1) {
          const toDelete = matchingMems[0];
          await deleteMemory(toDelete.id);
          executionMessage = `I've removed the memory: "${toDelete.key}: ${toDelete.value}".`;
        } else if (matchingMems.length > 1) {
          executionMessage = `I found ${matchingMems.length} memories related to "${parsedAction.data?.targetQuery}". Which one should I remove?`;
          parsedAction.options = matchingMems.map(m => ({ id: m.id, title: `${m.key}: ${m.value}` }));
        } else {
          executionMessage = `I couldn't find any saved memory matching "${parsedAction.data?.targetQuery}".`;
        }
        break;

      case 'list_memories':
        const queryTerm = parsedAction.data?.queryTerm || '';
        const relevantMems = await getRelevantMemories(prompt);
        if (relevantMems.length > 0) {
          const memList = relevantMems.map(m => `• ${m.key}: ${m.value} [${m.category}]`).join('\n');
          executionMessage = `Here is what I remember regarding "${queryTerm || 'your preferences'}":\n${memList}`;
        } else {
          executionMessage = `I don't have any relevant memories saved regarding "${queryTerm || 'your request'}".`;
        }
        break;

      case 'create_calendar_event':
        if (!parsedAction.data?.title || !parsedAction.data?.startTime) {
          return NextResponse.json({
            success: false,
            error: 'Server validation error: Meeting title or start time missing'
          }, { status: 422 });
        }
        const { createCalendarEvent: createEvt } = await import('@/lib/calendarService');
        const createdEvt = await createEvt({
          title: parsedAction.data.title,
          date: parsedAction.data.date,
          startTime: parsedAction.data.startTime,
          location: parsedAction.data.location || "Executive Suite",
          category: parsedAction.data.category || "Meeting"
        });
        executionMessage = `I have scheduled "${createdEvt.title}" for ${parsedAction.data.date} at ${parsedAction.data.startTime}.`;
        break;

      case 'clarify_priority':
        // Do NOT save task yet! Return clarification prompt and pending task context
        executionMessage = parsedAction.clarificationQuestion || "What priority should I set for this task?";
        break;

      case 'create_task':
        if (!parsedAction.data?.title) {
          return NextResponse.json({
            success: false,
            error: 'Server validation error: Task title missing'
          }, { status: 422 });
        }
        const created = await createTask({
          title: parsedAction.data.title,
          dueDate: parsedAction.data.dueDate,
          dueTime: parsedAction.data.dueTime,
          priority: parsedAction.data.priority,
          category: parsedAction.data.category,
          status: "To Do"
        });
        updatedTaskList = await getTasks();
        executionMessage = `I have added "${created.title}" to your tasks for ${created.dueDate} at ${created.dueTime} [Priority: ${created.priority}].`;
        break;

      case 'complete_task':
        if (parsedAction.data?.taskId) {
          await updateTask(parsedAction.data.taskId, { status: 'Completed' });
          updatedTaskList = await getTasks();
          executionMessage = `Successfully marked "${parsedAction.data.taskTitle}" as completed.`;
        }
        break;

      case 'update_task':
        if (parsedAction.data?.taskId) {
          await updateTask(parsedAction.data.taskId, parsedAction.data.updates);
          updatedTaskList = await getTasks();
          executionMessage = `Updated "${parsedAction.data.taskTitle}". ${parsedAction.actionSummary}.`;
        }
        break;

      case 'draft_email':
        // Retrieve relevant memories for this email request
        const relevantEmailMemories = await getRelevantMemories(prompt);
        let finalBody = parsedAction.data.body || '';

        // Check if a concise email preference memory applies
        const concisePref = relevantEmailMemories.find(m => 
          m.category.toLowerCase() === 'communication' || 
          m.value.toLowerCase().includes('concise') || 
          m.key.toLowerCase().includes('email')
        );

        if (concisePref) {
          const recipientName = parsedAction.data.recipient ? parsedAction.data.recipient.split(' ')[0] : 'John';
          finalBody = `Hi ${recipientName},\n\nFollowing up on the client proposal update.\n\nPlease share the latest status and timeline at your earliest convenience.\n\nBest regards,\nPuneet`;
        }

        const draft = await createEmailDraft({
          recipient: parsedAction.data.recipient || '',
          subject: parsedAction.data.subject || 'Executive Update',
          body: finalBody,
          status: 'Draft'
        });
        extraData = { ...extraData, draftId: draft.id, draft, appliedMemories: relevantEmailMemories };
        executionMessage = `Email draft created. ${concisePref ? `(Applied Executive Memory: "${concisePref.key}")` : ''}`;
        break;

      case 'summarize_tasks':
        const briefingData = await generateDailyBriefing();
        executionMessage = briefingData.formattedMarkdown;
        extraData = { ...extraData, briefing: briefingData };
        break;

      case 'clarify':
        executionMessage = parsedAction.clarificationQuestion || "Could you specify which item you meant?";
        break;

      default:
        executionMessage = `I have analyzed your request. ${parsedAction.actionSummary}`;
        break;
    }

    return NextResponse.json({
      success: true,
      intent: parsedAction.intent,
      message: executionMessage,
      actionSummary: parsedAction.actionSummary,
      clarificationQuestion: parsedAction.clarificationQuestion,
      options: parsedAction.options,
      requiresConfirmation: parsedAction.requiresConfirmation,
      confirmationMessage: parsedAction.confirmationMessage,
      data: extraData,
      tasks: updatedTaskList,
      isFallbackEngine: parsedAction.isFallbackEngine
    });


  } catch (err: any) {
    console.error("API Assistant route error:", err);
    return NextResponse.json({
      error: 'An internal server error occurred processing your request',
      details: err.message
    }, { status: 500 });
  }
}
