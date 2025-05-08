--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-05-08 12:55:16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 880 (class 1247 OID 139671)
-- Name: document_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.document_type AS ENUM (
    'THESIS',
    'DISSERTATION',
    'CONFLUENCE',
    'SYNERGY'
);


ALTER TYPE public.document_type OWNER TO postgres;

--
-- TOC entry 251 (class 1255 OID 140193)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 250 (class 1259 OID 140224)
-- Name: author_visits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.author_visits (
    id integer NOT NULL,
    author_id uuid NOT NULL,
    visitor_type character varying(10) NOT NULL,
    user_id character varying,
    ip_address character varying(45),
    visit_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT author_visits_visitor_type_check CHECK (((visitor_type)::text = ANY ((ARRAY['guest'::character varying, 'user'::character varying])::text[])))
);


ALTER TABLE public.author_visits OWNER TO postgres;

--
-- TOC entry 5150 (class 0 OID 0)
-- Dependencies: 250
-- Name: TABLE author_visits; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.author_visits IS 'Tracks visits to author profiles';


--
-- TOC entry 5151 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN author_visits.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.author_visits.id IS 'Primary key';


--
-- TOC entry 5152 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN author_visits.author_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.author_visits.author_id IS 'Foreign key to authors table';


--
-- TOC entry 5153 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN author_visits.visitor_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.author_visits.visitor_type IS 'Type of visitor (guest/user)';


--
-- TOC entry 5154 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN author_visits.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.author_visits.user_id IS 'Foreign key to users table, only set for logged-in users';


--
-- TOC entry 5155 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN author_visits.ip_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.author_visits.ip_address IS 'IP address of the visitor';


--
-- TOC entry 5156 (class 0 OID 0)
-- Dependencies: 250
-- Name: COLUMN author_visits.visit_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.author_visits.visit_date IS 'Timestamp of when the visit occurred';


--
-- TOC entry 249 (class 1259 OID 140223)
-- Name: author_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.author_visits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.author_visits_id_seq OWNER TO postgres;

--
-- TOC entry 5157 (class 0 OID 0)
-- Dependencies: 249
-- Name: author_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.author_visits_id_seq OWNED BY public.author_visits.id;


--
-- TOC entry 217 (class 1259 OID 139679)
-- Name: authors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.authors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    spud_id character varying(50),
    full_name character varying(255) NOT NULL,
    affiliation character varying(255),
    department character varying(255),
    email character varying(255),
    orcid_id character varying(255),
    biography text,
    profile_picture character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.authors OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 139730)
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    category_name character varying(255) NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 139729)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- TOC entry 5158 (class 0 OID 0)
-- Dependencies: 220
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- TOC entry 246 (class 1259 OID 140144)
-- Name: compiled_document_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compiled_document_items (
    id integer NOT NULL,
    compiled_document_id integer,
    document_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.compiled_document_items OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 140143)
-- Name: compiled_document_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.compiled_document_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compiled_document_items_id_seq OWNER TO postgres;

--
-- TOC entry 5159 (class 0 OID 0)
-- Dependencies: 245
-- Name: compiled_document_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.compiled_document_items_id_seq OWNED BY public.compiled_document_items.id;


--
-- TOC entry 244 (class 1259 OID 140134)
-- Name: compiled_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compiled_documents (
    id integer NOT NULL,
    start_year integer,
    end_year integer,
    volume integer,
    issue_number integer,
    department character varying(255),
    category character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    foreword character varying(255)
);


ALTER TABLE public.compiled_documents OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 140133)
-- Name: compiled_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.compiled_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.compiled_documents_id_seq OWNER TO postgres;

--
-- TOC entry 5160 (class 0 OID 0)
-- Dependencies: 243
-- Name: compiled_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.compiled_documents_id_seq OWNED BY public.compiled_documents.id;


--
-- TOC entry 235 (class 1259 OID 139862)
-- Name: credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credentials (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    password text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.credentials OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 139861)
-- Name: credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credentials_id_seq OWNER TO postgres;

--
-- TOC entry 5161 (class 0 OID 0)
-- Dependencies: 234
-- Name: credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.credentials_id_seq OWNED BY public.credentials.id;


--
-- TOC entry 223 (class 1259 OID 139739)
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    department_name character varying(255) NOT NULL,
    code character varying(10)
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 139738)
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- TOC entry 5162 (class 0 OID 0)
-- Dependencies: 222
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 226 (class 1259 OID 139783)
-- Name: document_authors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_authors (
    document_id integer NOT NULL,
    author_id uuid NOT NULL,
    author_order integer NOT NULL
);


ALTER TABLE public.document_authors OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 139915)
-- Name: document_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_permissions (
    id integer NOT NULL,
    document_id integer NOT NULL,
    user_id character varying,
    role_id integer,
    can_view boolean DEFAULT false,
    can_download boolean DEFAULT false,
    can_manage boolean DEFAULT false,
    granted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    granted_by character varying,
    CONSTRAINT document_permissions_check CHECK ((((user_id IS NOT NULL) AND (role_id IS NULL)) OR ((user_id IS NULL) AND (role_id IS NOT NULL))))
);


ALTER TABLE public.document_permissions OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 139914)
-- Name: document_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_permissions_id_seq OWNER TO postgres;

--
-- TOC entry 5163 (class 0 OID 0)
-- Dependencies: 239
-- Name: document_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_permissions_id_seq OWNED BY public.document_permissions.id;


--
-- TOC entry 248 (class 1259 OID 140196)
-- Name: document_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_requests (
    id integer NOT NULL,
    document_id character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    affiliation character varying(255) NOT NULL,
    reason character varying(255) NOT NULL,
    reason_details text NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_by character varying(255),
    reviewed_at timestamp without time zone,
    review_notes text,
    CONSTRAINT document_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


ALTER TABLE public.document_requests OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 140195)
-- Name: document_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_requests_id_seq OWNER TO postgres;

--
-- TOC entry 5164 (class 0 OID 0)
-- Dependencies: 247
-- Name: document_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_requests_id_seq OWNED BY public.document_requests.id;


--
-- TOC entry 229 (class 1259 OID 139807)
-- Name: document_research_agenda; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_research_agenda (
    document_id integer NOT NULL,
    research_agenda_id integer NOT NULL
);


ALTER TABLE public.document_research_agenda OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 139762)
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    abstract text,
    publication_date date,
    start_year integer,
    end_year integer,
    category_id integer,
    department_id integer,
    file_path text NOT NULL,
    pages integer,
    is_public boolean DEFAULT false,
    document_type public.document_type NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    volume character varying(50),
    issue character varying(50),
    compiled_parent_id integer
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 139761)
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO postgres;

--
-- TOC entry 5165 (class 0 OID 0)
-- Dependencies: 224
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- TOC entry 231 (class 1259 OID 139823)
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    file_type character varying(50),
    document_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.files OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 139822)
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.files_id_seq OWNER TO postgres;

--
-- TOC entry 5166 (class 0 OID 0)
-- Dependencies: 230
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- TOC entry 228 (class 1259 OID 139799)
-- Name: research_agenda; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.research_agenda (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.research_agenda OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 139798)
-- Name: research_agenda_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.research_agenda_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.research_agenda_id_seq OWNER TO postgres;

--
-- TOC entry 5167 (class 0 OID 0)
-- Dependencies: 227
-- Name: research_agenda_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.research_agenda_id_seq OWNED BY public.research_agenda.id;


--
-- TOC entry 219 (class 1259 OID 139709)
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    role_name character varying(50) NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 139708)
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_id_seq OWNER TO postgres;

--
-- TOC entry 5168 (class 0 OID 0)
-- Dependencies: 218
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- TOC entry 242 (class 1259 OID 140116)
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id character varying(50) NOT NULL,
    token text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 140115)
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO postgres;

--
-- TOC entry 5169 (class 0 OID 0)
-- Dependencies: 241
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- TOC entry 238 (class 1259 OID 139896)
-- Name: user_document_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_document_history (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    document_id integer NOT NULL,
    accessed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    action character varying(20) NOT NULL,
    CONSTRAINT user_document_history_action_check CHECK (((action)::text = ANY ((ARRAY['VIEW'::character varying, 'DOWNLOAD'::character varying])::text[])))
);


ALTER TABLE public.user_document_history OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 139895)
-- Name: user_document_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_document_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_document_history_id_seq OWNER TO postgres;

--
-- TOC entry 5170 (class 0 OID 0)
-- Dependencies: 237
-- Name: user_document_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_document_history_id_seq OWNED BY public.user_document_history.id;


--
-- TOC entry 236 (class 1259 OID 139879)
-- Name: user_saved_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_saved_documents (
    user_id character varying NOT NULL,
    document_id integer NOT NULL,
    saved_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_saved_documents OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 139840)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    first_name character varying(50),
    middle_name character varying(50),
    last_name character varying(50),
    email character varying(255),
    department_id integer,
    role_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 139839)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5171 (class 0 OID 0)
-- Dependencies: 232
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4869 (class 2604 OID 140227)
-- Name: author_visits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.author_visits ALTER COLUMN id SET DEFAULT nextval('public.author_visits_id_seq'::regclass);


--
-- TOC entry 4836 (class 2604 OID 139733)
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 4864 (class 2604 OID 140147)
-- Name: compiled_document_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compiled_document_items ALTER COLUMN id SET DEFAULT nextval('public.compiled_document_items_id_seq'::regclass);


--
-- TOC entry 4861 (class 2604 OID 140137)
-- Name: compiled_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compiled_documents ALTER COLUMN id SET DEFAULT nextval('public.compiled_documents_id_seq'::regclass);


--
-- TOC entry 4848 (class 2604 OID 139865)
-- Name: credentials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentials ALTER COLUMN id SET DEFAULT nextval('public.credentials_id_seq'::regclass);


--
-- TOC entry 4837 (class 2604 OID 139742)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 4854 (class 2604 OID 139918)
-- Name: document_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_permissions ALTER COLUMN id SET DEFAULT nextval('public.document_permissions_id_seq'::regclass);


--
-- TOC entry 4866 (class 2604 OID 140199)
-- Name: document_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_requests ALTER COLUMN id SET DEFAULT nextval('public.document_requests_id_seq'::regclass);


--
-- TOC entry 4838 (class 2604 OID 139765)
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- TOC entry 4843 (class 2604 OID 139826)
-- Name: files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- TOC entry 4842 (class 2604 OID 139802)
-- Name: research_agenda id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_agenda ALTER COLUMN id SET DEFAULT nextval('public.research_agenda_id_seq'::regclass);


--
-- TOC entry 4835 (class 2604 OID 139712)
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- TOC entry 4859 (class 2604 OID 140119)
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- TOC entry 4852 (class 2604 OID 139899)
-- Name: user_document_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_document_history ALTER COLUMN id SET DEFAULT nextval('public.user_document_history_id_seq'::regclass);


--
-- TOC entry 4846 (class 2604 OID 140013)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5144 (class 0 OID 140224)
-- Dependencies: 250
-- Data for Name: author_visits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.author_visits (id, author_id, visitor_type, user_id, ip_address, visit_date) FROM stdin;
\.


--
-- TOC entry 5111 (class 0 OID 139679)
-- Dependencies: 217
-- Data for Name: authors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.authors (id, spud_id, full_name, affiliation, department, email, orcid_id, biography, profile_picture, created_at, updated_at) FROM stdin;
4957e643-6dcc-4ae7-bd01-48c891c5e97d	\N	EDMARK IAN L. CABIO	\N	\N	\N	\N	\N	\N	2025-05-01 13:54:17.084479	2025-05-01 13:54:17.084479
77fa2462-82f2-4ddc-898e-c898e979d0cb	\N	GERALD RIDOLA, TRANCO	\N	\N	\N	\N	\N	\N	2025-05-01 13:59:00.541708	2025-05-01 13:59:00.541708
dba2f92d-a935-4b23-b382-23b7184a4df6	\N	EMMARY LUAGUE TORREDA	\N	\N	\N	\N	\N	\N	2025-05-01 14:00:42.560584	2025-05-01 14:00:42.560584
f475067b-1d7c-4df8-9412-1023ed548580	\N	Sami Gregg T, Managbanag, MA	\N	\N	\N	\N	\N	\N	2025-05-01 14:03:19.979694	2025-05-01 14:03:19.979694
ae9ea5ec-82c6-4b02-bb27-09d357bb3125	\N	Maricar Flores, ED, D,	\N	\N	\N	\N	\N	\N	2025-05-01 14:05:26.104506	2025-05-01 14:05:26.104506
1cb3bd2c-f5a5-4352-8cd2-73989ec5c266	\N	Irish Sequihod-Udtohan, MS	\N	\N	\N	\N	\N	\N	2025-05-01 14:06:12.211796	2025-05-01 14:06:12.211796
d45cbae9-5890-429d-b986-aff840bf51d7	\N	Sr. Helen A, Mabuhay, SPC	\N	\N	\N	\N	\N	\N	2025-05-01 14:08:45.21773	2025-05-01 14:08:45.21773
b34f25be-1dbc-43ef-8b94-7394e0c113cb	\N	Joana Rose Deciar, CPA	\N	\N	\N	\N	\N	\N	2025-05-01 14:09:03.85792	2025-05-01 14:09:03.85792
d5c395f8-6695-4da5-a9d3-cf96ffc69577	\N	Maria Fe M, Sadang, RSW	\N	\N	\N	\N	\N	\N	2025-05-01 14:11:38.095548	2025-05-01 14:11:38.095548
71c78870-619e-4ff1-b453-520d77399703	\N	Mary Francis V, Laquinon, ED,D	\N	\N	\N	\N	\N	\N	2025-05-01 14:12:08.920485	2025-05-01 14:12:08.920485
577e1337-e47b-40f2-9937-b0fdba029d49	\N	Marian	\N	\N	\N	\N	\N	\N	2025-05-03 11:40:03.881565	2025-05-03 11:40:03.881565
aa667160-23e1-4c47-9cf2-c904b6337c5e	\N	Juan Dela Cruz	\N	\N	\N	\N	\N	\N	2025-05-04 20:18:24.685907	2025-05-04 20:18:24.685907
e62e2b74-6f53-47d4-83c5-7de53451a248	SPUD - 012019201 - Z	Cj Anadon	\N	\N	\N	\N	My GHAD	\N	2025-05-03 11:40:03.869635	2025-05-06 10:32:26.327
c44794ac-2749-42c9-a250-f9480e68ce61	\N	ANNA MARIE CATACUTAN, AUSTERO, MAEd, BGC	\N	CBIT	\N	\N	\N	/storage/authors/profile-pictures/1746601671616_744	2025-05-01 13:57:02.941235	2025-05-07 15:07:51.635
\.


--
-- TOC entry 5115 (class 0 OID 139730)
-- Dependencies: 221
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, category_name) FROM stdin;
1	Confluence
2	Synergy
3	Thesis
4	Dissertation
\.


--
-- TOC entry 5140 (class 0 OID 140144)
-- Dependencies: 246
-- Data for Name: compiled_document_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compiled_document_items (id, compiled_document_id, document_id, created_at) FROM stdin;
73	46	134	2025-05-08 12:07:15.767393
74	46	135	2025-05-08 12:07:15.770715
\.


--
-- TOC entry 5138 (class 0 OID 140134)
-- Dependencies: 244
-- Data for Name: compiled_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.compiled_documents (id, start_year, end_year, volume, issue_number, department, category, created_at, updated_at, deleted_at, foreword) FROM stdin;
46	2017	2018	3	1	\N	CONFLUENCE	2025-05-08 12:07:15.373609	2025-05-08 12:07:15.373609+08	\N	/storage/foreword/confluence/1746677235356_4425
\.


--
-- TOC entry 5129 (class 0 OID 139862)
-- Dependencies: 235
-- Data for Name: credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credentials (id, user_id, password, created_at, updated_at) FROM stdin;
1	admin-01	admin123	2025-04-29 17:16:24.237644	2025-04-29 17:16:24.237644
2	spud-01	user123	2025-04-29 17:16:24.237644	2025-04-29 17:16:24.237644
\.


--
-- TOC entry 5117 (class 0 OID 139739)
-- Dependencies: 223
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, department_name, code) FROM stdin;
1	College of Business Information Technology	CBIT
2	College of Nursing	CON
3	Basic Academic Education	BAED
4	College of Arts and Science Education	CASE
\.


--
-- TOC entry 5120 (class 0 OID 139783)
-- Dependencies: 226
-- Data for Name: document_authors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_authors (document_id, author_id, author_order) FROM stdin;
132	e62e2b74-6f53-47d4-83c5-7de53451a248	1
133	e62e2b74-6f53-47d4-83c5-7de53451a248	1
133	aa667160-23e1-4c47-9cf2-c904b6337c5e	2
134	e62e2b74-6f53-47d4-83c5-7de53451a248	1
134	aa667160-23e1-4c47-9cf2-c904b6337c5e	2
135	577e1337-e47b-40f2-9937-b0fdba029d49	1
\.


--
-- TOC entry 5134 (class 0 OID 139915)
-- Dependencies: 240
-- Data for Name: document_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_permissions (id, document_id, user_id, role_id, can_view, can_download, can_manage, granted_at, granted_by) FROM stdin;
\.


--
-- TOC entry 5142 (class 0 OID 140196)
-- Dependencies: 248
-- Data for Name: document_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_requests (id, document_id, full_name, email, affiliation, reason, reason_details, status, created_at, updated_at, reviewed_by, reviewed_at, review_notes) FROM stdin;
2	85	froxxy	frozenskill2212003@gmail.com	SPUD SeX Counsilor	research	wala ra	approved	2025-05-07 11:44:33.019	2025-05-07 13:18:44.223	admin-01	2025-05-07 13:18:44.223	Approved by admin
3	120	Sample guest	zanimontelli8@gmail.com	student 	academic	please	approved	2025-05-07 13:21:53.661	2025-05-07 13:22:05.909	admin-01	2025-05-07 13:22:05.909	Approved by admin
4	117	zani montelli	zanimontelli8@gmail.com	student lng	personal	was	approved	2025-05-07 13:31:07.184	2025-05-07 13:31:18.561	admin-01	2025-05-07 13:31:18.561	Approved by admin
5	85	papahesus	officeresearch520@gmail.com	sisteadsdasd	personal	sad	approved	2025-05-07 14:09:43.676	2025-05-07 14:09:50.463	admin-01	2025-05-07 14:09:50.463	Approved by admin
6	115	sample ko pre	officeresearch520@gmail.com	gana tawon	academic	asdad	approved	2025-05-07 14:38:42.749	2025-05-07 14:38:48.26	admin-01	2025-05-07 14:38:48.26	Approved by admin
7	116	hello kitty	officeresearch520@gmail.com	sad	research	adasd	approved	2025-05-07 14:45:28.064	2025-05-07 14:45:44.38	admin-01	2025-05-07 14:45:44.38	Approved by admin
\.


--
-- TOC entry 5123 (class 0 OID 139807)
-- Dependencies: 229
-- Data for Name: document_research_agenda; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_research_agenda (document_id, research_agenda_id) FROM stdin;
132	10
132	3
132	2
134	15
134	1
135	3
133	10
\.


--
-- TOC entry 5119 (class 0 OID 139762)
-- Dependencies: 225
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, title, description, abstract, publication_date, start_year, end_year, category_id, department_id, file_path, pages, is_public, document_type, created_at, updated_at, deleted_at, volume, issue, compiled_parent_id) FROM stdin;
134	res1	\N	No abstract provided	2025-05-08	\N	\N	3	\N	/storage/compiled/confluence/studies/1746677235532_1064	\N	t	CONFLUENCE	2025-05-08 12:07:15.544827	2025-05-08 12:07:15.544827	\N	\N	\N	46
132	Single Thesis Sample	\N	The paper discusses the results of a study which explored advanced learners of English engagement with their mobile devices to develop learning experiences that meet their needs and goals as foreign language learners. The data were collected from 20 students by means of a semi-structured interview. The gathered data were subjected to qualitative and quantitative analysis. The results of the study demonstrated that, on the one hand, some subjects manifested heightened awareness relating to the advantageous role of mobile devices in their learning endeavors, their ability to reach for suitable tools and retrieve necessary information so as to achieve their goals, meet their needs and adjust their learning of English to their personal learning styles, and on the other, a rather intuitive and/or ad hoc use of their mobile devices in the classroom.	2000-01-01	\N	\N	\N	\N	/storage/single/1746676954072_3510	\N	t	THESIS	2025-05-08 12:02:34.25095	2025-05-08 12:04:02.807342	\N	\N	\N	\N
135	res2	\N	No abstract provided	2025-05-08	\N	\N	3	\N	/storage/compiled/confluence/studies/1746677235712_1888	\N	t	CONFLUENCE	2025-05-08 12:07:15.724198	2025-05-08 12:07:15.724198	\N	\N	\N	46
133	Sinle Dissertation Sample	\N	The paper discusses the results of a study which explored advanced learners of English engagement with their mobile devices to develop learning experiences that meet their needs and goals as foreign language learners. The data were collected from 20 students by means of a semi-structured interview. The gathered data were subjected to qualitative and quantitative analysis. The results of the study demonstrated that, on the one hand, some subjects manifested heightened awareness relating to the advantageous role of mobile devices in their learning endeavors, their ability to reach for suitable tools and retrieve necessary information so as to achieve their goals, meet their needs and adjust their learning of English to their personal learning styles, and on the other, a rather intuitive and/or ad hoc use of their mobile devices in the classroom.	2003-09-30	\N	\N	\N	\N	/storage/single/1746677125374_2055	\N	t	DISSERTATION	2025-05-08 12:05:25.613629	2025-05-08 12:21:16.99802	\N	\N	\N	\N
\.


--
-- TOC entry 5125 (class 0 OID 139823)
-- Dependencies: 231
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.files (id, file_name, file_path, file_size, file_type, document_id, created_at, updated_at) FROM stdin;
25	file	/storage/single/1746676954072_3510	379315	other	132	2025-05-08 12:02:34.273914	2025-05-08 12:02:34.273914
26	file	/storage/single/1746677125374_2055	379315	other	133	2025-05-08 12:05:25.657045	2025-05-08 12:05:25.657045
\.


--
-- TOC entry 5122 (class 0 OID 139799)
-- Dependencies: 228
-- Data for Name: research_agenda; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.research_agenda (id, name) FROM stdin;
1	Health and Wellness
2	Technology and Innovation
3	Education and Literacy
4	Environmental Sustainability
5	Community Development
6	God Bless Senpols
7	Hello kitty
8	Sistaarr!!!
9	Vhal
10	art
11	christian
12	ert
13	Philosophy
14	SENPOL
15	tea
\.


--
-- TOC entry 5113 (class 0 OID 139709)
-- Dependencies: 219
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, role_name) FROM stdin;
1	ADMIN
2	USER
3	GUEST
\.


--
-- TOC entry 5136 (class 0 OID 140116)
-- Dependencies: 242
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, user_id, token, created_at, expires_at) FROM stdin;
1	admin-01	4a200818-9d4e-4c56-9b7d-dc7baf632a8b	2025-05-08 12:01:39.838261	2025-05-09 12:01:39.836
2	admin-01	eaaadda8-7fc5-498a-9c09-fdb002472943	2025-05-08 12:11:06.558511	2025-05-09 12:11:06.557
3	admin-01	d791f386-7b5a-4e71-ac56-68cfb117e9a7	2025-05-08 12:15:27.614314	2025-05-09 12:15:27.613
4	admin-01	c4f5f95a-7c7a-448c-a43a-87eb3f67d7e6	2025-05-08 12:25:52.423192	2025-05-09 12:25:52.422
5	admin-01	1073f950-e80b-4822-9a94-4190eb224bc7	2025-05-08 12:30:08.279088	2025-05-09 12:30:08.278
6	admin-01	d55e7d9f-2c34-48b9-b8e3-06263f4b6dd2	2025-05-08 12:36:13.541343	2025-05-09 12:36:13.54
\.


--
-- TOC entry 5132 (class 0 OID 139896)
-- Dependencies: 238
-- Data for Name: user_document_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_document_history (id, user_id, document_id, accessed_at, action) FROM stdin;
\.


--
-- TOC entry 5130 (class 0 OID 139879)
-- Dependencies: 236
-- Data for Name: user_saved_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_saved_documents (user_id, document_id, saved_at) FROM stdin;
\.


--
-- TOC entry 5127 (class 0 OID 139840)
-- Dependencies: 233
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, first_name, middle_name, last_name, email, department_id, role_id, created_at, last_login) FROM stdin;
spud-01	John	D	Doe	john.doe@example.com	2	2	2025-04-29 15:19:33.059118	2025-05-08 02:48:41.389
admin-01	Admin	M	User	admin@example.com	1	1	2025-04-29 15:19:33.059118	2025-05-08 04:36:13.539
\.


--
-- TOC entry 5172 (class 0 OID 0)
-- Dependencies: 249
-- Name: author_visits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.author_visits_id_seq', 1, false);


--
-- TOC entry 5173 (class 0 OID 0)
-- Dependencies: 220
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 4, true);


--
-- TOC entry 5174 (class 0 OID 0)
-- Dependencies: 245
-- Name: compiled_document_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.compiled_document_items_id_seq', 74, true);


--
-- TOC entry 5175 (class 0 OID 0)
-- Dependencies: 243
-- Name: compiled_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.compiled_documents_id_seq', 46, true);


--
-- TOC entry 5176 (class 0 OID 0)
-- Dependencies: 234
-- Name: credentials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.credentials_id_seq', 2, true);


--
-- TOC entry 5177 (class 0 OID 0)
-- Dependencies: 222
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.departments_id_seq', 4, true);


--
-- TOC entry 5178 (class 0 OID 0)
-- Dependencies: 239
-- Name: document_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.document_permissions_id_seq', 1, false);


--
-- TOC entry 5179 (class 0 OID 0)
-- Dependencies: 247
-- Name: document_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.document_requests_id_seq', 7, true);


--
-- TOC entry 5180 (class 0 OID 0)
-- Dependencies: 224
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documents_id_seq', 135, true);


--
-- TOC entry 5181 (class 0 OID 0)
-- Dependencies: 230
-- Name: files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.files_id_seq', 26, true);


--
-- TOC entry 5182 (class 0 OID 0)
-- Dependencies: 227
-- Name: research_agenda_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.research_agenda_id_seq', 15, true);


--
-- TOC entry 5183 (class 0 OID 0)
-- Dependencies: 218
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.roles_id_seq', 3, true);


--
-- TOC entry 5184 (class 0 OID 0)
-- Dependencies: 241
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sessions_id_seq', 6, true);


--
-- TOC entry 5185 (class 0 OID 0)
-- Dependencies: 237
-- Name: user_document_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_document_history_id_seq', 1, false);


--
-- TOC entry 5186 (class 0 OID 0)
-- Dependencies: 232
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- TOC entry 4938 (class 2606 OID 140235)
-- Name: author_visits author_visits_author_id_idx; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.author_visits
    ADD CONSTRAINT author_visits_author_id_idx UNIQUE (id, author_id);


--
-- TOC entry 4940 (class 2606 OID 140233)
-- Name: author_visits author_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.author_visits
    ADD CONSTRAINT author_visits_pkey PRIMARY KEY (id);


--
-- TOC entry 4876 (class 2606 OID 139688)
-- Name: authors authors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authors
    ADD CONSTRAINT authors_pkey PRIMARY KEY (id);


--
-- TOC entry 4878 (class 2606 OID 139690)
-- Name: authors authors_spud_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.authors
    ADD CONSTRAINT authors_spud_id_key UNIQUE (spud_id);


--
-- TOC entry 4886 (class 2606 OID 139737)
-- Name: categories categories_category_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_category_name_key UNIQUE (category_name);


--
-- TOC entry 4888 (class 2606 OID 139735)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4933 (class 2606 OID 140150)
-- Name: compiled_document_items compiled_document_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compiled_document_items
    ADD CONSTRAINT compiled_document_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4931 (class 2606 OID 140142)
-- Name: compiled_documents compiled_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compiled_documents
    ADD CONSTRAINT compiled_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 4917 (class 2606 OID 139871)
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (id);


--
-- TOC entry 4919 (class 2606 OID 140045)
-- Name: credentials credentials_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_user_id_key UNIQUE (user_id);


--
-- TOC entry 4890 (class 2606 OID 139748)
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- TOC entry 4892 (class 2606 OID 139746)
-- Name: departments departments_department_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_department_name_key UNIQUE (department_name);


--
-- TOC entry 4894 (class 2606 OID 139744)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 4899 (class 2606 OID 139787)
-- Name: document_authors document_authors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_authors
    ADD CONSTRAINT document_authors_pkey PRIMARY KEY (document_id, author_id);


--
-- TOC entry 4925 (class 2606 OID 139925)
-- Name: document_permissions document_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 4935 (class 2606 OID 140206)
-- Name: document_requests document_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_requests
    ADD CONSTRAINT document_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4907 (class 2606 OID 139811)
-- Name: document_research_agenda document_research_agenda_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_research_agenda
    ADD CONSTRAINT document_research_agenda_pkey PRIMARY KEY (document_id, research_agenda_id);


--
-- TOC entry 4896 (class 2606 OID 139772)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- TOC entry 4911 (class 2606 OID 139832)
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- TOC entry 4903 (class 2606 OID 139806)
-- Name: research_agenda research_agenda_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_agenda
    ADD CONSTRAINT research_agenda_name_key UNIQUE (name);


--
-- TOC entry 4905 (class 2606 OID 139804)
-- Name: research_agenda research_agenda_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.research_agenda
    ADD CONSTRAINT research_agenda_pkey PRIMARY KEY (id);


--
-- TOC entry 4882 (class 2606 OID 139714)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- TOC entry 4884 (class 2606 OID 139716)
-- Name: roles roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_role_name_key UNIQUE (role_name);


--
-- TOC entry 4927 (class 2606 OID 140124)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4929 (class 2606 OID 140126)
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- TOC entry 4923 (class 2606 OID 139903)
-- Name: user_document_history user_document_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_document_history
    ADD CONSTRAINT user_document_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4921 (class 2606 OID 140027)
-- Name: user_saved_documents user_saved_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_documents
    ADD CONSTRAINT user_saved_documents_pkey PRIMARY KEY (user_id, document_id);


--
-- TOC entry 4913 (class 2606 OID 139850)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4915 (class 2606 OID 140015)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4936 (class 1259 OID 140246)
-- Name: author_visits_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX author_visits_author_id ON public.author_visits USING btree (author_id);


--
-- TOC entry 4941 (class 1259 OID 140247)
-- Name: author_visits_visit_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX author_visits_visit_date ON public.author_visits USING btree (visit_date);


--
-- TOC entry 4879 (class 1259 OID 140101)
-- Name: idx_authors_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_authors_email ON public.authors USING btree (email);


--
-- TOC entry 4880 (class 1259 OID 140100)
-- Name: idx_authors_full_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_authors_full_name ON public.authors USING btree (full_name);


--
-- TOC entry 4900 (class 1259 OID 140103)
-- Name: idx_document_authors_author_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_authors_author_id ON public.document_authors USING btree (author_id);


--
-- TOC entry 4901 (class 1259 OID 140102)
-- Name: idx_document_authors_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_authors_document_id ON public.document_authors USING btree (document_id);


--
-- TOC entry 4908 (class 1259 OID 140104)
-- Name: idx_document_research_agenda_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_research_agenda_document_id ON public.document_research_agenda USING btree (document_id);


--
-- TOC entry 4909 (class 1259 OID 140105)
-- Name: idx_document_research_agenda_research_agenda_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_research_agenda_research_agenda_id ON public.document_research_agenda USING btree (research_agenda_id);


--
-- TOC entry 4897 (class 1259 OID 140169)
-- Name: idx_documents_compiled_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_compiled_parent_id ON public.documents USING btree (compiled_parent_id);


--
-- TOC entry 4964 (class 2606 OID 140236)
-- Name: author_visits author_visits_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.author_visits
    ADD CONSTRAINT author_visits_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.authors(id) ON DELETE CASCADE;


--
-- TOC entry 4965 (class 2606 OID 140241)
-- Name: author_visits author_visits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.author_visits
    ADD CONSTRAINT author_visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4962 (class 2606 OID 140151)
-- Name: compiled_document_items compiled_document_items_compiled_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compiled_document_items
    ADD CONSTRAINT compiled_document_items_compiled_document_id_fkey FOREIGN KEY (compiled_document_id) REFERENCES public.compiled_documents(id) ON DELETE CASCADE;


--
-- TOC entry 4963 (class 2606 OID 140156)
-- Name: compiled_document_items compiled_document_items_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compiled_document_items
    ADD CONSTRAINT compiled_document_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 4952 (class 2606 OID 140078)
-- Name: credentials credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4945 (class 2606 OID 139793)
-- Name: document_authors document_authors_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_authors
    ADD CONSTRAINT document_authors_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.authors(id) ON DELETE CASCADE;


--
-- TOC entry 4946 (class 2606 OID 139788)
-- Name: document_authors document_authors_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_authors
    ADD CONSTRAINT document_authors_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 4957 (class 2606 OID 139926)
-- Name: document_permissions document_permissions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 4958 (class 2606 OID 140088)
-- Name: document_permissions document_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- TOC entry 4959 (class 2606 OID 139936)
-- Name: document_permissions document_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- TOC entry 4960 (class 2606 OID 140083)
-- Name: document_permissions document_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_permissions
    ADD CONSTRAINT document_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4947 (class 2606 OID 139812)
-- Name: document_research_agenda document_research_agenda_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_research_agenda
    ADD CONSTRAINT document_research_agenda_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 4948 (class 2606 OID 139817)
-- Name: document_research_agenda document_research_agenda_research_agenda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_research_agenda
    ADD CONSTRAINT document_research_agenda_research_agenda_id_fkey FOREIGN KEY (research_agenda_id) REFERENCES public.research_agenda(id);


--
-- TOC entry 4942 (class 2606 OID 139773)
-- Name: documents documents_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- TOC entry 4943 (class 2606 OID 139778)
-- Name: documents documents_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4949 (class 2606 OID 139833)
-- Name: files files_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 4944 (class 2606 OID 140164)
-- Name: documents fk_compiled_parent; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_compiled_parent FOREIGN KEY (compiled_parent_id) REFERENCES public.compiled_documents(id) ON DELETE SET NULL;


--
-- TOC entry 4961 (class 2606 OID 140127)
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4955 (class 2606 OID 139909)
-- Name: user_document_history user_document_history_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_document_history
    ADD CONSTRAINT user_document_history_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 4956 (class 2606 OID 140073)
-- Name: user_document_history user_document_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_document_history
    ADD CONSTRAINT user_document_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4953 (class 2606 OID 139890)
-- Name: user_saved_documents user_saved_documents_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_documents
    ADD CONSTRAINT user_saved_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- TOC entry 4954 (class 2606 OID 140068)
-- Name: user_saved_documents user_saved_documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_documents
    ADD CONSTRAINT user_saved_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4950 (class 2606 OID 139851)
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4951 (class 2606 OID 139856)
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


-- Completed on 2025-05-08 12:55:17

--
-- PostgreSQL database dump complete
--

