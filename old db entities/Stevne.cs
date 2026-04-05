using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Resultater.Entities
{
    public class Stevne
    {


        public int Id { get; set; }
        [Required]
        public string StevneNavn { get; set; }
        public string StevneSted { get; set; }

        [DataType(DataType.Date), Required]
        public DateTime? StevneDato { get; set; }
        [Display(Name = "Arrangør")]
        public int? KlubbId { get; set; }
        [Display(Name = "Type")]
        public int? StevneTypeId { get; set; }
        [Display(Name = "Innledende")]
        public int? InnledendeKastemetodeId { get; set; }
        [Display(Name = "Avsluttende")]
        public int? AvsluttendeKastemetodeId { get; set; }
        [Display(Name = "Klassifisering")]
        public int? StevneForId { get; set; }
        [Display(Name = "Kontakt")]
        public int? KasterId { get; set; }

        public string Juryleder { get; set; }
        [Display(Name = "Er NM")]
        public bool? IsNM { get; set; }
        public bool IsNorgesranking { get; set; }
        [Display(Name = "Fullført")]
        public bool IsCompleted { get; set; }
        [Display(Name = "Ekskludert rekorder")]
        public bool? IsExcludedFromRecords { get; set; }

        public virtual Klubb Klubb { get; set; }
        public virtual StevneType Stevnetype { get; set; }
        [ForeignKey("InnledendeKastemetodeId")]
        public virtual Kastemetode Innledende { get; set; }
        [ForeignKey("AvsluttendeKastemetodeId")]
        public virtual Kastemetode Avsluttende { get; set; }
        public virtual StevneFor StevneFor { get; set; }
        [ForeignKey("KasterId")]
        public virtual Kaster KontaktPerson { get; set; }

        public virtual ICollection<Resultat> Resultater { get; set; }
        public virtual ICollection<Kamp> Kamper { get; set; }

        public virtual ICollection<File> ResultatPdfFiles { get; set; }
        public virtual ICollection<File> InnbydelsePdfFiles { get; set; }

        // Slug generation taken from http://stackoverflow.com/questions/2920744/url-slugify-algorithm-in-c
        public string GenerateSlug()
        {
            string phrase = string.Format("{0}-{1}", Id, StevneNavn);

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
