using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace Resultater.Entities
{
    public class Kaster
    {

        public int Id { get; set; }
        public int? Medlemsnummer { get; set; }
        [Required]
        public string Fornavn { get; set; }
        [Required]
        public string Etternavn { get; set; }
        public string Telefon { get; set; }
        public string Epost { get; set; }
        [Display(Name = "Kjønn")]

        public int GenderId { get; set; }
        [Display(Name = "Klubb")]
        public int? KlubbId { get; set; }
        [Display(Name = "Klasse")]
        public int? KlasseId { get; set; }
        [Display(Name = "Aktiv")]
        public bool IsActive { get; set; }
        [Display(Name = "Navn")]
        public string FullName
        {
            get
            {
                return Etternavn + ", " + Fornavn;
            }
        }
        public string FullNameOrderedByFornavn
        {
            get
            {
                return Fornavn + " " + Etternavn;
            }
        }
        public string NameAndClub
        {
            get
            {
                return Etternavn + ", " + Fornavn + " (" + Klubb.KlubbNavn + ")";
            }
        }

        public virtual Gender Gender { get; set; }
        [ForeignKey("KlubbId")]
        public virtual Klubb Klubb { get; set; }
        public virtual Klasse Klasse { get; set; }

        public virtual ICollection<File> Avatars { get; set; }
        public virtual ICollection<Resultat> Resultater { get; set; }
        public virtual ICollection<KampDetalj> KampDetaljer { get; set; }

        // Slug generation taken from http://stackoverflow.com/questions/2920744/url-slugify-algorithm-in-c
        public string GenerateSlug()
        {
            string phrase = string.Format("{0}-{1}", Id, FullName);

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
