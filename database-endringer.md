## Fjern/endre unødvendige tabellar/kolonner - FULLFØRT

Tabell: bruker_profil
har duplikate kolonner: kasterid og kobling_kasterid. Usikker på kven av dei som er brukt i koden

pamelding
bruker_id. Denne trengst ikkje fordi den finst i bruker_profil
klasse_id, gruppe_id og merknad. Trengst ikkje
status. Trengst ikkje. Det er nok at raden ligg i tabellen

koden må endrast tilsvarande


## Legg til nye nødvendige tabellar/kolonner - TODO
## Aktiver database migrations

Supabase CLI er det rette valet. Sidan du er åleine og har Git, får du eit enkelt og ryddig oppsett der alle databaseendringar ligg i repoet ditt og kan angras når som helst.

Steg 1: Installer Supabase CLI

npm install supabase --save-dev

Steg 2: Koble til prosjektet ditt

npx supabase login
npx supabase init          # lagar supabase/-mappe i prosjektet ditt
npx supabase link --project-ref DIN_PROJECT_REF

Slik lagar du ein ny migrasjon:

npx supabase migration new legg_til_betaling

Køyr migrasjonen mot Supabase:

npx supabase db push

.gitignore – pass på dette:
supabase/.temp/
supabase/seed.sql   # viss han inneheld sensitiv data