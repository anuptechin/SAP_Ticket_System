// Paid add-on modules. Each is OFF unless the license key lists its id in `addons`.
// The catalogue is shown to admins (Add-on modules page) so they can see what is available.
export const ADDONS = [
  { id: 'sla', name: 'SLA Management', icon: 'clock', tagline: 'Service levels that match your contracts.',
    features: ['SLA policies by priority, SAP module or category', 'Business hours, weekends and holiday calendars', 'SLA paused while waiting on the requester', 'Breach warnings before the deadline', 'SLA compliance reports by team and module'] },
  { id: 'escalation', name: 'Escalation Matrix', icon: 'up', tagline: 'Nothing critical sits unnoticed.',
    features: ['Escalation levels L1 → L2 → L3 / vendor manager', 'Rules by SAP module and priority', 'Automatic time-based escalation emails', 'Escalation history on every ticket', 'Escalation report for management reviews'] },
  { id: 'analytics', name: 'Analytics & Reports', icon: 'rep', tagline: 'See where time and effort go.',
    features: ['Ticket volume by module, category and requester', 'Average response and resolution times', 'Agent and team workload', 'Scheduled weekly / monthly email reports', 'Excel export of any view'] },
  { id: 'kb', name: 'Knowledge Base', icon: 'book', tagline: 'Solve a problem once, reuse the fix.',
    features: ['Resolution notes become searchable articles', 'Similar solved tickets suggested to the agent', 'Articles by SAP module and transaction', 'Internal and requester-facing articles'] },
  { id: 'cr', name: 'Change Request Workflow', icon: 'flow', tagline: 'Controlled SAP changes, end to end.',
    features: ['Approval chain: business owner → IT head', 'Transport tracking DEV → QAS → PRD', 'UAT sign-off by the requester', 'Change calendar and audit trail'] },
  { id: 'csat', name: 'Customer Satisfaction', icon: 'star', tagline: 'Know how requesters feel.',
    features: ['Rating email on closure (1–5 stars + comment)', 'CSAT by agent, team and module', 'Low ratings flagged for follow-up'] },
  { id: 'autoassign', name: 'Smart Auto-Assignment', icon: 'users', tagline: 'The right consultant, automatically.',
    features: ['Round-robin within the module team', 'Workload-based balancing', 'Skills by SAP module and component', 'Shift roster and leave awareness'] },
  { id: 'alerts', name: 'Teams & WhatsApp Alerts', icon: 'bell', tagline: 'P1s reach people where they are.',
    features: ['P1 and SLA-breach alerts to a Microsoft Teams channel', 'WhatsApp alerts to on-call consultants', 'Configurable quiet hours'] },
];
export const ADDON_IDS = ADDONS.map(a => a.id);
