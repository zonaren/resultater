# Konkurranseformat – Hesteskokasting Norge

> Dokument basert på planleggingssamtale mars 2026.  
> Formålet er å dokumentere hvordan konkurranser arrangeres, som grunnlag for databasedesign og scoreapp-integrasjon.  
> **NB: Dette dokumentet må verifiseres og suppleres av fagperson.**

---

## Overordnet struktur

Et **arrangement** er en hel helg med én eller flere konkurranser.  
Et **stevne** er én enkelt konkurranse innad i et arrangement (det kan også arrangeres enkeltstevner i ukedager)
En konkurranse har én **kategori** (hvem deltar) og én eller to **kastemetoder** (hvordan det kastes).

---

## Kategorier (hvem deltar)

| Kategori | Beskrivelse |
|----------|-------------|
| Singel | Én kaster konkurrerer individuelt |
| Par | To kastere samarbeider som ett par |
| Mix | Par med blandet kjønn |
| Lag | Fire kastere samarbeider som ett lag |
| X-kast | Individuell konkurranse med egen metode |
| Kongelag | Individuell konkurranse med egen metode |
| Hesteskogolf | Individuell konkurranse med egne klasser (Damer/Herrer/Junior) |

> For Par, Mix og Lag grupperes enkeltresultater i frontend basert på samme plassering.  
> Lagets navn utledes fra klubbtilhørighet – samme klubb vises én gang, blanding vises som "Klubb 1 / Klubb 2".

---

## Felles
- Gloppen, Nordhordlandsmetoden og cup utføres som en kamp mellom to eller tre deltakere/par/lag per bane
- X-kast utføres mellom to makkere per bane, der de bytter på å kaste/føre mellom hver runde
- Kongelag utføres mellom to makkere per bane, der de bytter på å kaste/føre etter at deltakeren har kastet 10 omganger
    - Hver omgang utføres på kommando fra konkurranseleder.
    - I noen konkurranser, for eksempel NM Kongelag blir deltakere delt inn i to eller flere puljer
        - Poengførere blir tildelt baner

## Litt om kamp
- Alle deltakere kaster to sko
- Poeng
    - Ring 3 poeng
    - Nærmest sko: 1 poeng
    - Begge sko nærmest: 2 poeng
    - Begge deltakere har en ring: 3 poeng til begge (andre sko kanselleres)
    - Deltaker A har to ringer, mens deltaker B har en ring: 6-3 (andre sko kanselleres)
    - Deltaker A har en ring og en sko nærmest: 4 poeng
- Hver kamp gir kamppoeng (2 for seier, 1.5 for uavgjort, 1 dersom taperen får 11 eller mer i skår, 0 for tap (mindre enn 11 i skår))
    - Gjelder ikke cup
- - Total skår (poeng fra alle kast) brukes som tiebreaker
- Singel: Deltakerene kaster to sko hver frem og tilbake mellom stikkene
- Par/Mix: Deltakerene står på en side og kaster kun en veg.
    - Eksempel: Per/Ola mot Kari/Gunn
    - Per og Kari står på en side, mens Ola og Gunn står på den andre siden
- Lag: Et lag består av fire deltakere og kaster på hver sin bane (som singel) mot en annen deltaker fra et annet lag
- Den første deltakeren som når minimum 21 skår vinner kampen.
    - I cup sluttspill må deltakeren vinne med minimum 2 poeng. 

## Kastemetoder

### Gloppen (tilnærmet round robin, men ikke det samme)
- Arrangøren bestemmer antall runder. Typisk 6-9
- Alle kastere får tildelt banenummer og motstander for hver runde før konkurransen starter (banefordelingsnøkkel)
    - Vi har en Banefordelingsnøkkel per antall deltakere (partall). Inneholder startnummer, bane og motstander
- Brukes typisk som **innledende** runde, men kan også brukes som fullstendig konkurranse
- Gjelder for kategoriene: Singel, Par, Mix, Lag

### Nordhordlandsmetoden (swiss)
- Lignende Gloppen, men trekning av motstandere baseres på poengstilling mellom hver runde. Første runde blir trekt tilfeldig eller det brukes seeding
- Brukes typisk som **fullstendig** konkurranse, men kan også brukes som innledende og avsluttende konkurranse.
- Gjelder for kategoriene: Singel, Par, Mix, Lag

### Cup (utslag)
- Direkteoppgjør, vinneren går videre, taper er ute
- Brukes bare som **avsluttende** runde
- Basert på resultat fra innledende runde deles deltakerne ofte i gruppe A og gruppe B (det er ikke vanlig dele inn i A og B ved få deltakere)
- Gjelder for kategoriene: Singel, Par, Mix, Lag

### Kombinasjon innledende + avsluttende
Den vanligste konkurranseformen er:
- **Innledende:** Gloppen eller Nordhordlandsmetoden
- **Avsluttende:** Cup, der x antall går til A-gruppe og resten til B-gruppe

---

## X-kast og Kongelag - Felles regler
- Deltakere kaster 4 sko per omgang
- Maks oppnåelige poengsum er 20 (4 ringer)
- Poeng:
    5 poeng for ring
    3 poeng dersom skoen er 0-5cm fra stikka
    2 poeng dersom skoen er 5-20cm fra stikka
    1 poeng dersom skoen er 20-50cm fra stikka

## X-kast

X-kast er både en kategori og en kastemetode. Den finnes i tre varianter:

| Variant | Antall runder |
|---------|--------------|
| Minimatch | 3 runder | 15 omganger |
| Halvmatch | 5 runder | 25 omganger |
| Heilmatch | 10 runder | 50 omganger |

### Gjennomføring
- To deltakere går sammen på én bane
- Deltaker A kaster: 4 sko frem og tilbake = 1 omgang. 5 omganger = 1 runde (totalt 20 sko per runde)
- Deltaker B fører poengsum og antall ringer per omgang
- Når Deltaker A er ferdig med en runde, bytter de roller
- Deltaker B kaster sin runde mens Deltaker A fører
- Dette repeteres til alle rundene er ferdig
- Resultatet er individuelt – de to på banen er hverandres dommere, ikke motstandere
- Statistikk: poeng og antall ringer per omgang og total poengsum og totalt antall ringer per deltaker

### X-kast som kastemetode i singel
X-kast kan også brukes som kastemetode i en singelkonkurranse:
- F.eks. X-kast halvmatch som innledende og Kongelag som avsluttende
- Da settes kategori til "Singel", ikke "X-kast"

---

## Kongelag

Kongelag er både en kategori og en kastemetode.

### Gjennomføring
- To deltakere går sammen på én bane
- Deltaker A kaster én og én omgang på kommando fra konkurranselederen (alle 10 omganger)
- Deltaker B fører poengsum og antall ringer i hver omgang
- Etter 10 omganger er Deltaker A ferdig, og de bytter roller
- Resultatet er individuelt – samme prinsipp som X-kast
- Statistikk: poeng og antall ringer per omgang og total poengsum og antall ringer per deltaker

---

## Par-konkurranse

### Gjennomføring
- To par møtes på én bane: Par 1 (Ola + Kari) vs Par 2 (Per + Lisa)
- Deltakerne står alltid på samme side av banen (ulikt singel der de går frem og tilbake)
- Ola og Per kaster mot hverandre fra én ende
- Kari og Lisa kaster mot hverandre fra den andre enden
- Poengsummene fra begge ender slås sammen for laget
- Paret som oppnår 21 poeng først vinner kampen
- Scoreappen bytter automatisk mellom endene (Ola/Per → Kari/Lisa → Ola/Per osv.)
- Statistikk registreres per enkeltdeltaker, slik at individuelle data bevares

---

## Scoreapp – live registrering

Scoreappen brukes til live registrering av poeng under konkurransen.

### Støttede konkurranseformer (nåværende + planlagt)
- X-kast (alle varianter): støttet
- Kongelag: støttet
- Singelkamp: støttet
- Parkamp: Planlagt
- Lagkamp (vurderes)

### Dataflyt
1. Scoreappen registrerer poeng per omgang live (via Firebase i dag)
2. Når konkurransen er ferdig eksporteres aggregerte resultater til resultatdatabasen via API
3. Rundedetaljer lagres valgfritt – ikke alle deltakere ønsker dette
4. Manuell innlegging av kun aggregerte tall skal alltid være mulig som alternativ

### Registrering per konkurranseform
- **Singel/Par:** poeng per omgang, vinner/taper per kamp
- **X-kast:** poeng og antall ringer per omgang
- **Kongelag:** poeng og antall ringer per omgang

---

## Åpne spørsmål

- [ ] Hvordan fungerer trekning av motstandere i Gloppen og Nordhordlandsmetoden?
    - I gloppen bruker vi såkalte banefordelingsnøkler. Deltakerene får tildelt bane og motstander for hver runde
    - I nordhordlandsmetoden er den første runden tilfeldig, mens resterende runder er basert på swiss.
- [ ] Hva er maks antall deltakere i en typisk konkurranse?
    - Det er ingen maksgrense
- [ ] Hvordan håndteres uavgjort i Cup?
    - Det kan ikke bli uavgjort i cup. Deltakeren som vinenr må vinne med minimum 2 poeng.
- [ ] Er det noen kastemetoder som ikke er nevnt her?
    - Ja, men de er ikke i bruk lenger.
- [ ] Finnes det faste lag som stiller i flere konkurranser (relevant for Lag-kategori)?
    - Nei
- [ ] Nøyaktig poengberegning per kastemetode (f.eks. maks poeng per omgang i X-kast)?
    - X-kast og Kongelag: Hver deltaker kaster 4 sko per omgang. Maks poeng er 20 og maks antall ringer er 4 (en ring er 5 poeng)
    - Kamp: Hver deltaker kaster 2 sko. Se poengberegning
