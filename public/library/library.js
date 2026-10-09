'use strict';

/* ---------------------------------------------------------------------------
 * Library page: browse, search, tag, import and delete the central channel
 * and contact library, and turn a selection into CPS2 XML.
 * ------------------------------------------------------------------------- */

const state = { type: 'channel', items: [], checked: new Set(), counts: {} };
const NOUN = { channel: 'channel', contact: 'contact' };

async function load() {
  try {
    const [ch, ct] = await Promise.all([Library.list('channel'), Library.list('contact')]);
    state.counts = { channel: ch.length, contact: ct.length };
    state.items = state.type === 'channel' ? ch : ct;
    showMsg('libMsg', '');
  } catch (e) {
    state.items = [];
    showMsg('libMsg', e.message, 'error');
  }
  const ids = new Set(state.items.map((i) => i.id));
  for (const id of [...state.checked]) if (!ids.has(id)) state.checked.delete(id);
  $('countChannel').textContent = state.counts.channel ?? '';
  $('countContact').textContent = state.counts.contact ?? '';
  render();
}

function visible() {
  const t = $('libSearch').value.toLowerCase();
  return state.items.filter((it) => !t || `${it.name} ${it.summary} ${it.tags} ${it.notes} ${it.source}`.toLowerCase().includes(t));
}

async function patch(it, key, value, input) {
  if (it[key] === value) return;
  try {
    Object.assign(it, await Library.update(it.id, { [key]: value }));
    input.value = it[key];
    toast('Saved.');
  } catch (e) {
    input.value = it[key];
    toast(e.message, 5000);
  }
}

function render() {
  const rows = visible();
  const allChecked = rows.length > 0 && rows.every((it) => state.checked.has(it.id));
  const edit = (it, key, cls) => h('input', {
    type: 'text', value: it[key], class: cls,
    onchange: (e) => patch(it, key, e.target.value, e.target),
  });
  $('libTable').replaceChildren(
    h('thead', {}, h('tr', {},
      h('th', { class: 'sticky' }, h('input', {
        type: 'checkbox', checked: allChecked, title: 'Check all shown',
        onchange: (e) => { rows.forEach((it) => (e.target.checked ? state.checked.add(it.id) : state.checked.delete(it.id))); render(); },
      })),
      h('th', {}, 'Name'), h('th', {}, 'Summary'), h('th', {}, 'Tags'), h('th', {}, 'Notes'), h('th', {}, 'Source'), h('th', {}, 'Updated'))),
    h('tbody', {}, rows.length ? rows.map((it) => h('tr', { class: state.checked.has(it.id) ? 'checked' : '' },
      h('td', { class: 'num sticky' }, h('input', {
        type: 'checkbox', checked: state.checked.has(it.id),
        onchange: (e) => { e.target.checked ? state.checked.add(it.id) : state.checked.delete(it.id); render(); },
      })),
      h('td', { class: 'w-alias' }, edit(it, 'name')),
      h('td', { class: 'lib-summary' }, it.summary),
      h('td', { class: 'w-text' }, edit(it, 'tags')),
      h('td', { class: 'w-text' }, edit(it, 'notes')),
      h('td', { class: 'muted small lib-cell' }, it.source),
      h('td', { class: 'muted small lib-cell' }, it.updated.replace(' ', ' · ') + ' UTC')))
      : h('tr', {}, h('td', { colspan: 7, class: 'lib-empty' },
        state.items.length ? 'Nothing matches the search.' : `No ${NOUN[state.type]}s yet. Use "Import from XML", or save them from an editor.`))));
  $('buildBtn').textContent = `Use checked (${state.checked.size})…`;
}

const checkedItems = () => state.items.filter((it) => state.checked.has(it.id));

/* -------------------------------- Import -------------------------------- */

function openImport() {
  $('importText').value = '';
  showMsg('importError', '');
  $('importDialog').showModal();
  $('importText').focus();
}

async function doImport() {
  let doc;
  try { ({ doc } = parseXml($('importText').value)); } catch (e) { showMsg('importError', e.message, 'error'); return; }
  const channels = itemsOf(doc, 'zone').flatMap((z) => kids(named(z, 'collection', 'ZoneItems'), 'set'));
  const contacts = itemsOf(doc, 'contacts');
  let type = state.type;
  if (type === 'channel' && !channels.length && contacts.length) type = 'contact';
  if (type === 'contact' && !contacts.length && channels.length) type = 'channel';
  const sets = type === 'channel' ? channels : contacts;
  if (!sets.length) { showMsg('importError', 'No zone channels or contacts found in that XML.', 'error'); return; }

  const items = sets.map((s) => ({
    name: s.getAttribute('alias'),
    xml: setXml(s),
    summary: summarize(type, s),
    tags: $('importTags').value,
    source: type === 'channel' ? `Zone: ${s.parentNode.parentNode.getAttribute('alias')}` : 'Contacts',
  }));
  try {
    const r = await Library.save(type, items, $('importConflict').value);
    $('importDialog').close();
    toast(`Imported ${plural(items.length, NOUN[type])}: ${r.added} added, ${r.replaced} replaced, ${r.skipped} skipped.`, 5000);
    switchType(type);
  } catch (e) {
    showMsg('importError', e.message, 'error');
  }
}

/* ------------------------ RadioReference import ------------------------- */

const rr = { channels: [], contacts: [], tgIndex: new Map(), specs: [], title: '', excluded: new Set(), tagsTouched: false };

async function openRR() {
  try {
    [rr.channels, rr.contacts] = await Promise.all([Library.list('channel'), Library.list('contact')]);
  } catch (e) { toast(e.message, 5000); return; }
  rr.tgIndex = groupIdIndex(rr.contacts);
  // Template choices: built-in, or any Library channel of the same kind.
  const fill = (sel, kind, label) => {
    const prev = sel.value;
    const opts = rr.channels.filter((c) => c.summary.startsWith(label));
    sel.replaceChildren(h('option', { value: 'builtin' }, `Built-in ${kind}`),
      ...opts.map((c) => h('option', { value: String(c.id) }, `Like: ${c.name}`)));
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  };
  fill($('rrTplA'), 'analog', 'Analog');
  fill($('rrTplD'), 'digital', 'Digital');
  showMsg('rrError', '');
  $('rrText').value = '';
  $('rrTags').value = '';
  rr.tagsTouched = false;
  rr.excluded.clear();
  $('rrDialog').showModal();
  $('rrText').focus();
  renderRR();
}

function tgContactName(id) {
  return rr.tgIndex.get(id) || truncName($('rrTgName').value.replace('{id}', id) || `TG ${id}`);
}

function renderRR() {
  const { title, rows } = parseRadioReference($('rrText').value);
  rr.title = title;
  if (!rr.tagsTouched) $('rrTags').value = title;
  const opts = { nameFrom: $('rrNameFrom').value, repeaterOffset: $('rrOffset').checked };
  rr.specs = rows.map((o) => rrToSpec(o, opts));
  uniquifyNames(rr.specs.filter((s) => !s.skip));

  const ok = rr.specs.filter((s, i) => !s.skip && !rr.excluded.has(i));
  const tgs = [...new Set(ok.filter((s) => s.kind === 'digital' && s.tg != null).map((s) => s.tg))];
  const newTgs = tgs.filter((id) => !rr.tgIndex.has(id));
  const skipped = rr.specs.filter((s) => s.skip).length;

  $('rrSummary').replaceChildren(rows.length
    ? h('span', {},
      h('strong', {}, plural(ok.length, 'channel')), ' to import',
      tgs.length ? ` · talkgroups ${tgs.join(', ')}` : '',
      newTgs.length && $('rrContacts').checked ? ` · ${plural(newTgs.length, 'new contact')} (${newTgs.map(tgContactName).join(', ')})` : '',
      tgs.length - newTgs.length ? ` · ${tgs.length - newTgs.length} already in the Library` : '',
      skipped ? ` · ${skipped} skipped` : '')
    : h('span', { class: 'muted' }, 'Paste a RadioReference table to see a preview.'));

  $('rrPreview').replaceChildren(
    h('thead', {}, h('tr', {}, ['', 'Name', 'RX', 'TX', 'Type', 'Signalling', 'Contact', 'Notes'].map((t) => h('th', {}, t)))),
    h('tbody', {}, rr.specs.map((s, i) => h('tr', { class: s.skip ? 'skip' : '' },
      h('td', {}, h('input', {
        type: 'checkbox', checked: !s.skip && !rr.excluded.has(i), disabled: !!s.skip,
        onchange: (e) => { e.target.checked ? rr.excluded.delete(i) : rr.excluded.add(i); renderRR(); },
      })),
      h('td', {}, s.name || s.alpha),
      h('td', { class: 'num-cell' }, mhz(s.rx)),
      h('td', { class: 'num-cell' }, s.skip ? '' : s.tx === s.rx ? 'simplex' : mhz(s.tx)),
      h('td', {}, s.kind ? `${s.kind === 'digital' ? 'Digital' : 'Analog'} (${s.mode})` : s.mode),
      h('td', {}, specSignalling(s)),
      h('td', {}, s.kind === 'digital' && s.tg != null ? tgContactName(s.tg) : ''),
      h('td', { class: 'rr-notes' }, s.skip || s.notes.join('; '))))));
  $('rrGo').disabled = !ok.length;
  $('rrGo').textContent = ok.length ? `Import ${plural(ok.length, 'channel')}` : 'Import';
}

async function doRRImport() {
  const specs = rr.specs.filter((s, i) => !s.skip && !rr.excluded.has(i));
  if (!specs.length) return;
  const tpl = (sel, kind) => (sel.value === 'builtin' ? TEMPLATES[kind] : rr.channels.find((c) => String(c.id) === sel.value).xml);
  const tplA = tpl($('rrTplA'), 'analog');
  const tplD = tpl($('rrTplD'), 'digital');
  const source = `RadioReference${rr.title ? ': ' + rr.title : ''}`;
  const extraTags = $('rrTags').value;
  const makeContacts = $('rrContacts').checked;
  try {
    // 1. Talkgroup contacts the Library doesn't have yet.
    const newIds = [...new Set(specs.filter((s) => s.kind === 'digital' && s.tg != null && !rr.tgIndex.has(s.tg)).map((s) => s.tg))];
    let contactRes = null;
    if (makeContacts && newIds.length) {
      const items = newIds.map((id) => {
        const set = buildContactSet(tgContactName(id), id);
        return { name: set.getAttribute('alias'), xml: setXml(set), summary: contactSummary(set), tags: extraTags, source };
      });
      contactRes = await Library.save('contact', items, 'skip');
      newIds.forEach((id) => rr.tgIndex.set(id, tgContactName(id)));
    }
    // 2. Channels.
    const items = specs.map((s) => {
      const contact = s.kind === 'digital' && s.tg != null && rr.tgIndex.has(s.tg) ? rr.tgIndex.get(s.tg) : null;
      const set = buildChannelSet(s, s.kind === 'digital' ? tplD : tplA, contact);
      const tags = [extraTags, s.tag].filter(Boolean).join(', ');
      const notes = [s.desc, s.license && `License ${s.license}`, ...s.notes].filter(Boolean).join(' · ');
      return { name: s.name, xml: setXml(set), summary: channelSummary(set), tags, notes, source };
    });
    const r = await Library.save('channel', items, $('rrConflict').value);
    $('rrDialog').close();
    let msg = `RadioReference: ${r.added} channels added, ${r.replaced} replaced, ${r.skipped} skipped`;
    if (contactRes) msg += ` · ${contactRes.added} talkgroup contacts added`;
    toast(msg + '.', 6000);
    rr.excluded.clear();
    switchType('channel');
  } catch (e) {
    showMsg('rrError', e.message, 'error');
  }
}

/* ------------------------ Checked items -> CPS2 XML ---------------------- */

function buildDoc(items, zoneName) {
  if (state.type === 'channel') {
    const doc = emptyDoc('Zone');
    const z = doc.createElement('set');
    z.setAttribute('name', 'Zone'); z.setAttribute('alias', zoneName); z.setAttribute('key', 'NORMAL');
    const coll = doc.createElement('collection'); coll.setAttribute('name', 'ZoneItems');
    z.append(coll);
    const field = (name, text, Name) => {
      const f = doc.createElement('field'); f.setAttribute('name', name);
      if (Name) f.setAttribute('Name', Name);
      f.textContent = text; z.append(f);
    };
    field('ZP_ZONEALIAS', zoneName); field('ZP_ZONETYPE', 'NORMAL', 'Normal'); field('ZP_ZVFNLITEM', 'NONE', 'None'); field('Comments', '');
    const used = new Set();
    for (const s of importItems(doc, items)) {
      let a = s.getAttribute('alias');
      for (let i = 2; used.has(a); i++) a = `${s.getAttribute('alias')} ${i}`;
      used.add(a);
      if (a !== s.getAttribute('alias')) setVal(s, { ...ALIAS_COL }, a);
      coll.append(s);
    }
    doc.getElementsByTagName('category')[0].append(z);
    return doc;
  }
  const doc = emptyDoc('PCRContacts');
  const cat = doc.getElementsByTagName('category')[0];
  importItems(doc, items).forEach((s) => cat.append(s));
  return doc;
}

function openBuild() {
  const items = checkedItems();
  if (!items.length) return toast(`Check the ${NOUN[state.type]}s to use first.`);
  const isCh = state.type === 'channel';
  $('buildTitle').textContent = `Use ${plural(items.length, NOUN[state.type])}`;
  $('buildDesc').textContent = isCh
    ? 'Make a new zone from these channels. Copy its XML to paste into CPS2, or add it to your workspace to edit it first.'
    : 'Copy the contacts as CPS2 XML, or add them to the Contacts workspace.';
  $('buildZoneRow').hidden = !isCh;
  $('buildZone').value = 'Library';
  $('buildWs').textContent = isCh ? 'Add zone to workspace' : 'Add to Contacts workspace';
  $('buildDialog').showModal();
  if (isCh) { $('buildZone').focus(); $('buildZone').select(); }
}

async function buildCopy() {
  const name = $('buildZone').value.trim() || 'Library';
  const xml = serializeDoc(buildDoc(checkedItems(), name));
  const ok = await copyText(xml);
  $('buildDialog').close();
  toast(ok ? 'XML copied — paste it into CPS2.' : 'Copy failed.', 4000);
}

function buildWorkspace() {
  const items = checkedItems();
  if (state.type === 'channel') {
    const name = $('buildZone').value.trim() || 'Library';
    if (WsNames.of('zone').includes(name) && !confirm(`The workspace already has a zone "${name}". Replace it?`)) return;
    const w = Workspace.load('zone') || { doc: emptyDoc('Zone'), decl: DEFAULT_DECL };
    mergeItems(w.doc, buildDoc(items, name), 'zone');
    Workspace.save('zone', serializeDoc(w.doc, w.decl));
    toast(`Zone "${name}" added to the workspace. Open the Zone editor to review it.`, 5000);
  } else {
    const added = Workspace.addSets('contacts', importItems(document.implementation.createDocument(null, null), items));
    const skipped = items.length - added.length;
    toast(`Added ${plural(added.length, 'contact')} to the Contacts workspace${skipped ? ` (${skipped} already there)` : ''}.`, 5000);
  }
  $('buildDialog').close();
}

/* --------------------------- Delete / backup ---------------------------- */

async function deleteChecked() {
  const items = checkedItems();
  if (!items.length) return toast(`Check the ${NOUN[state.type]}s to delete first.`);
  if (!confirm(`Delete ${plural(items.length, NOUN[state.type])} from the library? This can't be undone.`)) return;
  try {
    const r = await Library.remove(items.map((i) => i.id));
    toast(`Deleted ${plural(r.deleted, NOUN[state.type])}.`);
    load();
  } catch (e) { toast(e.message, 5000); }
}

async function exportLibrary() {
  try {
    const [channel, contact] = await Promise.all([Library.list('channel'), Library.list('contact')]);
    const strip = (it) => ({ name: it.name, summary: it.summary, tags: it.tags, notes: it.notes, source: it.source, xml: it.xml });
    downloadFile(`cps2-library-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ app: 'cps2tools-library', version: 1, channel: channel.map(strip), contact: contact.map(strip) }, null, 2),
      'application/json');
  } catch (e) { toast(e.message, 5000); }
}

async function importLibrary(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'cps2tools-library') throw new Error('That file is not a CPS2 Tools library export.');
    const onConflict = confirm('Replace library items that have the same name?\n\nOK = replace, Cancel = keep the current ones') ? 'replace' : 'skip';
    const res = [];
    for (const type of ['channel', 'contact']) {
      if (data[type] && data[type].length) {
        const r = await Library.save(type, data[type], onConflict);
        res.push(`${NOUN[type]}s: ${r.added} added, ${r.replaced} replaced, ${r.skipped} skipped`);
      }
    }
    toast(res.join(' · ') || 'Nothing to import.', 6000);
    load();
  } catch (e) { toast(e.message, 6000); }
}

/* -------------------------------- Wiring -------------------------------- */

function switchType(type) {
  state.type = type;
  state.checked.clear();
  document.querySelectorAll('.tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.type === type));
  load();
}

initShell();
document.querySelectorAll('.tabs .tab').forEach((t) => t.addEventListener('click', () => switchType(t.dataset.type)));
$('libSearch').addEventListener('input', render);
$('importBtn').addEventListener('click', openImport);
$('importGo').addEventListener('click', doImport);
$('importCancel').addEventListener('click', () => $('importDialog').close());
$('rrBtn').addEventListener('click', openRR);
$('rrGo').addEventListener('click', doRRImport);
$('rrCancel').addEventListener('click', () => $('rrDialog').close());
$('rrText').addEventListener('input', () => { rr.excluded.clear(); renderRR(); });
$('rrTags').addEventListener('input', () => { rr.tagsTouched = true; });
for (const id of ['rrNameFrom', 'rrOffset', 'rrContacts', 'rrTgName']) $(id).addEventListener(id === 'rrTgName' ? 'input' : 'change', renderRR);
$('buildBtn').addEventListener('click', openBuild);
$('buildCopy').addEventListener('click', buildCopy);
$('buildWs').addEventListener('click', buildWorkspace);
$('buildCancel').addEventListener('click', () => $('buildDialog').close());
$('delBtn').addEventListener('click', deleteChecked);
$('exportBtn').addEventListener('click', exportLibrary);
$('importFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importLibrary(f); });
// Backup menu
$('moreBtn').addEventListener('click', (e) => { e.stopPropagation(); $('moreMenu').hidden = !$('moreMenu').hidden; });
document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) $('moreMenu').hidden = true; });
load();
