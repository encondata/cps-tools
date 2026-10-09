'use strict';

/* ---------------------------------------------------------------------------
 * RadioReference import (requires common.js, grid.js, libclient.js,
 * templates.js). Parses a table copied from a RadioReference frequency page
 * and builds CPS2 channels (and talkgroup contacts) for the Library.
 *
 * Copied tables are tab separated; the Tone cell of DMR rows spans several
 * lines ("CC 5 / TG 55 / SL 1"). A record starts with a line that begins
 * with a frequency.
 * ------------------------------------------------------------------------- */

const RR_DEFAULT_HEADER = ['frequency', 'license', 'type', 'tone', 'alpha tag', 'description', 'mode', 'tag'];

function parseRadioReference(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const isStart = (l) => /^\s*\d{2,4}\.\d+\s*(\t|$)/.test(l);
  let header = null;
  const title = [];
  const records = [];
  let cur = null;
  for (const line of lines) {
    if (!header) {
      if (/^\s*frequency\t/i.test(line)) { header = line.split('\t').map((s) => s.trim().toLowerCase()); continue; }
      if (!isStart(line)) { if (line.trim()) title.push(line.trim()); continue; }
      header = RR_DEFAULT_HEADER;
    }
    if (isStart(line)) { cur = [line]; records.push(cur); } else if (cur && line.trim()) cur.push(line);
  }
  const rows = records.map((r) => {
    const cells = r.join('\n').split('\t');
    const o = {};
    header.forEach((h, i) => { o[h] = (cells[i] || '').trim(); });
    return o;
  });
  return { title: title.join(' '), rows };
}

// Standard repeater input for an output frequency, or null when unknown.
function repeaterInput(rx) {
  if (rx >= 450 && rx < 470) return rx + 5;       // UHF business / public safety
  if (rx >= 470 && rx < 512) return rx + 3;       // T-band
  if (rx >= 851 && rx < 870) return rx - 45;      // 800 MHz
  if (rx >= 935 && rx < 941) return rx - 39;      // 900 MHz
  return null;
}

const truncName = (s) => String(s || '').trim().slice(0, ALIAS_MAX).trim();

// One RadioReference row -> channel spec (or {skip: reason}).
function rrToSpec(o, opts) {
  const rx = Number(o.frequency);
  const mode = (o.mode || '').toUpperCase();
  const type = (o.type || '').toUpperCase();
  const tone = o.tone || '';
  const spec = {
    rx, tx: rx, mode, type, tone, license: o.license || '', alpha: o['alpha tag'] || '', desc: o.description || '',
    tag: o.tag || '', notes: [], name: '',
  };
  if (!isFinite(rx) || rx <= 0) return { ...spec, skip: 'No frequency' };

  // TX frequency: explicit input column, standard repeater offset, or simplex.
  const input = Number(o.input || o['input freq'] || NaN);
  if (isFinite(input) && input > 0) spec.tx = input;
  else if (/R/.test(type) && opts.repeaterOffset) {
    const tx = repeaterInput(rx);
    if (tx == null) spec.notes.push('Repeater input unknown for this band — TX set to RX, check it');
    else spec.tx = Math.round(tx * 1e6) / 1e6;
  }

  if (/DMR/.test(mode)) {
    spec.kind = 'digital';
    const m = (re) => { const x = tone.match(re); return x ? Number(x[1]) : null; };
    spec.cc = m(/CC\s*(\d+)/i);
    spec.tg = m(/TG\s*(\d+)/i);
    spec.slot = m(/SL\s*(\d)/i) || 1;
    if (spec.cc == null) { spec.cc = 1; spec.notes.push('No color code listed — using 1'); }
    if (spec.cc > 15) return { ...spec, skip: `Color code ${spec.cc} is out of range` };
    if (spec.slot !== 1 && spec.slot !== 2) spec.slot = 1;
  } else if (/^FM/.test(mode)) {
    spec.kind = 'analog';
    spec.wide = mode === 'FM';
    const pl = tone.match(/(\d{2,3}\.\d)\s*PL/i) || tone.match(/^\s*(\d{2,3}\.\d)\s*$/);
    const dpl = tone.match(/(\d{3})\s*DPL/i) || tone.match(/D(\d{3})/i);
    if (pl) { spec.sq = 'TPL'; spec.toneVal = Number(pl[1]).toFixed(1); } else if (dpl) { spec.sq = 'DPL'; spec.toneVal = dpl[1]; } else spec.sq = 'CSQ';
    if (tone && !pl && !dpl && !/CSQ/i.test(tone)) spec.notes.push(`Tone "${tone}" not understood — carrier squelch`);
  } else {
    return { ...spec, skip: `${o.mode || 'Unknown'} mode is not supported` };
  }

  spec.name = truncName(opts.nameFrom === 'desc' ? spec.desc || spec.alpha : spec.alpha || spec.desc) || `${rx}`;
  return spec;
}

function specSignalling(s) {
  if (s.skip) return '';
  if (s.kind === 'digital') return `CC${s.cc} TS${s.slot}${s.tg != null ? ` TG ${s.tg}` : ''}`;
  return s.sq === 'CSQ' ? 'CSQ' : `${s.sq === 'TPL' ? 'PL' : 'DPL'} ${s.toneVal}${s.wide ? ' · 25 kHz' : ''}`;
}

/* ------------------------------ Builders -------------------------------- */

function setField(set, name, value, display) {
  const f = fieldEl(set, name);
  if (!f) return false;
  f.textContent = value;
  if (f.hasAttribute('Name')) f.setAttribute('Name', display ?? value);
  return true;
}

// Build a channel <set> from a template XML string and a spec.
function buildChannelSet(spec, templateXml, contactName) {
  const set = parseXml(templateXml).doc.documentElement;
  set.setAttribute('alias', spec.name);
  setField(set, 'CP_CNVPERSALIAS', spec.name);
  setField(set, 'CP_RXFREQ', spec.rx.toFixed(6));
  setField(set, 'CP_TXFREQ', spec.tx.toFixed(6));
  setField(set, 'OffSet', (spec.tx - spec.rx).toFixed(6));
  setField(set, 'CP_SCNROAMLISTIT', 'NONE', 'None');
  setField(set, 'Comments', '');
  if (spec.kind === 'digital') {
    setField(set, 'CP_COLORCODE', String(spec.cc));
    setField(set, 'CP_SLTASSGMNT', `SLOT${spec.slot}`, String(spec.slot));
    setField(set, 'CP_TGLISTIT', 'NONE', 'None');
    setField(set, 'CP_UKPPERS', contactName || 'NONE', contactName || 'None');
  } else {
    setField(set, 'CP_CHNLBWDTH', spec.wide ? 'STR_25KHZ' : 'STR_12PT5KHZ', spec.wide ? '25' : '12.5');
    // RX and TX signalling can differ (e.g. a repeater's uplink vs downlink
    // tone); spec.rx* / spec.tx* override the shared spec.sq / spec.toneVal.
    const dirs = [
      ['CP_XSQCHTY', 'CP_RXTPLFREQ', 'CP_RXDPLCD', 'CP_RXDPLINV', spec.rxSq ?? spec.sq, spec.rxTone ?? spec.toneVal, spec.rxInv],
      ['CP_TXSQCHTY', 'CP_TXTTPLFREQ', 'CP_TXTDPLCD', 'CP_TXDPLINV', spec.txSq ?? spec.sq, spec.txTone ?? spec.toneVal, spec.txInv],
    ];
    for (const [type, toneF, dplF, invF, sq, tone, inv] of dirs) {
      setField(set, type, sq || 'CSQ');
      if (sq === 'TPL') setField(set, toneF, tone);
      if (sq === 'DPL') { setField(set, dplF, tone); setField(set, invF, inv ? 'True' : 'False'); }
    }
  }
  return set;
}

function buildContactSet(name, id) {
  const set = parseXml(TEMPLATES.contact).doc.documentElement;
  set.setAttribute('alias', name);
  setField(set, 'ContactName', name);
  const d = kids(named(set, 'collection', 'DigitalCalls'), 'set')[0];
  setField(d, 'DU_CALLALIAS', name);
  setField(d, 'DU_CALLLSTID', String(id));
  setField(d, 'PeudoCallId', String(id));
  return set;
}

// Digital group-call ID -> name, from Library contact items.
function groupIdIndex(contactItems) {
  const idx = new Map();
  for (const it of contactItems) {
    try {
      const set = parseXml(it.xml).doc.documentElement;
      for (const d of kids(named(set, 'collection', 'DigitalCalls'), 'set')) {
        if (d.getAttribute('key') !== 'GRPCALL') continue;
        const id = fval(d, 'DU_CALLLSTID');
        if (id != null && !idx.has(Number(id))) idx.set(Number(id), it.name);
      }
    } catch { /* ignore unreadable items */ }
  }
  return idx;
}

// Make names unique within the batch (keeping the 16-character limit).
function uniquifyNames(specs) {
  const used = new Set();
  for (const s of specs) {
    let name = s.name;
    for (let i = 2; used.has(name); i++) name = `${s.name.slice(0, ALIAS_MAX - String(i).length - 1).trim()} ${i}`;
    if (name !== s.name) s.notes.push(`Renamed from "${s.name}" (duplicate name)`);
    s.name = name;
    used.add(name);
  }
}
