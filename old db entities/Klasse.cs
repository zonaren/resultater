using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Resultater.Entities
{
    public class Klasse
    {
        public int Id { get; set; }
        public string KlasseNavn { get; set; }
        public bool? IsActive { get; set; }
        public virtual ICollection<Resultat> Resultater { get; set; }


    }
}
