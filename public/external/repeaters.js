'use strict';

/* ---------------------------------------------------------------------------
 * Texas GMRS repeaters for "Load from External", built from data the user
 * supplies — no repeater data is bundled with this app.
 *
 * RepeaterBook's terms allow personal use of its pages and exports but not
 * redistribution, so the user pastes either:
 *   - a CHIRP CSV export from RepeaterBook (the only GMRS export it offers,
 *     for registered users), or
 *   - the table copied from RepeaterBook's Texas GMRS page
 *     (https://www.repeaterbook.com/gmrs/Display_SS.php?state_id=48).
 * The rows are sorted into regions and become tree groups like the
 * preconfigured ones. Credit: "Data courtesy of RepeaterBook.com".
 * ------------------------------------------------------------------------- */

const RB_TX_URL = 'https://www.repeaterbook.com/gmrs/Display_SS.php?state_id=48';
const GMRS_OUTPUTS = ['462.550', '462.575', '462.600', '462.625', '462.650', '462.675', '462.700', '462.725'];

// Built-in repeaters, from their owners' own published details (not
// RepeaterBook), shown even when no RepeaterBook data is loaded. Each group
// imports into the same zone as that region's pasted repeaters.
// All of these use PL 141.3 both ways and the standard +5 MHz input.
const presetItem = (name, rx, note) => ({
  name, rx, tx: Math.round((rx + 5) * 1e4) / 1e4, wide: true,
  txSq: 'TPL', txTone: '141.3', rxSq: 'TPL', rxTone: '141.3', note: `${note} · PL 141.3`,
});

const TX_PRESET_GROUPS = [
  {
    id: 'txgmrs-presets-dfw',
    label: 'GMRS DFW presets',
    title: 'Dallas County REACT repeaters',
    zone: 'GMRS DFW',
    rxOnlyDefault: true,
    note: 'Built in, from Dallas County REACT\'s published details. Imports into the same zone as the DFW repeaters.',
    source: { name: 'Dallas County REACT', url: 'https://www.dallasreact.org/communications' },
    items: [
      presetItem('Dallas 600', 462.6, 'Dallas County REACT "DCR Channel 3" · downtown Dallas'),
      presetItem('Dallas 675', 462.675, 'Dallas County REACT "DCR Channel 1"'),
    ],
  },
  {
    id: 'txgmrs-presets-houston',
    label: 'GMRS Houston presets',
    title: 'H.A.M.S. repeaters south and southeast of Houston',
    zone: 'GMRS Houston',
    rxOnlyDefault: true,
    note: 'Built in, from the Houston Amateur Mobile Society\'s published details (page updated 01/29/26). '
      + 'Imports into the same zone as the Houston repeaters.',
    source: { name: 'H.A.M.S.', url: 'https://www.qsl.net/hams/repeaters.html' },
    items: [
      presetItem('Texas City 550', 462.55, 'H.A.M.S. · Texas City / Galveston · 150 ft · no emergency power'),
      presetItem('Angleton 575', 462.575, 'H.A.M.S. · Angleton · 150 ft · emergency power'),
      presetItem('Alvin 600', 462.6, 'H.A.M.S. · Alvin · 150 ft · no emergency power'),
      presetItem('Danbury 625', 462.625, 'H.A.M.S. · Danbury · 200 ft · no emergency power'),
      presetItem('Santa Fe 725', 462.725, 'H.A.M.S. · Santa Fe · 200 ft · no emergency power'),
    ],
  },
];

// Regions, in display order. A row goes to the first region whose county
// list (or, when the data has no county, city list) matches.
const TX_REGIONS = [
  { id: 'dfw', label: 'DFW', zone: 'GMRS DFW', title: 'Dallas – Fort Worth metro',
    counties: ['Dallas', 'Tarrant', 'Collin', 'Denton', 'Rockwall', 'Kaufman', 'Parker', 'Wise', 'Johnson', 'Ellis'],
    cities: ['Dallas', 'Fort Worth', 'Arlington', 'Irving', 'Plano', 'Garland', 'Mesquite', 'Denton', 'McKinney', 'Frisco',
      'Allen', 'Richardson', 'Carrollton', 'Coppell', 'Grand Prairie', 'Haltom City', 'Keller', 'Southlake', 'Rockwall',
      'Rowlett', 'Lewisville', 'Mansfield', 'Burleson', 'Weatherford', 'Waxahachie', 'Ennis', 'Midlothian', 'Cedar Hill',
      'DeSoto', 'Duncanville', 'Lancaster', 'Forney', 'Terrell', 'Watauga', 'Bedford', 'Euless', 'Grapevine', 'Flower Mound'] },
  { id: 'i45', label: 'I-45 corridor', zone: 'GMRS I-45', title: 'Between DFW and Houston (Corsicana, Fairfield, Huntsville)',
    counties: ['Navarro', 'Freestone', 'Leon', 'Madison', 'Walker', 'Limestone', 'Anderson', 'Houston'],
    cities: ['Corsicana', 'Fairfield', 'Buffalo', 'Centerville', 'Madisonville', 'Huntsville', 'New Waverly', 'Mexia',
      'Teague', 'Crockett', 'Palestine', 'Streetman', 'Richland', 'Wortham'] },
  { id: 'montgomery', label: 'Montgomery / Conroe', zone: 'GMRS Conroe', title: 'Conroe, Montgomery, The Woodlands, Willis',
    counties: ['Montgomery', 'San Jacinto', 'Grimes'],
    cities: ['Conroe', 'Montgomery', 'The Woodlands', 'Woodlands', 'Willis', 'Magnolia', 'Spring', 'Dobbin', 'Coldspring',
      'Navasota', 'Splendora', 'New Caney', 'Porter', 'Carlos'] },
  { id: 'sugarland', label: 'Sugar Land / Fort Bend', zone: 'GMRS Sugar Land', title: 'Sugar Land, Richmond, Rosenberg, Katy west',
    counties: ['Fort Bend', 'Waller', 'Wharton', 'Austin'],
    cities: ['Sugar Land', 'Sugarland', 'Richmond', 'Rosenberg', 'Missouri City', 'Stafford', 'Fulshear', 'Needville',
      'Brookshire', 'Simonton', 'Waller', 'Hempstead'] },
  { id: 'houston', label: 'Houston', zone: 'GMRS Houston', title: 'Houston metro and Gulf coast',
    counties: ['Harris', 'Galveston', 'Brazoria', 'Chambers', 'Liberty'],
    cities: ['Houston', 'Katy', 'Cypress', 'Pasadena', 'Pearland', 'League City', 'Baytown', 'Humble', 'Kingwood', 'Tomball',
      'Galveston', 'Friendswood', 'Clear Lake', 'Webster', 'Bellaire', 'Alvin', 'Angleton', 'La Porte', 'Deer Park'] },
  { id: 'austin', label: 'Austin', zone: 'GMRS Austin', title: 'Austin metro (Round Rock, Georgetown, San Marcos)',
    counties: ['Travis', 'Williamson', 'Hays', 'Bastrop', 'Caldwell', 'Burnet'],
    cities: ['Austin', 'Round Rock', 'Georgetown', 'Leander', 'Cedar Park', 'Pflugerville', 'Buda', 'Kyle', 'San Marcos',
      'Bastrop', 'Lockhart', 'Dripping Springs', 'Wimberley', 'Lakeway', 'Marble Falls', 'Bertram', 'Burnet', 'Hutto',
      'Taylor', 'Jarrell', 'McDade', 'Elgin'] },
  { id: 'i35', label: 'I-35 corridor', zone: 'GMRS I-35', title: 'Between DFW and Austin (Hillsboro, Waco, Temple, Killeen)',
    counties: ['Hill', 'McLennan', 'Bell', 'Coryell', 'Falls', 'Bosque', 'Milam', 'Lampasas'],
    cities: ['Hillsboro', 'West', 'Waco', 'Hewitt', 'Temple', 'Belton', 'Killeen', 'Harker Heights', 'Salado', 'Troy',
      'Copperas Cove', 'Gatesville', 'Oglesby', 'Lorena', 'Marlin', 'Rosebud', 'Cameron', 'Lampasas', 'Minerva'] },
  { id: 'sa', label: 'San Antonio / I-35 south', zone: 'GMRS San Antonio', title: 'New Braunfels, San Antonio, Hill Country',
    counties: ['Bexar', 'Comal', 'Guadalupe', 'Kendall', 'Medina', 'Bandera', 'Kerr', 'Wilson'],
    cities: ['San Antonio', 'New Braunfels', 'Seguin', 'Schertz', 'Boerne', 'Canyon Lake', 'Startzville', 'Leon Valley',
      'Helotes', 'Floresville', 'Kerrville', 'Bandera', 'Medina', 'Hunt', 'Castroville', 'Dunlay'] },
  { id: 'other', label: 'Other Texas', zone: 'GMRS Texas', title: 'Everywhere else in Texas', counties: [], cities: [] },
];

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

function regionOf(r) {
  const county = (r.county || '').replace(/\s*County$/i, '').trim().toLowerCase();
  // A known county decides; city names are only a fallback for data without
  // one (CHIRP exports), since words like "West" also appear in descriptions.
  if (county) {
    return TX_REGIONS.find((g) => g.counties.some((c) => c.toLowerCase() === county)) || TX_REGIONS[TX_REGIONS.length - 1];
  }
  const text = `${r.loc} ${r.comment || ''}`.toLowerCase();
  return TX_REGIONS.find((g) => g.cities.some((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(text)))
    || TX_REGIONS[TX_REGIONS.length - 1];
}

// "The Woodlands, I-45" + 462.700 -> "Woodlands 700" (<= 16 characters).
function repeaterName(r) {
  const city = (r.loc || r.call || 'GMRS').split(/[,(]/)[0].replace(/^The\s+/i, '').trim();
  const ch = Number(r.freq).toFixed(3).slice(-3);
  return `${city.slice(0, ALIAS_MAX - ch.length - 1).trim()} ${ch}`;
}

function toneLabel(t) { return t && t !== 'CSQ' ? t : 'CSQ'; }

// Parsed rows -> tree groups (same shape as EXTERNAL_GROUPS).
function repeaterGroups(rows) {
  const byRegion = new Map(TX_REGIONS.map((g) => [g.id, []]));
  // A pasted row is the same repeater as a preset when the output and both
  // tones match; other repeaters on the same output keep their own entries.
  const presetItems = TX_PRESET_GROUPS.flatMap((g) => g.items);
  const toneKey = (sq, tone, inv) => (sq === 'CSQ' ? 'CSQ' : `${sq}${tone}${inv ? 'I' : ''}`);
  const presetKey = (rx, up, down) => `${Number(rx).toFixed(3)}|${toneKey(up.sq, up.tone, up.inv)}|${toneKey(down.sq, down.tone, down.inv)}`;
  const presets = new Set(presetItems.map((it) =>
    presetKey(it.rx, { sq: it.txSq, tone: it.txTone, inv: it.txInv }, { sq: it.rxSq, tone: it.rxTone, inv: it.rxInv })));
  for (const r of rows) {
    const up = parseTone(r.up), down = parseTone(r.down);
    if (presets.has(presetKey(r.freq, up, down))) continue; // already built in
    const offAir = /off/i.test(r.status || '');
    const restricted = /CLOSED|PRIVATE/i.test(r.use || '');
    byRegion.get(regionOf(r).id).push({
      name: repeaterName(r),
      rx: Number(r.freq),
      tx: r.tx,
      wide: true,
      txSq: up.sq, txTone: up.tone, txInv: up.inv,
      rxSq: down.sq, rxTone: down.tone, rxInv: down.inv,
      off: offAir || restricted,
      note: [r.call, [r.loc, r.county && `${r.county} Co.`].filter(Boolean).join(', '),
        `up ${toneLabel(r.up)} / down ${toneLabel(r.down)}`,
        r.use && r.use !== 'OPEN' ? r.use.toLowerCase() : '', offAir ? 'OFF-AIR' : (/testing/i.test(r.status || '') ? 'testing' : ''),
      ].filter(Boolean).join(' · '),
    });
  }
  return TX_REGIONS.filter((g) => byRegion.get(g.id).length).map((g) => {
    const items = byRegion.get(g.id).sort((a, b) => a.name.localeCompare(b.name));
    // Presets share the DFW zone, so pasted repeaters must not reuse their names.
    const seed = presetItems.map((p) => ({ name: p.name, notes: [] }));
    uniquifyNames([...seed, ...items.map((it) => { it.notes = []; return it; })]);
    return {
      id: `txgmrs-${g.id}`,
      label: `GMRS ${g.label}`,
      title: g.title,
      zone: g.zone,
      rxOnlyDefault: true,
      dynamic: true,
      note: 'Repeaters from your RepeaterBook data. Each channel listens on the output and transmits 5 MHz up with the '
        + 'repeater\'s uplink tone. Off-air, closed and private repeaters start unticked. Data courtesy of RepeaterBook.com.',
      source: { name: 'RepeaterBook.com', url: RB_TX_URL },
      items,
    };
  });
}
