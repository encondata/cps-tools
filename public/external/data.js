'use strict';

/* ---------------------------------------------------------------------------
 * Preconfigured channel sets for "Load from External".
 *
 * Sources (checked 2026-09-30):
 *   FRS     47 CFR 95.563   https://www.law.cornell.edu/cfr/text/47/95.563
 *   GMRS    47 CFR 95.1763  https://www.law.cornell.edu/cfr/text/47/95.1763
 *   MURS    47 CFR 95.2763  https://www.law.cornell.edu/cfr/text/47/95.2763
 *   Marine  USCG NavCen     https://www.navcen.uscg.gov/us-vhf-channel-information
 *   Weather NOAA NWR        https://www.weather.gov/nwr/
 *
 * Item fields: name (<= 16 chars), rx, tx (defaults to rx), wide (25 kHz
 * instead of 12.5 kHz), low (low power), rxOnly (never transmit),
 * off (unticked by default), note.
 * ------------------------------------------------------------------------- */

const FRS_FREQS = [462.5625, 462.5875, 462.6125, 462.6375, 462.6625, 462.6875, 462.7125,
  467.5625, 467.5875, 467.6125, 467.6375, 467.6625, 467.6875, 467.7125,
  462.5500, 462.5750, 462.6000, 462.6250, 462.6500, 462.6750, 462.7000, 462.7250];

const GMRS_MAIN = [462.5500, 462.5750, 462.6000, 462.6250, 462.6500, 462.6750, 462.7000, 462.7250];

// US VHF marine channels: [channel, ship TX, ship RX, note, flags]
const MARINE = [
  ['01A', 156.050, 156.050, 'Port ops / VTS (New Orleans, Lower Mississippi)'],
  ['05A', 156.250, 156.250, 'Port ops / VTS (Houston, New Orleans, Seattle)'],
  ['06', 156.300, 156.300, 'Intership safety'],
  ['07A', 156.350, 156.350, 'Commercial'],
  ['08', 156.400, 156.400, 'Commercial (intership only)'],
  ['09', 156.450, 156.450, 'Boater calling'],
  ['10', 156.500, 156.500, 'Commercial'],
  ['11', 156.550, 156.550, 'Commercial / VTS'],
  ['12', 156.600, 156.600, 'Port ops / VTS'],
  ['13', 156.650, 156.650, 'Bridge-to-bridge navigation (1 W)', { low: true }],
  ['14', 156.700, 156.700, 'Port ops / VTS'],
  ['15', 156.750, 156.750, 'Environmental (receive only)', { rxOnly: true, off: true }],
  ['16', 156.800, 156.800, 'Distress, safety and calling'],
  ['17', 156.850, 156.850, 'State & local government (1 W)', { low: true }],
  ['18A', 156.900, 156.900, 'Commercial'],
  ['19A', 156.950, 156.950, 'Commercial'],
  ['20', 157.000, 161.600, 'Port ops (duplex)'],
  ['20A', 157.000, 157.000, 'Port ops'],
  ['21A', 157.050, 157.050, 'U.S. Coast Guard only', { rxOnly: true }],
  ['22A', 157.100, 157.100, 'Coast Guard liaison / safety broadcasts'],
  ['23A', 157.150, 157.150, 'U.S. Coast Guard only', { rxOnly: true }],
  ['24', 157.200, 161.800, 'Public correspondence (duplex)'],
  ['25', 157.250, 161.850, 'Public correspondence (duplex)'],
  ['26', 157.300, 161.900, 'Public correspondence (duplex)'],
  ['27', 157.350, 161.950, 'Public correspondence (duplex)'],
  ['28', 157.400, 162.000, 'Public correspondence (duplex)'],
  ['63A', 156.175, 156.175, 'Port ops / VTS (New Orleans, Lower Mississippi)'],
  ['65A', 156.275, 156.275, 'Port ops'],
  ['66A', 156.325, 156.325, 'Port ops'],
  ['67', 156.375, 156.375, 'Commercial (intership only)'],
  ['68', 156.425, 156.425, 'Non-commercial'],
  ['69', 156.475, 156.475, 'Non-commercial'],
  ['70', 156.525, 156.525, 'Digital Selective Calling — no voice', { rxOnly: true, off: true }],
  ['71', 156.575, 156.575, 'Non-commercial'],
  ['72', 156.625, 156.625, 'Non-commercial (intership only)'],
  ['73', 156.675, 156.675, 'Port ops'],
  ['74', 156.725, 156.725, 'Port ops'],
  ['77', 156.875, 156.875, 'Port ops (intership only)'],
  ['78A', 156.925, 156.925, 'Non-commercial'],
  ['79A', 156.975, 156.975, 'Commercial (non-commercial on Great Lakes)'],
  ['80A', 157.025, 157.025, 'Commercial (non-commercial on Great Lakes)'],
  ['81A', 157.075, 157.075, 'U.S. Government only (environmental)', { rxOnly: true }],
  ['82A', 157.125, 157.125, 'U.S. Government only', { rxOnly: true }],
  ['83A', 157.175, 157.175, 'U.S. Coast Guard only', { rxOnly: true }],
  ['84', 157.225, 161.825, 'Public correspondence (duplex)'],
  ['85', 157.275, 161.875, 'Public correspondence (duplex)'],
  ['86', 157.325, 161.925, 'Public correspondence (duplex)'],
  ['87', 157.375, 157.375, 'Public correspondence'],
  ['88', 157.425, 157.425, 'Commercial (intership only)'],
  ['AIS 1', 161.975, 161.975, 'AIS vessel data — not voice', { rxOnly: true, off: true }],
  ['AIS 2', 162.025, 162.025, 'AIS vessel data — not voice', { rxOnly: true, off: true }],
];

const EXTERNAL_GROUPS = [
  {
    id: 'frs',
    label: 'FRS',
    title: 'Family Radio Service',
    zone: 'FRS',
    rxOnlyDefault: true,
    note: 'Licence-free, but transmitting requires an FRS-certified radio. All channels 12.5 kHz; channels 8–14 are 0.5 W.',
    source: { name: '47 CFR 95.563', url: 'https://www.law.cornell.edu/cfr/text/47/95.563' },
    items: FRS_FREQS.map((f, i) => ({
      name: `FRS ${i + 1}`,
      rx: f,
      low: i >= 7 && i <= 13,
      note: i >= 7 && i <= 13 ? '467 MHz interstitial, 0.5 W' : 'Shared with GMRS',
    })),
  },
  {
    id: 'gmrs',
    label: 'GMRS',
    title: 'General Mobile Radio Service',
    zone: 'GMRS',
    rxOnlyDefault: true,
    note: 'Requires an FCC GMRS licence and a GMRS-certified radio to transmit. Repeater channels transmit 5 MHz up (467 MHz).',
    source: { name: '47 CFR 95.1763', url: 'https://www.law.cornell.edu/cfr/text/47/95.1763' },
    items: [
      ...FRS_FREQS.map((f, i) => ({
        name: `GMRS ${i + 1}`,
        rx: f,
        wide: !(i >= 7 && i <= 13),
        low: i >= 7 && i <= 13,
        note: i < 7 ? '462 MHz interstitial' : i <= 13 ? '467 MHz interstitial, handhelds, 0.5 W' : '462 MHz main',
      })),
      ...GMRS_MAIN.map((f, i) => ({
        name: `GMRS ${15 + i}R`,
        rx: f,
        tx: Math.round((f + 5) * 1e4) / 1e4,
        wide: true,
        note: 'Repeater (TX +5 MHz); add the repeater\'s tone',
      })),
    ],
  },
  {
    id: 'murs',
    label: 'MURS',
    title: 'Multi-Use Radio Service',
    zone: 'MURS',
    rxOnlyDefault: true,
    note: 'Licence-free, 2 W, but transmitting requires a MURS-certified radio. Channels 4–5 are 20 kHz wide.',
    source: { name: '47 CFR 95.2763', url: 'https://www.law.cornell.edu/cfr/text/47/95.2763' },
    items: [
      { name: 'MURS 1', rx: 151.820, note: 'Narrow (11.25 kHz)' },
      { name: 'MURS 2', rx: 151.880, note: 'Narrow (11.25 kHz)' },
      { name: 'MURS 3', rx: 151.940, note: 'Narrow (11.25 kHz)' },
      { name: 'MURS 4', rx: 154.570, wide: true, note: '"Blue Dot", 20 kHz' },
      { name: 'MURS 5', rx: 154.600, wide: true, note: '"Green Dot", 20 kHz' },
    ],
  },
  {
    id: 'marine',
    label: 'Marine',
    title: 'US VHF Marine',
    zone: 'Marine',
    rxOnlyDefault: true,
    note: 'Transmitting requires a type-accepted marine radio. Shown with ship transmit / ship receive; data-only and receive-only channels start unticked.',
    source: { name: 'USCG Navigation Center', url: 'https://www.navcen.uscg.gov/us-vhf-channel-information' },
    items: MARINE.map(([ch, tx, rx, note, flags = {}]) => ({
      name: `Marine ${ch}`,
      rx,
      tx,
      wide: true,
      note,
      ...flags,
    })),
  },
  {
    id: 'weather',
    label: 'Weather',
    title: 'NOAA Weather Radio',
    zone: 'Weather',
    rxOnlyDefault: true,
    rxOnlyForced: true,
    note: 'Receive only. Each area is served on one of these seven frequencies.',
    source: { name: 'NOAA Weather Radio', url: 'https://www.weather.gov/nwr/' },
    items: [162.550, 162.400, 162.475, 162.425, 162.450, 162.500, 162.525].map((f, i) => ({
      name: `WX${i + 1} ${f.toFixed(3)}`,
      rx: f,
      wide: true,
      rxOnly: true,
    })),
  },
];
