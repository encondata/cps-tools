'use strict';

/* ---------------------------------------------------------------------------
 * Workspace builders shared by the editors and the Load from External page
 * (requires common.js).
 * ------------------------------------------------------------------------- */

// Default settings for a scan list created from scratch (CPS2's defaults).
const SCAN_TEMPLATE = `<set name="ScanItems" alias="" key="CONVSCAN">
  <field name="SP_TLKSCNEN">True</field>
  <field name="SP_SCPLTYPE" Name="Priority and Non-Priority Channel">PRIORNONPRIORCHAN</field>
  <field name="SP_PLLOCKCHMARKEN">True</field>
  <field name="SP_DSGTXMEM_Zone" Name="None">NONE</field>
  <field name="SP_DSGTXMEM" Name="Selected">SELECTED</field>
  <field name="SC_SCANSIGHT">2000</field>
  <field name="SCAN_RAD_TBPRIOSAMP">2000</field>
  <multifield name="ScanListItems"></multifield>
  <field name="SP_PR1MEM" Name="None">NONE</field>
  <field name="SP_PR2MEM" Name="None">NONE</field>
  <field name="SP_SCANLISTALIAS"></field>
  <field name="SP_SCHSKIPCYCLE">0</field>
  <field name="SP_SCLSTTYPE" Name="Scan List">CONVSCAN</field>
  <field name="SP_RXUNCONFGRPDATAALLSCANMEMBERS">False</field>
  <field name="SP_VOICESCANHANGTIME">True</field>
  <field name="Comments"></field>
</set>`;

// Create or replace a workspace scan list with the given members.
// A new list copies the settings of the first existing list (or CPS2's defaults).
function upsertScanList(name, members) {
  const w = Workspace.load('scan') || { doc: emptyDoc('ScanItems'), decl: DEFAULT_DECL };
  const lists = itemsOf(w.doc, 'scan');
  let list = lists.find((l) => l.getAttribute('alias') === name);
  const created = !list;
  if (created) {
    list = lists[0]
      ? lists[0].cloneNode(true)
      : w.doc.importNode(parseXml(SCAN_TEMPLATE).doc.documentElement, true);
    (lists[0] ? lists[0].parentNode : w.doc.getElementsByTagName('category')[0]).append(list);
    list.setAttribute('alias', name);
    for (const f of kids(list, 'field')) {
      const fname = f.getAttribute('name');
      if (/ALIAS$/.test(fname)) f.textContent = name;
      // Priority members referred to the template's channels.
      if (fname === 'SP_PR1MEM' || fname === 'SP_PR2MEM') { f.textContent = 'NONE'; f.setAttribute('Name', 'None'); }
    }
  }
  let mf = named(list, 'multifield', 'ScanListItems');
  if (!mf) { mf = w.doc.createElement('multifield'); mf.setAttribute('name', 'ScanListItems'); list.prepend(mf); }
  mf.replaceChildren(...members.map((m) => { const v = w.doc.createElement('value'); v.textContent = m; return v; }));
  Workspace.save('scan', serializeDoc(w.doc, w.decl));
  return created;
}

// Used when there is no zone to copy the zone-level settings from.
const ZONE_SKELETON = `<set name="Zone" alias="Zone" key="NORMAL">
  <collection name="ZoneItems" />
  <field name="ZP_ZONEALIAS">Zone</field>
  <field name="ZP_ZONETYPE" Name="Normal">NORMAL</field>
  <field name="ZP_ZVFNLITEM" Name="None">NONE</field>
  <field name="Comments"></field>
</set>`;

// A new, empty zone element in `doc`. Copies the zone-level settings of
// `like` (a zone in the same document) when given, else uses the skeleton.
function makeZone(doc, name, like) {
  let z;
  if (like) {
    z = like.cloneNode(true);
    named(z, 'collection', 'ZoneItems').replaceChildren();
    const type = fieldEl(z, 'ZP_ZONETYPE');
    if (type) { type.textContent = 'NORMAL'; type.setAttribute('Name', 'Normal'); }
    z.setAttribute('key', 'NORMAL');
  } else {
    z = doc.importNode(parseXml(ZONE_SKELETON).doc.documentElement, true);
  }
  z.setAttribute('alias', name);
  const alias = fieldEl(z, 'ZP_ZONEALIAS');
  if (alias) alias.textContent = name;
  return z;
}

// Add channel <set>s to a workspace zone, creating the zone if needed.
// Channels whose name is already in the zone are replaced.
// Returns {created, added, replaced}.
function upsertZoneChannels(zoneName, sets) {
  const w = Workspace.load('zone') || { doc: emptyDoc('Zone'), decl: DEFAULT_DECL };
  const zones = itemsOf(w.doc, 'zone');
  let z = zones.find((x) => x.getAttribute('alias') === zoneName);
  const res = { created: !z, added: 0, replaced: 0 };
  if (!z) {
    z = makeZone(w.doc, zoneName, zones[0]);
    (zones.length ? zones[zones.length - 1].parentNode : w.doc.getElementsByTagName('category')[0]).append(z);
  }
  const coll = named(z, 'collection', 'ZoneItems');
  for (const s of sets) {
    const copy = w.doc.importNode(s, true);
    const same = kids(coll, 'set').find((c) => c.getAttribute('alias') === copy.getAttribute('alias'));
    if (same) { same.replaceWith(copy); res.replaced++; } else { coll.append(copy); res.added++; }
  }
  Workspace.save('zone', serializeDoc(w.doc, w.decl));
  return res;
}
