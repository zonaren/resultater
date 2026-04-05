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
    f"password={os.environ['SUPABASEDBPW']}"
)

# ============================================================
# MANUELL MAPPING: StevneFor -> kategori
# Sjekk Id-ane dine med: SELECT Id, StevneForNavn FROM StevneFor
# ============================================================

STEVNEFOR_MAP = {
    # StevneForId: erlagbasert
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


# ============================================================
# MIGRERINGSLOGIKK
# ============================================================

def migrer(ms, pg):
    ms_cur = ms.cursor()
    pg_cur = pg.cursor()

    pg_cur.execute("SET session_replication_role = 'replica';")

    print("\nTømmer eksisterande data...")
    for t in ["resultat", "stevne", "kaster",
              "norgescuppoeng", "kategori", "kastemetode",
              "stevnetype", "gruppe", "klasse", "klubb", "kjonn"]:
        pg_cur.execute(f"TRUNCATE TABLE {t} RESTART IDENTITY CASCADE;")
    pg.commit()
    print("  OK")

    # ─────────────────────────────────────────────────────────────────────
    # 1. kjonn  (Gender -> kjonn)
    #    Gammal: Id, Kjonn (="Mann"/"Kvinne"), Alias (="M"/"K")
    #    Ny:     id, navn, kortform
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "kjonn (Gender)",
        sql_select = "SELECT Id, Kjonn, Alias FROM Gender",
        pg_table   = "kjonn",
        columns    = ["id", "navn", "kortform"],
        transform  = lambda r: (r[0], r[1], r[2])
    )

    # ─────────────────────────────────────────────────────────────────────
    # 2. gruppe
    #    Gammal: Id, GruppeNavn, IsActive
    #    Ny:     id, navn, eraktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "gruppe",
        sql_select = "SELECT Id, GruppeNavn, IsActive FROM Gruppe",
        pg_table   = "gruppe",
        columns    = ["id", "navn", "eraktiv"],
        transform  = lambda r: (r[0], r[1], bool(r[2]))
    )

    # ─────────────────────────────────────────────────────────────────────
    # 3. kastemetode
    #    Gammal: Id, KasteMetodeNavn, Beskrivelse, IsActive, IsNorgesranking
    #    Ny:     id, navn, beskrivelse, eraktiv, ernorgesranking
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "kastemetode",
        sql_select = "SELECT Id, KasteMetodeNavn, Beskrivelse, IsActive, IsNorgesranking FROM Kastemetode",
        pg_table   = "kastemetode",
        columns    = ["id", "navn", "beskrivelse", "eraktiv", "ernorgesranking"],
        transform  = lambda r: (
            r[0], r[1], r[2],
            bool(r[3]) if r[3] is not None else True,
            bool(r[4]) if r[4] is not None else False
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 4. klasse
    #    Gammal: Id, KlasseNavn, IsActive
    #    Ny:     id, navn, eraktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "klasse",
        sql_select = "SELECT Id, KlasseNavn, IsActive FROM Klasse",
        pg_table   = "klasse",
        columns    = ["id", "navn", "eraktiv"],
        transform  = lambda r: (
            r[0], r[1],
            bool(r[2]) if r[2] is not None else True
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 5. kategori  (StevneFor -> kategori)
    #    Gammal: Id, StevneForNavn
    #    Ny:     id, navn, erlagbasert
    #    Juster STEVNEFOR_MAP øvst om Id-ane ikkje stemmer
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "kategori (StevneFor)",
        sql_select = "SELECT Id, StevneForNavn FROM StevneFor",
        pg_table   = "kategori",
        columns    = ["id", "navn", "erlagbasert"],
        transform  = lambda r: (
            r[0],
            r[1],
            STEVNEFOR_MAP.get(r[0], False),
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 6. stevnetype
    #    Gammal: Id, StevneTypeNavn, IsActive
    #    Ny:     id, navn, eraktiv, beskrivelse
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "stevnetype",
        sql_select = "SELECT Id, StevneTypeNavn, IsActive FROM StevneType",
        pg_table   = "stevnetype",
        columns    = ["id", "navn", "eraktiv", "beskrivelse"],
        transform  = lambda r: (
            r[0], r[1],
            bool(r[2]) if r[2] is not None else True,
            None
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 7. klubb
    #    Gammal: Id, KlubbNavn, IsActive
    #    Ny:     id, klubbnavn, klubbkortnavn, eraktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "klubb",
        sql_select = "SELECT Id, KlubbNavn, IsActive FROM Klubb",
        pg_table   = "klubb",
        columns    = ["id", "klubbnavn", "klubbkortnavn", "eraktiv"],
        transform  = lambda r: (
            r[0],
            r[1],
            r[1].split()[0][:20] if r[1] else "",
            bool(r[2])
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 8. norgescuppoeng
    #    Gammal: to tabellar – NorgescupenPoeng (t.o.m. 2016)
    #                        – NorgescupenPoeng2017 (f.o.m. 2017)
    #    Ny: slått saman med gjelderfraaar / gjeldertilaar
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "norgescuppoeng (t.o.m. 2016)",
        sql_select = "SELECT Plassering, PoengNC, PoengDNC FROM NorgescupenPoeng ORDER BY Plassering",
        pg_table   = "norgescuppoeng",
        columns    = ["plassering", "poengnc", "poengdnc", "gjelderfraaar", "gjeldertilaar"],
        transform  = lambda r: (r[0], r[1], r[2], 1900, 2016)
    )
    migrate_table(
        ms_cur, pg_cur,
        label      = "norgescuppoeng (f.o.m. 2017)",
        sql_select = "SELECT Plassering, PoengNC, PoengDNC FROM NorgescupenPoeng2017 ORDER BY Plassering",
        pg_table   = "norgescuppoeng",
        columns    = ["plassering", "poengnc", "poengdnc", "gjelderfraaar", "gjeldertilaar"],
        transform  = lambda r: (r[0], r[1], r[2], 2017, None)
    )

    # ─────────────────────────────────────────────────────────────────────
    # 9. kaster
    #    Gammal: Id, Medlemsnummer, Fornavn, Etternavn, Telefon, Epost,
    #            GenderId, KlubbId, KlasseId, IsActive
    #    Ny:     id, medlemsnummer, fornavn, etternavn, telefon, epost,
    #            kjonnid, klubbid, klasseid, eraktiv
    # ─────────────────────────────────────────────────────────────────────
    migrate_table(
        ms_cur, pg_cur,
        label      = "kaster",
        sql_select = """
            SELECT Id, Medlemsnummer, Fornavn, Etternavn,
                   Telefon, Epost, GenderId, KlubbId, KlasseId, IsActive
            FROM Kaster
        """,
        pg_table   = "kaster",
        columns    = ["id", "medlemsnummer", "fornavn", "etternavn",
                      "telefon", "epost", "kjonnid", "klubbid", "klasseid", "eraktiv"],
        transform  = lambda r: (
            r[0], r[1], r[2], r[3],
            r[4], r[5], r[6], r[7], r[8],
            bool(r[9])
        )
    )

    # ─────────────────────────────────────────────────────────────────────
    # 10. stevne
    #     Gammal: Id, StevneNavn, StevneSted, StevneDato, KlubbId,
    #             StevneTypeId, InnledendeKastemetodeId, AvsluttendeKastemetodeId,
    #             StevneForId, KasterId, Juryleder,
    #             IsNM, IsNorgesranking, IsCompleted, IsExcludedFromRecords
    #     Ny:     id, stevnenavn, stevnested, stevnedato, klubbid,
    #             stevnetypeid, innledendekastemetodeid, avsluttendekastemetodeid,
    #             kategoriid, kontaktkasterid, juryleder,
    #             ernm, ernorgesranking, erfulfort, erekskludertfrarekorder
    # ─────────────────────────────────────────────────────────────────────
    print("\n-> Migrerer stevne...")
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
            r[0],   # id
            r[1],   # stevnenavn
            r[2],   # stevnested
            dato,   # stevnedato
            r[4],   # klubbid
            r[5],   # stevnetypeid
            r[6],   # innledendekastemetodeid
            r[7],   # avsluttendekastemetodeid
            r[8],   # kategoriid  (StevneForId)
            r[9],   # kontaktkasterid  (KasterId)
            r[10],  # juryleder
            bool(r[11]) if r[11] is not None else False,  # ernm
            bool(r[12]),                                   # ernorgesranking
            bool(r[13]),                                   # erfulfort
            bool(r[14]) if r[14] is not None else False,  # erekskludertfrarekorder
        ))

    psycopg2.extras.execute_batch(pg_cur, """
        INSERT INTO stevne (
            id, stevnenavn, stevnested, stevnedato, klubbid,
            stevnetypeid, innledendekastemetodeid, avsluttendekastemetodeid,
            kategoriid, kontaktkasterid, juryleder,
            ernm, ernorgesranking, erfullfort, erekskludertfrarekorder
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT DO NOTHING
    """, stevne_data)
    print(f"  OK {len(stevne_data)} stevner")

    # ─────────────────────────────────────────────────────────────────────
    # 11. resultat
    #     Gammal: Id, StevneId, GruppeId, KasterId, KlubbId, KlasseId,
    #             Plassering, IsPremie, PoengNc,
    #             PoengInnledende, PoengScore,
    #             PoengXkast, PoengXkastHel, PoengKonge, PoengGolf, PoengMinimatch,
    #             AntallRingMinimatch, AntallRingKonge, AntallRingHalvmatch, AntallRingHeilmatch
    #
    #     Kolonnemapping:
    #       PoengNc          -> norgescuppoeng
    #       PoengInnledende  -> kamppoeng
    #       PoengScore       -> skarinnledende
    #       PoengXkast       -> poengxhalvmatch
    #       PoengXkastHel    -> poengxheilmatch
    #       PoengKonge       -> poengkongelag
    #       AntallRingKonge  -> antallringkongelag
    # ─────────────────────────────────────────────────────────────────────
    print("\n-> Migrerer resultat...")
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
            float(PoengNc) if PoengNc is not None else None,
            float(PoengInnledende) if PoengInnledende is not None else None,
            PoengScore,
            PoengMinimatch,
            PoengXkast,
            PoengXkastHel,
            PoengKonge,
            PoengGolf,
            AntallRingMinimatch,
            AntallRingHalvmatch,
            AntallRingHeilmatch,
            AntallRingKonge,
        ))

    psycopg2.extras.execute_batch(pg_cur, """
        INSERT INTO resultat (
            id, stevneid, gruppeid, kasterid, klubbid, klasseid,
            plassering, erpremie, norgescuppoeng,
            kamppoeng, skarinnledende,
            poengminimatch, poengxhalvmatch, poengxheilmatch,
            poengkongelag, poenggolf,
            antallringminimatch, antallringhalvmatch,
            antallringheilmatch, antallringkongelag
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT DO NOTHING
    """, resultat_data)
    print(f"  OK {len(resultat_data)} resultat-rader")

    # ─────────────────────────────────────────────────────────────────────
    # Synkroniser SERIAL-sekvensar
    # ─────────────────────────────────────────────────────────────────────
    print("\n-> Synkroniserer sekvensar...")
    for table in ["kjonn", "klubb", "klasse", "gruppe", "stevnetype",
                  "kastemetode", "kategori", "norgescuppoeng",
                  "kaster", "stevne", "resultat"]:
        pg_cur.execute(f"""
            SELECT setval(
                pg_get_serial_sequence('{table}', 'id'),
                COALESCE((SELECT MAX(id) FROM {table}), 1)
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
