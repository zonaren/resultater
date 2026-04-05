# Databaseskjema – Hesteskokasting Norge (ny versjon)

> Dokument basert på planleggingssamtale mars 2026.  
> Erstatter eksisterende .NET Framework 4.6 / MSSQL-løsning.  
> Ny stack: ASP.NET Core Web API + PostgreSQL + EF Core

---

## Overordnede prinsipper

- **Arrangement** er en hel helg med konkurranser (f.eks. "NM 2026")
- **Stevne** er én enkelt konkurranse innad i et arrangement
- **Resultat** er alltid én kaster – lag/par grupperes i frontend på `Plassering`
- Historisk klubb og klasse lagres på `Resultat`, ikke bare på `Kaster`
- Filer lagres i **Azure Blob Storage** – kun URL lagres i databasen
- `Kamp`-tabeller er valgfrie tillegg til `Resultat` – manuell innlegging uten kampdetaljer skal alltid være mulig

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

> `ErAktiv = false` dekker gamle klasser (A, B, C osv.). Ingen egen `ErLegacy`-kolonne er nødvendig.

---

### Gruppe
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Navn | string | "A", "B" |

> Kun brukt i avsluttende runde – x antall til A-gruppe, resten til B-gruppe.

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

> `ErLagbasert` og `BrukerRinger` erstatter hardkodede Id-sjekker i koden.

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

> Spørring for riktig skala: `WHERE GjelderFraAar <= stevneår AND (GjelderTilAar IS NULL OR GjelderTilAar >= stevneår)`

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
| StevneId | int FK → Stevne | |
| KasterId | int? FK → Kaster | |
| KlubbId | int? FK → Klubb | Historisk – klubben kaster tilhørte på tidspunktet |
| KlasseId | int? FK → Klasse | Historisk – klassen kaster tilhørte på tidspunktet |
| GruppeId | int? FK → Gruppe | A eller B – kun avsluttende runde |
| Plassering | int? | Brukes til å gruppere lag/par i frontend |
| ErPremie | bool? | |
| NorgescupPoeng | float? | Beregnes automatisk fra NorgescupPoeng-tabellen |

### ResultatStandard (en mot en) - vises bare i frontend dersom Gloppen eller NHm er brukt som innledende/full konkurranse
| ResultatId | int FK -> Resultat |
| KampPoeng | float? | 2, 1.5, 1 eller 0 – per kamp i Gloppen/Nordhordland |
| SkarInnledende | int? | Total skår fra innledende runde |

### ResultatSpesial - vises bare i frontend dersom kastemetode er X-kast, Kongelag eller Hesteskogolf
| ResultatId | int FK -> Resultat |
| PoengMinimatch | int? | X-kast minimatch totalpoeng. Vises i frontend dersom minimatch | 
| PoengXHalvmatch | int? | X-kast halvmatch totalpoeng. Vises i frontend dersom halvmatch |
| PoengXHeilmatch | int? | X-kast heilmatch totalpoeng. Vises i frontend dersom heilmatch |
| PoengKongelag | int? | Kongelag totalpoeng. Vises i frontend dersom kongelag |
| PoengGolf | int? | Hesteskogolf totalpoeng. Vises i frontend dersom hesteskogolf |
| AntallRingMinimatch | int? |. Vises i frontend dersom minimatch |
| AntallRingHalvmatch | int? |. Vises i frontend dersom halvmatch |
| AntallRingHeilmatch | int? |. Vises i frontend dersom heilmatch |
| AntallRingKongelag | int? | . Vises i frontend dersom kongelag |

### ResultatKongelag - vises bare i frontend dersom kastemetode er Kongelag
| ResultatId | int FK -> Resultat |


> Én rad = alltid én kaster. For lag/par/mix kombineres rader med samme `Plassering` og `StevneId` i frontend.

---

## Kamp-tabeller
*(valgfritt tillegg – brukes når scoreappen registrerer kampdetaljer)*

### Kamp

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| StevneId | int FK → Stevne | |
| KastemetodeId | int FK → Kastemetode | Hvilken metode denne kampen tilhører |
| ErInnledende | bool | Gloppen/Nordhordland-runde |
| ErAvsluttende | bool | Cup-runde |
| RundeNummer | int? | Rundenummer i innledende (f.eks. runde 3 av 8 i Gloppen) |

> En kamp har alltid to sider (KampSide). For X-kast og Kongelag brukes samme struktur, men sidene er ikke motstandere – de er hverandres dommere.

---

### KampSide

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KampId | int FK → Kamp | |
| SideNummer | int | 1 eller 2 |
| TotalPoeng | int? | Aggregert – beregnes fra KampOmgang |
| TotalRinger | int? | Aggregert – kun X-kast/Kongelag |
| ErVinner | bool? | Kun relevant for kamp-kategorier |

---

### KampSideDeltaker

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KampSideId | int FK → KampSide | |
| KasterId | int FK → Kaster | |
| ErStartspiller | bool | Hvem starter – relevant for Par i scoreappen |

> Singel: én deltaker per side. Par: to deltakere per side. X-kast/Kongelag: én deltaker per side.

---

### KampOmgang

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KampSideId | int FK → KampSide | |
| OmgangNummer | int | |
| Poeng | int | Totalpoeng for denne omgangen |
| AntallRinger | int? | Kun X-kast og Kongelag |

---

## Hierarki

```
Arrangement (helgen)
└── Stevne (én konkurranse)
      ├── Resultat (én kasters aggregerte sluttresultat)
      └── Kamp (valgfritt – én kamp mellom to sider)
            └── KampSide (side 1 eller 2)
                  ├── KampSideDeltaker (én eller to kastere)
                  └── KampOmgang (poeng per omgang)
```

---

## Eksempler

### Singel – Gloppen runde 3 (Ola vs Per)
```
Kamp (RundeNummer=3, ErInnledende=true)
├── KampSide 1 → KampSideDeltaker (Ola)
│     └── KampOmgang 1..N (poeng per omgang)
└── KampSide 2 → KampSideDeltaker (Per)
      └── KampOmgang 1..N (poeng per omgang)
```

### Par – (Ola+Kari) vs (Per+Lisa)
```
Kamp (ErInnledende=true)
├── KampSide 1
│     ├── KampSideDeltaker (Ola, ErStartspiller=true)
│     ├── KampSideDeltaker (Kari, ErStartspiller=false)
│     └── KampOmgang 1..N
└── KampSide 2
      ├── KampSideDeltaker (Per, ErStartspiller=true)
      ├── KampSideDeltaker (Lisa, ErStartspiller=false)
      └── KampOmgang 1..N
```

### X-kast – Ola og Per på samme bane
```
Kamp (ErInnledende=false, ErAvsluttende=false)
├── KampSide 1 → KampSideDeltaker (Ola)
│     └── KampOmgang 1..15/25/50 (poeng + ringer per omgang)
└── KampSide 2 → KampSideDeltaker (Per)
      └── KampOmgang 1..15/25/50 (poeng + ringer per omgang)
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
