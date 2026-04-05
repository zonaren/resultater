using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Resultater.Entities
{
    public class Resultat
    {
        public int Id { get; set; }

        public int? StevneId { get; set; }
        public int? GruppeId { get; set; }

        public int? KasterId { get; set; }
        public int? KlubbId { get; set; }
        public int? KlasseId { get; set; }
        [Display(Name = "X-kast halv")]
        public int? PoengXkast { get; set; }
        [Display(Name = "X-kast heil")]
        public int? PoengXkastHel { get; set; }
        [Display(Name = "Kongelag")]
        public int? PoengKonge { get; set; }
        [Display(Name = "NC/DNC")]
        public int? PoengNc { get; set; }
        [Display(Name = "Poeng innl.")]
        public float? PoengInnledende { get; set; }
        [Display(Name = "Skår")]
        public int? PoengScore { get; set; }
        [Display(Name = "Hesteskogolf")]
        public int? PoengGolf { get; set; }
        [Display(Name = "Minimatch")]
        public int? PoengMinimatch { get; set; }
        
        public int? Plassering { get; set; }
        public bool? IsPremie { get; set; }
        [Display(Name = "Ringer Minimatch")]
        public int? AntallRingMinimatch { get; set; }
        [Display(Name = "Ringer Konge")]
        public int? AntallRingKonge { get; set; }
        [Display(Name = "Ringer halvmatch")]
        public int? AntallRingHalvmatch { get; set; }
        [Display(Name = "Ringer heilmatch")]
        public int? AntallRingHeilmatch { get; set; }

        public virtual Stevne Stevne { get; set; }
        public virtual Gruppe Gruppe { get; set; }
        public virtual Kaster Kaster { get; set; }
        public virtual Klubb Klubb { get; set; }
        public virtual Klasse Klasse { get; set; }

        //public int StevneTypeId { get; set; }
        //public int KlasseId { get; set; }
        //public int KastemetodeId { get; set; }
        //public virtual StevneType StevneType { get; set; }
        //public virtual Kastemetode Kastemetode { get; set; }
        //public virtual Klasse Klasse { get; set; }
        // Slug generation taken from http://stackoverflow.com/questions/2920744/url-slugify-algorithm-in-c
        public string GenerateSlugKaster()
        {
            string phrase = string.Format("{0}-{1}", KasterId, Kaster.FullName);

            string str = RemoveAccent(phrase).ToLower();
            // invalid chars           
            str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
            // convert multiple spaces into one space   
            str = Regex.Replace(str, @"\s+", " ").Trim();
            // cut and trim 
            str = str.Substring(0, str.Length <= 45 ? str.Length : 45).Trim();
            str = Regex.Replace(str, @"\s", "-"); // hyphens   
            return str;
        }

        public string GenerateSlugKlubb()
        {
            string phrase = string.Format("{0}-{1}", KlubbId, Klubb.KlubbNavn);

            string str = RemoveAccent(phrase).ToLower();
            // invalid chars           
            str = Regex.Replace(str, @"[^a-z0-9\s-]", "");
            // convert multiple spaces into one space   
            str = Regex.Replace(str, @"\s+", " ").Trim();
            // cut and trim 
            str = str.Substring(0, str.Length <= 45 ? str.Length : 45).Trim();
            str = Regex.Replace(str, @"\s", "-"); // hyphens   
            return str;
        }

        private string RemoveAccent(string text)
        {
            byte[] bytes = System.Text.Encoding.GetEncoding("Cyrillic").GetBytes(text);
            return System.Text.Encoding.ASCII.GetString(bytes);
        }

    }
}
