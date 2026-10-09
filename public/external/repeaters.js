'use strict';

/* ---------------------------------------------------------------------------
 * Texas GMRS repeaters for "Load from External": the built-in presets
 * (txgmrs-data.js) sorted into the Comptroller's regions, plus anything the
 * user pastes to update them.
 *
 * The user can paste either:
 *   - the table copied from RepeaterBook's Texas GMRS page
 *     (https://www.repeaterbook.com/gmrs/Display_SS.php?state_id=48), or
 *   - a CHIRP CSV export from RepeaterBook.
 * Rows already in the presets are skipped; new ones join their region.
 * Credit: "Data courtesy of RepeaterBook.com".
 * ------------------------------------------------------------------------- */

const RB_TX_URL = 'https://www.repeaterbook.com/gmrs/Display_SS.php?state_id=48';
const GMRS_OUTPUTS = ['462.550', '462.575', '462.600', '462.625', '462.650', '462.675', '462.700', '462.725'];

/* ------------------------------- Parsing -------------------------------- */

const isCall = (s) => /^(W|K)[A-Z]{2,3}\d{3,4}$/.test(s);
const toneToken = /^(CSQ|D\d{3}[NIR]?|\d{2,3}\.\d)$/i;

// "141.3" -> {sq: 'TPL', tone: '141.3'}; "D503" / "D503I" -> DPL (inverted); "", "CSQ" -> CSQ.
function parseTone(t) {
  t = String(t || '').trim().toUpperCase();
  let m = t.match(/^(\d{2,3}\.\d)/);
  if (m) return { sq: 'TPL', tone: Number(m[1]).toFixed(1) };
  m = t.match(/^D(\d{3})([NIR]?)/);
  if (m) return { sq: 'DPL', tone: m[1], inv: m[2] === 'I' || m[2] === 'R' };
  return { sq: 'CSQ' };
}

function csvRows(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// CHIRP CSV (RepeaterBook's GMRS export).
function parseChirp(text) {
  const rows = csvRows(text);
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (r, name) => (r[head.indexOf(name.toLowerCase())] ?? '').trim();
  return rows.slice(1).map((r) => {
    const freq = Number(col(r, 'Frequency'));
    const duplex = col(r, 'Duplex');
    const offset = Number(col(r, 'Offset')) || 0;
    const tx = duplex === '+' ? freq + offset : duplex === '-' ? freq - offset : duplex === 'split' ? offset : freq;
    // CHIRP tone modes -> uplink (radio TX) / downlink (radio RX).
    const mode = col(r, 'Tone');
    const rTone = col(r, 'rToneFreq'), cTone = col(r, 'cToneFreq');
    const dcs = col(r, 'DtcsCode'), rxDcs = col(r, 'RxDtcsCode') || dcs, pol = col(r, 'DtcsPolarity') || 'NN';
    const dcsTok = (code, p) => `D${String(code).padStart(3, '0')}${p === 'R' ? 'I' : ''}`;
    let up = '', down = '';
    if (mode === 'Tone') up = rTone;
    else if (mode === 'TSQL') up = down = cTone || rTone;
    else if (mode === 'DTCS') { up = dcsTok(dcs, pol[0]); down = dcsTok(rxDcs, pol[1]); }
    else if (mode === 'Cross') {
      const [a, b] = (col(r, 'CrossMode') || '->').split('->');
      if (a === 'Tone') up = rTone; else if (a === 'DTCS') up = dcsTok(dcs, pol[0]);
      if (b === 'Tone') down = cTone; else if (b === 'DTCS') down = dcsTok(rxDcs, pol[1]);
    }
    const comment = col(r, 'Comment');
    const name = col(r, 'Name');
    const call = (`${comment} ${name}`.match(/\b(W|K)[A-Z]{2,3}\d{3,4}\b/) || [])[0] || '';
    const county = (comment.match(/([A-Z][A-Za-z .]+?) County/) || [])[1] || '';
    return {
      freq: freq.toFixed(3), tx: Math.round(tx * 1e4) / 1e4, up, down, call,
      loc: (comment.split(/\s{2,}|,\s*(?:TX|Texas)\b/)[0] || name).replace(/\b(W|K)[A-Z]{2,3}\d{3,4}\b/, '').trim() || name,
      county, use: (comment.match(/\b(OPEN|CLOSED|PRIVATE)\b/i) || [])[1]?.toUpperCase() || '',
      status: /off-?air/i.test(comment) ? 'Off-Air' : '', comment,
    };
  }).filter((r) => isFinite(Number(r.freq)) && Number(r.freq) > 0);
}

// Text copied from RepeaterBook's GMRS table. Cells are tab separated, but a
// copied row can wrap over several lines (the Yes/No flag cells), so a record
// starts at a line whose first cell is a frequency and runs to the next one.
function parseRbTable(text) {
  const records = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (/^\s*46[27]\.\d{3}(\t|$)/.test(line)) records.push(line);
    else if (records.length && line.trim()) records[records.length - 1] += `\t${line}`;
  }
  const out = [];
  for (const line of records) {
    const cells = line.split('\t').map((c) => c.trim());
    const fi = cells.findIndex((c) => /^46[27]\.\d{3}$/.test(c));
    if (fi < 0) continue;
    const toneCell = cells[fi + 1] || '';
    const [up = '', down = ''] = toneCell.includes('/') ? toneCell.split('/').map((s) => s.trim()) : [toneCell, ''];
    // Remaining text cells: location, county, owner (call), use, status; skip Yes/No/— flags.
    const rest = cells.slice(fi + 2).filter((c) => c && !/^(—|-|Yes|No|🟢|🔴|🟡)$/.test(c));
    const callIdx = rest.findIndex(isCall);
    const before = callIdx >= 0 ? rest.slice(0, callIdx) : rest.slice(0, 2);
    const after = callIdx >= 0 ? rest.slice(callIdx + 1) : rest.slice(2);
    const status = line.match(/Off-Air|On-Air|Testing|Unknown/i);
    out.push({
      freq: cells[fi], tx: Math.round((Number(cells[fi]) + 5) * 1e4) / 1e4,
      up: toneToken.test(up) ? up : '', down: toneToken.test(down) ? down : '',
      loc: before[0] || '', county: before[1] || '', call: callIdx >= 0 ? rest[callIdx] : '',
      use: (after.find((c) => /^(OPEN|CLOSED|PRIVATE)$/i.test(c)) || '').toUpperCase(),
      status: status ? status[0] : /🔴/.test(line) ? 'Off-Air' : /🟡/.test(line) ? 'Testing' : '',
    });
  }
  return out;
}

function parseRepeaterText(text) {
  const first = text.trim().split(/\r?\n/)[0] || '';
  const rows = /frequency/i.test(first) && /duplex/i.test(first) ? parseChirp(text) : parseRbTable(text);
  // GMRS repeaters only: outputs on the eight 462 MHz main channels.
  return rows.filter((r) => GMRS_OUTPUTS.includes(Number(r.freq).toFixed(3)));
}

/* ------------------------------ Regions --------------------------------- */

const regionById = new Map(TX_REGIONS.map((g) => [g.id, g]));

// County decides (Comptroller regions). Without one (CHIRP exports), look for
// a known city in the location text; anything else goes to "unsorted".
function regionOf(r) {
  let county = (r.county || '').replace(/\s*County$/i, '').trim().toLowerCase();
  if (!county) {
    const text = `${r.loc || ''} ${r.comment || ''}`.toLowerCase();
    const city = Object.keys(TX_CITY_COUNTY).find((c) => new RegExp(`\b${c}\b`).test(text));
    if (city) county = TX_CITY_COUNTY[city].toLowerCase();
  }
  return TX_COUNTY_REGION.get(county) || 'unsorted';
}

// "The Woodlands, I-45" + 462.700 -> "Woodlands 700" (<= 16 characters).
function repeaterName(r) {
  const city = (r.loc || r.call || 'GMRS').split(/[,(/]/)[0].replace(/^The\s+/i, '').trim();
  const ch = Number(r.freq).toFixed(3).slice(-3);
  return `${city.slice(0, ALIAS_MAX - ch.length - 1).trim()} ${ch}`;
}

const toneLabel = (t) => t || '—';
const toneKey = (t) => { const p = parseTone(t); return p.sq === 'CSQ' ? 'CSQ' : `${p.sq}${p.tone}${p.inv ? 'I' : ''}`; };

// Built-in rows in the same shape as parsed ones.
const presetRows = () => TX_PRESET_ROWS.map(([ch, name, loc, county, call, up, down, flags, src]) => ({
  freq: `462.${ch}`, tx: Number(`467.${ch}`), name, loc, county, call, up, down,
  use: /closed/.test(flags) ? 'CLOSED' : 'OPEN',
  status: /off/.test(flags) ? 'Off-Air' : /testing/.test(flags) ? 'Testing' : '',
  src, preset: true,
}));

// One channel item for the tree.
function repeaterItem(r) {
  const up = parseTone(r.up), down = parseTone(r.down);
  const offAir = /off/i.test(r.status || '');
  const restricted = /CLOSED|PRIVATE/i.test(r.use || '');
  const unverified = r.src === 'user';
  const src = TX_PRESET_SOURCES[r.src] || TX_PRESET_SOURCES.rb;
  return {
    name: r.name || repeaterName(r),
    rx: Number(r.freq),
    tx: r.tx,
    wide: true,
    txSq: up.sq, txTone: up.tone, txInv: up.inv,
    rxSq: down.sq, rxTone: down.tone, rxInv: down.inv,
    // Without a published uplink tone the repeater can't be keyed up: receive only.
    rxOnly: !r.up || r.up === 'CSQ' ? true : undefined,
    off: offAir || restricted || unverified,
    note: [r.call, [r.loc, r.county && `${r.county} Co.`].filter(Boolean).join(', '),
      `up ${toneLabel(r.up)} / down ${toneLabel(r.down)}`,
      r.use && r.use !== 'OPEN' ? r.use.toLowerCase() : '', offAir ? 'OFF-AIR' : (/testing/i.test(r.status || '') ? 'testing' : ''),
      !r.up ? 'uplink tone not published' : '',
      r.preset ? src.note : 'from your data',
    ].filter(Boolean).join(' · '),
  };
}

// Built-in presets plus the user's pasted rows -> one tree group per region.
// A pasted row that is already a preset (same output, tones and call sign, or
// same output, tones and county when there's no call sign) is skipped.
function repeaterGroups(pasted = []) {
  const presets = presetRows();
  const keys = (r) => {
    const t = `${Number(r.freq).toFixed(3)}|${toneKey(r.up)}|${toneKey(r.down)}`;
    return [r.call && `${t}|${r.call}`, `${t}|${(r.county || '').toLowerCase()}`].filter(Boolean);
  };
  const known = new Set(presets.flatMap(keys));
  const extra = pasted.filter((r) => !keys(r).some((k) => known.has(k)));

  const byRegion = new Map();
  for (const r of [...presets, ...extra]) {
    const id = regionOf(r);
    if (!byRegion.has(id)) byRegion.set(id, []);
    byRegion.get(id).push(repeaterItem(r));
  }
  const regions = [...TX_REGIONS, { id: 'unsorted', label: 'Unsorted', zone: 'GMRS Texas', title: 'County not recognized' }];
  const groups = regions.filter((g) => byRegion.has(g.id)).map((g) => {
    const items = byRegion.get(g.id).sort((a, b) => a.rx - b.rx || a.name.localeCompare(b.name));
    uniquifyNames(items.map((it) => { it.notes = []; return it; }));
    return {
      id: `txgmrs-${g.id}`,
      label: `GMRS ${g.label}`,
      title: g.title,
      zone: g.zone,
      rxOnlyDefault: true,
      dynamic: true,
      note: 'Each channel listens on the output and transmits 5 MHz up with the repeater\'s uplink tone. Closed, off-air '
        + `and unverified repeaters start unticked; ones without a published uplink tone are receive only. Checked ${TX_GMRS_CHECKED}. `
        + 'Data courtesy of RepeaterBook.com, Dallas County REACT and the Houston Amateur Mobile Society.',
      source: { name: 'RepeaterBook.com', url: RB_TX_URL },
      items,
    };
  });
  return { groups, added: extra.length, skipped: pasted.length - extra.length };
}
