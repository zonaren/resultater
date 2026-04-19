## Kodekvalitet
- Skriv DRY-kode (Don't Repeat Yourself) — trekk ut gjenbrukbar logikk i funksjonar/modular
- Kvar funksjon skal ha éitt ansvar (Single Responsibility Principle)
- Gjenbruk eksisterande hjelpefunksjonar framfor å skrive ny kode som gjer det same
- Før du skriv ny kode: sjekk om tilsvarande logikk allereie finst i kodebasen

## Struktur
- Legg delt logikk i `src/utils/` eller tilsvarande delt modul
- Bruk arv/komposisjon/mixins framfor copy-paste av åtferd