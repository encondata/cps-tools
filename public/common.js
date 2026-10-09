'use strict';

/* ---------------------------------------------------------------------------
 * Shared helpers for every CPS2 page: DOM + XML utilities, the site header,
 * theme toggle, the shared Workspace (browser storage for every pasted XML),
 * cross-reference updates, the Paste / Edit / Copy tab workflow, and the
 * "All or Selected" function dialog.
 * ------------------------------------------------------------------------- */

const DEFAULT_DECL = '<?xml version="1.0" encoding="utf-8" standalone="yes"?>';

// Editor pages. setName is the <set name="..."> each one edits.
const PAGES = [
  { id: 'zone', path: 'zone/', label: 'Zones', setName: 'Zone', noun: 'zone',
    desc: 'Edit zones and their channels: frequencies, squelch, power, scan list and more.' },
  { id: 'scan', path: 'scan/', label: 'Scan Lists', setName: 'ScanItems', noun: 'scan list',
    desc: 'Edit scan list settings and build or reorder the member channels of each list.' },
  { id: 'rxgroup', path: 'rxgroup/', label: 'RX Group Lists', setName: 'DigitalRXGroupList', noun: 'group list',
    desc: 'Edit Digital RX Group Lists and the contacts in each list.' },
  { id: 'contacts', path: 'contacts/', label: 'Contacts', setName: 'PCRContacts', noun: 'contact',
    desc: 'Edit contacts and their Digital, MDC and Quik-Call II call IDs.' },
];
const pageInfo = (id) => PAGES.find((p) => p.id === id);

/* ----------------------------- DOM helpers ------------------------------ */

const $ = (id) => document.getElementById(id);
const kids = (el, tag) => el ? [...el.children].filter((c) => c.tagName === tag) : [];
const named = (el, tag, name) => kids(el, tag).find((c) => c.getAttribute('name') === name);
const fieldEl = (set, name) => named(set, 'field', name);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

function toast(text, ms = 2200) {
  let t = $('toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast', hidden: true }); document.body.append(t); }
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, ms);
}

function showMsg(id, text, kind) {
  const m = $(id);
  m.hidden = !text;
  m.textContent = text || '';
  m.className = 'msg ' + (kind || '');
}

function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // navigator.clipboard needs HTTPS/localhost; fall back for plain-HTTP LAN access.
    const ta = fallbackEl || h('textarea', { style: 'position:fixed;left:-9999px' });
    if (!fallbackEl) { ta.value = text; document.body.append(ta); }
    ta.select();
    const ok = document.execCommand('copy');
    if (!fallbackEl) ta.remove();
    return ok;
  }
}

function downloadFile(name, text, type = 'application/xml') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  h('a', { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* --------------------------------- XML ---------------------------------- */

function parseXml(text) {
  text = text.replace(/^﻿/, '').trim();
  if (!text) throw new Error('Nothing to load — paste the XML from CPS2 first.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error('The XML could not be read:\n' + err.textContent.trim().split('\n').slice(0, 3).join('\n'));
  const decl = text.match(/^<\?xml[^?]*\?>/);
  return { doc, decl: decl ? decl[0] : DEFAULT_DECL };
}

// Sets of a given name anywhere in the document, e.g. <set name="Zone">.
const setsNamed = (doc, name) => [...doc.getElementsByTagName('set')].filter((s) => s.getAttribute('name') === name);

// Top-level item sets of an editor type (zones must hold a ZoneItems collection).
function itemsOf(doc, type) {
  const sets = setsNamed(doc, pageInfo(type).setName);
  return type === 'zone' ? sets.filter((s) => named(s, 'collection', 'ZoneItems')) : sets;
}

// Which editor types does this document contain?
const detectTypes = (doc) => PAGES.filter((p) => itemsOf(doc, p.id).length).map((p) => p.id);

function esc(s, attr) {
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return attr ? s.replace(/"/g, '&quot;') : s;
}

// Pretty-print in CPS2's own style: 2-space indent, empty collections self-closed.
function serializeEl(el, depth, out) {
  const ind = '  '.repeat(depth);
  const attrs = [...el.attributes].map((a) => ` ${a.name}="${esc(a.value, true)}"`).join('');
  const children = [...el.children];
  if (!children.length) {
    if (el.tagName === 'collection' && !el.textContent) out.push(`${ind}<${el.tagName}${attrs} />`);
    else out.push(`${ind}<${el.tagName}${attrs}>${esc(el.textContent)}</${el.tagName}>`);
    return;
  }
  out.push(`${ind}<${el.tagName}${attrs}>`);
  for (const c of children) serializeEl(c, depth + 1, out);
  out.push(`${ind}</${el.tagName}>`);
}

function serializeDoc(doc, decl) {
  if (!doc) return '';
  const out = [decl || DEFAULT_DECL];
  serializeEl(doc.documentElement, 0, out);
  return out.join('\r\n');
}

// A fresh <config><category name="..."/></config> document.
function emptyDoc(category) {
  return parseXml(`${DEFAULT_DECL}<config><category name="${category}"></category></config>`).doc;
}

// Merge the items of `incoming` into `base` (same type): items with the same
// name are replaced in place, new ones are appended. Returns {added, updated}.
function mergeItems(base, incoming, type) {
  const existing = itemsOf(base, type);
  let cat = existing.length ? existing[0].parentNode : null;
  const res = { added: [], updated: [] };
  for (const item of itemsOf(incoming, type)) {
    const copy = base.importNode(item, true);
    const alias = item.getAttribute('alias');
    const same = itemsOf(base, type).find((s) => s.getAttribute('alias') === alias);
    if (same) { same.replaceWith(copy); res.updated.push(alias); continue; }
    if (!cat) {
      const catName = item.parentNode.getAttribute('name') || pageInfo(type).setName;
      cat = [...base.getElementsByTagName('category')].find((c) => c.getAttribute('name') === catName);
      if (!cat) { cat = base.createElement('category'); cat.setAttribute('name', catName); base.documentElement.append(cat); }
    }
    cat.append(copy);
    res.added.push(alias);
  }
  return res;
}

/* ------------------------------- Workspace ------------------------------ */

// Every pasted XML, kept in browser storage so all editors can use them.
// Entry per type: {xml, pastedAt, updatedAt, changed}. `changed` means edited
// since it was pasted or last copied, i.e. it needs pasting back into CPS2.
const Workspace = (() => {
  const KEY = 'cps2tools.workspace.v1';
  let memory = null; // fallback when browser storage is unavailable

  function readAll() {
    if (memory) return memory;
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { memory = {}; return memory; }
  }
  function writeAll(all) {
    if (memory) { memory = all; return; }
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') { toast('The workspace is too large to save in this browser.', 6000); return; }
      memory = all;
    }
  }

  return {
    KEY,
    get persistent() { readAll(); return !memory; },
    all: readAll,
    get: (type) => readAll()[type] || null,
    has: (type) => !!readAll()[type],
    // Parsed document for a type, or null.
    load(type) { const e = readAll()[type]; return e ? parseXml(e.xml) : null; },
    // opts.pasted: fresh from CPS2 (clears `changed`).
    save(type, xml, opts = {}) {
      const all = readAll();
      const prev = all[type];
      if (prev && prev.xml === xml && !opts.pasted) return false;
      const now = Date.now();
      all[type] = {
        xml,
        pastedAt: opts.pasted || !prev ? now : prev.pastedAt,
        updatedAt: now,
        changed: opts.pasted ? false : true,
      };
      writeAll(all);
      return true;
    },
    markCopied(type) {
      const all = readAll();
      if (all[type] && all[type].changed) { all[type].changed = false; writeAll(all); }
    },
    clear(type) { const all = readAll(); delete all[type]; writeAll(all); },
    clearAll() { writeAll({}); },
    replaceAll(obj) { writeAll(obj); },
    // Load, modify with fn(doc) -> count, and save if anything changed.
    update(type, fn) {
      const w = this.load(type);
      if (!w) return 0;
      const n = fn(w.doc);
      if (n) this.save(type, serializeDoc(w.doc, w.decl));
      return n;
    },
    // Add <set> elements (e.g. contacts from the library) to a type's workspace
    // document, creating it if needed. Existing names are left alone.
    // Returns the names added.
    addSets(type, sets) {
      const w = this.load(type) || { doc: emptyDoc(pageInfo(type).setName), decl: DEFAULT_DECL };
      const have = new Set(itemsOf(w.doc, type).map((s) => s.getAttribute('alias')));
      const existing = itemsOf(w.doc, type);
      const cat = existing.length ? existing[0].parentNode : w.doc.getElementsByTagName('category')[0];
      const added = [];
      for (const s of sets) {
        const alias = s.getAttribute('alias');
        if (have.has(alias)) continue;
        cat.append(w.doc.importNode(s, true));
        have.add(alias);
        added.push(alias);
      }
      if (added.length) this.save(type, serializeDoc(w.doc, w.decl));
      return added;
    },
    // Add pasted XML to the workspace, merging by name. Returns a summary per type.
    paste(text, { replace = false, only = null } = {}) {
      const { doc, decl } = parseXml(text);
      let types = detectTypes(doc);
      if (only) types = types.filter((t) => t === only);
      const out = [];
      for (const type of types) {
        const cur = !replace && this.load(type);
        if (!cur) {
          const base = emptyDoc(itemsOf(doc, type)[0].parentNode.getAttribute('name') || pageInfo(type).setName);
          const r = mergeItems(base, doc, type);
          this.save(type, serializeDoc(base, decl), { pasted: true });
          out.push({ type, added: r.added, updated: [] });
        } else {
          const r = mergeItems(cur.doc, doc, type);
          const wasChanged = this.get(type).changed;
          this.save(type, serializeDoc(cur.doc, cur.decl), { pasted: true });
          if (wasChanged) { const all = readAll(); all[type].changed = true; writeAll(all); }
          out.push({ type, ...r });
        }
      }
      return { types, results: out, detected: detectTypes(doc) };
    },
  };
})();

// Human summary of a Workspace.paste() result.
function describePaste(res) {
  return res.results.map(({ type, added, updated }) => {
    const p = pageInfo(type);
    const parts = [];
    if (added.length) parts.push(`added ${plural(added.length, p.noun)}`);
    if (updated.length) parts.push(`updated ${plural(updated.length, p.noun)}`);
    return `${p.label}: ${parts.join(', ') || 'nothing new'}`;
  }).join('\n');
}

/* ---------------------------- Cross-references -------------------------- */

// Name lists from the workspace, for pickers and validation.
const WsNames = {
  zones: () => { const w = Workspace.load('zone'); return w ? itemsOf(w.doc, 'zone') : []; },
  channels() {
    const names = new Set();
    for (const z of this.zones()) for (const c of kids(named(z, 'collection', 'ZoneItems'), 'set')) names.add(c.getAttribute('alias'));
    return [...names];
  },
  of(type) { const w = Workspace.load(type); return w ? itemsOf(w.doc, type).map((s) => s.getAttribute('alias')) : []; },
};

// How channels refer to other items: "ScanItems/<name>", "DigitalRXGroupList/<name>", "<contact name>".
const SCAN_REF_PREFIX = 'ScanItems/';
const RXGROUP_REF_PREFIX = 'DigitalRXGroupList/';

// Rename references to an item in the other workspace documents.
// Returns the number of references updated.
const Refs = {
  // Channel renamed -> scan list members.
  channel: (oldName, newName) => Workspace.update('scan', (doc) => renameValues(doc, 'ScanListItems', oldName, newName)),
  // Contact renamed -> RX group list members.
  contact: (oldName, newName) => Workspace.update('rxgroup', (doc) => renameValues(doc, 'DigitalRXGroupListItems', oldName, newName)),
  // Contact renamed -> digital channels' Contact.
  channelContact: (oldName, newName) => Workspace.update('zone', (doc) => renameFieldRefs(doc, 'CP_UKPPERS', oldName, newName)),
  // Scan list renamed -> channels' Scan / Roam List.
  scanList: (oldName, newName) => Workspace.update('zone',
    (doc) => renameFieldRefs(doc, 'CP_SCNROAMLISTIT', SCAN_REF_PREFIX + oldName, SCAN_REF_PREFIX + newName)),
  // RX group list renamed -> digital channels' RX Group List.
  rxGroup: (oldName, newName) => Workspace.update('zone',
    (doc) => renameFieldRefs(doc, 'CP_TGLISTIT', RXGROUP_REF_PREFIX + oldName, RXGROUP_REF_PREFIX + newName)),
};

function renameFieldRefs(doc, fieldName, oldVal, newVal) {
  let n = 0;
  for (const f of doc.getElementsByTagName('field')) {
    if (f.getAttribute('name') !== fieldName || f.textContent !== oldVal) continue;
    f.textContent = newVal;
    if (f.hasAttribute('Name')) f.setAttribute('Name', newVal);
    n++;
  }
  return n;
}

function renameValues(doc, multifield, oldName, newName) {
  let n = 0;
  for (const mf of doc.getElementsByTagName('multifield')) {
    if (mf.getAttribute('name') !== multifield) continue;
    for (const v of kids(mf, 'value')) if (v.textContent === oldName) { v.textContent = newName; n++; }
  }
  return n;
}

/* ------------------------------ Page shell ------------------------------ */

// Builds the site header. <body data-page="zone" data-base="../"> on sub-pages.
function initShell() {
  const page = document.body.dataset.page || 'home';
  const base = document.body.dataset.base || '';
  const link = (href, id, label) => h('a', { href, class: page === id ? 'active' : '' }, label);
  const nav = h('nav', { class: 'site-nav' },
    link(base || './', 'home', 'Home'),
    link(base + 'setup/', 'setup', 'Setup'),
    link(base + 'library/', 'library', 'Library'),
    link(base + 'external/', 'external', 'Load External'),
    PAGES.map((p) => link(base + p.path, p.id, p.label)));
  const themeBtn = h('button', { id: 'themeBtn', class: 'ghost theme-btn', title: 'Switch between light and dark theme' });
  document.body.prepend(h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: base || './' }, 'CPS2 Tools'), nav, themeBtn));

  const apply = (dark) => {
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    themeBtn.textContent = dark ? 'Light mode' : 'Dark mode';
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  };
  apply(document.documentElement.dataset.theme === 'dark');
  themeBtn.addEventListener('click', () => apply(document.documentElement.dataset.theme !== 'dark'));
}

/* ------------------------ Paste / Edit / Copy tabs ---------------------- */

function showTab(id) {
  document.querySelectorAll('.tabs .tab').forEach((t) => {
    const on = t.dataset.tab === id;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  });
  for (const p of ['inputPanel', 'editorPanel', 'outputPanel']) $(p).hidden = p !== id;
  window.scrollTo(0, 0);
}

// Wires the standard panels to the workspace.
//   type        editor type ('zone', 'scan', ...)
//   load(text)  parse + render a full document; return a summary (or throw)
//   serialize() full document XML (saved to the workspace)
//   output()    XML for the Copy tab (defaults to serialize)
function initWorkflow({ type, load, serialize, output, fileName }) {
  const info = pageInfo(type);
  let original = '';
  let saveTimer = null;

  const enableTabs = () => document.querySelectorAll('.tabs .tab').forEach((t) => { t.disabled = false; });
  const loadText = (text) => { const summary = load(text); original = text; enableTabs(); return summary; };

  const openFromWorkspace = (msg) => {
    const e = Workspace.get(type);
    if (!e) return false;
    try {
      const summary = loadText(e.xml);
      showMsg('inputMsg', `${msg || 'Loaded from the workspace'}: ${summary}`, 'ok');
    } catch (err) {
      showMsg('inputMsg', err.message, 'error');
      return false;
    }
    return true;
  };

  const doPaste = (text) => {
    let res;
    try {
      res = Workspace.paste(text, { replace: $('replaceWs') && $('replaceWs').checked, only: type });
    } catch (err) { showMsg('inputMsg', err.message, 'error'); return; }
    if (!res.types.length) {
      const other = res.detected.map((t) => pageInfo(t).label).join(', ');
      showMsg('inputMsg', other
        ? `That XML contains ${other}, not ${info.label}. Paste it in the matching editor or on the Setup page.`
        : `No ${info.label} found in that XML.`, 'error');
      return;
    }
    if (openFromWorkspace(describePaste(res).replace(/^[^:]+: /, 'Pasted — '))) {
      $('xmlInput').value = '';
      showTab('editorPanel');
    }
  };

  document.querySelectorAll('.tabs .tab, [data-goto]').forEach((b) => b.addEventListener('click', () => {
    showTab(b.dataset.tab || b.dataset.goto);
  }));
  $('parseBtn').addEventListener('click', () => doPaste($('xmlInput').value));
  $('clearInputBtn').addEventListener('click', () => { $('xmlInput').value = ''; showMsg('inputMsg', ''); });
  $('loadSampleBtn').addEventListener('click', async () => {
    try { doPaste(await (await fetch('sample.xml')).text()); } catch { showMsg('inputMsg', 'Could not load the sample file.', 'error'); }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Discard the edits made since this page was opened?')) return;
    loadText(original);
    Workspace.save(type, serialize());
  });
  $('copyBtn').addEventListener('click', async () => {
    const ok = await copyText($('xmlOutput').value, $('xmlOutput'));
    if (ok) Workspace.markCopied(type);
    toast(ok ? 'XML copied — paste it into CPS2.' : 'Copy failed — select the text and press Ctrl+C.');
  });
  $('downloadBtn').addEventListener('click', () => {
    downloadFile(`${(fileName() || info.label).replace(/[^\w.-]+/g, '_')}.xml`, $('xmlOutput').value);
  });

  // Another tab changed the workspace: reload so we don't overwrite it.
  window.addEventListener('storage', (e) => {
    if (e.key !== Workspace.KEY) return;
    const entry = Workspace.get(type);
    if (entry && entry.xml !== serialize()) { openFromWorkspace('Reloaded (changed in another tab)'); toast('Reloaded — the workspace changed in another tab.'); }
  });

  // Status line under the paste box.
  const status = $('wsStatus');
  if (status) {
    status.replaceChildren(Workspace.persistent
      ? h('span', {}, 'Pasted XML is added to the shared workspace (merged by name). ', h('a', { href: '../setup/' }, 'Manage the workspace →'))
      : h('span', { class: 'warn-text' }, 'Browser storage is unavailable, so the workspace only lasts until you leave this page.'));
  }

  // Open the workspace copy once the page script has finished setting up.
  queueMicrotask(() => { if (openFromWorkspace()) showTab('editorPanel'); });

  // Saves are batched; write any pending one before the page goes away.
  const flush = () => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; Workspace.save(type, serialize()); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  document.addEventListener('click', (e) => { if (e.target.closest('a[href]')) flush(); }, true);

  return {
    refreshOutput() {
      $('xmlOutput').value = output ? output() : serialize();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { saveTimer = null; Workspace.save(type, serialize()); }, 250);
    },
    flush,
    // Re-open this editor from the workspace (after creating data there).
    reopen(msg) { if (openFromWorkspace(msg)) showTab('editorPanel'); },
  };
}

/* --------------------------- Functions menu ----------------------------- */

// Wires a "Functions ▾" menu: <div class="menu"><button id=fnBtn> + <div id=fnMenu> of [data-fn] items.
function initFunctionMenu(run) {
  const btn = $('fnBtn'), menu = $('fnMenu');
  const toggle = (open) => {
    menu.hidden = !(open ?? menu.hidden);
    btn.setAttribute('aria-expanded', !menu.hidden);
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-fn]');
    if (!item) return;
    toggle(false);
    run(item.dataset.fn);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) toggle(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
}

// Ask for one line of text. validate(value) returns an error string or null.
// Resolves to the trimmed text, or null when cancelled.
function askText({ title, desc, label, value = '', maxLength, validate, okLabel = 'OK' }) {
  $('textDialog')?.remove();
  const input = h('input', { type: 'text', value, autocomplete: 'off', maxLength: maxLength || undefined });
  const error = h('div', { class: 'msg error', hidden: true });
  const dlg = h('dialog', { id: 'textDialog', class: 'dialog' },
    h('form', { method: 'dialog' },
      h('h3', {}, title),
      desc ? h('p', { class: 'dialog-desc' }, desc) : null,
      h('label', { class: 'dialog-field' }, h('span', {}, label), input),
      error,
      h('div', { class: 'dialog-actions' },
        h('button', { type: 'button', onclick: () => dlg.close('cancel') }, 'Cancel'),
        h('button', { value: 'ok', class: 'primary' }, okLabel))));
  document.body.append(dlg);
  dlg.showModal();
  input.focus();
  input.select();
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); if (dlg.open) dlg.close(); dlg.remove(); };
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const err = validate && validate(v);
      if (err) { error.hidden = false; error.textContent = err; return; }
      finish(v);
    });
    dlg.addEventListener('close', () => finish(null));
  });
}

// "Apply to All / Selected" dialog with optional extra fields.
// opts: {title, desc, noun, total, selected,
//        fields: [{key, label, type: 'text'|'select'|'checkbox', options: [{value,label}], value, placeholder}],
//        validate(values) -> error string or null}
// Resolves to {scope: 'all'|'selected', values} or null when cancelled.
function askScope(opts) {
  $('scopeDialog')?.remove();
  const { noun = 'row', total, selected, fields = [] } = opts;
  const allR = h('input', { type: 'radio', name: 'scope', value: 'all' });
  const selR = h('input', { type: 'radio', name: 'scope', value: 'selected', disabled: !selected });
  (selected ? selR : allR).checked = true;

  const controls = {};
  const fieldRows = fields.map((f) => {
    let el;
    if (f.type === 'select') {
      el = h('select', {}, f.options.map((o) => h('option', { value: o.value }, o.label)));
      if (f.value != null) el.value = f.value;
    } else if (f.type === 'checkbox') {
      el = h('input', { type: 'checkbox', checked: !!f.value });
      controls[f.key] = el;
      return h('label', { class: 'dialog-check' }, el, h('span', {}, f.label));
    } else {
      el = h('input', { type: 'text', autocomplete: 'off', value: f.value ?? '', placeholder: f.placeholder || '' });
    }
    controls[f.key] = el;
    return h('label', { class: 'dialog-field' }, h('span', {}, f.label), el);
  });
  const error = h('div', { class: 'msg error', hidden: true });

  const dlg = h('dialog', { id: 'scopeDialog', class: 'dialog' },
    h('form', { method: 'dialog' },
      h('h3', {}, opts.title),
      opts.desc ? h('p', { class: 'dialog-desc' }, opts.desc) : null,
      h('fieldset', {},
        h('legend', {}, 'Apply to'),
        h('label', {}, allR, h('span', {}, `All ${noun}s (${total})`)),
        h('label', {}, selR, h('span', {}, `Selected ${noun}s (${selected})`))),
      fieldRows,
      error,
      h('div', { class: 'dialog-actions' },
        h('button', { type: 'button', onclick: () => dlg.close('cancel') }, 'Cancel'),
        h('button', { value: 'ok', class: 'primary' }, 'Apply'))));
  document.body.append(dlg);
  dlg.showModal();
  const first = Object.values(controls).find((c) => c.type === 'text');
  if (first) { first.focus(); first.select(); }

  // Resolve on submit directly; the close event can be deferred in a background tab.
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
      if (dlg.open) dlg.close();
      dlg.remove();
    };
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {};
      for (const [k, el] of Object.entries(controls)) values[k] = el.type === 'checkbox' ? el.checked : el.value;
      const err = opts.validate && opts.validate(values);
      if (err) { error.hidden = false; error.textContent = err; return; }
      finish({ scope: selR.checked ? 'selected' : 'all', values });
    });
    dlg.addEventListener('close', () => finish(null));
  });
}
