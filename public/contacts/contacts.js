'use strict';

/* ---------------------------------------------------------------------------
 * Contacts Editor. Each contact (<set name="PCRContacts">) can hold one entry
 * per call system — DigitalCalls, MDCCalls, QuikCallIICalls — and the grid
 * shows the fields of each as "System/FIELD" columns.
 * ------------------------------------------------------------------------- */

// Friendly names for the call systems; any other <collection> is picked up too.
const SYSTEMS = {
  DigitalCalls: 'digital', MDCCalls: 'MDC', QuikCallIICalls: 'Quik-Call II',
  CapacityPlusCalls: 'Capacity Plus', PhoneCalls: 'phone',
};

const CONTACT_CFG = {
  subCollections: 'auto',
  // ContactName and the per-system call aliases all follow the contact name.
  aliasFields: /^ContactName$|ALIAS$/,
  // Derived fields, kept in sync by onSet below.
  hidden: /^ContactName$|ALIAS$|\/PeudoCallId$|\/CallType$/,
  labels: {
    'DigitalCalls/DU_CALLTYPE': 'Digital Call Type',
    'DigitalCalls/DU_CALLLSTID': 'Digital Call ID',
    'DigitalCalls/DU_RINGTYPE': 'Digital Ring Style',
    'DigitalCalls/DU_TXTMSGALTTNTP': 'Digital Text Msg Alert',
    'DigitalCalls/DU_RVRTPERS': 'Digital Revert Channel',
    'DigitalCalls/DU_RVRTPERS_Zone': 'Digital Revert Zone',
    'DigitalCalls/DU_ROUTETYPE': 'Digital Route Type',
    'CapacityPlusCalls/CAPPLUSUCL_CALLTYPE': 'Cap+ Call Type',
    'CapacityPlusCalls/CAPPLUSUCL_CALLLSTID': 'Cap+ Call ID',
    'CapacityPlusCalls/CAPPLUSUCL_ROUTETYPE': 'Cap+ Route Type',
    'CapacityPlusCalls/CAPPLUSUCL_RINGTYPE': 'Cap+ Ring Style',
    'CapacityPlusCalls/CAPPLUSUCL_TXTMSGALTTNTP': 'Cap+ Text Msg Alert',
    'MDCCalls/AU_CALLTYPE': 'MDC Call Type',
    'MDCCalls/AU_CALLLSTID': 'MDC ID',
    'MDCCalls/AU_MDCSYS': 'MDC System',
    'MDCCalls/AU_TONE': 'MDC Tone',
    'MDCCalls/AU_RVRTPERS': 'MDC Revert Channel',
    'MDCCalls/AU_RVRTPERS_Zone': 'MDC Revert Zone',
    'QuikCallIICalls/QU_QCIISYS': 'QC-II System',
    'QuikCallIICalls/QU_CALLFORMAT': 'QC-II Call Format',
    'QuikCallIICalls/QU_TONEATXFRE': 'QC-II Tone A (Hz)',
    'QuikCallIICalls/QU_CODEA': 'QC-II Code A',
    'QuikCallIICalls/QU_TONEBTXFRE': 'QC-II Tone B (Hz)',
    'QuikCallIICalls/QU_CODEB': 'QC-II Code B',
    'QuikCallIICalls/QU_RVRTPERS': 'QC-II Revert Channel',
    'QuikCallIICalls/QU_RVRTPERS_Zone': 'QC-II Revert Zone',
    Comments: 'Comments',
  },
  common: [
    '__alias',
    'DigitalCalls/DU_CALLTYPE', 'DigitalCalls/DU_CALLLSTID', 'DigitalCalls/DU_RINGTYPE', 'DigitalCalls/DU_TXTMSGALTTNTP',
    'MDCCalls/AU_CALLTYPE', 'MDCCalls/AU_CALLLSTID', 'MDCCalls/AU_MDCSYS',
    'QuikCallIICalls/QU_CALLFORMAT', 'QuikCallIICalls/QU_TONEATXFRE', 'QuikCallIICalls/QU_CODEA',
    'QuikCallIICalls/QU_TONEBTXFRE', 'QuikCallIICalls/QU_CODEB',
    'CapacityPlusCalls/CAPPLUSUCL_CALLTYPE', 'CapacityPlusCalls/CAPPLUSUCL_CALLLSTID',
    'Comments',
  ],
  // A renamed contact is renamed in the workspace RX group lists too.
  onRename(row, oldName, newName) {
    const n = Refs.contact(oldName, newName);
    const c = Refs.channelContact(oldName, newName);
    const parts = [n && plural(n, 'RX group list member'), c && plural(c, 'channel')].filter(Boolean);
    if (parts.length) toast(`Also renamed "${oldName}" in ${parts.join(' and ')}.`, 3500);
  },
  onSet(row, target, col, value) {
    const pseudo = fieldEl(target, 'PeudoCallId');
    // The call ID is mirrored in PeudoCallId (Digital + MDC).
    if (/_CALLLSTID$/.test(col.field) && pseudo) pseudo.textContent = value;
    // Quik-Call II uses Code A as its PeudoCallId.
    if (col.field === 'QU_CODEA' && pseudo) {
      pseudo.textContent = value;
      if (pseudo.hasAttribute('Name')) pseudo.setAttribute('Name', displayVal(col, value));
    }
    // Call type drives the entry's key and the "System-Type" CallType text.
    if (/_CALLTYPE$/.test(col.field)) {
      if (target.hasAttribute('key')) target.setAttribute('key', value);
      const ct = fieldEl(target, 'CallType');
      if (ct && ct.textContent.includes('-')) ct.textContent = `${ct.textContent.split('-')[0]}-${displayVal(col, value)}`;
    }
  },
};

const state = { doc: null, decl: '' };
const contacts = () => (state.doc ? setsNamed(state.doc, 'PCRContacts') : []);

const grid = new SetGrid({
  table: $('grid'),
  rows: contacts,
  cfg: CONTACT_CFG,
  noun: 'contact',
  aliasLabel: 'Contact Name',
  newAlias: 'New Contact',
  onChange: () => refresh(),
});
grid.bindToolbar();

function load(text) {
  const { doc, decl } = parseXml(text);
  const rows = setsNamed(doc, 'PCRContacts');
  if (!rows.length) throw new Error('No contacts found. Expected <set name="PCRContacts"> elements.');
  Object.assign(state, { doc, decl });
  grid.orig = new WeakMap();
  grid.snapshot(rows);
  grid.reset();
  grid.computeColumns();
  grid.render();
  grid.renderBulk();
  refresh();
  const counts = Object.entries(SYSTEMS)
    .map(([sys, label]) => [rows.filter((r) => subSet(r, sys)).length, label])
    .filter(([n]) => n).map(([n, label]) => `${n} ${label}`);
  return `Loaded ${plural(rows.length, 'contact')}${counts.length ? ` (${counts.join(', ')})` : ''}.`;
}

function refresh() {
  const rows = contacts();
  const warn = aliasWarnings(rows, 'contact');
  // Two digital contacts of the same call type can't share an ID.
  const ids = new Map();
  rows.forEach((r, i) => {
    const d = subSet(r, 'DigitalCalls');
    if (!d) return;
    const key = `${d.getAttribute('key')}:${(fieldEl(d, 'DU_CALLLSTID') || {}).textContent}`;
    if (ids.has(key)) warn.push(`Row ${i + 1}: "${r.getAttribute('alias')}" has the same digital call type and ID as row ${ids.get(key) + 1}.`);
    else ids.set(key, i);
  });
  renderWarnings($('warnings'), warn);
  wf.refreshOutput();
}

/* ------------------------------ Functions ------------------------------- */

async function addFromLibrary() {
  if (!state.doc) return toast('Paste this radio\'s Contacts first, then add from the library.', 4000);
  const existing = new Set(grid.rows().map((r) => r.getAttribute('alias')));
  const items = await pickFromLibrary('contact', { title: 'Add contacts from the library', existing });
  if (!items) return;
  const rows = grid.rows();
  const container = rows.length ? rows[rows.length - 1].parentNode : state.doc.getElementsByTagName('category')[0];
  const sets = importItems(state.doc, items);
  for (const s of sets) {
    setVal(s, { ...ALIAS_COL }, uniqueAlias(grid.rows(), s.getAttribute('alias')), { ...CONTACT_CFG, onRename: null });
    container.append(s);
  }
  grid.changed(true);
  toast(`Added ${plural(sets.length, 'contact')} from the library.`);
}

async function runFunction(key) {
  if (key === 'saveLib') return saveSetsToLibrary('contact', { all: grid.rows(), selected: grid.checkedRows() }, 'Contacts');
  if (key !== 'seqId') return;
  const choice = await askScope({
    title: 'Number Digital Call IDs',
    desc: 'Gives each contact with a digital entry a call ID counting up from the starting ID, in grid order.',
    noun: 'contact',
    total: grid.rows().length,
    selected: grid.checkedRows().length,
    fields: [{ key: 'start', label: 'Starting ID', placeholder: 'e.g. 100' }],
    validate: (v) => (/^\d+$/.test(v.start.trim()) && +v.start > 0 ? null : 'Enter a whole number greater than 0.'),
  });
  if (!choice) return;
  const start = +choice.values.start;
  const col = grid.allCols.find((c) => c.name === 'DigitalCalls/DU_CALLLSTID');
  if (!col) return toast('These contacts have no digital call IDs.');
  const targets = (choice.scope === 'selected' ? grid.checkedRows() : grid.rows()).filter((r) => getVal(r, col) !== null);
  targets.forEach((r, i) => setVal(r, col, String(start + i), CONTACT_CFG));
  grid.changed(true);
  toast(`Numbered ${plural(targets.length, 'contact')} from ${start} to ${start + targets.length - 1}.`);
}

initShell();
initFunctionMenu(runFunction);
$('libAddBtn').addEventListener('click', addFromLibrary);
const wf = initWorkflow({
  type: 'contacts',
  load,
  serialize: () => serializeDoc(state.doc, state.decl),
  fileName: () => 'Contacts',
});
