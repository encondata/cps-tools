# CPS2 Tools

Web-based editors for bulk-editing MOTOTRBO CPS2 codeplug data that CPS2 can't import or export. Every editor follows the same copy-and-paste workflow:

1. **Paste:** in CPS2, copy the item(s) and paste the XML into the editor.
2. **Edit:** change values in a spreadsheet-style grid.
3. **Copy:** copy the generated XML and paste it back into CPS2.

Editing happens in the browser. The only data sent to the server is what you save to the Library.

| Editor | URL | Edits |
| --- | --- | --- |
| Setup | `/setup/` | The shared workspace: paste everything once |
| Library | `/library/` | Central, server-side list of channels and contacts |
| Load External | `/external/` | Preconfigured FRS, GMRS, MURS, Marine and NOAA Weather channels, plus Texas GMRS repeaters from your RepeaterBook data |
| Zones | `/zone/` | A zone and its channels |
| Scan Lists | `/scan/` | Scan list settings and member channels |
| RX Group Lists | `/rxgroup/` | Digital RX Group Lists and their member contacts |
| Contacts | `/contacts/` | Contacts and their Digital, MDC and Quik-Call II entries |

## Install (Unraid or any Linux server with Docker)

Copy the project folder to the server, or clone it from GitHub, then run the installer as root:

```bash
bash install.sh
```

It asks for two things:

- **Install folder** (default `/mnt/user/cps2xml`): the app code goes in `app/` and the Library database in `data/library.db`.
- **Web port** (default `8734`).

It then builds the `cps2-tools` image, starts the container (restarting automatically), and waits until it answers. On Unraid the container shows in the Docker tab with a WebUI link. Open `http://<server-ip>:8734/` when it's done.

| Task | Command |
| --- | --- |
| Install with defaults, no questions | `bash install.sh -y` |
| Choose folder and port | `bash install.sh -d /mnt/user/appdata/cps2 -p 9000` |
| Install or update straight from GitHub | `bash install.sh --repo https://github.com/encondata/cps-tools.git` |
| Update after changing the code | re-run `<install folder>/app/install.sh`. The Library data is kept |
| Uninstall (asks before deleting data) | `bash <install folder>/app/install.sh --uninstall` |

Back up `<install folder>/data/library.db`, or use **Library → Backup → Export library**.

The container runs a small Node.js server (`server/server.js`) that serves the app and the Library API (SQLite). There is no login: anyone who can reach the port can read and change the Library, so keep it on a trusted network.

### Other ways to run it

With Docker Compose (the Library lives in the `cps2-library` volume):

```bash
CPS2_PORT=8734 docker compose up -d --build
```

Without Docker (Node 22.13 or newer):

```bash
node server/server.js --port 8734 --db ./data/library.db
```

## Load from External

A tree of preconfigured channel groups. Expand a group to see every channel with its frequencies, and tick whole groups or single channels. Ticking a group selects its usual channels; clicking a partly ticked group clears it.

| Group | Channels | Source |
| --- | --- | --- |
| FRS | 22, 12.5 kHz, channels 8–14 low power | [47 CFR 95.563](https://www.law.cornell.edu/cfr/text/47/95.563) |
| GMRS | 22 simplex plus 8 repeater channels (15R–22R, TX +5 MHz) | [47 CFR 95.1763](https://www.law.cornell.edu/cfr/text/47/95.1763) |
| MURS | 5, channels 4–5 wide | [47 CFR 95.2763](https://www.law.cornell.edu/cfr/text/47/95.2763) |
| Marine | 51 US VHF channels, including duplex ship TX/RX pairs | [USCG NavCen](https://www.navcen.uscg.gov/us-vhf-channel-information) |
| Weather | 7 NOAA Weather Radio frequencies | [NOAA NWR](https://www.weather.gov/nwr/) |

**Import** adds the chosen channels to the workspace, carrier squelch (no tone):
- **Zones:** one zone per group, named as shown. If the zone exists, channels with the same name are replaced and new ones are added.
- **Scan lists:** each group gets a scan list, with every imported channel assigned to it and Auto Scan on (optional). Groups larger than the scan list limit (16 members including "Selected", adjustable) are split into "Marine", "Marine 2", and so on. Re-importing adds to existing lists.
- **Receive only by default:** FRS, GMRS, MURS and Marine need radios certified for that service to transmit (GMRS also needs a licence). Each group row has an **RX only** switch, and **Import options → Allow transmit** switches all four at once, importing their TX frequencies and repeater offsets. The first time transmit is enabled you're asked to confirm. Weather, government-only (21A, 23A, 81A–83A) and data-only marine channels stay receive-only either way. Marine data channels (70, AIS) and 15 start unticked.
- **Channel template:** new channels copy their other settings from an analog channel already in the workspace (so they match the radio model), or from the built-in template.
- **Library:** optionally, the channels are also saved to the Library.

Copy both Zones and Scan Lists into CPS2 afterwards.

### Texas GMRS repeaters

RepeaterBook's terms don't allow its listings to be redistributed, so no repeater data ships with this app. Load your own copy instead:
- **Table:** open RepeaterBook's [Texas GMRS repeater list](https://www.repeaterbook.com/gmrs/Display_SS.php?state_id=48), select the table from the header to the last row, copy, and paste it into **Texas GMRS repeaters**.
- **CSV:** or open a CHIRP CSV export from RepeaterBook (GMRS exports need a free RepeaterBook account).

**Built-in presets:** a **GMRS Texas presets** group is always available, even with no RepeaterBook data loaded. It holds repeaters whose details come from their owners:
- **Dallas 600:** 462.600 / 467.600, PL 141.3. This is Dallas County REACT's "DCR Channel 3".
- **Dallas 675:** 462.675 / 467.675, PL 141.3. This is Dallas County REACT's "DCR Channel 1".

Both come from [dallasreact.org](https://www.dallasreact.org/communications).

Presets import into the GMRS DFW zone:
- **Same repeater:** if your pasted data lists one with the same output and tones, the pasted copy is skipped.
- **Name clash:** other pasted repeaters that would get a preset's name are numbered instead ("Dallas 675 2").

Repeaters are sorted by county into regions. Each region becomes a tree group with its own zone and scan list:

| Group | Zone | Counties |
| --- | --- | --- |
| DFW | GMRS DFW | Dallas, Tarrant, Collin, Denton, Rockwall, Kaufman, Parker, Wise, Johnson, Ellis |
| I-45 corridor | GMRS I-45 | Navarro, Freestone, Leon, Madison, Walker, Limestone, Anderson, Houston |
| Montgomery / Conroe | GMRS Conroe | Montgomery, San Jacinto, Grimes |
| Sugar Land / Fort Bend | GMRS Sugar Land | Fort Bend, Waller, Wharton, Austin |
| Houston | GMRS Houston | Harris, Galveston, Brazoria, Chambers, Liberty |
| Austin | GMRS Austin | Travis, Williamson, Hays, Bastrop, Caldwell, Burnet |
| I-35 corridor | GMRS I-35 | Hill, McLennan, Bell, Coryell, Falls, Bosque, Milam, Lampasas |
| San Antonio / I-35 south | GMRS San Antonio | Bexar, Comal, Guadalupe, Kendall, Medina, Bandera, Kerr, Wilson |
| Other Texas | GMRS Texas | everything else |

Channels are named after the city and output, for example "Montgomery 600". Each channel receives on the output with the downlink tone and transmits 5 MHz up with the uplink tone, so split tones such as D627 / D156 are kept. A blank tone means carrier squelch. Receive-only defaults and the TX switches work as for the other groups. Off-air, closed and private repeaters start unticked. The pasted data stays in your browser and is restored when you come back. Data courtesy of [RepeaterBook.com](https://www.repeaterbook.com).

## Library (central channel and contact list)

The Library stores channels and contacts on the server, so they can be reused across radios.

- **Adding to the Library**
  - On the Library page, *Import from XML* adds every channel from pasted Zone XML, or every contact from Contacts XML.
  - Zone editor: **Functions → Save Channels to Library**. Contacts editor: **Functions → Save Contacts to Library**.
  - Each save adds optional tags and says what to do when the name already exists: replace, skip, or keep both.
- **Using it for a radio**
  - Zone editor: **+ From Library** adds the chosen channels to the current zone. Names are made unique within the zone.
  - If those channels use contacts the radio doesn't have, it offers to add them from the Library to the Contacts workspace.
  - Contacts editor: **+ From Library** adds the chosen contacts.
  - Library page: *Use checked* turns the checked channels into a new zone, or the checked contacts into Contacts XML. You can copy the result straight into CPS2 or add it to the workspace.
- **Import from RadioReference** (Library page): copy a frequency table from a RadioReference page, including the header row, and paste it in. A preview shows every channel before anything is saved.
  - DMR rows become digital channels. The Tone cell (`CC 5 / TG 55 / SL 1`) sets the color code, talkgroup and timeslot.
  - FM/FMN rows become analog channels, 25 or 12.5 kHz, with PL or DPL from the Tone column (e.g. `115 DPL`).
  - Repeaters (type contains R) get TX from standard band offsets: UHF 450–470 +5, T-band +3, 800 MHz −45, 900 MHz −39. Other types are simplex. An Input column is used when present.
  - Each talkgroup uses the Library contact with that group ID. Missing ones are created as "TG {id}", and the pattern can be changed.
  - Names come from the Alpha Tag or the Description, trimmed to 16 characters. The page title and the Tag column become tags. The description and license go into notes.
  - New channels copy their other settings from built-in templates taken from CPS2 exports. You can pick an existing Library channel as the template instead, to match a particular radio model.
- **Housekeeping:** search, edit names, tags and notes in place, delete, and export or import the whole Library as JSON.
- **Radio models:** channels keep all their CPS2 fields. A channel saved from one radio model may carry fields another model doesn't use, so test-paste into a different model before relying on it.
- **Missing references:** the Zone editor warns when channels use contacts, RX group lists or scan lists that aren't in the workspace.

## Setup and the shared workspace

The **Setup** page (`/setup/`) is where you load the codeplug once. Paste any Zone, Scan List, RX Group List or Contacts XML copied from CPS2, and the type is detected automatically.

- **Merging:** items are merged by name, so you can paste zones one at a time. Tick *Replace* to start fresh instead.
- **Storage:** everything is kept in the browser's local storage, which survives closing the browser.
- **Auto-load:** every editor opens with its workspace data already loaded. Pasting inside an editor also merges into the workspace.
- **Linked editors:**
  - The Zone grid's *Scan / Roam List* column becomes a dropdown of the workspace scan lists.
  - Zone **Functions → Create Scan List from Channels** builds a scan list from the chosen channels. It can start the list with "Selected", set the list on those channels, and turn Auto Scan on or off.
  - Zone **Functions → Set Scan List** points channels at an existing scan list and sets Auto Scan.
  - Scan list members can be picked from workspace channels, and *Add all channels of zone* adds a whole zone. RX group members can be picked from workspace contacts. Members that don't exist in the workspace are flagged.
- **Linked renames:**
  - Renaming a scan list updates the channels that use it.
  - Renaming a channel updates scan list members.
  - Renaming a contact updates RX group list members and the digital channels that use it as their Contact.
  - Renaming an RX group list updates the digital channels that use it.
- **Change tracking:** the Setup page shows each type as *Matches CPS2* or *Changed — copy back to CPS2*. Copying the XML, from Setup or from an editor's Copy tab, marks it as matching again.
- **Backup:** *Export workspace* and *Import workspace* move the workspace between PCs as a JSON file.

The Zone editor's Copy tab copies only the zone being edited by default. Untick the option to copy every zone.

## Common features

- **Faithful round-trip.** The pasted XML is edited in place. Fields the editor doesn't show are passed through unchanged, and a load with no edits reproduces the input.
- **Common fields / All fields views.**
- **Typed cells.** Dropdowns for enumerations update CPS2's `Name="..."` display attribute along with the value. Numbers, frequencies and booleans are validated.
- **Rows.** Add, duplicate, delete and reorder rows. New rows are cloned from an existing one, so all required fields are present.
- **Bulk set.** Set one field on every checked row.
- **Excel round-trip.** *Copy grid for Excel* copies the grid out, and you can paste a block of cells from Excel back into any cell. Extra rows become new items.
- **Warnings and highlighting.** Empty, duplicate or over-long (16 character) names are flagged. Changed cells are highlighted.
- **Name sync.** Renaming an item keeps its alias fields in step, for example `CP_CNVPERSALIAS`, `ZP_ZONEALIAS`, `SP_SCANLISTALIAS` and `ContactName`.

## Editor specifics

- **Zones**
  - Next to the zone dropdown are **+ New zone**, **Duplicate zone** and **Delete zone**. A new zone copies the current zone's zone-level settings, not its channels.
  - On the Paste tab, **Start a new empty zone** builds a zone from scratch, for example from the Library, without pasting from CPS2.
  - Deleting a zone here doesn't remove it from the radio, because pasting XML never deletes zones in CPS2. Delete it there too.
  - Analog and digital channels can share a zone. Fields a channel doesn't have are greyed out.
  - The Common view covers analog fields (squelch type, PL/DPL, bandwidth) and digital fields (color code 0–15, timeslot, contact, RX group list, privacy key).
  - Scan List, RX Group List and Contact are dropdowns of the workspace items, plus "None".
  - Empty zones are supported. **+ Add channel** in an empty zone copies a channel from another zone.
  - The **Functions** menu has *Copy RX → TX Freq* and *Apply Offset*, each applying to all or selected channels.
  - PL tones and DPL codes are chosen from the standard lists.
- **Scan Lists / RX Group Lists**
  - Click a list to edit its members in the side panel: add, remove, reorder, or *Paste list…* one name per line.
  - Renaming a list warns that channels referencing it must be updated in the Zone Editor.
- **Contacts**
  - Every call system CPS2 exports gets its own columns, including Digital, MDC, Quik-Call II, Capacity Plus and Phone. A cell is greyed out when the contact has no entry for that system.
  - Editing a call ID or call type updates the derived `PeudoCallId`, `CallType` and `key` values.
  - The **Functions** menu has *Number Digital Call IDs*, which assigns sequential IDs.
  - Duplicate digital call type and ID pairs are flagged.

## Files

| Path | Purpose |
| --- | --- |
| `public/index.html` | Home page |
| `server/server.js` | Node.js server: static files and the Library API (SQLite) |
| `public/libclient.js` | Library API client, summaries, picker and save dialogs |
| `public/external/` | Load from External page, its channel data (`data.js`) and the Texas GMRS repeater loader (`repeaters.js`) |
| `public/builders.js` | Shared zone and scan list builders |
| `public/rrimport.js`, `public/templates.js` | RadioReference parser and channel builder, and built-in CPS2 channel and contact templates |
| `public/library/` | Library page |
| `public/common.js` | Shared helpers: XML, workspace, cross-references, header, tabs, dialogs |
| `public/grid.js` | Shared spreadsheet grid |
| `public/lists.js` | Shared Scan List / RX Group List editor |
| `public/setup/` | Setup / workspace page |
| `public/zone/`, `scan/`, `rxgroup/`, `contacts/` | Editor pages, each with a `sample.xml` |
| `install.sh` | Installer: builds the image and runs the container (default `/mnt/user/cps2xml`, port 8734) |
| `Dockerfile`, `docker-compose.yml` | Node.js container image, and a Compose alternative to the installer |
