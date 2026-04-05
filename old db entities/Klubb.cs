using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace Resultater.Entities
{
    public class Klubb
    {

        public int Id { get; set; }
        public string KlubbNavn { get; set; }
        public string Adresse1 { get; set; }
        public string Adresse2 { get; set; }
        public string PostNr { get; set; }
        public string Sted { get; set; }
        public string Telefon { get; set; }
        public string Epost { get; set; }
        public string Hjemmeside { get; set; }
        public string KlubbInfo { get; set; }
        [Display(Name = "Aktiv")]
        public bool IsActive { get; set; }
        //[Display(Name = "Klubbleder")]
        //public int? KasterId { get; set; }

        public virtual ICollection<Kaster> Kastere { get; set; }
        public virtual ICollection<File> Avatars { get; set; }
        //[ForeignKey("KasterId")]
        //public virtual Kaster KlubbLeder { get; set; }

        // Slug generation taken from http://stackoverflow.com/questions/2920744/url-slugify-algorithm-in-c
        public string GenerateSlug()
        {
            string phrase = string.Format("{0}-{1}", Id, KlubbNavn);

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
