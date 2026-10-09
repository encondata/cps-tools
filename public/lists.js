'use strict';

/* ---------------------------------------------------------------------------
 * List editor shared by Scan Lists and Digital RX Group Lists. Both are a set
 * of named lists, each holding an ordered <multifield> of member names.
 *
 * The page picks its list type from <body data-page="...">.
 * ------------------------------------------------------------------------- */

const LIST_TYPES = {
  scan: {
    setName: 'ScanItems',
    members: 'ScanListItems',
    noun: 'scan list',
    title: 'Scan List',
    aliasLabel: 'Scan List Name',
    newAlias: 'New Scan List',
    memberNoun: 'channel',
    newMembers: ['Selected'],
    memberHint: '"Selected" is the radio\'s currently selected channel.',
    renameHint: 'channels that use it as their Scan / Roam List must be updated in the Zone Editor.',
    // Members are channels from the workspace zones.
    sourceType: 'zone',
    sourceNames: () => WsNames.channels(),
    specialMembers: ['Selected'],
    // Renaming a list updates the channels that use it.
    renameRefs: (oldName, newName) => Refs.scanList(oldName, newName),
    cfg: {
      labels: {
        SP_SCPLTYPE: 'PL Type',
        SP_PR1MEM: 'Priority 1 Member',
        SP_PR2MEM: 'Priority 2 Member',
        SP_DSGTXMEM: 'TX Designated Channel',
        SP_DSGTXMEM_Zone: 'TX Designated Zone',
        SP_TLKSCNEN: 'Talkback',
        SCAN_RAD_TBPRIOSAMP: 'Priority Sample Time (ms)',
        SP_SCLSTTYPE: 'List Type',
        Comments: 'Comments',
      },
      common: ['__alias', 'SP_SCPLTYPE', 'SP_PR1MEM', 'SP_PR2MEM', 'SP_DSGTXMEM', 'SP_TLKSCNEN', 'SCAN_RAD_TBPRIOSAMP', 'Comments'],
      readonly: new Set(['SP_SCLSTTYPE']),
      hidden: /ALIAS$/,
    },
  },
  rxgroup: {
    setName: 'DigitalRXGroupList',
    members: 'DigitalRXGroupListItems',
    noun: 'group list',
    title: 'RX Group List',
    aliasLabel: 'Group List Name',
    newAlias: 'New Group List',
    memberNoun: 'contact',
    newMembers: [],
    memberHint: 'Members are contact names from the Contacts list.',
    renameHint: 'channels that use it as their RX Group List must be updated in the Zone Editor.',
    sourceType: 'contacts',
    sourceNames: () => WsNames.of('contacts'),
    specialMembers: [],
    renameRefs: (oldName, newName) => Refs.rxGroup(oldName, newName),
    cfg: {
      labels: { Comments: 'Comments' },
      common: ['__alias', 'Comments'],
      hidden: /ALIAS$/,
    },
  },
};

const TYPE = document.body.dataset.page;
const T = LIST_TYPES[TYPE];
const state = { doc: null, decl: '' };
const origMembers = new WeakMap(); // list -> original member names
const renamed = new Map();         // original alias -> current, for lists whose references weren't updated

T.cfg.onRename = (row, oldName, newName) => {
  const n = T.renameRefs && Workspace.has('zone') ? T.renameRefs(oldName, newName) : null;
  if (n === null) {
    // No workspace copy of the referencing items: warn instead.
    const first = [...renamed].find(([, cur]) => cur === oldName);
    renamed.delete(first ? first[0] : oldName);
    renamed.set(first ? first[0] : oldName, newName);
  } else if (n) {
    toast(`Also updated ${plural(n, 'channel')} that used "${oldName}".`, 3500);
  }
};

const listsOf = () => (state.doc ? setsNamed(state.doc, T.setName) : []);
const membersEl = (list) => named(list, 'multifield', T.members);
const memberValues = (list) => kids(membersEl(list), 'value');
const memberNames = (list) => memberValues(list).map((v) => v.textContent);

const grid = new SetGrid({
  table: $('grid'),
  rows: listsOf,
  cfg: T.cfg,
  noun: T.noun,
  aliasLabel: T.aliasLabel,
  newAlias: T.newAlias,
  extraCols: [{ label: 'Members', value: (list) => String(memberNames(list).length) }],
  onNewRow: (list) => setMembers(list, T.newMembers),
  onActivate: () => renderMembers(),
  onChange: (structural) => { if (!structural) updateCounts(); renderMembers(); refresh(); },
});
grid.bindToolbar();

/* ------------------------------- Loading -------------------------------- */

function load(text) {
  const { doc, decl } = parseXml(text);
  const lists = setsNamed(doc, T.setName);
  if (!lists.length) throw new Error(`No ${T.title}s found. Expected <set name="${T.setName}"> elements.`);
  Object.assign(state, { doc, decl });
  grid.orig = new WeakMap();
  grid.snapshot(lists);
  lists.forEach((l) => origMembers.set(l, memberNames(l)));
  renamed.clear();
  loadSource();
  grid.reset();
  grid.computeColumns();
  grid.render();
  grid.renderBulk();
  renderMembers();
  refresh();
  const n = lists.reduce((a, l) => a + memberNames(l).length, 0);
  return `Loaded ${plural(lists.length, T.noun)} with ${plural(n, 'member')}.`;
}

/* ------------------------------- Members -------------------------------- */

function setMembers(list, names) {
  let mf = membersEl(list);
  if (!mf) { // Create the member list on first use.
    mf = list.ownerDocument.createElement('multifield');
    mf.setAttribute('name', T.members);
    list.prepend(mf);
  }
  mf.replaceChildren(...names.map((n) => {
    const v = list.ownerDocument.createElement('value');
    v.textContent = n;
    return v;
  }));
}

// Names of the channels / contacts in the workspace (null when not loaded there).
let source = null;
function loadSource() {
  source = Workspace.has(T.sourceType) ? new Set(T.sourceNames()) : null;
}

function knownMembers() {
  const all = new Set(T.specialMembers);
  if (source) source.forEach((n) => all.add(n));
  for (const l of listsOf()) memberNames(l).forEach((n) => all.add(n));
  return [...all].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

const isKnown = (name) => !source || source.has(name) || T.specialMembers.includes(name);

// Scan lists: add every channel of a workspace zone.
function renderZonePicker() {
  const host = $('memZone');
  host.replaceChildren();
  const zones = T.sourceType === 'zone' && grid.active ? WsNames.zones() : [];
  host.hidden = !zones.length;
  if (!zones.length) return;
  const sel = h('select', {}, zones.map((z, i) => h('option', { value: i }, z.getAttribute('alias'))));
  host.append(h('span', { class: 'muted small' }, 'Add all channels of zone'), sel, h('button', {
    onclick: () => {
      const list = grid.active;
      const chs = kids(named(zones[+sel.value], 'collection', 'ZoneItems'), 'set').map((c) => c.getAttribute('alias'));
      const have = new Set(memberNames(list));
      const add = chs.filter((c) => !have.has(c));
      setMembers(list, [...memberNames(list), ...add]);
      memberChanged(list);
      toast(`Added ${plural(add.length, 'channel')}${chs.length - add.length ? ` (${chs.length - add.length} already in the list)` : ''}.`);
    },
  }, 'Add'));
}

function memberChanged(list) {
  updateCounts();
  renderMembers();
  refresh();
}

function updateCounts() {
  const rows = listsOf();
  grid.table.querySelectorAll('tbody tr').forEach((tr) => {
    const cell = tr.querySelector('td.extra');
    if (cell) cell.textContent = String(memberNames(rows[+tr.dataset.i]).length);
  });
}

function renderMembers() {
  const list = grid.active;
  const host = $('memList');
  $('memAdd').hidden = !list;
  $('memActions').hidden = !list;
  renderZonePicker();
  if (!list) {
    $('memTitle').textContent = 'Members';
    host.replaceChildren(h('p', { class: 'muted' }, `Click a ${T.noun} to see its members.`));
    return;
  }
  const names = memberNames(list);
  const orig = origMembers.get(list) || [];
  $('memTitle').textContent = `Members of "${list.getAttribute('alias')}" (${names.length})`;
  $('memAddInput').setAttribute('list', datalistFor('dl_members', knownMembers()));

  if (!names.length) {
    host.replaceChildren(h('p', { class: 'muted' }, `No members yet. Add a ${T.memberNoun} below.`));
    return;
  }
  const values = memberValues(list);
  const move = (i, d) => {
    const v = values[i], sib = values[i + d];
    if (!sib) return;
    d < 0 ? sib.before(v) : sib.after(v);
    memberChanged(list);
  };
  host.replaceChildren(h('table', { class: 'members' }, h('tbody', {}, values.map((v, i) =>
    h('tr', {
      class: [orig[i] === v.textContent ? '' : 'changed', isKnown(v.textContent) ? '' : 'unknown'].join(' '),
      title: isKnown(v.textContent) ? null : `Not a ${T.memberNoun} in the workspace`,
    },
      h('td', { class: 'num' }, String(i + 1)),
      h('td', {}, h('input', {
        type: 'text', value: v.textContent, list: 'dl_members',
        onchange: (e) => { v.textContent = e.target.value.trim(); memberChanged(list); },
      })),
      h('td', { class: 'mem-btns' },
        h('button', { title: 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        h('button', { title: 'Move down', disabled: i === values.length - 1, onclick: () => move(i, 1) }, '↓'),
        h('button', { title: 'Remove', class: 'danger', onclick: () => { v.remove(); memberChanged(list); } }, '✕')))))));
}

function addMember() {
  const list = grid.active;
  const name = $('memAddInput').value.trim();
  if (!list || !name) return;
  if (memberNames(list).includes(name) && !confirm(`"${name}" is already in this list. Add it again?`)) return;
  setMembers(list, [...memberNames(list), name]);
  $('memAddInput').value = '';
  memberChanged(list);
  $('memAddInput').focus();
}

function openPasteDialog() {
  const list = grid.active;
  if (!list) return;
  $('memPasteText').value = memberNames(list).join('\n');
  $('memPasteDialog').showModal();
  $('memPasteText').focus();
}

function applyPaste(mode) {
  const list = grid.active;
  const names = $('memPasteText').value.split(/\r?\n/).map((s) => s.split('\t')[0].trim()).filter(Boolean);
  setMembers(list, mode === 'append' ? [...memberNames(list), ...names] : names);
  $('memPasteDialog').close();
  memberChanged(list);
  toast(`${mode === 'append' ? 'Added' : 'Set'} ${plural(names.length, 'member')}.`);
}

/* ------------------------------- Refresh -------------------------------- */

function refresh() {
  const lists = listsOf();
  const warn = aliasWarnings(lists, T.noun);
  lists.forEach((l, i) => {
    const names = memberNames(l);
    const alias = l.getAttribute('alias');
    const dupes = names.filter((n, j) => names.indexOf(n) !== j);
    if (dupes.length) warn.push(`Row ${i + 1}: "${alias}" lists ${[...new Set(dupes)].map((d) => `"${d}"`).join(', ')} more than once.`);
    if (names.some((n) => !n)) warn.push(`Row ${i + 1}: "${alias}" has an empty member.`);
    const unknown = names.filter((n) => n && !isKnown(n));
    if (unknown.length) {
      const verb = unknown.length === 1 ? `isn't a ${T.memberNoun}` : `aren't ${T.memberNoun}s`;
      warn.push(`Row ${i + 1}: "${alias}" has ${plural(unknown.length, 'member')} that ${verb} in the workspace: `
        + unknown.slice(0, 5).map((n) => `"${n}"`).join(', ') + (unknown.length > 5 ? '…' : ''));
    }
  });
  for (const [was, now] of renamed) {
    if (was !== now && lists.some((l) => l.getAttribute('alias') === now)) warn.push(`"${was}" was renamed to "${now}" — ${T.renameHint}`);
  }
  renderWarnings($('warnings'), warn);
  wf.refreshOutput();
}

/* -------------------------------- Wiring -------------------------------- */

initShell();
$('memHint').textContent = T.memberHint;
$('memAddBtn').addEventListener('click', addMember);
$('memAddInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } });
$('memPasteBtn').addEventListener('click', openPasteDialog);
$('memClearBtn').addEventListener('click', () => {
  const list = grid.active;
  if (list && confirm(`Remove all members from "${list.getAttribute('alias')}"?`)) { setMembers(list, []); memberChanged(list); }
});
$('memPasteReplace').addEventListener('click', () => applyPaste('replace'));
$('memPasteAppend').addEventListener('click', () => applyPaste('append'));
$('memPasteCancel').addEventListener('click', () => $('memPasteDialog').close());

// Channels / contacts may have changed in another editor.
window.addEventListener('focus', () => { if (state.doc) { loadSource(); renderMembers(); refresh(); } });

const wf = initWorkflow({
  type: TYPE,
  load,
  serialize: () => serializeDoc(state.doc, state.decl),
  fileName: () => T.title.replace(/ /g, '') + 's',
});
