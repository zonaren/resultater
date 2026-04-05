# Databaseskjema – Original (gammel .NET Framework 4.6 MVC-app)

> Dette dokumentet beskriver nøyaktig hvordan databasen ser ut i dag, basert på de eksisterende C#-entitetsklassene.
> Rammeverk: .NET Framework 4.6 MVC / Code First / LINQ to SQL / MSSQL Server

---

## Oppslagstabeller

### Gender
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Kjonn | string | "Mann", "Kvinne" |
| Alias | string | "M", "K" |

---

### Klubb
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KlubbNavn | string | |
| Adresse1 | string? | |
| Adresse2 | string? | |
| PostNr | string? | |
| Sted | string? | |
| Telefon | string? | |
| Epost | string? | |
| Hjemmeside | string? | |
| KlubbInfo | string? | |
| IsActive | bool | |

---

### Klasse
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KlasseNavn | string | |
| IsActive | bool? | |

---

### Gruppe
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| GruppeNavn | string | |
| IsActive | bool | |

---

### StevneType
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| StevneTypeNavn | string | |
| IsActive | bool? | |

---

### Kastemetode
| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| KasteMetodeNavn | string | |
| Beskrivelse | string? | |
| IsActive | bool? | |
| IsNorgesranking | bool? | |

---

### StevneFor
*(Klassifisering – f.eks. Singel, Par, Lag, X-kast)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| StevneForNavn | string | |

---

### NorgescupenPoeng
*(Poengskala gjeldende frem til og med 2016)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Plassering | int | |
| PoengNC | int | Poeng for Norgescup-stevne |
| PoengDNC | int | Poeng for Del-Norgescup-stevne |

---

### NorgescupenPoeng2017
*(Poengskala gjeldende fra 2017)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Plassering | int | |
| PoengNC | int | Poeng for Norgescup-stevne |
| PoengDNC | int | Poeng for Del-Norgescup-stevne |

---

## Kjernetabeller

### Kaster

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| Medlemsnummer | int? | |
| Fornavn | string | |
| Etternavn | string | |
| Telefon | string? | |
| Epost | string? | |
| GenderId | int FK → Gender | |
| KlubbId | int? FK → Klubb | |
| KlasseId | int? FK → Klasse | |
| IsActive | bool | |

> `FullName` (Etternavn, Fornavn), `FullNameOrderedByFornavn` og `NameAndClub` er beregnede properties i C#-koden, ikke kolonner i databasen.

---

### Stevne

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| StevneNavn | string | |
| StevneSted | string? | |
| StevneDato | datetime? | |
| KlubbId | int? FK → Klubb | Arrangørklubb |
| StevneTypeId | int? FK → StevneType | |
| InnledendeKastemetodeId | int? FK → Kastemetode | |
| AvsluttendeKastemetodeId | int? FK → Kastemetode | |
| StevneForId | int? FK → StevneFor | Klassifisering (Singel, Par osv.) |
| KasterId | int? FK → Kaster | Kontaktperson |
| Juryleder | string? | |
| IsNM | bool? | |
| IsNorgesranking | bool | |
| IsCompleted | bool | |
| IsExcludedFromRecords | bool? | |

---

### Resultat

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | |
| StevneId | int? FK → Stevne | |
| GruppeId | int? FK → Gruppe | |
| KasterId | int? FK → Kaster | |
| KlubbId | int? FK → Klubb | |
| KlasseId | int? FK → Klasse | |
| PoengXkast | int? | X-kast halvmatch totalpoeng |
| PoengXkastHel | int? | X-kast heilmatch totalpoeng |
| PoengKonge | int? | Kongelag totalpoeng |
| PoengNc | int? | NC/DNC-poeng |
| PoengInnledende | float? | Poeng fra innledende runde (f.eks. 2, 1.5, 1, 0 i Gloppen) |
| PoengScore | int? | Total skår innledende runde |
| PoengGolf | int? | Hesteskogolf totalpoeng |
| PoengMinimatch | int? | X-kast minimatch totalpoeng |
| Plassering | int? | |
| IsPremie | bool? | |
| AntallRingMinimatch | int? | |
| AntallRingKonge | int? | |
| AntallRingHalvmatch | int? | |
| AntallRingHeilmatch | int? | |

---

### File
*(brukt for bilder/logoer på Kaster og Klubb, og PDF-vedlegg på Stevne)*

| Felt | Type | Notat |
|------|------|-------|
| Id | int PK | (antatt – ikke eksplisitt entitet i koden) |
| ... | ... | Struktur ikke tilgjengelig – referert via navigasjons-properties |

> Klubb har `Avatars` (logoer), Kaster har `Avatars` (profilbilde), Stevne har `ResultatPdfFiles` og `InnbydelsePdfFiles`.

---

## Tabeller som finnes men ikke er i bruk

### Kamp
Referert fra `Stevne.Kamper` og `Kaster.KampDetaljer`, men ikke funksjonell i appen. Struktur ikke tilgjengelig som egen entitetsfil.

### KampDetalj
Referert fra `Kaster.KampDetaljer`. Struktur ikke tilgjengelig som egen entitetsfil.

---

## Hierarki

```
Stevne
└── Resultat (én kasters resultat)
```

---

## Beregnede properties i C# (ikke databasekolonner)

| Klasse | Property | Logikk |
|--------|----------|--------|
| Kaster | FullName | Etternavn + ", " + Fornavn |
| Kaster | FullNameOrderedByFornavn | Fornavn + " " + Etternavn |
| Kaster | NameAndClub | Etternavn + ", " + Fornavn + " (" + Klubb.KlubbNavn + ")" |
| Stevne | GenerateSlug() | Id + StevneNavn → URL-slug |
| Kaster | GenerateSlug() | Id + FullName → URL-slug |
| Klubb | GenerateSlug() | Id + KlubbNavn → URL-slug |
| Resultat | GenerateSlugKaster() | KasterId + Kaster.FullName → URL-slug |
| Resultat | GenerateSlugKlubb() | KlubbId + Klubb.KlubbNavn → URL-slug |
