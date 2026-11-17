// SAP module taxonomy — the single source of truth for categorisation.
// Used to build Claude's system prompt, the JSON schema enum, routing, the rules fallback and the UI.

export const GROUPS = [
  { id: 'fin',  name: 'Finance',                        color: '#5B5CF6' },
  { id: 'log',  name: 'Logistics & Supply Chain',       color: '#10B489' },
  { id: 'hr',   name: 'Human Capital',                  color: '#F07B2E' },
  { id: 'tech', name: 'Technology, Basis & Security',   color: '#A64DF4' },
  { id: 'int',  name: 'Integration',                    color: '#FF5F8A' },
  { id: 'ana',  name: 'Analytics & Reporting',          color: '#22B8E0' },
  { id: 'cx',   name: 'Customer, Supplier & Master Data', color: '#D9860B' },
];

// kw: lowercase regex sources used only by the offline rules engine.
export const MODULES = [
  // ---------- Finance ----------
  { code: 'FI', name: 'Financial Accounting', group: 'fin', team: 'SAP FI/CO Team',
    components: ['General Ledger', 'Accounts Payable', 'Accounts Receivable', 'Bank Accounting', 'Tax / GST / e-Invoice', 'Period-End Close'],
    tcodes: ['FB50', 'FB60', 'FB70', 'F110', 'FBL1N', 'FBL3N', 'FBL5N', 'F-02', 'FF_5', 'FAGLB03', 'OB52'],
    kw: ['\\bf110\\b', 'payment run', 'general ledger|\\bgl\\b', 'vendor payment', '\\bfb\\d\\d\\b|\\bfbl\\dn\\b', '\\bgst\\b|e-?invoice|\\birn\\b|\\btds\\b', 'bank (statement|reconciliation|file)|dmee', 'posting period|ob52', 'journal entry|\\bjv\\b', 'credit note|debit note'] },
  { code: 'FI-AA', name: 'Asset Accounting', group: 'fin', team: 'SAP FI/CO Team',
    components: ['Asset Master', 'Depreciation', 'Asset Acquisition / Retirement', 'Asset Transfer', 'Year-End'],
    tcodes: ['AS01', 'AS02', 'AW01N', 'AFAB', 'ABUMN', 'F-90'],
    kw: ['fixed asset', 'depreciation|\\bafab\\b', '\\bas0\\d\\b|aw01n', 'capitali[sz]', 'asset (retirement|transfer|class)'] },
  { code: 'CO', name: 'Controlling', group: 'fin', team: 'SAP FI/CO Team',
    components: ['Cost Center Accounting', 'Profit Center Accounting', 'Internal Orders', 'Product Costing', 'Profitability Analysis (CO-PA)'],
    tcodes: ['KS01', 'KS03', 'KSB1', 'KE30', 'CK11N', 'KO88', 'KSU5'],
    kw: ['cost cent', 'profit cent', '\\bks0\\d\\b|ksb1', 'internal order|\\bko88\\b', 'product cost|ck11n|cost estimate', 'co-?pa|ke30|profitability', 'assessment cycle|settlement'] },
  { code: 'TR', name: 'Treasury & Cash Management', group: 'fin', team: 'SAP FI/CO Team',
    components: ['Cash Management', 'Bank Communication', 'Liquidity Forecast', 'In-House Cash'],
    tcodes: ['FF7A', 'FF7B', 'FTE_BSM'],
    kw: ['cash position|liquidity', '\\bff7[ab]\\b', 'treasury', 'bank communication'] },
  { code: 'FSCM', name: 'Credit, Collections & Dispute', group: 'fin', team: 'SAP FI/CO Team',
    components: ['Credit Management', 'Collections Management', 'Dispute Management'],
    tcodes: ['UKM_BP', 'UDM_DISPUTE', 'FSCM_CR'],
    kw: ['credit (limit|exposure|block)|ukm_bp', 'collection', 'dispute case'] },

  // ---------- Logistics ----------
  { code: 'MM', name: 'Materials Management', group: 'log', team: 'SAP Logistics Team',
    components: ['Purchasing', 'Inventory Management', 'Invoice Verification', 'Material Master', 'Release Strategy', 'Vendor Evaluation'],
    tcodes: ['ME21N', 'ME23N', 'ME2N', 'MIGO', 'MIRO', 'MMBE', 'MB52', 'MM01', 'MM02', 'ME29N', 'MB1B'],
    kw: ['\\bmigo\\b', 'purchase order|\\bpo\\b', '\\bgrn\\b|goods receipt', '\\bme2\\dn\\b|\\bme\\d\\dn\\b', '\\bmiro\\b|invoice verification', '\\bmmbe\\b|\\bmb52\\b|\\bmb1b\\b', 'material master|\\bmm0\\d\\b', 'storage location', 'release strategy', 'purchase requisition|\\bpr\\b', 'stock (transfer|mismatch)'] },
  { code: 'SD', name: 'Sales & Distribution', group: 'log', team: 'SAP Logistics Team',
    components: ['Sales Order', 'Pricing', 'Billing', 'Shipping & Delivery', 'Output Determination', 'Returns'],
    tcodes: ['VA01', 'VA02', 'VA03', 'VL01N', 'VF01', 'VF02', 'VF11', 'VK11', 'VKM3'],
    kw: ['sales order|\\bva0\\d\\b', 'billing|\\bvf\\d\\d\\b', 'delivery|\\bvl0\\dn\\b', 'pricing|condition type|\\bvk1\\d\\b', 'customer (order|invoice)', 'dispatch', 'sales org', 'returns order'] },
  { code: 'PP', name: 'Production Planning', group: 'log', team: 'SAP Logistics Team',
    components: ['MRP', 'Production Orders', 'BOM & Routing', 'Capacity Planning', 'Repetitive Manufacturing'],
    tcodes: ['MD01N', 'MD04', 'CO01', 'CO02', 'CO11N', 'CS01', 'CA01'],
    kw: ['\\bmrp\\b|md01n|\\bmd04\\b', 'production order|\\bco0\\d\\b|co11n', '\\bbom\\b|\\bcs0\\d\\b', 'routing', 'planned order', 'confirmation'] },
  { code: 'QM', name: 'Quality Management', group: 'log', team: 'SAP Logistics Team',
    components: ['Inspection Lots', 'Quality Notifications', 'Results Recording', 'Certificates'],
    tcodes: ['QA32', 'QA11', 'QE51N', 'QM01'],
    kw: ['inspection lot|qa32|qa11', 'quality (notification|inspection)', 'usage decision', 'results recording'] },
  { code: 'PM', name: 'Plant Maintenance', group: 'log', team: 'SAP Logistics Team',
    components: ['Maintenance Orders', 'Notifications', 'Equipment & Functional Location', 'Preventive Maintenance'],
    tcodes: ['IW31', 'IW32', 'IW21', 'IE01', 'IP10'],
    kw: ['maintenance (order|plan)|iw3\\d', 'breakdown', 'equipment|functional location', '\\biw2\\d\\b'] },
  { code: 'EWM', name: 'Warehouse Management (WM / EWM)', group: 'log', team: 'SAP Logistics Team',
    components: ['Inbound', 'Outbound / Picking', 'Bins & Storage Types', 'RF / Handhelds', 'Physical Inventory'],
    tcodes: ['/SCWM/MON', 'LT01', 'LT12', 'LS01N'],
    kw: ['warehouse|\\bewm\\b', 'storage bin|\\bbin\\b', 'putaway|picking', '\\brf (gun|device|scanner)', '/scwm/|\\blt\\d\\d\\b', 'transfer order'] },
  { code: 'TM', name: 'Transportation Management', group: 'log', team: 'SAP Logistics Team',
    components: ['Freight Orders', 'Shipments', 'Freight Cost'],
    tcodes: ['VT01N', 'VI01'],
    kw: ['shipment|vt01n', 'freight', 'transporter|carrier'] },
  { code: 'PS', name: 'Project System', group: 'log', team: 'SAP Logistics Team',
    components: ['WBS', 'Networks', 'Project Budget'],
    tcodes: ['CJ20N', 'CJ30', 'CJI3'],
    kw: ['\\bwbs\\b', 'cj20n|cji3', 'project budget'] },

  // ---------- Human Capital ----------
  { code: 'HCM', name: 'Human Capital Management (on-prem)', group: 'hr', team: 'SAP HCM Team',
    components: ['Personnel Administration', 'Organizational Management', 'Time Management', 'Payroll', 'Payroll Posting to FI'],
    tcodes: ['PA20', 'PA30', 'PA40', 'PC00_M40_CALC', 'PT60'],
    kw: ['payroll', '\\bpa[234]0\\b', 'employee', 'time (evaluation|management)|attendance', 'wage type', 'infotype'] },
  { code: 'SF', name: 'SuccessFactors', group: 'hr', team: 'SAP HCM Team',
    components: ['Employee Central', 'Recruiting', 'Performance & Goals', 'Learning'],
    tcodes: [],
    kw: ['successfactors|\\bsf\\b', 'employee central', 'performance review'] },

  // ---------- Technology ----------
  { code: 'BASIS', name: 'Basis & System Administration', group: 'tech', team: 'Basis & Infrastructure',
    components: ['Performance', 'Transports', 'Background Jobs', 'Printing / Spool', 'System Availability', 'Client Admin'],
    tcodes: ['SM37', 'SM50', 'SM21', 'ST03', 'ST22', 'STMS', 'SPAD', 'SP01'],
    kw: ['\\bslow\\b|performance|response time', '\\btransport\\b|stms', '\\bsm\\d\\d\\b|background job', '\\bst0\\d\\b', 'printer|spool|spad', 'system (down|unavailable)', 'sap gui'] },
  { code: 'SEC', name: 'Security, Authorizations & GRC', group: 'tech', team: 'Basis & Infrastructure',
    components: ['User Administration', 'Roles & Authorizations', 'Password / Lock', 'GRC Access Control', 'Firefighter'],
    tcodes: ['SU01', 'SU53', 'PFCG', 'SUIM', 'GRAC_REQ'],
    kw: ['\\brole\\b|pfcg', 'authori[sz]ation|su53|no authority', 'password|unlock|locked', 'user (id|creation)|\\bsu01\\b', '\\bgrc\\b|firefighter|access request'] },
  { code: 'ABAP', name: 'ABAP Development', group: 'tech', team: 'Development Team',
    components: ['Custom Reports', 'Forms (Smartforms / Adobe)', 'Enhancements & BAdIs', 'Short Dumps', 'Workflow'],
    tcodes: ['SE38', 'SE80', 'ST22', 'SMARTFORMS', 'SFP', 'SWI1'],
    kw: ['short dump|\\bdump\\b|st22', 'smartform|adobe form', '\\bz[a-z][a-z0-9_]{3,}\\b', 'custom (report|program)', 'enhancement|badi|user exit', 'workflow'] },
  { code: 'FIORI', name: 'Fiori / UI5', group: 'tech', team: 'Development Team',
    components: ['Launchpad', 'Tiles & Catalogs', 'Custom UI5 Apps', 'Gateway / OData'],
    tcodes: ['/UI2/FLP', '/IWFND/MAINT_SERVICE', '/IWFND/ERROR_LOG'],
    kw: ['fiori|launchpad|\\btile\\b', 'ui5', 'odata|gateway|/iwfnd/'] },
  { code: 'HANA', name: 'HANA Database', group: 'tech', team: 'Basis & Infrastructure',
    components: ['Memory', 'Backup / Recovery', 'DB Performance'],
    tcodes: ['DBACOCKPIT'],
    kw: ['\\bhana\\b', 'database|\\bdb\\b', 'backup'] },
  { code: 'SOLMAN', name: 'Solution Manager / ChaRM', group: 'tech', team: 'Basis & Infrastructure',
    components: ['ChaRM', 'Monitoring', 'Test Suite'],
    tcodes: ['SM_WORKCENTER', 'SOLMAN_WORKCENTER'],
    kw: ['solman|solution manager', 'charm|change request management'] },

  // ---------- Integration ----------
  { code: 'PI/PO', name: 'Process Integration / Orchestration', group: 'int', team: 'Integration Team',
    components: ['Interfaces & Channels', 'Message Mapping', 'Adapter Engine', 'Message Monitoring'],
    tcodes: ['SXMB_MONI', 'SXI_MONITOR', 'SXMB_IFR'],
    kw: ['\\bpi/po\\b|\\bpi\\b|\\bpo\\b system|process integration', 'sxmb_moni|sxi_monitor', 'communication channel|adapter', 'message mapping', 'interface (failed|error|down)'] },
  { code: 'CPI', name: 'BTP Integration Suite (CPI)', group: 'int', team: 'Integration Team',
    components: ['iFlows', 'API Management', 'Event Mesh'],
    tcodes: [],
    kw: ['\\bcpi\\b|cloud platform integration|integration suite', 'iflow', '\\bbtp\\b', 'api management'] },
  { code: 'EDI', name: 'EDI & IDocs', group: 'int', team: 'Integration Team',
    components: ['Inbound IDocs', 'Outbound IDocs', 'Partner Profiles', 'EDI Mapping'],
    tcodes: ['WE02', 'WE05', 'WE19', 'BD87', 'WE20'],
    kw: ['\\bidoc\\b', '\\bwe0\\d\\b|bd87|we20', '\\bedi\\b', 'status 51|status 56|partner profile'] },

  // ---------- Analytics ----------
  { code: 'BW', name: 'BW / BI Reporting', group: 'ana', team: 'Analytics Team',
    components: ['Data Loads / Process Chains', 'Queries', 'BusinessObjects'],
    tcodes: ['RSA1', 'RSPC', 'RSRT'],
    kw: ['\\bbw\\b|\\bbi\\b', 'process chain|rspc', 'data load|rsa1', 'bex|query', 'businessobjects|\\bbo\\b report'] },
  { code: 'SAC', name: 'SAP Analytics Cloud', group: 'ana', team: 'Analytics Team',
    components: ['Stories / Dashboards', 'Planning', 'Live Connections'],
    tcodes: [],
    kw: ['analytics cloud|\\bsac\\b', 'story|dashboard'] },

  // ---------- Customer, Supplier & Master Data ----------
  { code: 'CRM', name: 'CRM / Sales Cloud', group: 'cx', team: 'CX Team',
    components: ['Leads & Opportunities', 'Service Tickets', 'Campaigns'],
    tcodes: [],
    kw: ['\\bcrm\\b', 'lead|opportunit', 'campaign'] },
  { code: 'ARIBA', name: 'Ariba / SRM', group: 'cx', team: 'Procurement Systems Team',
    components: ['Supplier Portal', 'Sourcing', 'Guided Buying', 'Supplier Invoicing'],
    tcodes: [],
    kw: ['ariba|\\bsrm\\b', 'supplier portal|guided buying', 'sourcing event|rfq'] },
  { code: 'MDG', name: 'Master Data Governance', group: 'cx', team: 'Master Data Team',
    components: ['Business Partner', 'Material Master Governance', 'Change Requests', 'Data Quality'],
    tcodes: ['BP', 'NWBC', 'MDG_BS_MAT'],
    kw: ['\\bmdg\\b|master data governance', 'business partner|\\bbp\\b', 'customer master|vendor master|supplier master', 'duplicate (customer|vendor|material)'] },
];

export const MODULE_CODES = MODULES.map(m => m.code);
export const UNKNOWN = 'UNKNOWN';
export const moduleByCode = code => MODULES.find(m => m.code === code);
export const groupOf = code => GROUPS.find(g => g.id === moduleByCode(code)?.group);

export const CATEGORIES = ['Incident', 'Change Request', 'Service Request', 'Query', 'Follow-up', 'Not SAP-related', 'Irrelevant'];
export const DECISIONS = ['create_ticket', 'update_existing', 'mark_duplicate', 'request_clarification', 'ignore', 'reject'];
export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
export const SLA_HOURS = { P1: 4, P2: 24, P3: 72, P4: 120 };          // resolution
export const RESPONSE_HOURS = { P1: 1, P2: 4, P3: 8, P4: 24 };       // first response

export function taxonomyForPrompt() {
  return GROUPS.map(g => {
    const mods = MODULES.filter(m => m.group === g.id).map(m =>
      `  - ${m.code} — ${m.name}\n    components: ${m.components.join('; ')}${m.tcodes.length ? `\n    typical t-codes: ${m.tcodes.join(', ')}` : ''}`).join('\n');
    return `${g.name}\n${mods}`;
  }).join('\n\n');
}
