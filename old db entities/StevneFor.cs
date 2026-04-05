using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Resultater.Entities
{
    public class StevneFor
    {
        public int Id { get; set; }
        public string StevneForNavn { get; set; }
        public virtual ICollection<Stevne> Stevner { get; set; }

    }
}
