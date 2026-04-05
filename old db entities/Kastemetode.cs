using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Resultater.Entities
{
    public class Kastemetode
    {
        public int Id { get; set; }
        public string KasteMetodeNavn { get; set; }
        public string Beskrivelse { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsNorgesranking { get; set; }


        public virtual ICollection<Stevne> StevnerInnl { get; set; }
        public virtual ICollection<Stevne> StevnerAvsl { get; set; }

        //public virtual ICollection<Stevne> AvsluttendeKastemetoder { get; set; }
    }
}
