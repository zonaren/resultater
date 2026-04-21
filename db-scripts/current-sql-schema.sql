-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.antallTellendeNc (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  year integer UNIQUE,
  max_nc_total integer NOT NULL DEFAULT 3,
  max_dnc_total integer NOT NULL DEFAULT 10,
  max_snc_total integer NOT NULL DEFAULT 3,
  maxtotal integer NOT NULL DEFAULT 10,
  max_snc integer NOT NULL DEFAULT 3,
  max_dnc integer NOT NULL DEFAULT 6,
  CONSTRAINT antallTellendeNc_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bruker_profil (
  id uuid NOT NULL,
  rolle text NOT NULL DEFAULT 'bruker'::text CHECK (rolle = ANY (ARRAY['admin'::text, 'klubbadmin'::text, 'bruker'::text])),
  kasterid integer,
  kobling_status text NOT NULL DEFAULT 'ingen'::text CHECK (kobling_status = ANY (ARRAY['ingen'::text, 'venter'::text, 'godkjent'::text, 'avvist'::text])),
  kobling_kasterid integer,
  opprettet_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bruker_profil_pkey PRIMARY KEY (id),
  CONSTRAINT bruker_profil_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT bruker_profil_kasterid_fkey FOREIGN KEY (kasterid) REFERENCES public.kaster(id),
  CONSTRAINT bruker_profil_kobling_kasterid_fkey FOREIGN KEY (kobling_kasterid) REFERENCES public.kaster(id)
);
CREATE TABLE public.gruppe (
  id integer NOT NULL DEFAULT nextval('gruppe_id_seq'::regclass),
  navn text NOT NULL,
  eraktiv boolean NOT NULL DEFAULT true,
  CONSTRAINT gruppe_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kastemetode (
  id integer NOT NULL DEFAULT nextval('kastemetode_id_seq'::regclass),
  navn text NOT NULL,
  beskrivelse text,
  eraktiv boolean NOT NULL DEFAULT true,
  ernorgesranking boolean NOT NULL DEFAULT false,
  CONSTRAINT kastemetode_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kaster (
  id integer NOT NULL DEFAULT nextval('kaster_id_seq'::regclass),
  medlemsnummer integer,
  fornavn text NOT NULL,
  etternavn text NOT NULL,
  telefon text,
  epost text,
  kjonnid integer NOT NULL,
  klubbid integer,
  klasseid integer,
  eraktiv boolean NOT NULL DEFAULT true,
  avatarurl text,
  CONSTRAINT kaster_pkey PRIMARY KEY (id),
  CONSTRAINT kaster_kjonnid_fkey FOREIGN KEY (kjonnid) REFERENCES public.kjonn(id),
  CONSTRAINT kaster_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT kaster_klasseid_fkey FOREIGN KEY (klasseid) REFERENCES public.klasse(id)
);
CREATE TABLE public.kategori (
  id integer NOT NULL DEFAULT nextval('kategori_id_seq'::regclass),
  navn text NOT NULL,
  erlagbasert boolean NOT NULL DEFAULT false,
  ernm boolean NOT NULL DEFAULT true,
  CONSTRAINT kategori_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kjonn (
  id integer NOT NULL DEFAULT nextval('kjonn_id_seq'::regclass),
  navn text NOT NULL,
  kortform text NOT NULL,
  CONSTRAINT kjonn_pkey PRIMARY KEY (id)
);
CREATE TABLE public.klasse (
  id integer NOT NULL DEFAULT nextval('klasse_id_seq'::regclass),
  navn text NOT NULL,
  eraktiv boolean NOT NULL DEFAULT true,
  har_nm_vinnere boolean NOT NULL DEFAULT false,
  CONSTRAINT klasse_pkey PRIMARY KEY (id)
);
CREATE TABLE public.klubb (
  id integer NOT NULL DEFAULT nextval('klubb_id_seq'::regclass),
  navn text NOT NULL,
  kortnavn text NOT NULL DEFAULT ''::text,
  eraktiv boolean NOT NULL DEFAULT true,
  logourl text,
  CONSTRAINT klubb_pkey PRIMARY KEY (id)
);
CREATE TABLE public.klubbadmin_klubber (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  bruker_id uuid NOT NULL,
  klubbid integer NOT NULL,
  tildelt_av uuid,
  tildelt_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT klubbadmin_klubber_pkey PRIMARY KEY (id),
  CONSTRAINT klubbadmin_klubber_bruker_id_fkey FOREIGN KEY (bruker_id) REFERENCES auth.users(id),
  CONSTRAINT klubbadmin_klubber_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT klubbadmin_klubber_tildelt_av_fkey FOREIGN KEY (tildelt_av) REFERENCES auth.users(id)
);
CREATE TABLE public.norgescuppoeng (
  id integer NOT NULL DEFAULT nextval('norgescuppoeng_id_seq'::regclass),
  plassering integer NOT NULL,
  poengnc integer NOT NULL,
  poengdnc integer NOT NULL,
  gjelderfraaar integer NOT NULL,
  gjeldertilaar integer,
  CONSTRAINT norgescuppoeng_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pamelding (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  stevneid integer NOT NULL,
  kasterid integer NOT NULL,
  bruker_id uuid NOT NULL,
  klasse_id integer,
  gruppe_id integer,
  merknad text,
  status text NOT NULL DEFAULT 'pameldt'::text CHECK (status = ANY (ARRAY['pameldt'::text, 'avmeldt'::text, 'bekreftet'::text])),
  opprettet_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pamelding_pkey PRIMARY KEY (id),
  CONSTRAINT pamelding_stevneid_fkey FOREIGN KEY (stevneid) REFERENCES public.stevne(id),
  CONSTRAINT pamelding_kasterid_fkey FOREIGN KEY (kasterid) REFERENCES public.kaster(id),
  CONSTRAINT pamelding_bruker_id_fkey FOREIGN KEY (bruker_id) REFERENCES auth.users(id),
  CONSTRAINT pamelding_klasse_id_fkey FOREIGN KEY (klasse_id) REFERENCES public.klasse(id),
  CONSTRAINT pamelding_gruppe_id_fkey FOREIGN KEY (gruppe_id) REFERENCES public.gruppe(id)
);
CREATE TABLE public.resultat (
  id integer NOT NULL DEFAULT nextval('resultat_id_seq'::regclass),
  stevneid integer,
  gruppeid integer,
  kasterid integer,
  klubbid integer,
  klasseid integer,
  plassering integer,
  erpremie boolean,
  norgescuppoeng real,
  kamppoeng real,
  skarinnledende integer,
  poengminimatch integer,
  poengxhalvmatch integer,
  poengxheilmatch integer,
  poengkongelag integer,
  poenggolf integer,
  antallringminimatch integer,
  antallringhalvmatch integer,
  antallringheilmatch integer,
  antallringkongelag integer,
  CONSTRAINT resultat_pkey PRIMARY KEY (id),
  CONSTRAINT resultat_stevneid_fkey FOREIGN KEY (stevneid) REFERENCES public.stevne(id),
  CONSTRAINT resultat_gruppeid_fkey FOREIGN KEY (gruppeid) REFERENCES public.gruppe(id),
  CONSTRAINT resultat_kasterid_fkey FOREIGN KEY (kasterid) REFERENCES public.kaster(id),
  CONSTRAINT resultat_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT resultat_klasseid_fkey FOREIGN KEY (klasseid) REFERENCES public.klasse(id)
);
CREATE TABLE public.stevne (
  id integer NOT NULL DEFAULT nextval('stevne_id_seq'::regclass),
  navn text NOT NULL,
  sted text,
  dato timestamp with time zone,
  klubbid integer,
  stevnetypeid integer,
  innledendekastemetodeid integer,
  avsluttendekastemetodeid integer,
  kategoriid integer,
  kontaktkasterid integer,
  juryleder text,
  ernm boolean NOT NULL DEFAULT false,
  ernorgesranking boolean NOT NULL DEFAULT false,
  erfullfort boolean NOT NULL DEFAULT false,
  erekskludertfrarekorder boolean NOT NULL DEFAULT false,
  innbydelseurl text,
  resultaturl text,
  CONSTRAINT stevne_pkey PRIMARY KEY (id),
  CONSTRAINT stevne_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT stevne_stevnetypeid_fkey FOREIGN KEY (stevnetypeid) REFERENCES public.stevnetype(id),
  CONSTRAINT stevne_innledendekastemetodeid_fkey FOREIGN KEY (innledendekastemetodeid) REFERENCES public.kastemetode(id),
  CONSTRAINT stevne_avsluttendekastemetodeid_fkey FOREIGN KEY (avsluttendekastemetodeid) REFERENCES public.kastemetode(id),
  CONSTRAINT stevne_kategoriid_fkey FOREIGN KEY (kategoriid) REFERENCES public.kategori(id),
  CONSTRAINT stevne_kontaktkasterid_fkey FOREIGN KEY (kontaktkasterid) REFERENCES public.kaster(id)
);
CREATE TABLE public.stevnetype (
  id integer NOT NULL DEFAULT nextval('stevnetype_id_seq'::regclass),
  navn text NOT NULL,
  eraktiv boolean NOT NULL DEFAULT true,
  beskrivelse text,
  CONSTRAINT stevnetype_pkey PRIMARY KEY (id)
);