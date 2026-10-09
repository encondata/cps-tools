'use strict';

/* ---------------------------------------------------------------------------
 * Load from External: a tree of preconfigured channel groups (data.js).
 * Import builds analog channels, one zone and scan list(s) per group, and
 * adds them to the workspace.
 * ------------------------------------------------------------------------- */

const ui = {
  selected: new Map(),   // group id -> Set of item indexes
  expanded: new Set(),
  rxOnly: new Map(),     // group id -> bool
  zoneName: new Map(),   // group id -> zone / scan list name
};

// Texas GMRS repeaters by region: built-in presets plus any pasted data (repeaters.js).
let repeaterGroupsLoaded = repeaterGroups().groups;
const allGroups = () => [...EXTERNAL_GROUPS, ...repeaterGroupsLoaded];

function initGroupState(g) {
  ui.selected.set(g.id, new Set());
  ui.rxOnly.set(g.id, g.rxOnlyDefault);
  ui.zoneName.set(g.id, g.zone);
}
[...EXTERNAL_GROUPS, ...repeaterGroupsLoaded].forEach(initGroupState);

const defaultItems = (g) => g.items.map((it, i) => (it.off ? -1 : i)).filter((i) => i >= 0);
const txOf = (it) => it.tx ?? it.rx;

/* -------------------------------- Tree ---------------------------------- */

function groupCheckbox(g) {
  const sel = ui.selected.get(g.id);
  const cb = h('input', {
    type: 'checkbox', title: 'Select or clear this group',
    onchange: () => {
      // Empty group -> select its default channels (data-only ones stay off);
      // partly or fully selected -> clear it.
      ui.selected.set(g.id, new Set(sel.size ? [] : defaultItems(g)));
      render();
    },
  });
  cb.checked = sel.size === g.items.length;
  cb.indeterminate = sel.size > 0 && sel.size < g.items.length;
  return cb;
}

/* ---------------------------- Receive only ------------------------------ */

const txGroups = () => allGroups().filter((g) => !g.rxOnlyForced);
let txConfirmed = false;

// Transmitting on these services needs certified radios (and a GMRS licence),
// so ask once before allowing it.
function confirmTx() {
  if (txConfirmed) return true;
  txConfirmed = confirm('Import transmit frequencies?\n\n'
    + 'Only do this if the radio is certified for the service (FRS, GMRS, MURS or Marine) and, for GMRS, '
    + 'you hold an FCC licence. Government-only and data-only marine channels stay receive-only.');
  return txConfirmed;
}

function setRxOnly(groups, rxOnly) {
  if (!rxOnly && !confirmTx()) { render(); return; }
  groups.forEach((g) => ui.rxOnly.set(g.id, rxOnly));
  render();
}

function rxOnlySwitch(g) {
  const forced = !!g.rxOnlyForced;
  return h('label', { class: 'ext-rx', title: forced ? 'This service is receive-only' : 'Untick to import transmit frequencies' },
    h('input', {
      type: 'checkbox', checked: forced || ui.rxOnly.get(g.id), disabled: forced,
      onchange: (e) => setRxOnly([g], e.target.checked),
    }),
    h('span', {}, forced ? 'RX only (always)' : 'RX only'));
}

function renderTxMaster() {
  const cb = $('optAllowTx');
  const tx = txGroups().filter((g) => !ui.rxOnly.get(g.id));
  cb.checked = tx.length === txGroups().length;
  cb.indeterminate = tx.length > 0 && !cb.checked;
  $('txState').textContent = tx.length ? `Transmit on: ${tx.map((g) => g.label).join(', ')}` : 'All groups receive only';
}

function renderGroup(g) {
  const sel = ui.selected.get(g.id);
  const open = ui.expanded.has(g.id);
  const forced = !!g.rxOnlyForced;
  const head = h('div', { class: 'ext-head' },
    h('button', {
      class: 'ext-toggle ghost', 'aria-expanded': String(open), title: open ? 'Collapse' : 'Expand',
      onclick: () => { open ? ui.expanded.delete(g.id) : ui.expanded.add(g.id); render(); },
    }, open ? '▾' : '▸'),
    groupCheckbox(g),
    h('button', { class: 'ext-label', onclick: () => { open ? ui.expanded.delete(g.id) : ui.expanded.add(g.id); render(); } },
      h('strong', {}, g.label), h('span', { class: 'muted' }, ` ${g.title}`)),
    h('span', { class: 'ext-count' }, sel.size ? `${sel.size} of ${g.items.length} selected` : plural(g.items.length, 'channel')),
    rxOnlySwitch(g),
    h('a', { href: g.source.url, target: '_blank', rel: 'noopener', class: 'small' }, g.source.name));

  if (!open) return h('div', { class: 'ext-group' }, head);

  const zoneInput = h('input', {
    type: 'text', value: ui.zoneName.get(g.id), maxLength: ALIAS_MAX,
    oninput: (e) => { ui.zoneName.set(g.id, e.target.value); updateSummary(); },
  });
  const rows = g.items.map((it, i) => {
    const rx = forced || ui.rxOnly.get(g.id) || it.rxOnly;
    return h('tr', { class: sel.has(i) ? 'checked' : '' },
      h('td', {}, h('input', {
        type: 'checkbox', checked: sel.has(i),
        onchange: (e) => { e.target.checked ? sel.add(i) : sel.delete(i); render(); },
      })),
      h('td', {}, it.name),
      h('td', { class: 'num-cell' }, mhz(it.rx)),
      h('td', { class: 'num-cell' }, rx ? h('span', { class: 'muted' }, '—') : txOf(it) === it.rx ? 'simplex' : mhz(txOf(it))),
      h('td', {}, it.wide ? '25' : '12.5'),
      h('td', { class: 'num-cell small' }, toneText(it)),
      h('td', { class: 'small' },
        rx ? h('span', { class: 'badge ok' }, 'RX only') : null,
        it.low && !rx ? h('span', { class: 'badge warn' }, 'Low power') : null,
        ' ', it.note || ''));
  });
  return h('div', { class: 'ext-group open' }, head,
    h('div', { class: 'ext-body' },
      h('p', { class: 'muted small' }, g.note),
      h('div', { class: 'ext-opts' },
        h('label', { class: 'dialog-field' }, h('span', {}, 'Zone & scan list name'), zoneInput)),
      h('table', { class: 'lib-table ext-items' },
        h('thead', {}, h('tr', {}, ['', 'Name', 'RX MHz', 'TX MHz', 'kHz', 'Tone TX / RX', 'Notes'].map((t) => h('th', {}, t)))),
        h('tbody', {}, rows))));
}

// "141.3 / 141.3", "D627 / D156", "—" for carrier squelch.
function toneText(it) {
  const t = (sq, tone, inv) => (sq === 'TPL' ? tone : sq === 'DPL' ? `D${tone}${inv ? 'I' : ''}` : 'CSQ');
  if (!it.txSq && !it.rxSq) return '—';
  return `${t(it.txSq, it.txTone, it.txInv)} / ${t(it.rxSq, it.rxTone, it.rxInv)}`;
}

function render() {
  $('tree').replaceChildren(...EXTERNAL_GROUPS.map(renderGroup));
  $('rbTree').replaceChildren(...repeaterGroupsLoaded.map(renderGroup));
  renderTxMaster();
  updateSummary();
}

function chosenGroups() {
  return allGroups().filter((g) => ui.selected.get(g.id).size);
}

function validate() {
  const names = new Set();
  for (const g of chosenGroups()) {
    const n = (ui.zoneName.get(g.id) || '').trim();
    if (!n) return `Give the ${g.label} zone a name.`;
    if (names.has(n)) return `Two groups use the zone name "${n}".`;
    names.add(n);
  }
  const max = Number($('optScanMax').value);
  if (!(max >= 2)) return 'Max scan list members must be at least 2.';
  return null;
}

function updateSummary() {
  const groups = chosenGroups();
  const n = groups.reduce((a, g) => a + ui.selected.get(g.id).size, 0);
  const err = validate();
  $('summary').textContent = err || (n
    ? `${plural(n, 'channel')} in ${plural(groups.length, 'zone')}: ${groups.map((g) => `${ui.zoneName.get(g.id).trim()} (${ui.selected.get(g.id).size}${!g.rxOnlyForced && !ui.rxOnly.get(g.id) ? ', with TX' : ''})`).join(', ')}`
    : 'Tick the channels to import.');
  $('summary').className = err ? 'warn-text' : 'muted';
  $('importBtn').disabled = !n || !!err;
  $('importBtn').textContent = n ? `Import ${plural(n, 'channel')}` : 'Import';
}

/* ------------------------------- Template ------------------------------- */

// Built-in analog channel, or an analog channel from the workspace (matches the radio model).
function fillTemplates() {
  const opts = [h('option', { value: 'builtin' }, 'Built-in analog channel')];
  const seen = new Set();
  for (const z of WsNames.zones()) {
    for (const c of kids(named(z, 'collection', 'ZoneItems'), 'set')) {
      if (c.getAttribute('key') !== 'ANLGCONV' || seen.size >= 40) continue;
      const key = `${z.getAttribute('alias')}/${c.getAttribute('alias')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push(h('option', { value: key }, `Like "${c.getAttribute('alias')}" (${z.getAttribute('alias')})`));
    }
  }
  $('optTemplate').replaceChildren(...opts);
  if (opts.length > 1) $('optTemplate').value = opts[1].value; // prefer this radio's own channel
}

function templateXml() {
  const v = $('optTemplate').value;
  if (v === 'builtin') return TEMPLATES.analog;
  const [zoneName, chName] = [v.slice(0, v.indexOf('/')), v.slice(v.indexOf('/') + 1)];
  const z = WsNames.zones().find((x) => x.getAttribute('alias') === zoneName);
  const c = z && kids(named(z, 'collection', 'ZoneItems'), 'set').find((x) => x.getAttribute('alias') === chName);
  return c ? setXml(c) : TEMPLATES.analog;
}

/* -------------------------------- Import -------------------------------- */

function scanListNames(base, chunks) {
  if (chunks === 1) return [base];
  return Array.from({ length: chunks }, (_, k) => (k === 0 ? base : `${base.slice(0, ALIAS_MAX - String(k + 1).length - 1).trim()} ${k + 1}`));
}

async function doImport() {
  const err = validate();
  if (err) return toast(err, 5000);
  const tpl = templateXml();
  const autoScan = $('optAutoScan').checked;
  const perList = Number($('optScanMax').value) - 1; // "Selected" takes one member slot
  const report = [];
  const libItems = [];

  for (const g of chosenGroups()) {
    const zoneName = ui.zoneName.get(g.id).trim();
    const items = [...ui.selected.get(g.id)].sort((a, b) => a - b).map((i) => g.items[i]);
    const chunks = Math.ceil(items.length / perList);
    const listNames = scanListNames(zoneName, chunks);

    const sets = items.map((it, i) => {
      const rxOnly = !!(g.rxOnlyForced || ui.rxOnly.get(g.id) || it.rxOnly);
      const set = buildChannelSet({
        name: it.name, rx: it.rx, tx: txOf(it), kind: 'analog', wide: !!it.wide, sq: 'CSQ',
        txSq: it.txSq, txTone: it.txTone, txInv: it.txInv, rxSq: it.rxSq, rxTone: it.rxTone, rxInv: it.rxInv,
      }, tpl, null);
      const list = listNames[Math.floor(i / perList)];
      setField(set, 'CP_RXONLYEN', rxOnly ? 'True' : 'False');
      setField(set, 'CP_TALKAROUNDEN', 'False');
      if (it.low) setField(set, 'CP_TXPWR', 'LOWPWR', 'Low');
      setField(set, 'CP_SCNROAMLISTIT', SCAN_REF_PREFIX + list);
      setField(set, 'CP_UTOSCANEN', autoScan ? 'True' : 'False');
      setField(set, 'Comments', it.note || '');
      return set;
    });

    const zres = upsertZoneChannels(zoneName, sets);
    const lists = listNames.map((name, k) => {
      const members = sets.slice(k * perList, (k + 1) * perList).map((s) => s.getAttribute('alias'));
      // Keep members already in an existing list (e.g. when re-importing part of a group).
      const w = Workspace.load('scan');
      const existing = w ? itemsOf(w.doc, 'scan').find((l) => l.getAttribute('alias') === name) : null;
      const before = existing ? [...existing.getElementsByTagName('value')].map((v) => v.textContent) : [];
      const all = [...new Set(['Selected', ...before, ...members])];
      const created = upsertScanList(name, all);
      if (all.length > perList + 1) toast(`Scan list "${name}" now has ${all.length} members — more than the ${perList + 1} set.`, 6000);
      return `${name} (${all.length - 1}${created ? '' : ', updated'})`;
    });
    report.push({ g, zoneName, zres, lists });
    for (const s of sets) {
      libItems.push({ name: s.getAttribute('alias'), xml: setXml(s), summary: channelSummary(s), tags: g.label, notes: fval(s, 'Comments') || '', source: `External: ${g.title}` });
    }
  }

  let libMsg = '';
  if ($('optLibrary').checked && libItems.length) {
    try {
      const r = await Library.save('channel', libItems, 'replace');
      libMsg = `Library: ${r.added} added, ${r.replaced} replaced.`;
    } catch (e) { libMsg = `Library not updated: ${e.message}`; }
  }

  $('result').hidden = false;
  $('result').replaceChildren(...[
    h('h3', {}, 'Imported into the workspace'),
    h('ul', {}, report.map(({ zoneName, zres, lists }) => h('li', {},
      h('strong', {}, zoneName), ` — zone ${zres.created ? 'created' : 'updated'}: ${zres.added} added`,
      zres.replaced ? `, ${zres.replaced} replaced` : '', ` · scan list${lists.length > 1 ? 's' : ''}: ${lists.join(', ')}`))),
    libMsg ? h('p', { class: 'small' }, libMsg) : null,
    h('p', { class: 'small' }, 'Next, copy both Zones and Scan Lists into CPS2. The Setup page shows what changed.'),
    h('div', { class: 'actions' },
      h('a', { class: 'button primary', href: '../zone/' }, 'Open Zone editor'),
      h('a', { class: 'button', href: '../scan/' }, 'Open Scan Lists'),
      h('a', { class: 'button ghost', href: '../setup/' }, 'Setup page')),
  ].filter(Boolean));
  $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  fillTemplates();
  toast(`Imported ${plural(libItems.length, 'channel')} into ${plural(report.length, 'zone')}.`, 4000);
}

/* --------------------------- Texas GMRS loader --------------------------- */

const RB_STORE = 'cps2tools.txgmrs.v1';

function loadRepeaters(text, { quiet = false } = {}) {
  const rows = text.trim() ? parseRepeaterText(text) : [];
  if (text.trim() && !rows.length) {
    showMsg('rbMsg', "No GMRS repeaters found. Paste the table from RepeaterBook's Texas GMRS page, or a CHIRP CSV export.", 'error');
    return;
  }
  // Rebuild the region groups, keeping each existing group's RX-only switch,
  // zone name and expanded state (selections reset since the items change).
  const res = repeaterGroups(rows);
  const anyTx = EXTERNAL_GROUPS.some((g) => !g.rxOnlyForced && !ui.rxOnly.get(g.id));
  for (const g of res.groups) {
    const had = ui.rxOnly.has(g.id);
    const keep = had && { rxOnly: ui.rxOnly.get(g.id), zone: ui.zoneName.get(g.id) };
    initGroupState(g);
    if (keep) { ui.rxOnly.set(g.id, keep.rxOnly); ui.zoneName.set(g.id, keep.zone); } else if (anyTx) ui.rxOnly.set(g.id, false);
  }
  repeaterGroupsLoaded = res.groups;
  try { if (text.trim()) localStorage.setItem(RB_STORE, text); else localStorage.removeItem(RB_STORE); } catch { /* storage unavailable */ }
  $('rbClear').hidden = !rows.length;
  if (!quiet) {
    showMsg('rbMsg', rows.length
      ? `Read ${plural(rows.length, 'repeater')}: ${res.added} new, ${res.skipped} already built in.`
        + (res.added ? ' New ones are marked "from your data" in their region.' : '')
      : '', 'ok');
  }
  render();
}

$('rbLoad').addEventListener('click', () => loadRepeaters($('rbText').value));
$('rbFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) { $('rbText').value = await f.text(); loadRepeaters($('rbText').value); }
});
$('rbClear').addEventListener('click', () => { $('rbText').value = ''; showMsg('rbMsg', ''); loadRepeaters(''); });

/* -------------------------------- Wiring -------------------------------- */

initShell();
fillTemplates();
$('expandAll').addEventListener('click', () => { allGroups().forEach((g) => ui.expanded.add(g.id)); render(); });
$('collapseAll').addEventListener('click', () => { ui.expanded.clear(); render(); });
$('selectAll').addEventListener('click', () => { allGroups().forEach((g) => ui.selected.set(g.id, new Set(defaultItems(g)))); render(); });
$('selectNone').addEventListener('click', () => { allGroups().forEach((g) => ui.selected.set(g.id, new Set())); render(); });
$('optScanMax').addEventListener('input', updateSummary);
$('optAllowTx').addEventListener('change', (e) => setRxOnly(txGroups(), !e.target.checked));
$('importBtn').addEventListener('click', doImport);
render();
try {
  const saved = localStorage.getItem(RB_STORE);
  if (saved) { $('rbText').value = saved; loadRepeaters(saved, { quiet: true }); }
} catch { /* storage unavailable */ }
