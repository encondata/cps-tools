'use strict';

/* ---------------------------------------------------------------------------
 * Built-in CPS2 templates used when creating channels and contacts from
 * scratch (e.g. RadioReference import). Taken from real CPS2 exports; the
 * name, frequencies and signalling are overwritten when they are used.
 * A Library channel can be chosen instead to match a specific radio model.
 * ------------------------------------------------------------------------- */

const TEMPLATES = {
  analog: `<set name="ConventionalPersonality" alias="Analog" key="ANLGCONV">
  <field name="CP_SELECT5CHAN">False</field>
  <field name="CP_PERSTYPE" Name="Analog">ANLGCONV</field>
  <field name="CP_UTOSCANEN">False</field>
  <field name="CP_TOCEN">True</field>
  <field name="CP_RXONLYEN">False</field>
  <field name="CP_RXREFFREQ" Name="Default">DEFAULT</field>
  <field name="CP_RXTPLCODE" Name="XZ">STR_XZ</field>
  <field name="CP_TXREFFREQ" Name="Default">DEFAULT</field>
  <field name="CP_TXTPLCODE" Name="XZ">STR_XZ</field>
  <field name="CP_TALKAROUNDEN">False</field>
  <field name="CP_VOXSTATE">False</field>
  <field name="CP_EMPHASEL" Name="De &amp; Pre">DEEMPHPREEMPH</field>
  <field name="CP_TOT">60</field>
  <field name="CP_TOTWRN">4</field>
  <field name="CP_AFCEN">1</field>
  <field name="CP_OPBEN">False</field>
  <field name="CP_REVBURST" Name="Standard">STANDARD</field>
  <field name="CP_VOICELMT">2</field>
  <field name="CP_DATALMT">3</field>
  <field name="CP_SQCHCONT">-6</field>
  <field name="CP_TXPWR" Name="High">HIGHPWR</field>
  <field name="CP_CHASSGNTYPE" Name="Domestic">DOMESTIC</field>
  <field name="CP_COMPSTATE">False</field>
  <field name="CP_PLREQDATA">False</field>
  <field name="CP_RXUNMUTE" Name="Data Or Squelch Or Selective Squelch">DATAORSQCHORSELSQCH</field>
  <field name="CP_RXSIGTY" Name="LTD">LTD</field>
  <field name="CP_SCANREMCARSQCH">False</field>
  <field name="CP_TXSIGSYSIT" Name="None">NONE</field>
  <field name="CP_TXFREQ">0</field>
  <field name="CP_RXFREQ">0</field>
  <field name="CP_TXDEV" Name="ID2PT5">ID2PT5</field>
  <field name="CP_PLDEV">650</field>
  <field name="CP_CHNLBWDTH" Name="12.5">STR_12PT5KHZ</field>
  <field name="CP_TXTDPLCD">023</field>
  <field name="CP_RXDPLCD">023</field>
  <field name="CP_TXTTPLFREQ">67.0</field>
  <field name="CP_RXTPLFREQ">67.0</field>
  <field name="CP_RXDPLINV">False</field>
  <field name="CP_TXDPLINV">False</field>
  <field name="CP_USELD" Name="On">ON</field>
  <field name="CP_XSQCHTY" Name="CSQ">CSQ</field>
  <field name="CP_TXSQCHTY" Name="CSQ">CSQ</field>
  <field name="CP_EMACKEN">False</field>
  <field name="CP_EMACKALERTEN">True</field>
  <field name="CP_EMALRMINDEN">False</field>
  <field name="CP_EMCALINDEN">False</field>
  <field name="CP_CNVPERSALIAS">Analog</field>
  <field name="CP_UNMUTETYPE" Name="Std Unmute, Mute">STDUNMUTESTDMUTE</field>
  <field name="CP_TXINHXPLEN" Name="Channel Free">ONCHNNLFREE</field>
  <field name="CP_BUSYLEDEN">True</field>
  <field name="CP_RXSIGSYSIT" Name="None">NONE</field>
  <field name="CP_RXSIGSQL" Name="OR">OR</field>
  <field name="CP_TOTREKEYDELAY">0</field>
  <field name="CP_EMERGENCY_CALL_DECODE_TONE_ENABLE">False</field>
  <field name="CP_MTSTFCCTP1RSSITHRSHD_SUBS">-124</field>
  <field name="CP_SCNROAMLISTIT" Name="None">NONE</field>
  <field name="CP_LONEWORKEN">False</field>
  <field name="CP_HCS" Name="None">NONE</field>
  <field name="CP_RDIPCSINHSTT">False</field>
  <field name="CP_SQUELCHPLUS" Name="Normal">NORMAL</field>
  <field name="CP_LOIS">False</field>
  <field name="CP_CNIHBTSLTN">False</field>
  <field name="CP_RPTACID">0</field>
  <field name="CP_ARTSMODETYPE" Name="Disabled">STR_DISABLED</field>
  <field name="CP_ARTSTXPRD" Name="25">ID25</field>
  <field name="CP_CVFNLITEM" Name="None">NONE</field>
  <field name="CP_ANALOGVOICESCRAMBLINGENABLE">False</field>
  <field name="CP_OTAPHGHVLMDT">1400</field>
  <field name="CP_OTAPIDCHNLSH">600</field>
  <field name="CP_OTAPARSMNTFG">False</field>
  <field name="CP_OTAPFSTTRDWD">240</field>
  <field name="CP_OTAPTMDTIDCN">3000</field>
  <field name="CP_OTAPLOWVLMCT">8</field>
  <field name="CP_OTAPHIGHVLMCT">3</field>
  <field name="CP_SARQ_AT">8</field>
  <field name="CP_SARQ_WT">700</field>
  <field name="CP_MANDOWNPROFILEITEM" Name="None">NONE</field>
  <field name="CP_WAVEMODE" Name="WAVE_DISABLED">WAVE_DISABLED</field>
  <field name="CP_LASTSELECTEDWAVECHANNEL">4294967295</field>
  <field name="Comments"></field>
  <field name="OffSet">0.000000</field>
</set>`,

  digital: `<set name="ConventionalPersonality" alias="Digital" key="DGTLCONV6PT25">
  <field name="CP_PERSTYPE" Name="Digital">DGTLCONV6PT25</field>
  <field name="CP_UTOSCANEN">False</field>
  <field name="CP_RXONLYEN">False</field>
  <field name="CP_RXREFFREQ" Name="Default">DEFAULT</field>
  <field name="CP_TXREFFREQ" Name="Default">DEFAULT</field>
  <field name="CP_SLTASSGMNT" Name="1">SLOT1</field>
  <field name="CP_TALKAROUNDEN">False</field>
  <field name="CP_VOXSTATE">False</field>
  <field name="CP_ALLSYSCALLEN">True</field>
  <field name="CP_VOICEPRIVACYEN">False</field>
  <field name="CP_TOT">60</field>
  <field name="CP_TOTWRN">4</field>
  <field name="CP_AFCEN">1</field>
  <field name="CP_OPBEN">False</field>
  <field name="CP_VOICELMT">2</field>
  <field name="CP_DATALMT">3</field>
  <field name="CP_TXPWR" Name="High">HIGHPWR</field>
  <field name="CP_CHASSGNTYPE" Name="Domestic">DOMESTIC</field>
  <field name="CP_SYNCMODE" Name="SYNCHRNOUS">SYNCHRNOUS</field>
  <field name="CP_RXSIGTY" Name="LTD">LTD</field>
  <field name="CP_COLORCODE">1</field>
  <field name="CP_EMSYSIT" Name="None">NONE</field>
  <field name="CP_TGLISTIT" Name="None">NONE</field>
  <field name="CP_TXFREQ">0</field>
  <field name="CP_RXFREQ">0</field>
  <field name="CP_TXDEV" Name="ID2PT5">ID2PT5</field>
  <field name="CP_USELD" Name="Off">OFF</field>
  <field name="CP_UKPPERS" Name="None">NONE</field>
  <field name="CP_EMACKEN">False</field>
  <field name="CP_EMACKALERTEN">True</field>
  <field name="CP_EMALRMINDEN">False</field>
  <field name="CP_EMCALINDEN">False</field>
  <field name="CP_CNVPERSALIAS">Digital</field>
  <field name="CP_TXINHXPLEN" Name="Channel Free">ONCHNNLFREE</field>
  <field name="CP_BUSYLEDEN">True</field>
  <field name="CP_TOTREKEYDELAY">0</field>
  <field name="CP_EMERGENCY_CALL_DECODE_TONE_ENABLE">False</field>
  <field name="CP_GPSRVRTPERSIT_Zone" Name="None">NONE</field>
  <field name="CP_GPSRVRTPERSIT" Name="Selected">SELECTED</field>
  <field name="CP_MYCALLADCRTR" Name="Always">ALWAYS</field>
  <field name="CP_VOICECALLINT">False</field>
  <field name="CP_MLTSTPSNLTIND">False</field>
  <field name="CP_PRVTCLSTPOP">False</field>
  <field name="CP_INTRPTMSGDLY">60</field>
  <field name="CP_MTSTFCCTP1RSSITHRSHD_SUBS">-124</field>
  <field name="CP_ENHCPRVCYIT" Name="None">NONE</field>
  <field name="CP_SCNROAMLISTIT" Name="None">NONE</field>
  <field name="CP_LONEWORKEN">False</field>
  <field name="CP_OVCMDECODEENABLE">False</field>
  <field name="CP_OBTRUNKMODE">False</field>
  <field name="CP_TXCOMPUDPIPHEADEN" Name="None">NONE</field>
  <field name="CP_DEVMEDFORINDDATACALL">True</field>
  <field name="CP_OPONTICH">False</field>
  <field name="CP_RDIPCSINHSTT">False</field>
  <field name="CP_PHONESYSIT" Name="None">NONE</field>
  <field name="CP_SCHGPSWDSZ" Name="8">ID8</field>
  <field name="CP_TRTEN">False</field>
  <field name="CP_SCHGPSEN">False</field>
  <field name="CP_RASDATAITEM" Name="None">NONE</field>
  <field name="CP_ARSPLUS" Name="Disabled">DISABLED</field>
  <field name="CP_LOIS">False</field>
  <field name="CP_625EDMEN">False</field>
  <field name="CP_CNIHBTSLTN">False</field>
  <field name="CP_CVFNLITEM" Name="None">NONE</field>
  <field name="CP_OTAPHGHVLMDT">1400</field>
  <field name="CP_OTAPIDCHNLSH">600</field>
  <field name="CP_OTAPARSMNTFG">False</field>
  <field name="CP_OTAPFSTTRDWD">240</field>
  <field name="CP_OTAPTMDTIDCN">3000</field>
  <field name="CP_OTAPLOWVLMCT">8</field>
  <field name="CP_OTAPHIGHVLMCT">3</field>
  <field name="CP_SARQ_AT">8</field>
  <field name="CP_SARQ_WT">700</field>
  <field name="CP_CSBKDATAENABLE">False</field>
  <field name="CP_625EDMPRFLD" Name="Eligible">ELIGIBLE</field>
  <field name="CP_MANDOWNPROFILEITEM" Name="None">NONE</field>
  <field name="CP_LOCATIONDATADELIVERYMODE" Name="Follow Data Call Confirmed">FOLLOW_CALL_DATA_SETTING</field>
  <field name="CP_TEXTMESSAGETYPE" Name="Advantage">TMS</field>
  <field name="CP_OTABMSTATUS">False</field>
  <field name="CP_PERSITEROAMINGRSSITHRESHOLD">-108</field>
  <field name="CP_SFROUTBOUNDCOLORCODE">1</field>
  <field name="CP_SFRINBOUNDCOLORCODE">1</field>
  <field name="CP_SFRENABLE" Name="Disabled">SFR_DISABLED</field>
  <field name="CP_TRANSMITINTERRUPTTYPE" Name="Advantage">PROPRIETARY</field>
  <field name="CP_IGNORERXCLEARVOICEANDPACKETDATAENABLE">False</field>
  <field name="CP_FIXEDPRIVACYKEYDECRYPTIONENABLE">False</field>
  <field name="CP_WAVEMODE" Name="WAVE_DISABLED">WAVE_DISABLED</field>
  <field name="CP_LASTSELECTEDWAVECHANNEL">4294967295</field>
  <field name="CP_DIGITALBACKHAULENABLED">False</field>
  <field name="Comments"></field>
  <field name="OffSet">0.000000</field>
</set>`,

  // Digital group-call contact.
  contact: `<set name="PCRContacts" alias="Contact">
  <field name="ContactName">Contact</field>
  <collection name="MDCCalls" />
  <collection name="QuikCallIICalls" />
  <collection name="DigitalCalls">
    <set name="DigitalCalls" index="0" key="GRPCALL">
      <field name="DU_CALLALIAS">Contact</field>
      <field name="DU_CALLLSTID">1</field>
      <field name="DU_ROUTETYPE" Name="Regular">REGULAR</field>
      <field name="DU_CALLPRCDTNEN">False</field>
      <field name="DU_RINGTYPE" Name="No Style">NOSTYLE</field>
      <field name="DU_TXTMSGALTTNTP" Name="Repetitive">REPETITIVE</field>
      <field name="DU_CALLTYPE" Name="Group Call">GRPCALL</field>
      <field name="DU_OVCMCALL">False</field>
      <field name="DU_CALLTYPEPART2">0</field>
      <field name="DU_UKPOTCFLG">False</field>
      <field name="DU_RVRTPERS_Zone" Name="None">NONE</field>
      <field name="DU_RVRTPERS" Name="Selected">SELECTED</field>
      <field name="CallType">Digital Calls-Group Call</field>
      <field name="PeudoCallId">1</field>
    </set>
  </collection>
  <collection name="CapacityPlusCalls" />
  <collection name="PhoneCalls" />
  <field name="Comments"></field>
</set>`,
};
