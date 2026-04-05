"""
Migreringsskript: MSSQL -> Supabase (PostgreSQL)
Hesteskokasting Norge

Basert på:
  - Kilde:  MSSQL-database (original .NET Framework 4.6)
  - Mål:    sql-supabase.sql (PostgreSQL / Supabase)

Krav:
    pip install pyodbc psycopg2-binary tqdm python-dotenv

Bruk:
    Køyr: python sql-migration.py
"""

import os
import pyodbc
import psycopg2
import psycopg2.extras
from tqdm import tqdm
from dotenv import load_dotenv
import sys
import traceback

load_dotenv()

# ============================================================
# KONFIGURASJON
# ============================================================

MSSQL_CONN = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=SQL6030.site4now.net;"
    "DATABASE=db_a67d66_resultaterdbtest;"
    "UID=db_a67d66_resultaterdbtest_admin;"
    f"PWD={os.environ['MSSQLPW']};"
)

SUPABASE_CONN = (
    "host=aws-0-eu-west-1.pooler.supabase.com "
    "port=6543 "
    "dbname=postgres "
    "user=postgres.urtvpewjlevhlevtnvkf "
    f"password={os.environ['SUPABASEDBPW']} "
    "sslmode=require"
)

# ============================================================
# MANUELL MAPPING: StevneFor -> Kategori
# Sjekk Id-ane dine med: SELECT Id, StevneForNavn FROM StevneFor
# ============================================================

STEVNEFOR_MAP = {
    # StevneForId: ErLagbasert
    1: False,  # Singel
    2: True,   # Par
    3: True,   # Mix
    4: True,   # Lag
    5: False,  # X-kast
    6: True,   # Kongelag
    7: False,  # Hesteskogolf
}

# ============================================================
# HJELPEFUNKSJONAR
# ============================================================

def chunk(lst, size=500):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]


def migrate_table(ms_cur, pg_cur, label, sql_select, pg_table, columns, transform=None):
    print(f"\n-> Migrerer {label}...")
    ms_cur.execute(sql_select)
    rows = ms_cur.fetchall()
    if not rows:
        print(f"  Ingen rader funne.")
        return 0

    placeholders = ", ".join(["%s"] * len(columns))
    col_names    = ", ".join(columns)
    sql_insert   = (
        f"INSERT INTO {pg_table} ({col_names}) "
        f"VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    )

    count = 0
    errors = 0
    for batch in tqdm(list(chunk(rows)), desc=label, unit="batch"):
        transformed = []
        for row in batch:
            try:
                result = transform(row) if transform else tuple(row)
                if result is not None:
                    transformed.append(result)
            except Exception as e:
                errors += 1
                print(f"  ADVARSEL: {e} | rad: {tuple(row)}")
        if transformed:
            psycopg2.extras.execute_batch(pg_cur, sql_insert, transformed)
            count += len(transformed)

    print(f"  OK {count} rader" + (f", {errors} hoppa over" if errors else ""))
    return count


def reset_sequence(pg_cur, table, col="id"):
    pg_cur.execute(f"""
        SELECT setval(
            pg_get_serial_sequence('{table}', '{col}'),
            COALESCE((SELECT MAX({col}) FROM {table}), 1)
        )
    """)


# ============================================================
# MIGRERINGSLOGIKK
# ============================================================

def migrer(ms, pg):
    ms_cur = ms.cursor()
    pg_cur = pg.cursor()

    pg_cur.execute("SET session_replication_role = 'replica';")

    print("\nTømmer eksisterande data...")
    for t in ["Resultat", "Stevne", "Kaster",
              "NorgescupPoeng", "Kategori", "Kastemetode",
              "StevneType", "Gruppe", "Klasse", "Klubb", "Kjonn"]:
        pg_cur.execute(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE;')
    pg.commit()
    print("  OK")

    # ─────────────────────────────────────────────────────────────────────
    # 1. Kjonn  (Gender -> Kjonn)
    #    Gammal: Id, Kjonn (="Mann"/"Kvinne"), Alias (="M"/"K")
    #    Ny:     Id, Navn, Kortform
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "Kjonn (Gender)",
        sql_select = "SELECT Id, Kjonn, Alias FROM Gender",
        pg_table   = '"Kjonn"',
        columns    = ["Id", "Navn", "Kortform"],
        transform  = lambda r: (r[0], r[1], r[2])
    )

    # ─────────────────────────────────────────────────────────────────────
    # 2. Gruppe
    #    Gammal: Id, GruppeNavn, IsActive
    #    Ny:     Id, Navn, ErAktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "Gruppe",
        sql_select = "SELECT Id, GruppeNavn, IsActive FROM Gruppe",
        pg_table   = '"Gruppe"',
        columns    = ["Id", "Navn", "ErAktiv"],
        transform  = lambda r: (r[0], r[1], bool(r[2]))
    )

    # ─────────────────────────────────────────────────────────────────────
    # 3. Kastemetode
    #    Gammal: Id, KasteMetodeNavn, Beskrivelse, IsActive, IsNorgesranking
    #    Ny:     Id, Navn, Beskrivelse, ErAktiv, ErNorgesranking
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "Kastemetode",
        sql_select = "SELECT Id, KasteMetodeNavn, Beskrivelse, IsActive, IsNorgesranking FROM Kastemetode",
        pg_table   = '"Kastemetode"',
        columns    = ["Id", "Navn", "Beskrivelse", "ErAktiv", "ErNorgesranking"],
        transform  = lambda r: (
            r[0], r[1], r[2],
            bool(r[3]) if r[3] is not None else True,
            bool(r[4]) if r[4] is not None else False
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 4. Klasse
    #    Gammal: Id, KlasseNavn, IsActive
    #    Ny:     Id, Navn, ErAktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "Klasse",
        sql_select = "SELECT Id, KlasseNavn, IsActive FROM Klasse",
        pg_table   = '"Klasse"',
        columns    = ["Id", "Navn", "ErAktiv"],
        transform  = lambda r: (
            r[0], r[1],
            bool(r[2]) if r[2] is not None else True
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 5. Kategori  (StevneFor -> Kategori)
    #    Gammal: Id, StevneForNavn
    #    Ny:     Id, Navn, ErLagbasert
    #    Juster STEVNEFOR_MAP øvst om Id-ane ikkje stemmer
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "Kategori (StevneFor)",
        sql_select = "SELECT Id, StevneForNavn FROM StevneFor",
        pg_table   = '"Kategori"',
        columns    = ["Id", "Navn", "ErLagbasert"],
        transform  = lambda r: (
            r[0],
            r[1],
            STEVNEFOR_MAP.get(r[0], False),
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 6. StevneType
    #    Gammal: Id, StevneTypeNavn, IsActive
    #    Ny:     Id, Navn, ErAktiv, Beskrivelse
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "StevneType",
        sql_select = "SELECT Id, StevneTypeNavn, IsActive FROM StevneType",
        pg_table   = '"StevneType"',
        columns    = ["Id", "Navn", "ErAktiv", "Beskrivelse"],
        transform  = lambda r: (
            r[0], r[1],
            bool(r[2]) if r[2] is not None else True,
            None
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 7. Klubb
    #    Gammal: Id, KlubbNavn, IsActive
    #    Ny:     Id, KlubbNavn, KlubbKortNavn, ErAktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "Klubb",
        sql_select = "SELECT Id, KlubbNavn, IsActive FROM Klubb",
        pg_table   = '"Klubb"',
        columns    = ["Id", "KlubbNavn", "KlubbKortNavn", "ErAktiv"],
        transform  = lambda r: (
            r[0],
            r[1],
            r[1].split()[0][:20] if r[1] else "",
            bool(r[2])
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 8. NorgescupPoeng
    #    Gammal: to tabellar – NorgescupenPoeng (t.o.m. 2016)
    #                        – NorgescupenPoeng2017 (f.o.m. 2017)
    #    Ny: slått saman med GjelderFraAar / GjelderTilAar
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "NorgescupPoeng (t.o.m. 2016)",
        sql_select = "SELECT Plassering, PoengNC, PoengDNC FROM NorgescupenPoeng ORDER BY Plassering",
        pg_table   = '"NorgescupPoeng"',
        columns    = ["Plassering", "PoengNC", "PoengDNC", "GjelderFraAar", "GjelderTilAar"],
        transform  = lambda r: (r[0], r[1], r[2], 1900, 2016)
    )
    migrate_table(
        ms_cur, pg_cur,
        label      = "NorgescupPoeng (f.o.m. 2017)",
        sql_select = "SELECT Plassering, PoengNC, PoengDNC FROM NorgescupenPoeng2017 ORDER BY Plassering",
        pg_table   = '"NorgescupPoeng"',
        columns    = ["Plassering", "PoengNC", "PoengDNC", "GjelderFraAar", "GjelderTilAar"],
        transform  = lambda r: (r[0], r[1], r[2], 2017, None)
    )

    # ─────────────────────────────────────────────────────────────────────
    # 9. Kaster
    #    Gammal: Id, Medlemsnummer, Fornavn, Etternavn, Telefon, Epost,
    #            GenderId, KlubbId, KlasseId, IsActive
    #    Ny:     Id, Medlemsnummer, Fornavn, Etternavn, Telefon, Epost,
    #            KjonnId, KlubbId, KlasseId, ErAktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "Kaster",
        sql_select = """
            SELECT Id, Medlemsnummer, Fornavn, Etternavn,
                   Telefon, Epost, GenderId, KlubbId, KlasseId, IsActive
            FROM Kaster
        """,
        pg_table   = '"Kaster"',
        columns    = ["Id", "Medlemsnummer", "Fornavn", "Etternavn",
                      "Telefon", "Epost", "KjonnId", "KlubbId", "KlasseId", "ErAktiv"],
        transform  = lambda r: (
            r[0], r[1], r[2], r[3],
            r[4], r[5], r[6], r[7], r[8],
            bool(r[9])
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 10. Stevne
    #     Gammal: Id, StevneNavn, StevneSted, StevneDato, KlubbId,
    #             StevneTypeId, InnledendeKastemetodeId, AvsluttendeKastemetodeId,
    #             StevneForId, KasterId, Juryleder,
    #             IsNM, IsNorgesranking, IsCompleted, IsExcludedFromRecords
    #     Ny:     Id, StevneNavn, StevneSted, StevneDato, KlubbId,
    #             StevneTypeId, InnledendeKastemetodeId, AvsluttendeKastemetodeId,
    #             KategoriId, KontaktKasterId, Juryleder,
    #             ErNM, ErNorgesranking, ErFullfort, ErEkskludertFraRekorder
    # ─────────────────────────────────────────────────────────────────────
    print("\n-> Migrerer Stevne...")
    ms_cur.execute("""
        SELECT Id, StevneNavn, StevneSted, StevneDato, KlubbId,
               StevneTypeId, InnledendeKastemetodeId, AvsluttendeKastemetodeId,
               StevneForId, KasterId, Juryleder,
               IsNM, IsNorgesranking, IsCompleted, IsExcludedFromRecords
        FROM Stevne
    """)
    stevne_rows = ms_cur.fetchall()
    stevne_data = []
    for r in stevne_rows:
        dato = r[3].date() if r[3] else None
        stevne_data.append((
            r[0],   # Id
            r[1],   # StevneNavn
            r[2],   # StevneSted
            dato,   # StevneDato
            r[4],   # KlubbId
            r[5],   # StevneTypeId
            r[6],   # InnledendeKastemetodeId
            r[7],   # AvsluttendeKastemetodeId
            r[8],   # KategoriId  (StevneForId)
            r[9],   # KontaktKasterId  (KasterId)
            r[10],  # Juryleder
            bool(r[11]) if r[11] is not None else False,  # ErNM
            bool(r[12]),                                   # ErNorgesranking
            bool(r[13]),                                   # ErFullfort
            bool(r[14]) if r[14] is not None else False,  # ErEkskludertFraRekorder
        ))

    psycopg2.extras.execute_batch(pg_cur, """
        INSERT INTO "Stevne" (
            "Id", "StevneNavn", "StevneSted", "StevneDato", "KlubbId",
            "StevneTypeId", "InnledendeKastemetodeId", "AvsluttendeKastemetodeId",
            "KategoriId", "KontaktKasterId", "Juryleder",
            "ErNM", "ErNorgesranking", "ErFullfort", "ErEkskludertFraRekorder"
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT DO NOTHING
    """, stevne_data)
    print(f"  OK {len(stevne_data)} stevner")

    # ─────────────────────────────────────────────────────────────────────
    # 11. Resultat
    #     Gammal: Id, StevneId, GruppeId, KasterId, KlubbId, KlasseId,
    #             Plassering, IsPremie, PoengNc,
    #             PoengInnledende, PoengScore,
    #             PoengXkast, PoengXkastHel, PoengKonge, PoengGolf, PoengMinimatch,
    #             AntallRingMinimatch, AntallRingKonge, AntallRingHalvmatch, AntallRingHeilmatch
    #     Ny:     alle i same tabell (ingen split)
    #
    #     Kolonnemapping:
    #       PoengNc          -> NorgescupPoeng
    #       PoengInnledende  -> KampPoeng
    #       PoengScore       -> SkarInnledende
    #       PoengXkast       -> PoengXHalvmatch
    #       PoengXkastHel    -> PoengXHeilmatch
    #       PoengKonge       -> PoengKongelag
    #       AntallRingKonge  -> AntallRingKongelag
    # ─────────────────────────────────────────────────────────────────────
    print("\n-> Migrerer Resultat...")
    ms_cur.execute("""
        SELECT Id, StevneId, GruppeId, KasterId, KlubbId, KlasseId,
               Plassering, IsPremie, PoengNc,
               PoengInnledende, PoengScore,
               PoengXkast, PoengXkastHel, PoengKonge, PoengGolf, PoengMinimatch,
               AntallRingMinimatch, AntallRingKonge, AntallRingHalvmatch, AntallRingHeilmatch
        FROM Resultat
    """)
    resultat_rows = ms_cur.fetchall()
    resultat_data = []
    for r in resultat_rows:
        (Id, StevneId, GruppeId, KasterId, KlubbId, KlasseId,
         Plassering, IsPremie, PoengNc,
         PoengInnledende, PoengScore,
         PoengXkast, PoengXkastHel, PoengKonge, PoengGolf, PoengMinimatch,
         AntallRingMinimatch, AntallRingKonge, AntallRingHalvmatch, AntallRingHeilmatch) = r

        resultat_data.append((
            Id, StevneId, GruppeId, KasterId, KlubbId, KlasseId,
            Plassering,
            bool(IsPremie) if IsPremie is not None else None,
            float(PoengNc) if PoengNc is not None else None,           # NorgescupPoeng
            float(PoengInnledende) if PoengInnledende is not None else None,  # KampPoeng
            PoengScore,                                                 # SkarInnledende
            PoengMinimatch,
            PoengXkast,     # PoengXHalvmatch
            PoengXkastHel,  # PoengXHeilmatch
            PoengKonge,     # PoengKongelag
            PoengGolf,
            AntallRingMinimatch,
            AntallRingHalvmatch,
            AntallRingHeilmatch,
            AntallRingKonge,  # AntallRingKongelag
        ))

    psycopg2.extras.execute_batch(pg_cur, """
        INSERT INTO "Resultat" (
            "Id", "StevneId", "GruppeId", "KasterId", "KlubbId", "KlasseId",
            "Plassering", "ErPremie", "NorgescupPoeng",
            "KampPoeng", "SkarInnledende",
            "PoengMinimatch", "PoengXHalvmatch", "PoengXHeilmatch",
            "PoengKongelag", "PoengGolf",
            "AntallRingMinimatch", "AntallRingHalvmatch",
            "AntallRingHeilmatch", "AntallRingKongelag"
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT DO NOTHING
    """, resultat_data)
    print(f"  OK {len(resultat_data)} resultat-rader")

    # ─────────────────────────────────────────────────────────────────────
    # Synkroniser SERIAL-sekvensar
    # ─────────────────────────────────────────────────────────────────────
    print("\n-> Synkroniserer sekvensar...")
    for table, col in [
        ("Kjonn", "Id"), ("Klubb", "Id"), ("Klasse", "Id"),
        ("Gruppe", "Id"), ("StevneType", "Id"), ("Kastemetode", "Id"),
        ("Kategori", "Id"), ("NorgescupPoeng", "Id"),
        ("Kaster", "Id"), ("Stevne", "Id"), ("Resultat", "Id"),
    ]:
        pg_cur.execute(f"""
            SELECT setval(
                pg_get_serial_sequence('"{table}"', '{col}'),
                COALESCE((SELECT MAX("{col}") FROM "{table}"), 1)
            )
        """)
        print(f"  OK {table}")

    pg_cur.execute("SET session_replication_role = 'origin';")
    pg.commit()

    print("\n===== MIGRERING FULLFORT =====")
    print(f"  Stevner:  {len(stevne_data)}")
    print(f"  Resultat: {len(resultat_data)}")


# ============================================================
# KJOR
# ============================================================

if __name__ == "__main__":
    print("Kobler til MSSQL...")
    try:
        ms = pyodbc.connect(MSSQL_CONN)
    except Exception as e:
        print(f"FEIL: Kan ikkje kople til MSSQL:\n  {e}")
        sys.exit(1)

    print("Kobler til Supabase...")
    try:
        pg = psycopg2.connect(SUPABASE_CONN)
    except Exception as e:
        print(f"FEIL: Kan ikkje kople til Supabase:\n  {e}")
        sys.exit(1)

    try:
        migrer(ms, pg)
    except Exception as e:
        pg.rollback()
        print(f"\nFEIL under migrering – rollback utfort.")
        traceback.print_exc()
    finally:
        ms.close()
        pg.close()
