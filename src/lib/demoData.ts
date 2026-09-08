export const initialDemoTasks = [
  {
    id: "task-1",
    title: "Follow up with Dubai leads",
    description: "Connect with Tariq regarding the commercial terms for Q4 expansion in the GCC region.",
    status: "To Do",
    priority: "High",
    dueDate: new Date().toISOString().split('T')[0], // Today
    dueTime: "10:00 AM",
    category: "Clients",
    notes: "Lead score is 92/100. High intent for enterprise package.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-2",
    title: "Review client proposal for Apex Holdings",
    description: "Verify financial modeling slides and SLA commitments before sending to board.",
    status: "To Do",
    priority: "High",
    dueDate: new Date().toISOString().split('T')[0], // Today
    dueTime: "01:00 PM",
    category: "Strategy",
    notes: "Check section 4.2 for margin calculation accuracy.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-3",
    title: "Prepare Q4 campaign roadmap",
    description: "Align with growth team lead on budget allocation across EMEA and APAC.",
    status: "In Progress",
    priority: "Medium",
    dueDate: new Date().toISOString().split('T')[0], // Today
    dueTime: "04:00 PM",
    category: "Operations",
    notes: "Total target budget allocation $120k.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-4",
    title: "Finalize Board Presentation Deck",
    description: "Complete key metrics summary, ARR growth charts, and hiring targets.",
    status: "To Do",
    priority: "Urgent",
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    dueTime: "09:00 AM",
    category: "Executive",
    notes: "Need final numbers from finance by 6 PM today.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-5",
    title: "TechCorp Contract Renewal Review",
    description: "Review legal terms and SLA penalties for upcoming multi-year renewal.",
    status: "To Do",
    priority: "Urgent",
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday (Overdue)
    dueTime: "11:00 AM",
    category: "Clients",
    notes: "Overdue action item - reach out to general counsel.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-6",
    title: "Quarterly Revenue Audit with CFO",
    description: "Reviewed preliminary performance figures and operational expenditure.",
    status: "Completed",
    priority: "Medium",
    dueDate: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    dueTime: "02:30 PM",
    category: "Executive",
    notes: "Approved Q3 variance report.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialDemoCalendarEvents = [
  {
    id: "evt-1",
    title: "Dubai Client Follow-up Call",
    description: "Video call with Tariq Al-Mansoor regarding Q4 rollout",
    location: "Google Meet / Executive Room 4",
    startTime: `${new Date().toISOString().split('T')[0]}T10:00:00`,
    endTime: `${new Date().toISOString().split('T')[0]}T10:30:00`,
    isAllDay: false,
    category: "Client Meeting"
  },
  {
    id: "evt-2",
    title: "Executive Team Alignment",
    description: "Weekly sync with VP Product & Engineering",
    location: "Boardroom A",
    startTime: `${new Date().toISOString().split('T')[0]}T11:30:00`,
    endTime: `${new Date().toISOString().split('T')[0]}T12:30:00`,
    isAllDay: false,
    category: "Internal Sync"
  },
  {
    id: "evt-3",
    title: "Investor Partnership Discussion",
    description: "Strategic investment opportunity review",
    location: "Executive Suite",
    startTime: `${new Date().toISOString().split('T')[0]}T15:00:00`,
    endTime: `${new Date().toISOString().split('T')[0]}T16:00:00`,
    isAllDay: false,
    category: "Investor Relations"
  }
];

export const initialDemoEmailDrafts = [
  {
    id: "email-1",
    recipient: "Tariq Al-Mansoor <tariq@dubaiholdings.ae>",
    subject: "Proposal Follow-up & Commercial Terms Discussion",
    body: `Hi Tariq,\n\nThank you for taking the time to speak with our team yesterday.\n\nFollowing up on our discussion regarding the Q4 rollout in Dubai, I wanted to confirm that we have updated the commercial proposal with the customized service level agreements we discussed.\n\nPlease let me know if you would like to schedule a quick 15-minute call today at 10 AM to finalize the details.\n\nBest regards,\nPuneet`,
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialDemoMemories = [
  {
    id: "mem-1",
    key: "Meeting Duration Preference",
    value: "Prefers 30-minute maximum duration for external client calls.",
    category: "Preference",
    createdAt: new Date().toISOString()
  },
  {
    id: "mem-2",
    key: "Top Strategic Focus",
    value: "GCC & Dubai regional growth drive for Q4 enterprise partnerships.",
    category: "Context",
    createdAt: new Date().toISOString()
  },
  {
    id: "mem-3",
    key: "Friday Policy",
    value: "No external meetings or non-urgent calls scheduled after 2 PM on Fridays.",
    category: "Directive",
    createdAt: new Date().toISOString()
  }
];
