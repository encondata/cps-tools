'use strict';

/* ---------------------------------------------------------------------------
 * Setup: paste any CPS2 XML into the shared workspace and see what's loaded.
 * ------------------------------------------------------------------------- */

function itemNames(type, doc) {
  if (type !== 'zone') return itemsOf(doc, type).map((s) => s.getAttribute('alias'));
  return itemsOf(doc, 'zone').map((z) =>
    `${z.getAttribute('alias')} (${kids(named(z, 'collection', 'ZoneItems'), 'set').length})`);
}

function renderCards() {
  $('wsCards').replaceChildren(...PAGES.map((p) => {
    const e = Workspace.get(p.id);
    if (!e) {
      return h('div', { class: 'ws-card empty' },
        h('h3', {}, p.label),
        h('p', { class: 'muted' }, 'Not loaded. Paste it above, or in the editor.'),
        h('div', { class: 'actions' }, h('a', { class: 'button ghost', href: `../${p.path}` }, 'Open editor')));
    }
    let names = [];
    try { names = itemNames(p.id, parseXml(e.xml).doc); } catch { /* shown as 0 */ }
    const preview = names.slice(0, 8).join(', ') + (names.length > 8 ? `, … +${names.length - 8} more` : '');
    return h('div', { class: 'ws-card' },
      h('div', { class: 'ws-card-head' },
        h('h3', {}, p.label),
        e.changed
          ? h('span', { class: 'badge warn', title: 'Edited here since it was pasted from CPS2' }, 'Changed — copy back to CPS2')
          : h('span', { class: 'badge ok' }, 'Matches CPS2')),
      h('p', { class: 'ws-count' }, plural(names.length, p.noun)),
      h('p', { class: 'muted small ws-names' }, preview),
      h('p', { class: 'muted small' }, `Pasted ${timeAgo(e.pastedAt)}${e.updatedAt !== e.pastedAt ? ` · edited ${timeAgo(e.updatedAt)}` : ''}`),
      h('div', { class: 'actions' },
        h('a', { class: 'button primary', href: `../${p.path}` }, 'Open editor'),
        h('button', {
          class: 'ghost',
          onclick: async () => {
            const ok = await copyText(Workspace.get(p.id).xml);
            if (ok) { Workspace.markCopied(p.id); renderCards(); }
            toast(ok ? `${p.label} XML copied — paste it into CPS2.` : 'Copy failed.');
          },
        }, 'Copy XML'),
        h('button', { class: 'ghost', onclick: () => downloadFile(`${p.label.replace(/ /g, '')}.xml`, Workspace.get(p.id).xml) }, 'Download'),
        h('button', {
          class: 'ghost danger',
          onclick: () => { if (confirm(`Remove ${p.label} from the workspace?`)) { Workspace.clear(p.id); renderCards(); } },
        }, 'Remove')));
  }));
}

function addPasted() {
  const text = $('setupInput').value;
  let res;
  try { res = Workspace.paste(text, { replace: $('setupReplace').checked }); } catch (err) {
    showMsg('setupMsg', err.message, 'error');
    return;
  }
  if (!res.types.length) {
    showMsg('setupMsg', 'No Zones, Scan Lists, RX Group Lists or Contacts were found in that XML.', 'error');
    return;
  }
  showMsg('setupMsg', describePaste(res), 'ok');
  $('setupInput').value = '';
  renderCards();
}

$('setupAdd').addEventListener('click', addPasted);
$('setupClearInput').addEventListener('click', () => { $('setupInput').value = ''; showMsg('setupMsg', ''); });

$('exportBtn').addEventListener('click', () => {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`cps2-workspace-${stamp}.json`, JSON.stringify({ app: 'cps2tools', version: 1, workspace: Workspace.all() }, null, 2), 'application/json');
});
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'cps2tools' || typeof data.workspace !== 'object') throw new Error();
    if (!confirm('Replace the current workspace with the imported one?')) return;
    Workspace.replaceAll(data.workspace);
    renderCards();
    toast('Workspace imported.');
  } catch {
    toast('That file is not a CPS2 Tools workspace export.', 4000);
  }
});
$('clearAllBtn').addEventListener('click', () => {
  if (confirm('Remove everything from the workspace? Anything not copied back into CPS2 will be lost.')) { Workspace.clearAll(); renderCards(); }
});

initShell();
$('storageStatus').textContent = Workspace.persistent
  ? 'Saved in this browser — it stays until you clear it.'
  : 'Browser storage is unavailable, so the workspace only lasts until you leave this page.';
window.addEventListener('storage', renderCards);
window.addEventListener('focus', renderCards);
renderCards();
