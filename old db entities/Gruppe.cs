using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;

namespace Resultater.Entities
{
    public class Gruppe
    {
        public int Id { get; set; }
        public string GruppeNavn { get; set; }
        public bool IsActive { get; set; }
        public virtual ICollection<Resultat> Resultater { get; set; }

    }
}
