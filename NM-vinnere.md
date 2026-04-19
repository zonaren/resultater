## Eksisterende kode (gammel)

        public ActionResult NMvinnere(string kl = "Singel", string gender = null)
        {
            var klassifiseringList = db.StevneFor.Where(s => s.StevneForNavn != "Norgesranking").Select(s => s.StevneForNavn); //StevneFor = Kategori (Singel, Lag, Par etc..)
            var genderList = db.Genders.Select(a => a.Alias); //Alias = Kortnavn

            ViewBag.Klassifisering = klassifiseringList;
            ViewBag.Gender = genderList;
            ViewBag.CurrentKlass = kl; //Kategori
            ViewBag.CurrentGender = gender;
            
            var nmVinnere = db.Resultater
                .Where(r => r.Plassering == 1 && r.Stevne.StevneFor.StevneForNavn == kl && r.Stevne.IsNM == true
                    && r.KlasseId != 2
                    && r.KlasseId != 31 && r.KlasseId != 12
                    && r.KlasseId != 17 && r.KlasseId != 17 
                    && r.KlasseId != 14 && r.KlasseId != 15 
                    && r.KlasseId != 22 && r.KlasseId != 25 
                    && r.KlasseId != 26 && r.KlasseId != 28 
                    && r.KlasseId != 30 && r.KlasseId != 33 
                    && r.KlasseId != 34 && r.KlasseId != 37 
                    && r.GruppeId != 2);

            var maxDate = nmVinnere.Max(s => (int?)s.Stevne.StevneDato.Value.Year);
            var minDate = nmVinnere.Min(s => (int?)s.Stevne.StevneDato.Value.Year);

            return View(new AdelskalenderViewModel //NM-vinnere i frontend
            {
                Resultater = nmVinnere.OrderByDescending(a => a.Stevne.StevneDato.Value.Year),
                MaxDato = maxDate ?? null,
                MinDato = minDate ?? null
            });
        }

        id,navn,eraktiv,har_nm_vinnere
1,Klasse 1,true,true
2,Klasse 2,true,false
3,Damer,true,true
4,Herrer,true,true
12,Klasse C,false,false
13,Gruppe A,false,true
14,Gruppe B,false,false
15,Gruppe C,false,false
16,Herrer A-cup,false,true
17,Herrer B-cup,false,false
18,Mix Par,false,false
19,Utslått før cupkasting,false,false
21,Klasse A,true,true
22,Klasse B,false,false
23,Åpen klasse A,false,true
24,A-cup,true,true
25,B-cup,false,false
26,C-cup,false,false
27,"Damer kl. A ",false,true
28,Damer kl. B,false,false
29,Herrer kl. A,false,true
30,Herrer kl. B,false,false
31,Rekrutt,true,false
32,Damer A-cup,false,true
33,Damer B-cup,false,false
34,Åpen klasse B,false,false
35,Åpen klasse Veteran,false,false