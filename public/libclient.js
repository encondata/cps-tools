'use strict';

/* ---------------------------------------------------------------------------
 * Central library client (requires common.js). Talks to the server's
 * /api/library, builds one-line summaries of channels and contacts, and
 * provides the "pick from library" and "save to library" dialogs.
 * ------------------------------------------------------------------------- */

const Library = (() => {
  const base = () => (document.body.dataset.base || '') + 'api/library';

  async function call(path, opts = {}) {
    let res;
    try {
      res = await fetch(base() + path, {
        ...opts,
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      throw new Error('The library server could not be reached.');
    }
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) throw new Error(data.error || (res.status === 404 ? 'The library server is not running (static hosting?).' : `Server error ${res.status}.`));
    return data;
  }

  return {
    list: async (type, q = '') => (await call(`?type=${type}&q=${encodeURIComponent(q)}`)).items,
    save: (type, items, onConflict = 'replace') => call('', { method: 'POST', body: { type, items, onConflict } }),
    update: (id, patch) => call(`/${id}`, { method: 'PUT', body: patch }),
    remove: (ids) => call('/delete', { method: 'POST', body: { ids } }),
  };
})();

/* ------------------------------- Summaries ------------------------------ */

const fval = (set, n) => { const e = fieldEl(set, n); return e ? e.textContent : null; };
const fname = (set, n) => { const e = fieldEl(set, n); return e ? e.getAttribute('Name') || e.textContent : null; };
const mhz = (v) => (v == null || !isFinite(Number(v)) ? '?' : String(Number(Number(v).toFixed(6))));
const stripRef = (v) => String(v || '').replace(/^(ScanItems|DigitalRXGroupList)\//, '');

function channelSummary(ch) {
  const rx = fval(ch, 'CP_RXFREQ'), tx = fval(ch, 'CP_TXFREQ');
  const parts = [fname(ch, 'CP_PERSTYPE') || ch.getAttribute('key') || 'Channel'];
  parts.push(rx === tx || tx == null ? `${mhz(rx)} simplex` : `RX ${mhz(rx)} / TX ${mhz(tx)}`);
  if (fval(ch, 'CP_COLORCODE') != null) {
    parts.push(`CC${fval(ch, 'CP_COLORCODE')} TS${fname(ch, 'CP_SLTASSGMNT') || '?'}`);
    const contact = fval(ch, 'CP_UKPPERS');
    if (contact && contact !== 'NONE') parts.push(contact);
    const grp = fval(ch, 'CP_TGLISTIT');
    if (grp && grp !== 'NONE') parts.push(`RX grp ${stripRef(grp)}`);
  } else {
    const sq = (type, tone, dpl) => ({ TPL: `PL ${fval(ch, tone)}`, DPL: `DPL ${fval(ch, dpl)}` }[fval(ch, type)] || null);
    const rsq = sq('CP_XSQCHTY', 'CP_RXTPLFREQ', 'CP_RXDPLCD');
    const tsq = sq('CP_TXSQCHTY', 'CP_TXTTPLFREQ', 'CP_TXTDPLCD');
    if (rsq || tsq) parts.push(rsq === tsq ? rsq : `RX ${rsq || 'CSQ'} / TX ${tsq || 'CSQ'}`);
    const bw = fname(ch, 'CP_CHNLBWDTH');
    if (bw) parts.push(`${bw} kHz`);
  }
  return parts.join(' · ');
}

function contactSummary(ct) {
  const parts = [];
  for (const coll of kids(ct, 'collection')) {
    for (const s of kids(coll, 'set')) {
      const type = fval(s, 'CallType') || coll.getAttribute('name');
      const id = kids(s, 'field').find((f) => /_CALLLSTID$/.test(f.getAttribute('name')));
      parts.push(`${type}${id ? ' ' + id.textContent : ''}`);
    }
  }
  return parts.join(' · ') || 'No call entries';
}

const summarize = (type, set) => (type === 'channel' ? channelSummary(set) : contactSummary(set));

// A single <set> as standalone XML.
function setXml(set) {
  const out = [];
  serializeEl(set, 0, out);
  return out.join('\r\n');
}

// Library items -> <set> elements owned by `doc`.
const importItems = (doc, items) => items.map((it) => doc.importNode(parseXml(it.xml).doc.documentElement, true));

/* -------------------------------- Dialogs ------------------------------- */

// Save sets to the library, asking for tags and what to do with existing names.
async function saveSetsToLibrary(type, sets, source) {
  const noun = type === 'channel' ? 'channel' : 'contact';
  const choice = await askScope({
    title: `Save ${noun}s to Library`,
    desc: `Stores the ${noun}s in the central library so they can be added to other radios. Items are matched by name.`,
    noun,
    total: sets.all.length,
    selected: sets.selected.length,
    fields: [
      { key: 'tags', label: 'Tags (comma separated, optional)', placeholder: 'e.g. Retail, UHF', value: '' },
      {
        key: 'onConflict', type: 'select', label: 'If the name is already in the library',
        options: [
          { value: 'replace', label: 'Replace the library copy' },
          { value: 'skip', label: 'Keep the library copy (skip)' },
          { value: 'keep', label: 'Keep both (save with a new name)' },
        ],
        value: 'replace',
      },
    ],
  });
  if (!choice) return null;
  const chosen = choice.scope === 'selected' ? sets.selected : sets.all;
  const items = chosen.map((s) => ({
    name: s.getAttribute('alias'), xml: setXml(s), summary: summarize(type, s), tags: choice.values.tags, source,
  }));
  try {
    const r = await Library.save(type, items, choice.values.onConflict);
    const parts = [r.added && `added ${r.added}`, r.replaced && `replaced ${r.replaced}`, r.skipped && `skipped ${r.skipped}`].filter(Boolean);
    toast(`Library: ${parts.join(', ') || 'nothing saved'}.`, 4000);
    return r;
  } catch (e) {
    toast(e.message, 6000);
    return null;
  }
}

// Let the user pick library items. Resolves to the chosen items, or null.
async function pickFromLibrary(type, { title, confirmLabel = 'Add selected', existing = new Set() } = {}) {
  let items;
  try { items = await Library.list(type); } catch (e) { toast(e.message, 6000); return null; }
  if (!items.length) { toast(`The library has no ${type}s yet. Save some from an editor or import on the Library page.`, 6000); return null; }

  $('libPicker')?.remove();
  const chosen = new Set();
  const search = h('input', { type: 'search', placeholder: 'Search name, tags, frequency…', class: 'lib-search' });
  const count = h('span', { class: 'muted small' });
  const tbody = h('tbody');
  const confirm = h('button', { value: 'ok', class: 'primary' }, confirmLabel);

  const visible = () => {
    const t = search.value.toLowerCase();
    return items.filter((it) => !t || `${it.name} ${it.summary} ${it.tags} ${it.notes} ${it.source}`.toLowerCase().includes(t));
  };
  const render = () => {
    const rows = visible();
    tbody.replaceChildren(...rows.map((it) => h('tr', { class: chosen.has(it) ? 'checked' : '' },
      h('td', {}, h('input', {
        type: 'checkbox', checked: chosen.has(it),
        onchange: (e) => { e.target.checked ? chosen.add(it) : chosen.delete(it); render(); },
      })),
      h('td', {}, it.name, existing.has(it.name) ? h('span', { class: 'badge warn', title: 'Already in this radio — it will be added with a new name' }, 'exists') : null),
      h('td', { class: 'muted small' }, it.summary),
      h('td', { class: 'small' }, it.tags))));
    count.textContent = `${chosen.size} selected · ${rows.length} of ${items.length} shown`;
    confirm.disabled = !chosen.size;
  };
  search.addEventListener('input', render);

  const dlg = h('dialog', { id: 'libPicker', class: 'dialog dialog-wide' },
    h('form', { method: 'dialog' },
      h('h3', {}, title || `Add ${type}s from Library`),
      h('div', { class: 'lib-picker-bar' }, search,
        h('button', { type: 'button', onclick: () => { visible().forEach((it) => chosen.add(it)); render(); } }, 'Select shown'),
        h('button', { type: 'button', onclick: () => { chosen.clear(); render(); } }, 'Clear')),
      h('div', { class: 'lib-picker-list' },
        h('table', { class: 'lib-table' }, h('thead', {}, h('tr', {}, h('th'), h('th', {}, 'Name'), h('th', {}, 'Summary'), h('th', {}, 'Tags'))), tbody)),
      h('div', { class: 'dialog-actions' }, count, h('span', { style: 'flex:1' }),
        h('button', { type: 'button', onclick: () => dlg.close('cancel') }, 'Cancel'), confirm)));
  document.body.append(dlg);
  render();
  dlg.showModal();
  search.focus();

  // Resolve on the button press itself; the close event can be deferred
  // (e.g. in a background tab), so it is only a fallback for Esc.
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok ? items.filter((it) => chosen.has(it)) : null);
      if (dlg.open) dlg.close();
      dlg.remove();
    };
    dlg.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); if (chosen.size) finish(true); });
    dlg.addEventListener('cancel', () => finish(false));
    dlg.addEventListener('close', () => finish(dlg.returnValue === 'ok'));
  });
}
