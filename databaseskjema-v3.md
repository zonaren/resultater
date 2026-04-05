# Databaseskjema – Hesteskokasting Norge (v3)

> Basert på gjennomgang av gamle entitetsklasser og planleggingssamtale mars 2026.
> Erstatter eksisterende .NET Framework 4.6 / MSSQL-løsning.
> Ny stack: ASP.NET Core Web API + PostgreSQL + EF Core

---

## Endringer fra v2 → v3

- **Arrangement fjernet** – Stevne er igjen selvstendig med direkte dato, sted og arrangørklubb
- **Kamp-tabeller fjernet** – Kamp, KampSide, KampSideDeltaker og KampOmgang legges til i en egen fase senere
- **NorgescupPoeng** – fikset til å ha separate `PoengNC` og `PoengDNC` kolonner (som gammel kode)
- **StevneType** – fikk `ErAktiv` (manglet i v2)
- **Gruppe** – fikk `ErAktiv` (manglet i v2)
- **ResultatStandard / ResultatSpesial** – beholdt fra v2 (god separasjon av felttyper)

---

## Overordnede prinsipper

- **Stevne** representerer én enkelt konkurranse (f.eks. "NM Singel 2026")
- **Resultat** er alltid én kaster – lag/par grupperes i frontend på `Plassering`
- Historisk klubb og klasse lagres på `Resultat`, ikke bare på `Kaster`
- Filer lagres i **Azure Blob Storage** – kun URL lagres i databasen
- `Kamp`-tabeller redesignes separat i en senere fase

---

## Oppslagstabeller

### Kjonn
*(gammel: `Gender` med felter `Kjonn` og `Alias`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Mann", "Kvinne" |
| Kortform | string | "M", "K" |

---

### Klubb
*(gammel: hadde Adresse1, Adresse2, PostNr, Sted, Telefon, Epost, Hjemmeside, KlubbInfo – disse er utelatt da appen kun presenterer resultater)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KlubbNavn | string | |
| KlubbKortNavn | string? | |
| ErAktiv | bool | |
| LogoUrl | string? | Supabase Storage URL |

---

### Klasse
*(gammel: `KlasseNavn`, `IsActive`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Klasse 1", "Klasse 2" osv. |
| ErAktiv | bool | false = skjules i admin, historikk bevares |

> `ErAktiv = false` dekker gamle klasser (A, B, C osv.) som fantes før appen ble laget. Ingen separat `ErLegacy`-kolonne er nødvendig.

---

### Gruppe
*(gammel: `GruppeNavn`, `IsActive`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "A", "B" |
| ErAktiv | bool | |

> Kun brukt i avsluttende runde – x antall kastere til A-gruppe, resten til B-gruppe basert på innledende resultat.

---

### StevneType
*(gammel: `StevneTypeNavn`, `IsActive`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "NM", "NC", "SNC", "DNC", "Lokalt" |
| ErAktiv | bool | |

---

### Kastemetode
*(gammel: `KasteMetodeNavn`, `Beskrivelse`, `IsActive`, `IsNorgesranking`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Gloppen", "Cup", "Nordhordlandsmetoden", "X-kast minimatch", "X-kast halvmatch", "X-kast heilmatch", "Kongelag", "Hesteskogolf" |
| Beskrivelse | string? | |
| ErAktiv | bool | |
| ErNorgesranking | bool | |

---

### Kategori
*(erstatter den gamle `StevneFor`-tabellen med kun `StevneForNavn`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Singel", "Par", "Mix", "Lag", "X-kast", "Kongelag", "Hesteskogolf" |
| ErLagbasert | bool | true for Par, Mix, Lag – frontend grupperer på Plassering |

> `ErLagbasert` og `BrukerRinger` erstatter hardkodede Id-sjekker i gammel kode. API-et styrer seg selv automatisk basert på disse feltene.

---

### NorgescupPoeng
*(slår sammen de gamle `NorgescupenPoeng` og `NorgescupenPoeng2017` – beholder separate NC/DNC-kolonner som i gammel kode)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Plassering | int | |
| PoengNC | int | Poeng for Norgescup-stevne |
| PoengDNC | int | Poeng for Del-Norgescup-stevne | Mangler
| GjelderFraAar | int | |
| GjelderTilAar | int? | null = gjelder fortsatt |

> **Spørring for riktig poengskala:** `WHERE GjelderFraAar <= stevneår AND (GjelderTilAar IS NULL OR GjelderTilAar >= stevneår)`
> API-et velger `PoengNC` eller `PoengDNC` basert på `StevneType.Navn` for det aktuelle stevnet.

---

## Kjernetabeller

### Stevne
*(Arrangement-tabellen er fjernet – Stevne er igjen selvstendig, slik som i gammel kode)*
*(gammel: `StevneNavn`, `StevneSted`, `StevneDato`, `KlubbId`, `StevneForId`, `IsNM`, `IsNorgesranking`, `IsCompleted`, `IsExcludedFromRecords`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | f.eks. "NM Singel 2026" |
| Sted | string? | |
| Dato | date | |
| SluttDato | date? | For stevner som strekker seg over flere dager |
| ArrangorKlubbId | int? FK → Klubb | |
| KategoriId | int FK → Kategori | erstatter StevneForId |
| StevneTypeId | int? FK → StevneType | |
| InnledendeKastemetodeId | int? FK → Kastemetode | null for X-kast/Kongelag/Hesteskogolf som helkonkurranse |
| AvsluttendeKastemetodeId | int? FK → Kastemetode | |
| KontaktKasterId | int? FK → Kaster | |
| Juryleder | string? | |
| ErNM | bool | NM-vinnere presenteres automatisk i frontend |
| ErNorgesranking | bool | |
| HarKlasseInndeling | bool | false fra 2026 for de fleste konkurranser |
| ErFullfort | bool | |
| ErEkskludertFraRekorder | bool | |
| InnbydelseUrl | string? | Supabase Storage URL |
| InnbydelseOppdatert | datetime? | |
| ResultatUrl | string? | Supabase Storage URL |
| ResultatOppdatert | datetime? | |

---

### Kaster
*(gammel: `GenderId`, `IsActive` – nå `KjonnId`, `ErAktiv`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Medlemsnummer | int? | |
| Fornavn | string | |
| Etternavn | string | |
| Telefon | string? | |
| Epost | string? | |
| KjonnId | int FK → Kjonn | |
| KlubbId | int? FK → Klubb | Nåværende klubb – historisk sannhet ligger i Resultat |
| KlasseId | int? FK → Klasse | Nåværende klasse – nullable fra 2026 |
| ErAktiv | bool | |
| BildeUrl | string? | Supabase Storage URL |

> `FullName`, `FullNameOrderedByFornavn` og `NameAndClub` beregnes i API-laget, ikke i databasen.

---

### Resultat
*(gammel: hadde alle spesialpoeng direkte på tabellen – v3 beholder oppsplitting i undertabeller)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| StevneId | int FK → Stevne | |
| KasterId | int? FK → Kaster | |
| KlubbId | int? FK → Klubb | Historisk – klubben kaster tilhørte på tidspunktet |
| KlasseId | int? FK → Klasse | Historisk – klassen kaster tilhørte på tidspunktet |
| GruppeId | int? FK → Gruppe | A eller B – kun avsluttende runde |
| Plassering | int? | Brukes til å gruppere lag/par i frontend |
| ErPremie | bool? | |
| NorgescupPoeng | float? | Beregnes og lagres fra NorgescupPoeng-tabellen |

> Én rad = alltid én kaster. For lag/par/mix kombineres rader med samme `Plassering` og `StevneId` i frontend.

---

### ResultatStandard
*(én-til-én med Resultat – kun populated for stevner med Gloppen eller Nordhordlandsmetoden)*
*(gammel: `PoengInnledende` → `KampPoeng`, `PoengScore` → `SkarInnledende`)*

| Felt | Type | Notat |
|------|------|-------|
| ResultatId | int PK FK → Resultat | |
| KampPoeng | float? | 2, 1.5, 1 eller 0 – poeng per kamp i Gloppen/Nordhordland |
| SkarInnledende | int? | Total skår fra innledende runde |

---

### ResultatSpesial
*(én-til-én med Resultat – kun populated for X-kast, Kongelag eller Hesteskogolf)*
*(gammel: `PoengXkast` → `PoengXHalvmatch`, `PoengXkastHel` → `PoengXHeilmatch`, `PoengKonge` → `PoengKongelag`, `AntallRingKonge` → `AntallRingKongelag`)*

| Felt | Type | Notat |
|------|------|-------|
| ResultatId | int PK FK → Resultat | |
| PoengMinimatch | int? | X-kast minimatch totalpoeng |
| PoengXHalvmatch | int? | X-kast halvmatch totalpoeng |
| PoengXHeilmatch | int? | X-kast heilmatch totalpoeng |
| PoengKongelag | int? | Kongelag totalpoeng |
| PoengGolf | int? | Hesteskogolf totalpoeng |
| AntallRingMinimatch | int? | |
| AntallRingHalvmatch | int? | |
| AntallRingHeilmatch | int? | |
| AntallRingKongelag | int? | |

---

## Tabeller som legges til senere

### Kamp / KampSide / KampSideDeltaker / KampOmgang
Disse designes og implementeres i en egen fase når scoreapp-funksjonalitet skal på plass.

---

## Hierarki

```
Stevne (én konkurranse)
└── Resultat (én kasters aggregerte sluttresultat)
      ├── ResultatStandard (valgfritt – Gloppen/Nordhordland)
      └── ResultatSpesial (valgfritt – X-kast/Kongelag/Golf)
```

---

## Feltnavnsendringer fra gammel kode

| Gammel felt | Ny felt | Tabell |
|-------------|---------|--------|
| StevneFor | Kategori | (tabell omdøpt) |
| StevneForNavn | Navn | Kategori |
| StevneTypeNavn | Navn | StevneType |
| KlasseNavn | Navn | Klasse |
| GruppeNavn | Navn | Gruppe |
| KasteMetodeNavn | Navn | Kastemetode |
| IsActive / IsNM / IsNorgesranking / IsCompleted | ErAktiv / ErNM / ErNorgesranking / ErFullfort | (alle tabeller) |
| IsExcludedFromRecords | ErEkskludertFraRekorder | Stevne |
| IsPremie | ErPremie | Resultat |
| GenderId | KjonnId | Kaster |
| Gender.Alias | Kjonn.Kortform | Kjonn |
| StevneNavn | Navn | Stevne |
| StevneSted | Sted | Stevne |
| StevneDato | Dato | Stevne |
| KlubbId (arrangør på Stevne) | ArrangorKlubbId | Stevne |
| StevneForId | KategoriId | Stevne |
| KasterId (kontakt på Stevne) | KontaktKasterId | Stevne |
| PoengXkast | PoengXHalvmatch | ResultatSpesial |
| PoengXkastHel | PoengXHeilmatch | ResultatSpesial |
| PoengKonge | PoengKongelag | ResultatSpesial |
| AntallRingKonge | AntallRingKongelag | ResultatSpesial |
| PoengInnledende | KampPoeng | ResultatStandard |
| PoengScore | SkarInnledende | ResultatStandard |
| PoengNc | NorgescupPoeng | Resultat |
| NorgescupenPoeng.PoengNC | NorgescupPoeng.PoengNC | NorgescupPoeng |
| NorgescupenPoeng.PoengDNC | NorgescupPoeng.PoengDNC | NorgescupPoeng |

---

## Fillagring

Alle filer lagres i **Supabase Storage**. Databasen lagrer kun URL og metadata:

| Entitet | Felt |
|---------|------|
| Stevne | InnbydelseUrl, InnbydelseFilnavn, InnbydelseOppdatert |
| Stevne | ResultatUrl, ResultatFilnavn, ResultatOppdatert |
| Kaster | BildeUrl |
| Klubb | LogoUrl |
