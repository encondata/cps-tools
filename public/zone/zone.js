'use strict';

/* ---------------------------------------------------------------------------
 * Zone Editor. The pasted XML is edited in place; everything the grid doesn't
 * show is passed through untouched.
 * ------------------------------------------------------------------------- */

const CHANNEL_LABELS = {
  CP_RXFREQ: 'RX Freq (MHz)',
  CP_TXFREQ: 'TX Freq (MHz)',
  CP_XSQCHTY: 'RX Squelch Type',
  CP_RXTPLFREQ: 'RX PL (Hz)',
  CP_RXDPLCD: 'RX DPL',
  CP_RXDPLINV: 'RX DPL Invert',
  CP_TXSQCHTY: 'TX Squelch Type',
  CP_TXTTPLFREQ: 'TX PL (Hz)',
  CP_TXTDPLCD: 'TX DPL',
  CP_TXDPLINV: 'TX DPL Invert',
  CP_CHNLBWDTH: 'Bandwidth (kHz)',
  CP_TXPWR: 'Power',
  CP_SCNROAMLISTIT: 'Scan / Roam List',
  CP_UTOSCANEN: 'Auto Scan',
  CP_RXONLYEN: 'RX Only',
  CP_TALKAROUNDEN: 'Talkaround',
  CP_TOT: 'TOT (s)',
  CP_TOTWRN: 'TOT Warning (s)',
  CP_VOXSTATE: 'VOX',
  CP_COMPSTATE: 'Compander',
  CP_TXINHXPLEN: 'Admit Criteria',
  CP_EMPHASEL: 'Emphasis',
  CP_SQUELCHPLUS: 'Squelch Level',
  CP_BUSYLEDEN: 'Busy LED',
  CP_LONEWORKEN: 'Lone Worker',
  CP_PERSTYPE: 'Channel Type',
  CP_COLORCODE: 'Color Code',
  CP_SLTASSGMNT: 'Timeslot',
  CP_UKPPERS: 'Contact',
  CP_TGLISTIT: 'RX Group List',
  CP_ENHCPRVCYIT: 'Privacy Key',
  CP_VOICEPRIVACYEN: 'Privacy',
  CP_EMSYSIT: 'Emergency System',
  CP_TEXTMESSAGETYPE: 'Text Message Type',
  CP_SYNCMODE: 'Sync Mode',
  Comments: 'Comments',
  OffSet: 'Offset',
};

const CTCSS = ['67.0', '69.3', '71.9', '74.4', '77.0', '79.7', '82.5', '85.4', '88.5', '91.5',
  '94.8', '97.4', '100.0', '103.5', '107.2', '110.9', '114.8', '118.8', '123.0', '127.3',
  '131.8', '136.5', '141.3', '146.2', '151.4', '156.7', '159.8', '162.2', '165.5', '167.9',
  '171.3', '173.8', '177.3', '179.9', '183.5', '186.2', '189.9', '192.8', '196.6', '199.5',
  '203.5', '206.5', '210.7', '218.1', '225.7', '229.1', '233.6', '241.8', '250.3', '254.1'];

const DCS = ['023', '025', '026', '031', '032', '036', '043', '047', '051', '053', '054', '065',
  '071', '072', '073', '074', '114', '115', '116', '122', '125', '131', '132', '134', '143',
  '145', '152', '155', '156', '162', '165', '172', '174', '205', '212', '223', '225', '226',
  '243', '244', '245', '246', '251', '252', '255', '261', '263', '265', '266', '271', '274',
  '306', '311', '315', '325', '331', '332', '343', '346', '351', '356', '364', '365', '371',
  '411', '412', '413', '423', '431', '432', '445', '446', '452', '454', '455', '462', '464',
  '465', '466', '503', '506', '516', '523', '526', '532', '546', '565', '606', '612', '624',
  '627', '631', '632', '654', '662', '664', '703', '712', '723', '731', '732', '734', '743', '754'];

const CHANNEL_CFG = {
  labels: CHANNEL_LABELS,
  common: [
    '__alias', 'CP_PERSTYPE', 'CP_RXFREQ', 'CP_TXFREQ',
    // Analog
    'CP_XSQCHTY', 'CP_RXTPLFREQ', 'CP_RXDPLCD',
    'CP_TXSQCHTY', 'CP_TXTTPLFREQ', 'CP_TXTDPLCD', 'CP_CHNLBWDTH',
    // Digital
    'CP_COLORCODE', 'CP_SLTASSGMNT', 'CP_UKPPERS', 'CP_TGLISTIT', 'CP_ENHCPRVCYIT',
    'CP_TXPWR', 'CP_SCNROAMLISTIT', 'CP_UTOSCANEN', 'CP_RXONLYEN', 'CP_TALKAROUNDEN', 'CP_TOT', 'Comments',
  ],
  readonly: new Set(['CP_PERSTYPE']),
  hidden: /PERSALIAS$/,
  knownEnums: {
    CP_TXPWR: [['HIGHPWR', 'High'], ['LOWPWR', 'Low']],
    CP_CHNLBWDTH: [['STR_12PT5KHZ', '12.5'], ['STR_20KHZ', '20'], ['STR_25KHZ', '25']],
    CP_XSQCHTY: [['CSQ', 'CSQ'], ['TPL', 'TPL'], ['DPL', 'DPL']],
    CP_TXSQCHTY: [['CSQ', 'CSQ'], ['TPL', 'TPL'], ['DPL', 'DPL']],
    CP_USELD: [['ON', 'On'], ['OFF', 'Off']],
    CP_SLTASSGMNT: [['SLOT1', '1'], ['SLOT2', '2']],
  },
  columnType(name) {
    // References to other workspace items: offer "None" plus every item there.
    const refs = (type, prefix) => ({
      type: 'enum',
      prefix,
      base: [['NONE', 'None'], ...WsNames.of(type).map((a) => [prefix + a, prefix + a])],
    });
    if (name === 'CP_SCNROAMLISTIT') return refs('scan', SCAN_REF_PREFIX);
    if (name === 'CP_TGLISTIT') return refs('rxgroup', RXGROUP_REF_PREFIX);
    if (name === 'CP_UKPPERS') return refs('contacts', '');
    if (name === 'CP_COLORCODE') return { type: 'int', min: 0, max: 15 };
    if (name === 'CP_RXFREQ' || name === 'CP_TXFREQ') return { type: 'freq' };
    if (name === 'CP_RXTPLFREQ' || name === 'CP_TXTTPLFREQ') return { type: 'enum', norm: 'tone', base: CTCSS.map((t) => [t, t]) };
    if (name === 'CP_RXDPLCD' || name === 'CP_TXTDPLCD') return { type: 'enum', norm: 'dpl', base: DCS.map((d) => [d, d]) };
    return null;
  },
  // A renamed channel is renamed in the workspace scan lists too, unless
  // another channel still has the old name.
  onRename(row, oldName, newName) {
    const stillUsed = state.zones.some((z) => channelsOf(z).some((c) => c !== row && c.getAttribute('alias') === oldName));
    if (stillUsed) return;
    const n = Refs.channel(oldName, newName);
    if (n) toast(`Also renamed "${oldName}" in ${plural(n, 'scan list member')}.`, 3500);
  },
};

const ZONE_CFG = {
  labels: { ZP_ZONETYPE: 'Zone Type', ZP_ZVFNLITEM: 'Voice Announcement', Comments: 'Comments' },
  hidden: /ZONEALIAS$/,
  // The zone's key attribute mirrors its type.
  onSet(row, target, col, value) { if (col.name === 'ZP_ZONETYPE') row.setAttribute('key', value); },
};

const state = { doc: null, decl: '', zones: [], zoneIdx: 0 };

const zoneItems = (z) => named(z, 'collection', 'ZoneItems');
const channelsOf = (z) => kids(zoneItems(z), 'set');
const zone = () => state.zones[state.zoneIdx];

const grid = new SetGrid({
  table: $('grid'),
  rows: () => (zone() ? channelsOf(zone()) : []),
  cfg: CHANNEL_CFG,
  noun: 'channel',
  aliasLabel: 'Channel Name',
  newAlias: 'New Channel',
  minRows: 0, // CPS2 allows empty zones
  emptyText: 'This zone has no channels yet. Use + Add channel, + From Library, or paste rows from Excel into a new channel.',
  // An empty zone borrows its first channel from another zone.
  // falling back to the built-in analog channel when no zone has channels.
  template: () => state.zones.map((z) => channelsOf(z)[0]).find(Boolean)
    || state.doc.importNode(parseXml(TEMPLATES.analog).doc.documentElement, true),
  container: () => zoneItems(zone()),
  onChange: (structural) => { if (structural) renderZoneTabs(); refresh(); },
});
grid.bindToolbar();

/* ------------------------------- Loading -------------------------------- */

function load(text) {
  const { doc, decl } = parseXml(text);
  const zones = itemsOf(doc, 'zone');
  if (!zones.length) throw new Error('No Zone found. Expected a <set name="Zone"> containing a <collection name="ZoneItems">.');
  // Stay on the same zone when reloading.
  const cur = zone() && zone().getAttribute('alias');
  const idx = Math.max(0, zones.findIndex((z) => z.getAttribute('alias') === cur));
  Object.assign(state, { doc, decl, zones, zoneIdx: idx });
  grid.orig = new WeakMap();
  zones.forEach((z) => grid.snapshot(channelsOf(z)));
  renderAll();
  const n = zones.reduce((a, z) => a + channelsOf(z).length, 0);
  return `Loaded ${plural(zones.length, 'zone')} with ${plural(n, 'channel')}.`;
}

/* ------------------------------- Rendering ------------------------------ */

function renderAll() {
  grid.reset();
  renderZoneTabs();
  renderZoneForm();
  grid.computeColumns();
  grid.render();
  grid.renderBulk();
  refresh();
}

function renderZoneTabs() {
  const host = $('zoneTabs');
  host.replaceChildren();
  if (!state.zones.length) return;
  const sel = h('select', {
    id: 'zoneSelect',
    onchange: () => { state.zoneIdx = +sel.value; renderAll(); },
  }, state.zones.map((z, i) => h('option', { value: i },
    `${z.getAttribute('alias') || '(unnamed)'} (${plural(channelsOf(z).length, 'channel')})`)));
  sel.value = state.zoneIdx;
  host.append(
    h('label', { class: 'zone-pick' }, h('span', {}, `Zone (${state.zones.length})`), sel),
    h('div', { class: 'zone-btns' },
      h('button', { id: 'newZoneBtn', onclick: newZone, title: 'Add an empty zone' }, '+ New zone'),
      h('button', { onclick: duplicateZone, title: 'Copy this zone and its channels' }, 'Duplicate zone'),
      h('button', { class: 'danger', onclick: deleteZone, title: 'Delete this zone and its channels' }, 'Delete zone')));
}

/* ----------------------------- Zone management -------------------------- */

const zoneNames = () => state.zones.map((z) => z.getAttribute('alias'));

function validateZoneName(v) {
  if (!v) return 'Enter a zone name.';
  if (v.length > ALIAS_MAX) return `Zone names can be at most ${ALIAS_MAX} characters.`;
  if (zoneNames().includes(v)) return `There is already a zone called "${v}".`;
  return null;
}

function nextZoneName(base) {
  const names = new Set(zoneNames());
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) {
    const n = `${base.slice(0, ALIAS_MAX - String(i).length - 1).trim()} ${i}`;
    if (!names.has(n)) return n;
  }
}

// Put a zone after `after` (or at the end) and switch to it.
function insertZone(z, after) {
  if (after) after.after(z);
  else state.doc.getElementsByTagName('category')[0].append(z);
  state.zones = itemsOf(state.doc, 'zone');
  state.zoneIdx = state.zones.indexOf(z);
  renderAll();
}

function renameZone(z, name) {
  setVal(z, { ...ALIAS_COL }, name, ZONE_CFG);
}

async function newZone() {
  const name = await askText({
    title: 'New zone', label: 'Zone name', value: nextZoneName('New Zone'),
    maxLength: ALIAS_MAX, validate: validateZoneName, okLabel: 'Create zone',
    desc: 'Creates an empty zone. Fill it with + Add channel, + From Library, or by pasting from Excel.',
  });
  if (name == null) return;
  // Copy the current zone's settings (keeps any model-specific fields), minus its channels.
  let z;
  if (zone()) {
    z = zone().cloneNode(true);
    zoneItems(z).replaceChildren();
    setVal(z, { name: 'ZP_ZONETYPE', type: 'enum', options: [{ value: 'NORMAL', label: 'Normal' }] }, 'NORMAL', ZONE_CFG);
  } else {
    z = state.doc.importNode(parseXml(ZONE_SKELETON).doc.documentElement, true);
  }
  renameZone(z, name);
  insertZone(z, zone());
  toast(`Zone "${name}" created.`);
}

async function duplicateZone() {
  const src = zone();
  const name = await askText({
    title: `Duplicate "${src.getAttribute('alias')}"`, label: 'Name for the copy',
    value: nextZoneName(src.getAttribute('alias')), maxLength: ALIAS_MAX, validate: validateZoneName, okLabel: 'Duplicate',
  });
  if (name == null) return;
  const z = src.cloneNode(true);
  renameZone(z, name);
  insertZone(z, src);
  toast(`Copied "${src.getAttribute('alias')}" to "${name}" with ${plural(channelsOf(z).length, 'channel')}.`);
}

function deleteZone() {
  const z = zone();
  if (state.zones.length < 2) return toast('This is the only zone. To start over, clear Zones on the Setup page.', 5000);
  const n = channelsOf(z).length;
  if (!confirm(`Delete zone "${z.getAttribute('alias')}"${n ? ` and its ${plural(n, 'channel')}` : ''}?`)) return;
  z.remove();
  state.zones = itemsOf(state.doc, 'zone');
  state.zoneIdx = Math.min(state.zoneIdx, state.zones.length - 1);
  renderAll();
  toast('Zone deleted. Remember to delete it in CPS2 as well — pasting XML never removes zones there.', 6000);
}

// Paste tab: start without any CPS2 XML (or add a zone to the workspace).
async function startNewZone() {
  if (state.doc) { showTab('editorPanel'); return newZone(); }
  const name = await askText({
    title: 'Start a new zone', label: 'Zone name', value: 'New Zone', maxLength: ALIAS_MAX,
    validate: (v) => (!v ? 'Enter a zone name.' : v.length > ALIAS_MAX ? `Zone names can be at most ${ALIAS_MAX} characters.` : null),
    desc: 'Creates an empty zone in the workspace, ready for channels from the Library.',
    okLabel: 'Create zone',
  });
  if (name == null) return;
  const doc = emptyDoc('Zone');
  const z = doc.importNode(parseXml(ZONE_SKELETON).doc.documentElement, true);
  setVal(z, { ...ALIAS_COL }, name, ZONE_CFG);
  doc.getElementsByTagName('category')[0].append(z);
  Workspace.save('zone', serializeDoc(doc, DEFAULT_DECL));
  wf.reopen('Created');
}

function renderZoneForm() {
  const z = zone();
  const host = $('zoneForm');
  host.replaceChildren();
  const cols = [{ ...ALIAS_COL, label: 'Zone Name' },
    ...buildColumns([z], ZONE_CFG).filter((c) => !ZONE_CFG.hidden.test(c.name))];
  for (const col of cols) {
    const ctl = makeControl(col, getVal(z, col), (raw, el) => {
      const r = normalize(col, raw);
      if (!r.ok) { toast(r.error); setControl(el, col, getVal(z, col)); return; }
      setVal(z, col, r.value, ZONE_CFG);
      if (col.name === '__alias') renderZoneTabs();
      refresh();
    });
    host.append(h('label', {}, col.label, ctl));
  }
  host.append(h('label', {}, 'Channels', h('span', { id: 'chanCount', class: 'count' })));
}

function refresh() {
  const z = zone();
  const chs = channelsOf(z);
  $('chanCount').textContent = String(chs.length);

  const warn = [];
  const zname = z.getAttribute('alias') || '';
  if (!zname.trim()) warn.push('Zone name is empty.');
  else if (zname.length > ALIAS_MAX) warn.push(`Zone name "${zname}" is longer than ${ALIAS_MAX} characters.`);
  const labels = { contacts: 'contacts', rxgroup: 'RX group lists', scan: 'scan lists' };
  for (const [type, names] of Object.entries(missingRefs(chs))) {
    warn.push(`Channels use ${labels[type]} that aren't in the workspace: ${names.map((n) => `"${n}"`).join(', ')}. `
      + 'Add them to the radio (and its workspace) or CPS2 may reject the paste.');
  }
  renderWarnings($('warnings'), [...warn, ...aliasWarnings(chs, 'channel')]);
  wf.refreshOutput();
}

/* ------------------------------ Functions ------------------------------- */

const FREQ_COL = { name: '', type: 'freq' };

// TX = RX + offset. Also keeps the XML's OffSet field in step with the new split.
function setTxFromRx(ch, offset) {
  const rx = fieldEl(ch, 'CP_RXFREQ');
  const tx = fieldEl(ch, 'CP_TXFREQ');
  if (!rx || !tx || !isFinite(Number(rx.textContent))) return false;
  const res = normalize(FREQ_COL, Number(rx.textContent) + offset);
  if (!res.ok) return false;
  tx.textContent = res.value;
  const off = fieldEl(ch, 'OffSet');
  if (off) off.textContent = offset.toFixed(6);
  return true;
}

// Point channels at a scan list, optionally switching Auto Scan on or off.
function assignScanList(chs, listName, autoScan) {
  const ref = { name: 'CP_SCNROAMLISTIT', type: 'combo', options: [] };
  const auto = { name: 'CP_UTOSCANEN', type: 'bool' };
  let n = 0;
  for (const ch of chs) {
    if (getVal(ch, ref) === null) continue;
    setVal(ch, ref, SCAN_REF_PREFIX + listName, CHANNEL_CFG);
    if (autoScan && getVal(ch, auto) !== null) setVal(ch, auto, autoScan === 'on' ? 'True' : 'False', CHANNEL_CFG);
    n++;
  }
  return n;
}

const AUTO_SCAN_OPTIONS = [
  { value: 'on', label: 'Turn Auto Scan on' },
  { value: 'off', label: 'Turn Auto Scan off' },
  { value: '', label: 'Leave Auto Scan as it is' },
];

function countRun(chs, fn, skipReason) {
  let n = 0, skipped = 0;
  for (const ch of chs) fn(ch) ? n++ : skipped++;
  return `updated ${plural(n, 'channel')}${skipped ? `, skipped ${skipped} (${skipReason})` : ''}.`;
}

const FUNCTIONS = {
  rx2tx: {
    title: 'Copy RX → TX Freq',
    desc: 'Sets each channel\'s TX frequency to match its RX frequency (simplex).',
    run: (chs) => countRun(chs, (ch) => setTxFromRx(ch, 0), 'no RX/TX frequency'),
  },
  offset: {
    title: 'Apply Offset',
    desc: 'Sets each channel\'s TX frequency to its RX frequency plus the offset. Use a negative number for a negative offset.',
    fields: [{ key: 'offset', label: 'Offset (MHz) — TX = RX + offset', placeholder: 'e.g. 5 or -5' }],
    validate: (v) => (v.offset.trim() !== '' && isFinite(Number(v.offset)) ? null : 'Enter the offset in MHz, e.g. 5 or -5.'),
    run: (chs, v) => countRun(chs, (ch) => setTxFromRx(ch, Number(v.offset)), 'no RX/TX frequency'),
  },
  makeScan: {
    title: 'Create Scan List from Channels',
    desc: 'Builds a scan list in the workspace whose members are these channels, then sets it as their Scan List. If a list with this name already exists, its members are replaced.',
    fields: () => [
      { key: 'name', label: 'Scan list name', value: zone().getAttribute('alias') || '' },
      { key: 'selected', type: 'checkbox', label: 'Start the list with "Selected" (the current channel)', value: true },
      { key: 'assign', type: 'checkbox', label: 'Set this scan list on the channels', value: true },
      { key: 'auto', type: 'select', label: 'Auto Scan', options: AUTO_SCAN_OPTIONS, value: 'on' },
    ],
    validate: (v) => {
      if (!v.name.trim()) return 'Enter a name for the scan list.';
      if (v.name.trim().length > ALIAS_MAX) return `Scan list names can be at most ${ALIAS_MAX} characters.`;
      return null;
    },
    run(chs, v) {
      const name = v.name.trim();
      const members = [...new Set(chs.map((c) => c.getAttribute('alias')))];
      const created = upsertScanList(name, v.selected ? ['Selected', ...members] : members);
      let msg = `${created ? 'Created' : 'Updated'} scan list "${name}" with ${plural(members.length, 'channel')}`;
      if (v.assign) msg += ` and set it on ${plural(assignScanList(chs, name, v.auto), 'channel')}`;
      return msg + '.';
    },
  },
  setScan: {
    title: 'Set Scan List',
    desc: 'Sets the Scan / Roam List of these channels to a scan list from the workspace.',
    fields: () => [
      { key: 'list', type: 'select', label: 'Scan list', options: WsNames.of('scan').map((a) => ({ value: a, label: a })) },
      { key: 'auto', type: 'select', label: 'Auto Scan', options: AUTO_SCAN_OPTIONS, value: 'on' },
    ],
    before: () => (WsNames.of('scan').length ? null
      : 'There are no scan lists in the workspace yet. Paste them on the Setup page, or use "Create Scan List from Channels".'),
    run: (chs, v) => `Set scan list "${v.list}" on ${plural(assignScanList(chs, v.list, v.auto), 'channel')}.`,
  },
};

/* ------------------------------- Library -------------------------------- */

// Contacts, RX group lists and scan lists a channel refers to.
function channelRefs(ch) {
  const v = (n) => { const f = fieldEl(ch, n); return f && f.textContent !== 'NONE' ? f.textContent : null; };
  const strip = (s, p) => (s && s.startsWith(p) ? s.slice(p.length) : s);
  return {
    contacts: v('CP_UKPPERS'),
    rxgroup: strip(v('CP_TGLISTIT'), RXGROUP_REF_PREFIX),
    scan: strip(v('CP_SCNROAMLISTIT'), SCAN_REF_PREFIX),
  };
}

// References from these channels to items missing in this radio's workspace.
// Only checked for types that are loaded in the workspace.
function missingRefs(chs) {
  const out = {};
  for (const type of ['contacts', 'rxgroup', 'scan']) {
    if (!Workspace.has(type)) continue;
    const have = new Set(WsNames.of(type));
    const miss = [...new Set(chs.map((c) => channelRefs(c)[type]).filter((n) => n && !have.has(n)))];
    if (miss.length) out[type] = miss;
  }
  return out;
}

async function addFromLibrary() {
  if (!zone()) return;
  const existing = new Set(grid.rows().map((c) => c.getAttribute('alias')));
  const items = await pickFromLibrary('channel', { title: `Add channels to "${zone().getAttribute('alias')}"`, existing });
  if (!items) return;
  const sets = importItems(state.doc, items);
  const container = zoneItems(zone());
  const after = grid.checkedRows().slice(-1)[0];
  let anchor = after || null;
  for (const s of sets) {
    // Keep names unique within the zone.
    setVal(s, { ...ALIAS_COL }, uniqueAlias(grid.rows(), s.getAttribute('alias')), { ...CHANNEL_CFG, onRename: null });
    anchor ? anchor.after(s) : container.append(s);
    if (anchor) anchor = s;
  }
  grid.changed(true);
  let msg = `Added ${plural(sets.length, 'channel')} from the library.`;

  // Contacts the new channels use but this radio doesn't have: offer to bring them from the library.
  const miss = missingRefs(sets);
  if (miss.contacts) {
    let libContacts = [];
    try { libContacts = await Library.list('contact'); } catch { /* library unavailable */ }
    const found = libContacts.filter((c) => miss.contacts.includes(c.name));
    if (found.length && confirm(`These channels use ${plural(found.length, 'contact')} that this radio's Contacts don't have:\n\n`
      + found.map((c) => `  • ${c.name}`).join('\n') + '\n\nAdd them from the library to the Contacts workspace?')) {
      const added = Workspace.addSets('contacts', importItems(document.implementation.createDocument(null, null), found));
      msg += ` Added ${plural(added.length, 'contact')} to Contacts — remember to copy Contacts into CPS2 too.`;
    }
  }
  refresh();
  toast(msg, 6000);
}

async function runFunction(key) {
  if (key === 'saveLib') {
    return saveSetsToLibrary('channel', { all: grid.rows(), selected: grid.checkedRows() }, zone().getAttribute('alias'));
  }
  const fn = FUNCTIONS[key];
  const blocked = fn.before && fn.before();
  if (blocked) return toast(blocked, 5000);
  const choice = await askScope({
    title: fn.title, desc: fn.desc, validate: fn.validate,
    fields: typeof fn.fields === 'function' ? fn.fields() : fn.fields,
    noun: 'channel', total: grid.rows().length, selected: grid.checkedRows().length,
  });
  if (!choice) return;
  const targets = choice.scope === 'selected' ? grid.checkedRows() : grid.rows();
  const msg = fn.run(targets, choice.values);
  grid.changed(true); // also rebuilds columns, so new scan lists appear in the dropdown
  toast(/^[a-z]/.test(msg) ? `${fn.title}: ${msg}` : msg, 4000);
}

/* -------------------------------- Wiring -------------------------------- */

// Copy tab: all zones, or only the one being edited.
function outputXml() {
  if (!$('onlyZone').checked || state.zones.length < 2) return serializeDoc(state.doc, state.decl);
  const doc = state.doc.cloneNode(true);
  itemsOf(doc, 'zone').forEach((z, i) => { if (i !== state.zoneIdx) z.remove(); });
  return serializeDoc(doc, state.decl);
}

initShell();
initFunctionMenu(runFunction);
const wf = initWorkflow({
  type: 'zone',
  load,
  serialize: () => serializeDoc(state.doc, state.decl),
  output: outputXml,
  fileName: () => ($('onlyZone').checked && zone() ? zone().getAttribute('alias') : 'Zones'),
});
$('onlyZone').addEventListener('change', () => wf.refreshOutput());
$('libAddBtn').addEventListener('click', addFromLibrary);
$('newZoneStartBtn').addEventListener('click', startNewZone);
