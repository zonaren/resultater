# Konkurranseformat – Hesteskokasting Norge

> Dokument basert på planleggingssamtale mars 2026.  
> Formålet er å dokumentere hvordan konkurranser arrangeres, som grunnlag for databasedesign og scoreapp-integrasjon.

---

## Overordnet struktur

Et **arrangement** er en hel helg med én eller flere konkurranser (kan også være enkeltstevner på ukedager).  
Et **stevne** er én enkelt konkurranse innad i et arrangement.  
En konkurranse har én **kategori** (hvem deltar) og én eller to **kastemetoder** (hvordan det kastes).

---

## Kategorier (hvem deltar)

| Kategori | Beskrivelse |
|----------|-------------|
| Singel | Én kaster konkurrerer individuelt |
| Par | To kastere samarbeider som ett par |
| Mix | Par med blandet kjønn |
| Lag | Fire kastere, én per bane, som singel mot motstanderlag |
| X-kast | Individuell konkurranse med egen metode |
| Kongelag | Individuell konkurranse med egen metode |
| Hesteskogolf | Individuell konkurranse med egne klasser (Damer/Herrer/Junior) |

> For Par, Mix og Lag grupperes enkeltresultater i frontend basert på samme plassering.  
> Lagets navn utledes fra klubbtilhørighet – samme klubb vises én gang, blanding vises som "Klubb 1 / Klubb 2".  
> Faste lag som stiller i flere konkurranser finnes ikke – lag er alltid midlertidige grupperinger.

---

## Felles regler for kamp (Gloppen, Nordhordland, Cup)

### Antall sko
- Alle deltakere kaster **2 sko** per omgang

### Poengberegning per omgang
| Situasjon | Poeng |
|-----------|-------|
| Ring | 3 poeng |
| Nærmest sko | 1 poeng |
| Begge sko nærmest | 2 poeng |
| Begge har ring | 3 poeng hver (andre sko kanselleres) |
| A har to ringer, B har én ring | A: 6p, B: 3p (andre sko kanselleres) |
| A har ring + nærmest sko | 4 poeng |

> Kun totalpoeng per omgang lagres – ikke rådata om enkeltsko.

### Vinnerbetingelse
- Første deltaker/par som når **minimum 21 skår** vinner kampen
- I cup sluttspill må vinneren lede med **minimum 2 poeng**
- Kan ikke bli uavgjort i cup

### Kamppoeng (Gloppen og Nordhordlandsmetoden)
| Resultat | Kamppoeng |
|----------|-----------|
| Seier | 2 |
| Uavgjort | 1.5 |
| Tap, men 11 eller mer i skår | 1 |
| Tap, mindre enn 11 i skår | 0 |

> Kamppoeng gjelder per enkelt kamp. Brukes ikke i cup (direkte utslag).

### Kategorispesifikt
- **Singel:** Kaster frem og tilbake mellom stikkene
- **Par/Mix:** Deltakerne står på samme side og kaster kun én vei. To deltakere fra hvert par kaster mot hverandre fra hver sin ende av banen
- **Lag:** Fire singelkamper parallelt (én per lagmedlem per bane). Alltid nøyaktig fire baner per lagkamp

---

## Kastemetoder

### Gloppen (tilnærmet round robin)
- Arrangøren bestemmer antall runder – typisk 6–9
- Deltakerne får tildelt bane og motstander per runde via banefordelingsnøkler
- Ikke ren round robin – alle møter ikke nødvendigvis alle andre
- Brukes som **innledende** runde, eller som fullstendig konkurranse
- Gjelder for: Singel, Par, Mix, Lag

### Nordhordlandsmetoden (swiss)
- Første runde trekkes tilfeldig eller med seeding
- Påfølgende runder: motstandere trekkes basert på poengstilling (swiss-system)
- Brukes som **fullstendig** konkurranse, eller som innledende/avsluttende
- Gjelder for: Singel, Par, Mix, Lag

### Cup (utslag)
- Direkteoppgjør – vinner går videre, taper er ute
- Brukes **kun** som avsluttende runde
- Basert på innledende runde deles deltakerne i gruppe A og gruppe B (kun ved nok deltakere)
- Gjelder for: Singel, Par, Mix, Lag

### Vanligste kombinasjon
- **Innledende:** Gloppen eller Nordhordlandsmetoden
- **Avsluttende:** Cup, der x antall går til A-gruppe og resten til B-gruppe

---

## X-kast og Kongelag – felles regler

### Antall sko og poengberegning
- Deltakere kaster **4 sko** per omgang
- Maks poengsum per omgang: **20 poeng** (4 ringer)
- Maks antall ringer per omgang: **4**

| Situasjon | Poeng |
|-----------|-------|
| Ring | 5 poeng |
| Sko 0–5 cm fra stikka | 3 poeng |
| Sko 5–20 cm fra stikka | 2 poeng |
| Sko 20–50 cm fra stikka | 1 poeng |

> Poeng og antall ringer lagres per omgang.  
> Resultatet er alltid individuelt – de to på banen er hverandres dommere, ikke motstandere.

---

## X-kast

X-kast er både en kategori og en kastemetode. Finnes i tre varianter:

| Variant | Runder | Omganger totalt per deltaker |
|---------|--------|------------------------------|
| Minimatch | 3 | 15 |
| Halvmatch | 5 | 25 |
| Heilmatch | 10 | 50 |

### Gjennomføring
- To deltakere går sammen på én bane
- Deltaker A kaster 4 sko frem og tilbake = 1 omgang. 5 omganger = 1 runde (20 sko per runde)
- Deltaker B fører poeng og ringer per omgang
- Etter én runde bytter de roller – Deltaker B kaster, Deltaker A fører
- Dette repeteres til alle runder er ferdige
- Statistikk: poeng og ringer per omgang, total poengsum og totalt antall ringer per deltaker

### X-kast som kastemetode i singel
- X-kast kan brukes som innledende kastemetode i en singelkamp
- F.eks. X-kast halvmatch innledende + Kongelag avsluttende → kategori settes til "Singel"

---

## Kongelag

Kongelag er både en kategori og en kastemetode.

### Gjennomføring
- To deltakere går sammen på én bane
- Deltaker A kaster én og én omgang på kommando fra konkurranselederen – totalt 10 omganger
- Deltaker B fører poeng og ringer per omgang
- Etter 10 omganger bytter de roller
- I større konkurranser (f.eks. NM Kongelag) deles deltakerne i puljer, og poengførere tildeles baner
- Statistikk: poeng og ringer per omgang, total poengsum og totalt antall ringer per deltaker

---

## Par-konkurranse (detaljer)

- To par møtes: Par 1 (Ola + Kari) vs Par 2 (Per + Lisa)
- Per og Kari kaster mot hverandre fra én ende av banen
- Ola og Lisa kaster mot hverandre fra den andre enden
- Poengsummene fra begge ender slås sammen for paret
- Scoreappen veksler automatisk mellom endene (Per/Kari → Ola/Lisa → Per/Kari osv.)
- Statistikk registreres per enkeltdeltaker

---

## Scoreapp – live registrering

### Status
| Konkurranseform | Status |
|----------------|--------|
| X-kast (alle varianter) | Støttet |
| Kongelag | Støttet |
| Singelkamp | Støttet |
| Parkamp | Planlagt |
| Lagkamp | Vurderes |

### Teknisk løsning
- Live data lagres i Firebase (sanntidsoppdatering under konkurransen)
- Aggregerte resultater eksporteres til resultatdatabasen via API når konkurransen er ferdig
- Rundedetaljer er valgfritt – manuell innlegging av kun aggregerte tall skal alltid være mulig

### Hva lagres per konkurranseform
| Konkurranseform | Lagres per omgang | Lagres aggregert |
|----------------|-------------------|-----------------|
| Singel/Par | Skår + ringer | Kamppoeng, skår, plassering |
| X-kast | Poeng + ringer | Total poeng, total ringer |
| Kongelag | Poeng + ringer | Total poeng, total ringer |
