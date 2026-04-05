using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Resultater.Entities
{
    public class StevneType
    {
        public int Id { get; set; }
        public string StevneTypeNavn { get; set; }
        public bool? IsActive { get; set; }
        public virtual ICollection<Stevne> Stevner { get; set; }

    }
}
