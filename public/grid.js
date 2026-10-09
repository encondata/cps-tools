'use strict';

/* ---------------------------------------------------------------------------
 * Spreadsheet-style grid that edits a list of CPS2 <set> elements in place.
 * Requires common.js.
 *
 * Each row is a <set>. Columns are discovered from the <field>s present, plus
 * (optionally) fields of the first <set> inside named sub-collections, which
 * are addressed as "Collection/FIELD" (used by Contacts).
 *
 * Column config (cfg):
 *   labels       { name: 'Friendly label' }
 *   common       [names] shown in the "Common fields" view, in order
 *   readonly     Set of names that can't be edited
 *   hidden       RegExp of names never shown as columns (synced fields etc.)
 *   knownEnums   { name: [[value, Name], ...] } merged with values seen in the XML
 *   columnType   (name) => partial column ({type, norm, base}) or null
 *   subCollections  [collection names] (or 'auto') whose first <set> contributes columns
 *   aliasFields  RegExp of fields kept equal to the row's alias (default /ALIAS$/)
 *   onSet        (row, target, col, value) => void, for derived fields
 *   onRename     (row, oldAlias, newAlias) => void, when a row is renamed
 * ------------------------------------------------------------------------- */

const ALIAS_MAX = 16;
const ALIAS_COL = { name: '__alias', label: 'Name', type: 'alias' };

/* ------------------------------- Columns -------------------------------- */

const subSet = (row, coll) => kids(named(row, 'collection', coll), 'set')[0] || null;

// Sub-collections that contribute columns: a fixed list, or 'auto' for every
// <collection> the row has (e.g. each call system of a contact).
const subCollNames = (row, cfg) => (cfg.subCollections === 'auto'
  ? kids(row, 'collection').map((c) => c.getAttribute('name'))
  : cfg.subCollections || []);

function buildColumns(sets, cfg = {}) {
  const order = [];
  const info = new Map();
  const visit = (set, coll) => {
    for (const f of kids(set, 'field')) {
      const field = f.getAttribute('name');
      const name = coll ? `${coll}/${field}` : field;
      if (!info.has(name)) { info.set(name, { name, coll, field, hasNameAttr: false, seen: new Map() }); order.push(name); }
      const i = info.get(name);
      if (f.hasAttribute('Name')) i.hasNameAttr = true;
      if (!i.seen.has(f.textContent)) i.seen.set(f.textContent, f.getAttribute('Name'));
    }
  };
  for (const s of sets) {
    visit(s, null);
    for (const coll of subCollNames(s, cfg)) {
      const sub = subSet(s, coll);
      if (sub) visit(sub, coll);
    }
  }
  return order.map((n) => makeColumn(info.get(n), cfg));
}

function makeColumn({ name, coll, field, hasNameAttr, seen }, cfg) {
  const col = {
    name, coll, field,
    label: (cfg.labels && cfg.labels[name]) || name,
    readonly: !!(cfg.readonly && cfg.readonly.has(name)),
    type: 'text',
  };
  const values = [...seen.keys()];
  const merge = (base) => {
    const out = base.map(([value, label]) => ({ value, label }));
    for (const [v, l] of seen) if (!out.some((o) => o.value === v)) out.push({ value: v, label: l ?? v });
    return out;
  };

  const special = cfg.columnType && cfg.columnType(name);
  if (special) {
    const { base, ...rest } = special;
    Object.assign(col, rest);
    if (base) col.options = merge(base);
  } else if (cfg.knownEnums && cfg.knownEnums[name]) {
    col.type = 'enum';
    col.options = merge(cfg.knownEnums[name]);
  } else if (hasNameAttr) {
    col.options = merge([]);
    // Name == value for every seen option (e.g. scan list references): allow free text.
    col.type = col.options.every((o) => o.label === o.value) ? 'combo' : 'enum';
  } else if (values.length && values.every((v) => v === 'True' || v === 'False')) col.type = 'bool';
  else if (values.length && values.every((v) => /^-?\d+$/.test(v))) col.type = 'int';
  else if (values.length && values.every((v) => /^-?\d+\.\d+$/.test(v))) {
    col.type = 'decimal';
    col.places = values[0].split('.')[1].length;
  }
  return col;
}

/* ---------------------------- Value get/set ----------------------------- */

function targetOf(row, col) {
  return col.coll ? subSet(row, col.coll) : row;
}

function getVal(row, col) {
  if (col.name === '__alias') return row.getAttribute('alias') || '';
  const t = targetOf(row, col);
  const f = t && fieldEl(t, col.field || col.name);
  return f ? f.textContent : null;
}

function setVal(row, col, value, cfg = {}) {
  if (col.name === '__alias') {
    const old = row.getAttribute('alias') || '';
    row.setAttribute('alias', value);
    // Keep alias fields (CP_CNVPERSALIAS, ZP_ZONEALIAS, ContactName, ...) in step.
    const re = cfg.aliasFields || /ALIAS$/;
    const targets = [row, ...subCollNames(row, cfg).flatMap((c) => kids(named(row, 'collection', c), 'set'))];
    for (const t of targets) {
      for (const f of kids(t, 'field')) {
        if (re.test(f.getAttribute('name')) && (f.textContent === old || t === row)) f.textContent = value;
      }
    }
    if (cfg.onRename && old && old !== value) cfg.onRename(row, old, value);
    return;
  }
  const t = targetOf(row, col);
  const f = t && fieldEl(t, col.field || col.name);
  if (!f) return;
  f.textContent = value;
  if (f.hasAttribute('Name')) {
    const opt = col.options && col.options.find((o) => o.value === value);
    f.setAttribute('Name', opt ? opt.label : value);
  }
  if (cfg.onSet) cfg.onSet(row, t, col, value);
}

// Validate + normalise a raw user value for a column. Returns {ok, value, error}.
function normalize(col, raw) {
  const s = String(raw ?? '').trim();
  switch (col.type) {
    case 'alias':
    case 'combo':
      return { ok: true, value: s };
    case 'text':
      return { ok: true, value: String(raw ?? '') };
    case 'freq': {
      const n = Number(s);
      if (!s || !isFinite(n) || n <= 0) return { ok: false, error: `"${s}" is not a valid frequency` };
      return { ok: true, value: n.toFixed(6) };
    }
    case 'int': {
      if (!/^-?\d+$/.test(s)) return { ok: false, error: `"${s}" must be a whole number` };
      const n = parseInt(s, 10);
      if ((col.min != null && n < col.min) || (col.max != null && n > col.max)) {
        return { ok: false, error: `${col.label} must be between ${col.min} and ${col.max}` };
      }
      return { ok: true, value: String(n) };
    }
    case 'decimal': {
      const n = Number(s);
      if (!s || !isFinite(n)) return { ok: false, error: `"${s}" must be a number` };
      return { ok: true, value: n.toFixed(col.places) };
    }
    case 'bool': {
      const l = s.toLowerCase();
      if (['true', 'yes', 'y', '1', 'on', 'x'].includes(l)) return { ok: true, value: 'True' };
      if (['false', 'no', 'n', '0', 'off', ''].includes(l)) return { ok: true, value: 'False' };
      return { ok: false, error: `"${s}" is not True/False` };
    }
    case 'enum': {
      let probe = s;
      if (col.norm === 'tone' && s && isFinite(Number(s))) probe = Number(s).toFixed(1);
      if (col.norm === 'dpl' && /^\d{1,3}[a-z]?$/i.test(s)) probe = s.replace(/[a-z]$/i, '').padStart(3, '0');
      const l = probe.toLowerCase();
      const opt = col.options.find((o) => o.value.toLowerCase() === l)
        || col.options.find((o) => (o.label || '').toLowerCase() === l)
        || col.options.find((o) => (optionText(col, o.label) || '').toLowerCase() === l);
      if (!opt) return { ok: false, error: `"${s}" is not a valid ${col.label}` };
      return { ok: true, value: opt.value };
    }
  }
  return { ok: true, value: s };
}

// Text shown for an option; col.prefix (e.g. "ScanItems/") is hidden from view.
const optionText = (col, label) => (col.prefix && label && label.startsWith(col.prefix) ? label.slice(col.prefix.length) : label);

function displayVal(col, v) {
  if (col.type === 'enum' || col.type === 'combo') {
    const o = col.options.find((x) => x.value === v);
    return optionText(col, o ? o.label : v);
  }
  return v;
}

/* ------------------------------- Controls ------------------------------- */

function makeControl(col, value, onChange) {
  let el;
  if (col.type === 'bool') {
    el = h('input', { type: 'checkbox', checked: value === 'True', disabled: !!col.readonly });
    el.addEventListener('change', () => onChange(el.checked ? 'True' : 'False', el));
    return el;
  }
  if (col.type === 'enum') {
    el = h('select', { disabled: !!col.readonly }, col.options.map((o) => h('option', { value: o.value }, optionText(col, o.label))));
    el.value = value;
    el.addEventListener('change', () => onChange(el.value, el));
    return el;
  }
  el = h('input', { type: 'text', value: displayVal(col, value) ?? '', readOnly: !!col.readonly });
  if (col.type === 'combo') el.setAttribute('list', datalistFor('dl_' + col.name, col.options.map((o) => o.value)));
  el.addEventListener('change', () => onChange(el.value, el));
  return el;
}

function setControl(el, col, value) {
  if (el.type === 'checkbox') el.checked = value === 'True';
  else el.value = el.tagName === 'SELECT' ? value : (displayVal(col, value) ?? '');
}

function datalistFor(id, values) {
  id = id.replace(/[^\w-]/g, '_');
  let dl = document.getElementById(id);
  if (!dl) { dl = h('datalist', { id }); document.body.append(dl); }
  dl.replaceChildren(...values.map((v) => h('option', { value: v })));
  return id;
}

function widthClass(col) {
  if (col.type === 'alias') return 'w-alias';
  if (col.type === 'freq') return 'w-freq';
  if (col.type === 'text' || col.type === 'combo') return 'w-text';
  return '';
}

/* ------------------------------- Helpers -------------------------------- */

function snapshotSet(row, cfg = {}) {
  const m = new Map([['__alias', row.getAttribute('alias') || '']]);
  for (const col of buildColumns([row], cfg)) m.set(col.name, getVal(row, col));
  return m;
}

function uniqueAlias(rows, base) {
  const names = new Set(rows.map((c) => c.getAttribute('alias')));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

// Warnings for empty, over-long and duplicate names.
function aliasWarnings(rows, noun) {
  const warn = [];
  const seen = new Map();
  rows.forEach((row, i) => {
    const a = row.getAttribute('alias') || '';
    if (!a.trim()) warn.push(`Row ${i + 1}: ${noun} name is empty.`);
    else if (a.length > ALIAS_MAX) warn.push(`Row ${i + 1}: "${a}" is longer than ${ALIAS_MAX} characters.`);
    if (a && seen.has(a)) warn.push(`Row ${i + 1}: "${a}" duplicates row ${seen.get(a) + 1}.`);
    else seen.set(a, i);
  });
  return warn;
}

function renderWarnings(host, warn) {
  host.replaceChildren(...warn.map((w) => h('div', {}, '⚠ ' + w)));
}

/* ------------------------------- SetGrid -------------------------------- */

class SetGrid {
  /**
   * opts: {
   *   table, rows: () => Element[], cfg,
   *   noun: 'channel', aliasLabel: 'Channel Name', newAlias: 'New Channel',
   *   minRows: 1,
   *   onChange(structural), onNewRow(row), onActivate(row),
   *   extraCols: [{label, value(row)}]   read-only display columns
   * }
   */
  constructor(opts) {
    this.o = { cfg: {}, noun: 'row', aliasLabel: 'Name', newAlias: 'New', minRows: 1, extraCols: [], ...opts };
    this.table = opts.table;
    this.checked = new Set();
    this.orig = new WeakMap();
    this.view = 'common';
    this.cols = [];
    this.active = null;

    this.table.addEventListener('keydown', (e) => this.onKey(e));
    this.table.addEventListener('focusin', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (tr) this.activate(this.rows()[+tr.dataset.i]);
    });
    this.table.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (tr) this.activate(this.rows()[+tr.dataset.i]);
    });
    document.addEventListener('paste', (e) => this.onPaste(e));
  }

  rows() { return this.o.rows(); }
  get cfg() { return this.o.cfg; }

  // Record original values so edits can be highlighted.
  snapshot(rows) { for (const r of rows) this.orig.set(r, snapshotSet(r, this.cfg)); }

  reset() {
    this.checked.clear();
    this.active = this.rows()[0] || null;
  }

  activate(row) {
    if (!this.o.onActivate || !row || row === this.active) return;
    this.active = row;
    this.table.querySelectorAll('tbody tr').forEach((tr) => tr.classList.toggle('active', this.rows()[+tr.dataset.i] === row));
    this.o.onActivate(row);
  }

  checkedRows() { return this.rows().filter((r) => this.checked.has(r)); }

  computeColumns() {
    const cfg = this.cfg;
    const alias = { ...ALIAS_COL, label: this.o.aliasLabel };
    const cols = buildColumns(this.rows(), cfg).filter((c) => !(cfg.hidden && cfg.hidden.test(c.name)));
    this.allCols = [alias, ...cols];
    this.cols = this.view === 'all' || !cfg.common
      ? this.allCols
      : cfg.common.map((n) => (n === '__alias' ? alias : this.allCols.find((c) => c.name === n))).filter(Boolean);
  }

  render() {
    const rows = this.rows();
    const allChecked = rows.length > 0 && rows.every((r) => this.checked.has(r));

    const head = h('tr', {},
      h('th', { class: 'sticky' }, h('input', {
        type: 'checkbox', checked: allChecked, title: 'Check all',
        onchange: (e) => { rows.forEach((r) => (e.target.checked ? this.checked.add(r) : this.checked.delete(r))); this.render(); },
      })),
      this.cols.map((c, i) => h('th', { class: i === 0 ? 'sticky2' : '', title: c.name },
        c.label, c.label !== c.name && c.name !== '__alias' ? h('small', {}, c.field || c.name) : null)),
      this.o.extraCols.map((x) => h('th', {}, x.label)));

    const body = rows.map((row, r) => {
      const tr = h('tr', {
        dataset: { i: r },
        class: [this.orig.has(row) ? '' : 'new', this.checked.has(row) ? 'checked' : '',
          this.o.onActivate && row === this.active ? 'active' : ''].join(' '),
      });
      tr.append(h('td', { class: 'num sticky' }, h('label', {},
        h('input', {
          type: 'checkbox', checked: this.checked.has(row),
          onchange: (e) => {
            e.target.checked ? this.checked.add(row) : this.checked.delete(row);
            tr.classList.toggle('checked', e.target.checked);
          },
        }), String(r + 1))));
      this.cols.forEach((col, c) => tr.append(this.renderCell(row, col, r, c)));
      this.o.extraCols.forEach((x) => tr.append(h('td', { class: 'extra' }, x.value(row))));
      return tr;
    });

    const empty = !rows.length && h('tr', {}, h('td', { class: 'grid-empty', colspan: this.cols.length + 1 + this.o.extraCols.length },
      this.o.emptyText || `No ${this.o.noun}s yet — use + Add ${this.o.noun}.`));
    this.table.replaceChildren(h('thead', {}, head), h('tbody', {}, empty || body));
  }

  renderCell(row, col, r, c) {
    const td = h('td', { class: [widthClass(col), c === 0 ? 'sticky2' : '', col.readonly ? 'readonly' : ''].join(' ') });
    const value = getVal(row, col);
    if (value === null) { td.classList.add('disabled'); td.title = `Not used by this ${this.o.noun}`; return td; }
    const ctl = makeControl(col, value, (raw, el) => {
      const res = normalize(col, raw);
      if (!res.ok) { toast(res.error); setControl(el, col, getVal(row, col)); return; }
      setVal(row, col, res.value, this.cfg);
      setControl(el, col, res.value);
      this.markChanged(td, row, col);
      this.o.onChange(false);
    });
    ctl.dataset.r = r;
    ctl.dataset.c = c;
    td.append(ctl);
    this.markChanged(td, row, col);
    return td;
  }

  markChanged(td, row, col) {
    const o = this.orig.get(row);
    td.classList.toggle('changed', !!o && o.get(col.name) !== getVal(row, col));
  }

  changed(structural) {
    if (structural) { this.computeColumns(); this.render(); this.renderBulk(); }
    this.o.onChange(structural);
  }

  /* ----------------------------- Row ops ------------------------------ */

  cloneRow(template, alias, after = null) {
    const row = template.cloneNode(true);
    (after || template.parentNode.lastElementChild).after(row);
    // A clone isn't a rename of its template, so skip onRename.
    setVal(row, { ...ALIAS_COL }, uniqueAlias(this.rows(), alias), { ...this.cfg, onRename: null });
    return row;
  }

  add() {
    const rows = this.rows();
    const sel = this.checkedRows();
    let tpl = sel[sel.length - 1] || rows[rows.length - 1];
    let row;
    if (tpl) {
      row = this.cloneRow(tpl, this.o.newAlias, tpl);
    } else {
      // Empty list: copy a template from elsewhere (e.g. another zone).
      tpl = this.o.template && this.o.template();
      if (!tpl) return toast(`There is no ${this.o.noun} to use as a template.`);
      row = tpl.cloneNode(true);
      this.o.container().append(row);
      setVal(row, { ...ALIAS_COL }, uniqueAlias(this.rows(), this.o.newAlias), { ...this.cfg, onRename: null });
    }
    if (this.o.onNewRow) this.o.onNewRow(row);
    this.changed(true);
    this.activate(row);
    this.focusCell(this.rows().indexOf(row), 0);
  }

  duplicate() {
    const sel = this.checkedRows();
    if (!sel.length) return toast(`Check one or more ${this.o.noun}s first.`);
    for (const s of sel) this.cloneRow(s, s.getAttribute('alias'), s);
    this.changed(true);
  }

  remove() {
    const sel = this.checkedRows();
    if (!sel.length) return toast(`Check one or more ${this.o.noun}s first.`);
    if (this.rows().length - sel.length < this.o.minRows) return toast(`You must keep at least ${plural(this.o.minRows, this.o.noun)}.`);
    if (!confirm(`Delete ${plural(sel.length, this.o.noun)}?`)) return;
    sel.forEach((s) => { s.remove(); this.checked.delete(s); });
    if (!this.rows().includes(this.active)) this.active = this.rows()[0] || null;
    this.changed(true);
    if (this.o.onActivate) this.o.onActivate(this.active);
  }

  move(dir) {
    const sel = this.checkedRows();
    if (!sel.length) return toast(`Check one or more ${this.o.noun}s first.`);
    for (const s of dir < 0 ? sel : [...sel].reverse()) {
      const sib = dir < 0 ? s.previousElementSibling : s.nextElementSibling;
      if (!sib || this.checked.has(sib) || sib.tagName !== s.tagName) continue;
      dir < 0 ? sib.before(s) : sib.after(s);
    }
    this.changed(true);
  }

  /* ------------------------------- Bulk ------------------------------- */

  renderBulk() {
    const sel = $('bulkCol');
    if (!sel) return;
    const prev = sel.value;
    const cols = this.cols.filter((c) => c.name !== '__alias' && !c.readonly);
    sel.replaceChildren(...cols.map((c) => h('option', { value: c.name }, c.label)));
    if (cols.some((c) => c.name === prev)) sel.value = prev;
    this.renderBulkValue();
  }

  renderBulkValue() {
    const col = this.cols.find((c) => c.name === $('bulkCol').value);
    const host = $('bulkValueHost');
    host.replaceChildren();
    if (!col) return;
    const seed = this.rows().map((r) => getVal(r, col)).find((v) => v !== null) ?? '';
    const ctl = makeControl(col, seed, () => {});
    ctl.id = 'bulkValue';
    host.append(ctl);
  }

  applyBulk() {
    const col = this.cols.find((c) => c.name === $('bulkCol').value);
    const ctl = $('bulkValue');
    if (!col || !ctl) return;
    const sel = this.checkedRows();
    if (!sel.length) return toast('Check the rows to update first.');
    const res = normalize(col, ctl.type === 'checkbox' ? (ctl.checked ? 'True' : 'False') : ctl.value);
    if (!res.ok) return toast(res.error);
    let n = 0;
    for (const r of sel) if (getVal(r, col) !== null) { setVal(r, col, res.value, this.cfg); n++; }
    this.changed(true);
    toast(`Set ${col.label} on ${plural(n, this.o.noun)}.`);
  }

  /* ------------------------ Keyboard + clipboard ---------------------- */

  focusCell(r, c) {
    const el = this.table.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (el) { el.focus(); if (el.select) el.select(); }
  }

  onKey(e) {
    const t = e.target;
    if (t.dataset.r === undefined) return;
    const isText = t.tagName === 'INPUT' && t.type === 'text';
    let dr = 0;
    if (e.key === 'Enter') dr = e.shiftKey ? -1 : 1;
    else if (isText && e.key === 'ArrowDown' && !t.list) dr = 1;
    else if (isText && e.key === 'ArrowUp' && !t.list) dr = -1;
    if (!dr) return;
    e.preventDefault();
    t.dispatchEvent(new Event('change'));
    this.focusCell(+t.dataset.r + dr, +t.dataset.c);
  }

  // Paste a block of cells (e.g. copied from Excel) starting at the focused cell.
  onPaste(e) {
    const t = document.activeElement;
    if (!t || !this.table.contains(t) || t.dataset.r === undefined) return;
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    const isBlock = /[\t\n]/.test(text.replace(/\r?\n$/, ''));
    if (!isBlock && t.type === 'text') return; // ordinary single-cell paste

    e.preventDefault();
    let lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    const r0 = +t.dataset.r, c0 = +t.dataset.c;
    // Skip a header row copied along with the data.
    if (lines.length > 1 && lines[0].some((v, i) => this.cols[c0 + i] && v.trim() === this.cols[c0 + i].label)) lines = lines.slice(1);

    let rows = this.rows();
    let added = 0;
    const errors = [];
    lines.forEach((vals, i) => {
      const r = r0 + i;
      if (r >= rows.length) {
        const row = this.cloneRow(rows[rows.length - 1], this.o.newAlias);
        if (this.o.onNewRow) this.o.onNewRow(row);
        rows = this.rows();
        added++;
      }
      vals.forEach((raw, j) => {
        const col = this.cols[c0 + j];
        if (!col || col.readonly || getVal(rows[r], col) === null) return;
        const res = normalize(col, raw);
        if (res.ok) setVal(rows[r], col, res.value, this.cfg);
        else errors.push(`Row ${r + 1}, ${col.label}: ${res.error}`);
      });
    });
    this.changed(true);
    this.focusCell(r0, c0);
    let msg = `Pasted ${plural(lines.length, 'row')}`;
    if (added) msg += `, added ${plural(added, 'new ' + this.o.noun)}`;
    if (errors.length) msg += `. ${plural(errors.length, 'value')} skipped: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}`;
    toast(msg, errors.length ? 7000 : 2500);
  }

  asTsv() {
    const clean = (v) => String(v ?? '').replace(/[\t\r\n]/g, ' ');
    const lines = [this.cols.map((c) => c.label).join('\t')];
    for (const r of this.rows()) lines.push(this.cols.map((c) => clean(displayVal(c, getVal(r, c)))).join('\t'));
    return lines.join('\r\n');
  }

  // Wire the standard toolbar controls (ids shared by every editor page).
  bindToolbar() {
    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
    on('addBtn', () => this.add());
    on('dupBtn', () => this.duplicate());
    on('delBtn', () => this.remove());
    on('upBtn', () => this.move(-1));
    on('downBtn', () => this.move(1));
    on('bulkApplyBtn', () => this.applyBulk());
    on('copyTsvBtn', async () => {
      toast(await copyText(this.asTsv()) ? 'Grid copied — paste into Excel, edit, then paste back here.' : 'Copy failed.');
    });
    if ($('bulkCol')) $('bulkCol').addEventListener('change', () => this.renderBulkValue());
    document.querySelectorAll('input[name=view]').forEach((r) => r.addEventListener('change', () => {
      this.view = r.value;
      this.computeColumns();
      this.render();
      this.renderBulk();
    }));
  }
}
