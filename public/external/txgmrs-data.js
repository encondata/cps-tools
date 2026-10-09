'use strict';

/* ---------------------------------------------------------------------------
 * Texas GMRS repeater presets and regions for "Load from External".
 *
 * Regions are the Texas Comptroller's 12 economic regions, which assign every
 * county: https://comptroller.texas.gov/economy/economic-data/regions/
 *
 * Preset sources (checked 2026-10-09):
 *   rb    – RepeaterBook.com Texas GMRS listing, supplied by the user and
 *           checked row by row against the live listing.
 *   react – Dallas County REACT, https://www.dallasreact.org/communications
 *   hams  – Houston Amateur Mobile Society, https://www.qsl.net/hams/repeaters.html
 *   user  – the user's own list; no published source found, so these are
 *           marked unverified and start unticked.
 * ------------------------------------------------------------------------- */

const TX_GMRS_CHECKED = '2026-10-09';

const TX_PRESET_SOURCES = {
  rb: { name: 'RepeaterBook.com', url: 'https://www.repeaterbook.com/gmrs/Display_SS.php?state_id=48', note: 'Data courtesy of RepeaterBook.com' },
  react: { name: 'Dallas County REACT', url: 'https://www.dallasreact.org/communications', note: 'Dallas County REACT' },
  hams: { name: 'H.A.M.S.', url: 'https://www.qsl.net/hams/repeaters.html', note: 'Houston Amateur Mobile Society' },
  user: { name: 'your list', url: '', note: 'unverified — no published source found' },
};

// Regions in display order, roughly north to south.
const TX_REGIONS = [
  { id: 'panhandle', label: 'Panhandle', zone: 'GMRS Panhandle', title: 'High Plains: Amarillo, Lubbock' },
  { id: 'northwest', label: 'Northwest Texas', zone: 'GMRS NW Texas', title: 'Wichita Falls, Abilene, Brownwood' },
  { id: 'north', label: 'North Texas', zone: 'GMRS North TX', title: 'Metroplex: Dallas, Fort Worth, Denton, Corsicana' },
  { id: 'east', label: 'East Texas', zone: 'GMRS East TX', title: 'Upper East: Tyler, Longview, Texarkana, Paris' },
  { id: 'southeast', label: 'Southeast Texas', zone: 'GMRS SE Texas', title: 'Beaumont, Lufkin, Nacogdoches, Coldspring' },
  { id: 'central', label: 'Central Texas', zone: 'GMRS Central TX', title: 'Waco, Temple, Killeen, Bryan, Fairfield' },
  { id: 'capital', label: 'Capital (Austin)', zone: 'GMRS Austin', title: 'Austin, Round Rock, San Marcos, Burnet' },
  { id: 'gulf', label: 'Gulf Coast (Houston)', zone: 'GMRS Gulf Coast', title: 'Houston, Sugar Land, Conroe, Galveston, Huntsville' },
  { id: 'alamo', label: 'Alamo (San Antonio)', zone: 'GMRS San Antonio', title: 'San Antonio, New Braunfels, Hill Country, Victoria' },
  { id: 'south', label: 'South Texas', zone: 'GMRS South TX', title: 'Corpus Christi, Laredo, Rio Grande Valley' },
  { id: 'west', label: 'West Texas', zone: 'GMRS West TX', title: 'Midland, Odessa, San Angelo' },
  { id: 'farwest', label: 'Far West Texas', zone: 'GMRS Far West', title: 'Upper Rio Grande: El Paso, Big Bend' },
];

// County -> region, from the Comptroller's "Regions by County" list (254 counties).
const TX_COUNTY_REGION = (() => {
  const lists = {
    panhandle: 'Armstrong,Bailey,Briscoe,Carson,Castro,Childress,Cochran,Collingsworth,Crosby,Dallam,Deaf Smith,Dickens,Donley,'
      + 'Floyd,Garza,Gray,Hale,Hall,Hansford,Hartley,Hemphill,Hockley,Hutchinson,King,Lamb,Lipscomb,Lubbock,Lynn,Moore,Motley,'
      + 'Ochiltree,Oldham,Parmer,Potter,Randall,Roberts,Sherman,Swisher,Terry,Wheeler,Yoakum',
    northwest: 'Archer,Baylor,Brown,Callahan,Clay,Coleman,Comanche,Cottle,Eastland,Fisher,Foard,Hardeman,Haskell,Jack,Jones,'
      + 'Kent,Knox,Mitchell,Montague,Nolan,Runnels,Scurry,Shackelford,Stephens,Stonewall,Taylor,Throckmorton,Wichita,Wilbarger,Young',
    north: 'Collin,Cooke,Dallas,Denton,Ellis,Erath,Fannin,Grayson,Hood,Hunt,Johnson,Kaufman,Navarro,Palo Pinto,Parker,Rockwall,'
      + 'Somervell,Tarrant,Wise',
    east: 'Anderson,Bowie,Camp,Cass,Cherokee,Delta,Franklin,Gregg,Harrison,Henderson,Hopkins,Lamar,Marion,Morris,Panola,Rains,'
      + 'Red River,Rusk,Smith,Titus,Upshur,Van Zandt,Wood',
    southeast: 'Angelina,Hardin,Houston,Jasper,Jefferson,Nacogdoches,Newton,Orange,Polk,Sabine,San Augustine,San Jacinto,Shelby,'
      + 'Trinity,Tyler',
    central: 'Bell,Bosque,Brazos,Burleson,Coryell,Falls,Freestone,Grimes,Hamilton,Hill,Lampasas,Leon,Limestone,Madison,McLennan,'
      + 'Milam,Mills,Robertson,San Saba,Washington',
    capital: 'Bastrop,Blanco,Burnet,Caldwell,Fayette,Hays,Lee,Llano,Travis,Williamson',
    gulf: 'Austin,Brazoria,Chambers,Colorado,Fort Bend,Galveston,Harris,Liberty,Matagorda,Montgomery,Walker,Waller,Wharton',
    alamo: 'Atascosa,Bandera,Bexar,Calhoun,Comal,DeWitt,Frio,Gillespie,Goliad,Gonzales,Guadalupe,Jackson,Karnes,Kendall,Kerr,'
      + 'Lavaca,Medina,Victoria,Wilson',
    south: 'Aransas,Bee,Brooks,Cameron,Dimmit,Duval,Edwards,Hidalgo,Jim Hogg,Jim Wells,Kenedy,Kinney,Kleberg,La Salle,Live Oak,'
      + 'Maverick,McMullen,Nueces,Real,Refugio,San Patricio,Starr,Uvalde,Val Verde,Webb,Willacy,Zapata,Zavala',
    west: 'Andrews,Borden,Coke,Concho,Crane,Crockett,Dawson,Ector,Gaines,Glasscock,Howard,Irion,Kimble,Loving,Martin,Mason,'
      + 'McCulloch,Menard,Midland,Pecos,Reagan,Reeves,Schleicher,Sterling,Sutton,Terrell,Tom Green,Upton,Ward,Winkler',
    farwest: 'Brewster,Culberson,El Paso,Hudspeth,Jeff Davis,Presidio',
  };
  const map = new Map();
  for (const [region, names] of Object.entries(lists)) for (const c of names.split(',')) map.set(c.toLowerCase(), region);
  return map;
})();

// City -> county, for data without a county (CHIRP exports). Larger cities only.
const TX_CITY_COUNTY = {
  'abilene': 'Taylor', 'allen': 'Collin', 'alvin': 'Brazoria', 'amarillo': 'Potter', 'angleton': 'Brazoria', 'arlington': 'Tarrant',
  'austin': 'Travis', 'baytown': 'Harris', 'beaumont': 'Jefferson', 'brownsville': 'Cameron', 'bryan': 'Brazos',
  'cedar park': 'Williamson', 'college station': 'Brazos', 'conroe': 'Montgomery', 'corpus christi': 'Nueces',
  'corsicana': 'Navarro', 'cypress': 'Harris', 'dallas': 'Dallas', 'denton': 'Denton', 'el paso': 'El Paso',
  'fort worth': 'Tarrant', 'frisco': 'Collin', 'galveston': 'Galveston', 'garland': 'Dallas', 'georgetown': 'Williamson',
  'harlingen': 'Cameron', 'houston': 'Harris', 'huntsville': 'Walker', 'irving': 'Dallas', 'katy': 'Harris', 'killeen': 'Bell',
  'kerrville': 'Kerr', 'laredo': 'Webb', 'league city': 'Galveston', 'leander': 'Williamson', 'longview': 'Gregg',
  'lubbock': 'Lubbock', 'lufkin': 'Angelina', 'mcallen': 'Hidalgo', 'mckinney': 'Collin', 'mesquite': 'Dallas',
  'midland': 'Midland', 'missouri city': 'Fort Bend', 'montgomery': 'Montgomery', 'nacogdoches': 'Nacogdoches',
  'new braunfels': 'Comal', 'odessa': 'Ector', 'paris': 'Lamar', 'pasadena': 'Harris', 'pearland': 'Brazoria',
  'plano': 'Collin', 'richmond': 'Fort Bend', 'rosenberg': 'Fort Bend', 'round rock': 'Williamson', 'san angelo': 'Tom Green',
  'san antonio': 'Bexar', 'san marcos': 'Hays', 'spring': 'Harris', 'sugar land': 'Fort Bend', 'temple': 'Bell',
  'texarkana': 'Bowie', 'texas city': 'Galveston', 'the woodlands': 'Montgomery', 'tyler': 'Smith', 'victoria': 'Victoria',
  'waco': 'McLennan', 'weatherford': 'Parker', 'wichita falls': 'Wichita',
};

// [channel, name (<= 16 chars), location, county, call, uplink tone, downlink tone, flags, source, region]
// region is only given for repeaters outside Texas; Texas ones are placed by county.
// Tones: "141.3" (PL), "D503" (DPL), "" (not published), "CSQ" (carrier squelch).
// Flags: closed, off (off-air), testing.
const TX_PRESET_ROWS = [
  // 462.550 – GMRS 15R
  ['550', 'Beaumont 550', 'Beaumont, Rogers Park', 'Jefferson', 'WQWN337', '123.0', '123.0', '', 'rb'],
  ['550', 'Brookshire 550', 'Brookshire', 'Fort Bend', 'WSGU761', '141.3', '141.3', '', 'rb'],
  ['550', 'Copperas Cv 550', 'Copperas Cove', 'Coryell', 'WSEE493', 'D503', 'D503', '', 'rb'],
  ['550', 'Corsicana 550', 'Corsicana (NFLARC)', 'Navarro', 'WSJE373', '146.2', '146.2', '', 'rb'],
  ['550', 'Dallas 550', 'Dallas, White Rock Lake', 'Dallas', 'WQUM597', '141.3', '141.3', '', 'rb'],
  ['550', 'Eula 550', 'Eula', 'Callahan', 'WRQA615', '167.9', '167.9', '', 'rb'],
  ['550', 'Gatesville 550', 'Gatesville, South Mountain', 'Coryell', 'WRYX509', '107.2', '107.2', '', 'rb'],
  ['550', 'Hunt 550', 'Hunt, South Fork', 'Kerr', 'WRJV317', '141.3', '141.3', '', 'rb'],
  ['550', 'Minerva 550', 'Minerva', 'Milam', 'WRXG431', '110.9', '110.9', '', 'rb'],
  ['550', 'Rockwall 550', 'Rockwall', 'Rockwall', 'WRWT372', '241.8', '241.8', '', 'rb'],
  ['550', 'San Angelo 550', 'San Angelo', 'Tom Green', 'WQQQ870', '107.2', '', '', 'rb'],
  ['550', 'Santa Anna 550', 'Santa Anna Mountain', 'Coleman', 'WQJZ921', '141.3', 'CSQ', '', 'rb'],
  ['550', 'Startzville 550', 'Startzville, Canyon Lake', 'Comal', 'WRUW408', '103.5', '103.5', '', 'rb'],
  ['550', 'Watauga 550', 'Watauga', 'Tarrant', 'WSAM504', '', '', 'closed', 'rb'],
  ['550', 'Texas City 550', 'Texas City / Galveston', 'Galveston', '', '141.3', '141.3', '', 'hams'],
  // 462.575 – GMRS 16R
  ['575', 'Camp Wood 575', 'Camp Wood', 'Real', 'WSEV342', '203.5', '203.5', '', 'rb'],
  ['575', 'Coldspring 575', 'Coldspring', 'San Jacinto', 'WQZN894', '146.2', 'CSQ', '', 'rb'],
  ['575', 'Dobbin 575', 'Dobbin', 'Montgomery', 'WSBR984', 'D454', 'D454', '', 'rb'],
  ['575', 'Hunt 575', 'Hunt', 'Kerr', 'WRJV317', '141.3', '141.3', '', 'rb'],
  ['575', 'Leander 575', 'Leander', 'Williamson', 'WRPK506', '141.3', '141.3', 'off', 'rb'],
  ['575', 'Leonard 575', 'Leonard', 'Fannin', 'WRWM826', '141.3', '141.3', '', 'rb'],
  ['575', 'Midland 575', 'Midland', 'Midland', 'WRWW239', '141.3', '141.3', '', 'rb'],
  ['575', 'Oglesby 575', 'Oglesby', 'Coryell', 'WRCP705', '141.3', '141.3', '', 'rb'],
  ['575', "Pt O'Connor 575", "Port O'Connor", 'Calhoun', 'WRPG595', '151.4', '151.4', '', 'rb'],
  ['575', 'Rockwall 575', 'Rockwall, Wilkerson Sanders', 'Rockwall', 'WREI852', '100.0', '', '', 'rb'],
  ['575', 'Angleton 575', 'Angleton', 'Brazoria', '', '141.3', '141.3', '', 'hams'],
  // 462.600 – GMRS 17R
  ['600', 'Commerce 600', 'Commerce', 'Hunt', 'WRJG536', '', '', 'closed', 'rb'],
  ['600', 'Denton 600', 'Denton, TWU Building', 'Denton', 'WRPR901', 'D624', 'D624', '', 'rb'],
  ['600', 'Dunlay 600', 'Dunlay', 'Medina', 'WRJC281', '141.3', '141.3', '', 'rb'],
  ['600', 'Ft Stockton 600', 'Fort Stockton', 'Pecos', 'WRXB309', '141.3', '', '', 'rb'],
  ['600', 'Kerrville 600', 'Kerrville', 'Kerr', 'WRJV317', '141.3', '141.3', '', 'rb'],
  ['600', 'Lakeport 600', 'Lakeport, Longview', 'Gregg', 'WRVG545', '141.3', '141.3', '', 'rb'],
  ['600', 'Lampasas 600', 'Lampasas', 'Lampasas', 'WQRK273', '250.3', '250.3', 'off closed', 'rb'],
  ['600', 'Laredo 600', 'Laredo, College Heights', 'Webb', 'WRNQ654', '', '', '', 'rb'],
  ['600', 'Leander 600', 'Leander', 'Travis', 'WRZK546', '141.3', '141.3', '', 'rb'],
  ['600', 'Montgomery 600', 'Montgomery', 'Montgomery', 'WRJQ567', '100.0', '100.0', '', 'rb'],
  ['600', 'Temple 600', 'Temple', 'Bell', 'WQVY368', '162.2', '162.2', 'closed', 'rb'],
  ['600', 'Wimberley 600', 'Wimberley', 'Hays', 'WRJV395', '', '', '', 'rb'],
  ['600', 'Wolfforth 600', 'Wolfforth', 'Lubbock', 'WQQH251', '162.2', '162.2', '', 'rb'],
  ['600', 'Dallas 600', 'Downtown Dallas, "DCR Channel 3"', 'Dallas', 'WQXR714', '141.3', '141.3', '', 'react'],
  ['600', 'Alvin 600', 'Alvin', 'Brazoria', '', '141.3', '141.3', '', 'hams'],
  ['600', 'Fairfield 600', 'Fairfield (NFLARC)', 'Freestone', 'WSHG319', '136.5', '', '', 'user'],
  ['600', 'Las Cruces 600', 'Las Cruces, NM (about 45 mi from El Paso)', 'Doña Ana, NM', 'WRKF200', '210.7', '210.7', '', 'rb', 'farwest'],
  ['600', 'Atlas 600', 'Atlas, Lamar County (RRVARC)', 'Lamar', '', '88.5', '88.5', '', 'user'],
  // 462.625 – GMRS 18R
  ['625', 'Brookston 625', 'Brookston', 'Lamar', 'WRFC958', '136.5', '', '', 'rb'],
  ['625', 'Clyde 625', 'Clyde', 'Callahan', 'WRQA615', '151.4', '151.4', 'closed', 'rb'],
  ['625', 'Dallas 625 141.3', 'Dallas', 'Dallas', 'WRKH887', '141.3', '141.3', '', 'rb'],
  ['625', 'Dallas 625 127.3', 'Dallas', 'Dallas', 'WRKH887', '127.3', '127.3', '', 'rb'],
  ['625', 'Floresville 625', 'Floresville', 'Wilson', 'WRDK329', '141.3', '141.3', 'closed', 'rb'],
  ['625', 'Mesquite 625', 'Mesquite', 'Dallas', 'WRKH887', '141.3', '141.3', '', 'rb'],
  ['625', 'Forreston 625', 'Nash / Forreston', 'Ellis', 'WRVB840', '131.8', 'CSQ', '', 'rb'],
  ['625', 'Richmond 625', 'Richmond, Fort Bend Fairgrounds', 'Fort Bend', 'WRDX849', '225.7', '225.7', '', 'rb'],
  ['625', 'Warren 625', 'Warren, Hwy 69 Bridge', 'Tyler', 'WROZ535', 'D132', 'D132', '', 'rb'],
  ['625', 'Danbury 625', 'Danbury', 'Brazoria', '', '141.3', '141.3', '', 'hams'],
  ['625', 'SAGMRS 625', 'San Antonio (SAGMRS primary)', 'Bexar', 'WRUK776', '', '', '', 'user'],
  // 462.650 – GMRS 19R
  ['650', 'Bandera 650', 'Bandera', 'Bandera', 'WQXE937', '203.5', '203.5', '', 'rb'],
  ['650', 'Burleson 650', 'Burleson', 'Johnson', 'WRYZ886', '', '', 'closed', 'rb'],
  ['650', 'Dallas 650', 'Dallas', 'Dallas', 'WRKH887', 'D627', 'D156', '', 'rb'],
  ['650', 'Goldthwaite 650', 'Goldthwaite', 'Mills', 'WSCA723', '127.3', '127.3', '', 'rb'],
  ['650', 'Hunt 650', 'Hunt, Mo Ranch', 'Kerr', 'WRJV317', '141.3', '141.3', '', 'rb'],
  ['650', 'Irving 650', 'Irving', 'Dallas', 'WRKH887', 'D627', 'D156', '', 'rb'],
  ['650', 'Leon Valley 650', 'Leon Valley', 'Bexar', 'WQYM992', '123.0', '123.0', '', 'rb'],
  ['650', 'Los Fresnos 650', 'Los Fresnos', 'Cameron', 'WSAB252', '233.6', '233.6', '', 'rb'],
  ['650', 'McDade 650', 'McDade', 'Bastrop', 'WRUG875', '162.2', '', 'closed', 'rb'],
  ['650', 'Mesquite 650', 'Mesquite', 'Dallas', 'WQPI555', 'D606', 'D606', '', 'rb'],
  ['650', 'New Waverly 650', 'New Waverly', 'Walker', 'WSCT237', 'D631', 'D631', '', 'rb'],
  ['650', 'Palestine 650', 'Palestine', 'Anderson', 'WRTY258', '118.8', '173.8', '', 'rb'],
  ['650', 'Round Rock 650', 'Round Rock', 'Williamson', 'WRAA259', 'D411', 'D411', 'off', 'rb'],
  ['650', 'SAGMRS LV 650', 'Leon Valley (SAGMRS "LV650")', 'Bexar', '', '', '', '', 'user'],
  ['650', 'Freedom 650', 'Irving ("Freedom")', 'Dallas', '', '', '', '', 'user'],
  // 462.675 – GMRS 20R
  ['675', 'Amarillo 675', 'Amarillo', 'Potter', 'WRJH615', '141.3', '141.3', '', 'rb'],
  ['675', 'Austin 675', 'Austin, Camp Mabry', 'Travis', 'WSKI831', '141.3', '141.3', '', 'rb'],
  ['675', 'Bayside 675', 'Bayside', 'Refugio', 'WRKY481', '', '', 'closed', 'rb'],
  ['675', 'Dallas 675 D025', 'Dallas', 'Dallas', 'WRKH887', '', 'D025', 'closed', 'rb'],
  ['675', 'Dallas 675 D606', 'Dallas', 'Dallas', 'WRKH887', 'D606', 'D606', '', 'rb'],
  ['675', 'Laredo 675', 'Laredo, Jet Bowl', 'Webb', 'WSAH546', '199.5', '199.5', '', 'rb'],
  ['675', 'Longview 675', 'Longview Heights', 'Harrison', 'WSIG454', '218.1', '218.1', '', 'rb'],
  ['675', 'Lubbock 675', 'Lubbock', 'Lubbock', 'WQQH251', '141.3', '141.3', '', 'rb'],
  ['675', 'Mesquite 675', 'Mesquite Tower', 'Dallas', 'WQPI555', 'D606', 'D606', '', 'rb'],
  ['675', 'Odessa 675', 'Odessa', 'Ector', 'WRFP880', '141.3', '', '', 'rb'],
  ['675', 'Paris 675', 'Paris', 'Lamar', 'WRYF926', '', '', 'closed', 'rb'],
  ['675', 'Potosi 675', 'Potosi', 'Taylor', 'WRND785', '', '', 'closed', 'rb'],
  ['675', 'Troy 675', 'Troy, Pleasant View', 'Bell', 'WRAL242', 'D223', 'D223', '', 'rb'],
  ['675', 'Dallas 675', '"DCR Channel 1"', 'Dallas', '', '141.3', '141.3', '', 'react'],
  ['675', 'Geforce 675', 'Dallas ("Geforce DFW")', 'Dallas', '', '', '', '', 'user'],
  // 462.700 – GMRS 21R
  ['700', 'Beaumont 700', 'Beaumont', 'Jefferson', 'WRXZ789', '100.0', '100.0', '', 'rb'],
  ['700', 'Buda 700', 'Buda', 'Hays', 'WSGB808', '136.5', '136.5', '', 'rb'],
  ['700', 'Canton 700', 'Canton', 'Van Zandt', 'WQYX489', '136.5', '136.5', 'closed', 'rb'],
  ['700', 'Crockett 700', 'Crockett', 'Houston', 'WRCW322', '123.0', '123.0', '', 'rb'],
  ['700', 'Dallas 700 D503', 'Dallas', 'Dallas', 'WRKH887', 'D503', 'D263', '', 'rb'],
  ['700', 'Dallas 700 D606', 'Dallas', 'Dallas', 'WRKH887', 'D606', 'D606', '', 'rb'],
  ['700', 'Farmersville 700', 'Farmersville', 'Collin', 'WQNA381', '', '', 'closed', 'rb'],
  ['700', 'Killeen 700', 'Killeen, Three Angels Bridge', 'Bell', 'WRZE964', '123.0', '123.0', '', 'rb'],
  ['700', 'Lubbock 700', 'Lubbock', 'Lubbock', 'WQQH251', '118.8', '118.8', '', 'rb'],
  ['700', 'Mansfield 700', 'Mansfield', 'Tarrant', 'WRWF998', '', '', 'closed', 'rb'],
  ['700', 'Mesquite 700', 'Mesquite Tower', 'Dallas', 'WQPI555', 'D606', 'D606', '', 'rb'],
  ['700', 'Mexia 700', 'Mexia, Tehuacana (NFLARC)', 'Limestone', 'WRKY482', '146.2', '', '', 'rb'],
  ['700', 'Woodlands 700', 'The Woodlands, I-45 & Rayford', 'Montgomery', 'WRJQ567', '141.3', '141.3', '', 'rb'],
  ['700', 'Weatherford 700', 'Weatherford', 'Parker', 'WRJW846', '141.3', '141.3', '', 'rb'],
  ['700', 'Citywide 700', 'University Park ("Citywide")', 'Dallas', '', '', '', '', 'user'],
  // 462.725 – GMRS 22R
  ['725', 'Ballinger 725', 'Ballinger', 'Runnels', 'WQQQ870', '123.0', '', 'off', 'rb'],
  ['725', 'Bertram 725', 'Bertram', 'Burnet', 'WSEN956', '107.2', '107.2', '', 'rb'],
  ['725', 'Carlos 725', 'Carlos', 'Grimes', 'WRHV671', '141.3', '141.3', 'closed', 'rb'],
  ['725', 'Dallas 725', 'Dallas', 'Dallas', 'WRKH887', '', 'CSQ', '', 'rb'],
  ['725', 'Haltom City 725', 'Haltom City', 'Tarrant', 'WRPL432', '141.3', '141.3', '', 'rb'],
  ['725', 'Ingleside 725', 'Ingleside', 'San Patricio', 'WRAF241', '', '', 'closed', 'rb'],
  ['725', 'Katy 725', 'Katy', 'Harris', 'WSJC209', '123.0', '123.0', 'testing', 'rb'],
  ['725', 'Medina 725', 'Medina', 'Kerr', 'WQXE937', '203.5', '203.5', '', 'rb'],
  ['725', 'San Antonio 725', 'San Antonio, The Alamo', 'Bexar', 'WSDM218', '141.3', '141.3', '', 'rb'],
  ['725', 'Santa Fe 725', 'Santa Fe', 'Galveston', '', '141.3', '141.3', '', 'hams'],
  ['725', 'SAGMRS NB 725', 'New Braunfels (SAGMRS)', 'Comal', '', '', '', '', 'user'],
  ['725', 'Big Blue 725', 'Las Colinas / Irving ("Big Blue")', 'Dallas', '', '', '', '', 'user'],
  // SAGMRS listings without a published tone, 462.550 / 462.575
  ['550', 'SAGMRS NE 550', 'Northeast San Antonio (SAGMRS)', 'Bexar', 'WRUK776', '', '', '', 'user'],
  ['575', 'SAGMRS NC 575', 'North Central San Antonio (SAGMRS "SA575")', 'Bexar', '', '', '', '', 'user'],
  ['575', 'SAGMRS EC 575', 'Southeast Bexar County (SAGMRS "Eagle Creek")', 'Bexar', '', '', '', '', 'user'],
];
