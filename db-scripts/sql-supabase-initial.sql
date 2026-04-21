-- ============================================================
-- Hesteskokasting Norge – PostgreSQL / Supabase skjema
-- Basert på eksisterande MSSQL-database (original struktur)
-- ============================================================

-- ============================================================
-- RYDD OPP EKSISTERANDE TABELLAR (trygt å køyre fleire gonger)
-- ============================================================

DROP TABLE IF EXISTS Resultat         CASCADE;
DROP TABLE IF EXISTS Stevne           CASCADE;
DROP TABLE IF EXISTS Kaster           CASCADE;
DROP TABLE IF EXISTS NorgescupPoeng   CASCADE;
DROP TABLE IF EXISTS Kategori         CASCADE;
DROP TABLE IF EXISTS Kastemetode      CASCADE;
DROP TABLE IF EXISTS StevneType       CASCADE;
DROP TABLE IF EXISTS Gruppe           CASCADE;
DROP TABLE IF EXISTS Klasse           CASCADE;
DROP TABLE IF EXISTS Klubb            CASCADE;
DROP TABLE IF EXISTS Kjonn            CASCADE;

-- ============================================================
-- OPPSLAGSTABELLER
-- ============================================================

CREATE TABLE Kjonn (
    Id       SERIAL PRIMARY KEY,
    Navn     TEXT NOT NULL,   -- "Mann", "Kvinne"
    Kortform TEXT NOT NULL    -- "M", "K"
);

CREATE TABLE Klubb (
    Id             SERIAL PRIMARY KEY,
    Navn           TEXT NOT NULL,
    KortNavn       TEXT NOT NULL DEFAULT '',
    ErAktiv        BOOLEAN NOT NULL DEFAULT TRUE,
    LogoUrl        TEXT
);

CREATE TABLE Klasse (
    Id       SERIAL PRIMARY KEY,
    Navn     TEXT NOT NULL,
    ErAktiv  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE Gruppe (
    Id   SERIAL PRIMARY KEY,
    Navn TEXT NOT NULL,   -- "A", "B"
    ErAktiv  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE StevneType (
    Id          SERIAL PRIMARY KEY,
    Navn        TEXT NOT NULL,
    ErAktiv     BOOLEAN NOT NULL DEFAULT TRUE,
    Beskrivelse TEXT
);

CREATE TABLE Kastemetode (
    Id              SERIAL PRIMARY KEY,
    Navn            TEXT NOT NULL,
    Beskrivelse     TEXT,
    ErAktiv         BOOLEAN NOT NULL DEFAULT TRUE,
    ErNorgesranking BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE Kategori (
    Id           SERIAL PRIMARY KEY,
    Navn         TEXT NOT NULL,   -- "Singel", "Par", "Mix", "Lag", "X-kast", "Kongelag", "Hesteskogolf"
    ErLagbasert  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE NorgescupPoeng (
    Id             SERIAL PRIMARY KEY,
    Plassering     INT NOT NULL,
    PoengNC        INT NOT NULL,
    PoengDNC       INT NOT NULL,
    GjelderFraAar  INT NOT NULL,
    GjelderTilAar  INT   -- NULL = gjelder framleis
);

-- ============================================================
-- KJERNETABELLER
-- ============================================================

CREATE TABLE Kaster (
    Id            SERIAL PRIMARY KEY,
    Medlemsnummer INT,
    Fornavn       TEXT NOT NULL,
    Etternavn     TEXT NOT NULL,
    Telefon       TEXT,
    Epost         TEXT,
    KjonnId       INT NOT NULL REFERENCES Kjonn(Id),
    KlubbId       INT REFERENCES Klubb(Id),
    KlasseId      INT REFERENCES Klasse(Id),
    ErAktiv       BOOLEAN NOT NULL DEFAULT TRUE,
    AvatarUrl     TEXT
);

CREATE TABLE Stevne (
    Id                       SERIAL PRIMARY KEY,
    Navn               TEXT NOT NULL,
    Sted               TEXT,
    Dato               TIMESTAMPTZ,
    KlubbId                  INT REFERENCES Klubb(Id),          -- Arrangørklubb
    StevneTypeId             INT REFERENCES StevneType(Id),
    InnledendeKastemetodeId  INT REFERENCES Kastemetode(Id),
    AvsluttendeKastemetodeId INT REFERENCES Kastemetode(Id),
    KategoriId               INT REFERENCES Kategori(Id),       -- tidlegare StevneForId
    KontaktKasterId          INT REFERENCES Kaster(Id),
    Juryleder                TEXT,
    ErNM                     BOOLEAN NOT NULL DEFAULT FALSE,
    ErNorgesranking          BOOLEAN NOT NULL DEFAULT FALSE,
    ErFullfort               BOOLEAN NOT NULL DEFAULT FALSE,
    ErEkskludertFraRekorder  BOOLEAN NOT NULL DEFAULT FALSE,
    InnbydelseUrl           TEXT,
    ResultatUrl             TEXT
);

CREATE TABLE Resultat (
    Id             SERIAL PRIMARY KEY,
    StevneId       INT REFERENCES Stevne(Id),
    GruppeId       INT REFERENCES Gruppe(Id),
    KasterId       INT REFERENCES Kaster(Id),
    KlubbId        INT REFERENCES Klubb(Id),
    KlasseId       INT REFERENCES Klasse(Id),
    Plassering     INT,
    ErPremie       BOOLEAN,
    NorgescupPoeng REAL,
    -- Gloppen / Nordhordlandsmetoden
    PoengInnledende      REAL,    -- 2, 1.5, 1 eller 0
    ScoreInnledende INT,
    -- X-kast
    PoengMinimatch  INT,
    PoengXHalvmatch INT,
    PoengXHeilmatch INT,
    -- Kongelag
    PoengKongelag   INT,
    -- Hesteskogolf
    PoengGolf       INT,
    -- Ringer
    AntallRingMinimatch  INT,
    AntallRingHalvmatch  INT,
    AntallRingHeilmatch  INT,
    AntallRingKongelag   INT
);

-- ============================================================
-- INDEKSAR
-- ============================================================

CREATE INDEX idx_resultat_stevne     ON Resultat(StevneId);
CREATE INDEX idx_resultat_kaster     ON Resultat(KasterId);
CREATE INDEX idx_resultat_plassering ON Resultat(StevneId, Plassering);
CREATE INDEX idx_stevne_dato         ON Stevne(StevneDato DESC);
CREATE INDEX idx_stevne_kategori     ON Stevne(KategoriId);
CREATE INDEX idx_norgescup_aar       ON NorgescupPoeng(GjelderFraAar, GjelderTilAar);

-- ============================================================
-- SUPABASE REALTIME (kommenter inn det du vil ha live)
-- ============================================================

-- ALTER PUBLICATION supabase_realtime ADD TABLE Resultat;
-- ALTER PUBLICATION supabase_realtime ADD TABLE Stevne;

-- ============================================================
-- SEED: Grunndata
-- ============================================================