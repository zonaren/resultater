# Databaseskjema – Hesteskokasting Norge (ny versjon)

> Dokument basert på planleggingssamtale mars 2026.  
> Erstatter eksisterende .NET Framework 4.6 / MSSQL-løsning.  
> Ny stack: ASP.NET Core Web API + PostgreSQL + EF Core

---

## Overordnede prinsipper

- **Arrangement** er en hel helg med konkurranser (f.eks. "NM 2026")
- **Stevne** er én enkelt konkurranse innad i et arrangement (f.eks. "NM Singel 2026")
- **Resultat** er alltid én kaster – lag/par grupperes i frontend på `Plassering`
- Historisk klubb og klasse lagres på `Resultat`, ikke bare på `Kaster`
- Filer lagres i **Azure Blob Storage** – kun URL lagres i databasen
- `Kamp`-tabeller redesignes separat i en senere fase

---

## Oppslagstabeller

### Kjonn
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Mann", "Kvinne" |
| Kortform | string | "M", "K" |

---

### Klubb
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KlubbNavn | string | |
| KlubbKortNavn | string | |
| ErAktiv | bool | |
| LogoUrl | string? | Azure Blob URL |

---

### Klasse
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Klasse 1", "Klasse 2" osv. |
| Kortform | string | |
| ErAktiv | bool | false = skjules i admin, historikk bevares |

> **Merk:** `ErAktiv = false` dekker gamle klasser (A, B, C osv.) fra før appen ble laget. Ingen egen `ErLegacy`-kolonne er nødvendig.

---

### Gruppe
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "A", "B" |

> Kun brukt i avsluttende runde (x antall til A-gruppe, x antall til B-gruppe basert på innledende resultat).

---

### StevneType
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "NM", "NC", "SNC", "DNC", "Lokalt" |
| Kortform | string | |

---

### Kastemetode
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Gloppen", "Cup", "Nordhordlandsmetoden", "X-kast minimatch", "X-kast halvmatch", "X-kast heilmatch", "Kongelag", "Hesteskogolf" |
| Beskrivelse | string? | |
| ErAktiv | bool | |
| ErNorgesranking | bool | |

---

### Kategori
*(erstatter den gamle `StevneFor`-tabellen)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "Singel", "Par", "Mix", "Lag", "X-kast", "Kongelag", "Hesteskogolf" |
| ErLagbasert | bool | true for Par, Mix, Lag – frontend grupperer på Plassering |
| BrukerRinger | bool | true for X-kast, Kongelag – frontend viser ringkolonner |

> **Merk:** `ErLagbasert` og `BrukerRinger` erstatter hardkodede Id-sjekker i koden. API-et styrer seg selv automatisk basert på disse feltene.

---

### NorgescupPoeng
*(slår sammen de gamle `NorgescupenPoeng` og `NorgescupenPoeng2017`)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Plassering | int | |
| Poeng | int | |
| GjelderFraAar | int | |
| GjelderTilAar | int? | null = gjelder fortsatt |

> **Spørring for riktig poengskala:** `WHERE GjelderFraAar <= stevneår AND (GjelderTilAar IS NULL OR GjelderTilAar >= stevneår)`

---

## Kjernetabeller

### Arrangement
*(ny tabell – representerer en hel helg/turnering)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | f.eks. "NM 2026" |
| Sted | string? | |
| StartDato | date | |
| SluttDato | date? | |
| ArrangorKlubbId | int? FK → Klubb | |
| InnbydelseUrl | string? | Azure Blob URL |
| InnbydelseFilnavn | string? | Originalt filnavn |
| InnbydelseOppdatert | datetime? | |

---

### Stevne
*(representerer én enkelt konkurranse)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| ArrangementId | int FK → Arrangement | |
| KategoriId | int FK → Kategori | |
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
| ResultatUrl | string? | Azure Blob URL |
| ResultatFilnavn | string? | Originalt filnavn |
| ResultatOppdatert | datetime? | |

---

### Kaster

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
| BildeUrl | string? | Azure Blob URL |

> `FullName`, `FullNameOrderedByFornavn` og `NameAndClub` beregnes i API-laget, ikke i databasen.

---

### Resultat

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| StevenId | int FK → Stevne | |
| KasterId | int? FK → Kaster | |
| KlubbId | int? FK → Klubb | Historisk – klubben kaster tilhørte på tidspunktet |
| KlasseId | int? FK → Klasse | Historisk – klassen kaster tilhørte på tidspunktet |
| GruppeId | int? FK → Gruppe | A eller B – kun avsluttende runde |
| Plassering | int? | Brukes til å gruppere lag/par i frontend |
| ErPremie | bool? | |
| KampPoeng | int? | Poeng fra innledende runde (f.eks. 2 for seier i Gloppen) |
| SkarInnledende | int? | Total skår fra innledende runde |
| NorgescupPoeng | float? | Beregnes automatisk fra NorgescupPoeng-tabellen |
| PoengXkastHalv | int? | X-kast halvmatch |
| PoengXkastHeil | int? | X-kast heilmatch |
| PoengKongelag | int? | Kongelag |
| PoengMinimatch | int? | X-kast minimatch |
| PoengGolf | int? | Hesteskogolf |
| AntallRingMinimatch | int? | |
| AntallRingKongelag | int? | |
| AntallRingHalvmatch | int? | |
| AntallRingHeilmatch | int? | |

> **Merk:** Én rad = alltid én kaster. For lag/par/mix kombineres rader med samme `Plassering` og `StevenId` i frontend. Lagets navn utledes fra klubbtilhørighet per deltaker.

---

## Tabeller som designes senere

### Kamp / KampDetalj / KamprundeDetalj
Disse er ikke funksjonelle i eksisterende app og redesignes fra scratch i en egen fase.

---

## Hierarki

```
Arrangement (helgen)
└── Stevne (én konkurranse)
      └── Resultat (én kasters resultat)
```

---

## Fillagring

Alle filer lagres i **Azure Blob Storage**. Databasen lagrer kun URL og metadata:

| Entitet | Felt |
|---------|------|
| Arrangement | InnbydelseUrl, InnbydelseFilnavn, InnbydelseOppdatert |
| Stevne | ResultatUrl, ResultatFilnavn, ResultatOppdatert |
| Kaster | BildeUrl |
| Klubb | LogoUrl |
