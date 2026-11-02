import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiRequestError, formatDate } from "./api";

type User = { id: string; email: string; fullName: string; role: "customer" | "admin" };
type AgeGroup = "little" | "middle" | "teen" | "adult";
type Season = "summer" | "winter";
const seasonSections: { season: Season; title: string }[] = [
  { season: "winter", title: "Séjours d'hiver" },
  { season: "summer", title: "Séjours d'été" },
];
type ActivityIllustration = {
  src: string;
  alt: string;
  label: string;
  credit: string;
  source: string;
};
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
type CampProgram = {
  ageGroup: AgeGroup;
  title: string;
  ages: string;
  days: number;
  theme: string;
  description: string;
  illustrations: ActivityIllustration[];
  activities: Record<Season, { title: string; details: string }[]>;
};
type CampSession = {
  id: string;
  season: Season;
  ageGroup: AgeGroup;
  title: string;
  description: string;
  activities: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  capacity: number;
  reservedPlaces: number;
  remainingPlaces: number;
  registrationOpen?: boolean;
  hasEnrollments?: boolean;
};
type Participant = {
  id?: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  dietaryRestrictions: string;
  medicalInstructions: string;
  specialRequests: string;
  matchesRecommendedAge?: boolean;
};
type Enrollment = {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  adminNote: string | null;
  cancellationReason: string | null;
  internalNote?: string | null;
  createdAt: string;
  processedAt: string | null;
  consentRecordedAt: string;
  customer?: { id: string; name: string; email: string };
  session: Pick<CampSession, "id" | "title" | "season" | "ageGroup" | "startDate" | "endDate">;
  participants: Participant[];
};
type ContactMessage = {
  id: string;
  message: string;
  createdAt: string;
  senderRole: "customer" | "admin";
};
type ContactConversation = {
  id: string;
  isRead: boolean;
  updatedAt: string;
  customer: { name: string; email: string };
  messages: ContactMessage[];
};

const programs: CampProgram[] = [
  {
    ageGroup: "little",
    title: "Les Petits",
    ages: "5–7 ans",
    days: 4,
    theme: "Premiers pas éco-aventuriers",
    description: "Une première aventure sportive, à leur rythme, pour découvrir la montagne en prenant soin du vivant.",
    illustrations: [
      {
        src: publicAsset("images/enfants-randonnee-alpes.jpg"),
        alt: "Deux enfants font une pause pendant une randonnée dans les Alpes.",
        label: "Randonnée et découverte de la montagne",
        credit: "SWT666 · CC BY-SA 4.0",
        source: "https://commons.wikimedia.org/wiki/File:Two_kids_resting_during_a_hike_on_the_Alps.jpg",
      },
      {
        src: publicAsset("images/kids-nature-camp.jpg"),
        alt: "Des enfants participent à un camp consacré à la découverte de la nature.",
        label: "Ateliers nature en camp",
        credit: "Alessandro Pucci · CC BY 2.0",
        source: "https://commons.wikimedia.org/wiki/File:Children_at_a_World_Wildlife_Fund_for_Nature_camp_in_Tuscany,_Italy_-_20060615.jpg",
      },
      {
        src: publicAsset("images/alpine-ibex.jpg"),
        alt: "Un groupe de bouquetins évolue sur une crête rocheuse des Alpes.",
        label: "Observer la faune alpine",
        credit: "SimonaINM · CC BY-SA 4.0",
        source: "https://commons.wikimedia.org/wiki/File:Stambecchi_Indren.jpg",
      },
    ],
    activities: {
      summer: [
        { title: "Randonnées contées et douces", details: "S'initier à la marche en montagne lors de petites balades adaptées, observer la nature et ramasser uniquement des éléments déjà détachés, sans déranger la faune ni la flore." },
        { title: "Chasse aux traces d'animaux", details: "Reconnaître les empreintes de chamois ou de lièvre sur des sentiers faciles, sans approcher ni suivre les animaux." },
        { title: "Petits gardiens de la montagne", details: "Découvrir le tri des déchets et fabriquer une petite mangeoire à oiseaux avec du bois recyclé." },
      ],
      winter: [
        { title: "Premières traces dans la neige", details: "Faire une très courte balade ludique en raquettes, si l'enneigement le permet, et observer les traces sans déranger les animaux." },
        { title: "Le manteau des animaux", details: "Découvrir comment la faune alpine traverse l'hiver grâce à la fourrure, aux réserves et, pour certaines espèces, à l'hibernation." },
        { title: "Mini-igloos écoresponsables", details: "Construire de petites formes dans la neige avec l'encadrement, sans laisser de déchets ni dégrader les milieux." },
      ],
    },
  },
  {
    ageGroup: "middle",
    title: "Les Moyens",
    ages: "7–12 ans",
    days: 7,
    theme: "Explorateurs de la biodiversité alpine",
    description: "Une semaine pour explorer les paysages et la biodiversité des Alpes, en équipe et en respectant les milieux naturels.",
    illustrations: [
      {
        src: publicAsset("images/camp-youth-crossing.jpg"),
        alt: "Des jeunes franchissent une rivière lors d'un séjour de plein air.",
        label: "Défis collectifs en pleine nature",
        credit: "BLM Nevada · domaine public",
        source: "https://commons.wikimedia.org/wiki/File:Tyrolean_River_Crossing_-_Youth_Camp_(22401946642).jpg",
      },
      {
        src: publicAsset("images/alpine-shepherd.jpg"),
        alt: "Un berger accompagne un grand troupeau sur un chemin de montagne.",
        label: "Rencontre avec un berger et son troupeau",
        credit: "Wowan1978 · CC BY-SA 4.0",
        source: "https://commons.wikimedia.org/wiki/File:A_shepherd_and_a_flock_of_sheep_on_the_Gegham_Ridge_in_Armenia.jpg",
      },
      {
        src: publicAsset("images/child-rock-climbing.jpg"),
        alt: "Un adulte accompagne une enfant sur un mur d'escalade.",
        label: "Initiation à l'escalade encadrée",
        credit: "U.S. Navy · domaine public",
        source: "https://commons.wikimedia.org/wiki/File:US_Navy_090403-N-9860Y-003_Lt._Cmdr._Brian_Danielson,_assigned_to_Electronic_Attack_Squadron_(VAQ)_129,_gives_his_daughter_pointers_as_she_attempts_to_climb_the_rock_wall_during_Northwest_Outdoor_Adventure_Day.jpg",
      },
    ],
    activities: {
      summer: [
        { title: "Orientation et bivouac léger", details: "Apprendre à lire une carte et à préparer une sortie en appliquant les principes du « ne laisser aucune trace ». Un éventuel bivouac dépend du lieu et de l'encadrement." },
        { title: "À la rencontre d'une estive", details: "Échanger avec un berger, découvrir son métier et le rôle des chiens de protection, en respectant les consignes et les distances autour du troupeau." },
        { title: "Escalade écoresponsable", details: "S'initier à l'escalade avec un encadrement qualifié et respecter les zones de nidification protégées, notamment celles de l'aigle royal." },
      ],
      winter: [
        { title: "Raquettes et orientation hivernale", details: "Explorer la montagne en raquettes, apprendre à s'orienter et découvrir les règles de sécurité adaptées aux conditions du jour." },
        { title: "Observer la faune aux jumelles", details: "Repérer les animaux à distance, sans les approcher ni les effrayer, afin de préserver leur tranquillité pendant l'hiver." },
        { title: "Atelier « Neige et climat »", details: "Comprendre par le jeu l'évolution du manteau neigeux et les effets du réchauffement climatique sur la montagne." },
      ],
    },
  },
  {
    ageGroup: "teen",
    title: "Les Ados",
    ages: "12–14 ans",
    days: 7,
    theme: "Défenseurs de la haute montagne",
    description: "Des défis outdoor et des découvertes naturalistes pour mieux connaître et préserver les milieux d'altitude.",
    illustrations: [
      {
        src: publicAsset("images/alpine-ibex.jpg"),
        alt: "Un groupe de bouquetins évolue sur une crête rocheuse des Alpes.",
        label: "Observer la faune sauvage",
        credit: "SimonaINM · CC BY-SA 4.0",
        source: "https://commons.wikimedia.org/wiki/File:Stambecchi_Indren.jpg",
      },
      {
        src: publicAsset("images/mountain-bike-downhill.jpg"),
        alt: "Un vététiste descend un sentier de montagne.",
        label: "VTT de descente",
        credit: "Stickansol · CC BY-SA 4.0",
        source: "https://commons.wikimedia.org/wiki/File:Mountain_bike_downhill_01.jpg",
      },
      {
        src: publicAsset("images/mountain-trail-cleanup.jpg"),
        alt: "Des bénévoles participent à l'entretien et au nettoyage d'un sentier de montagne.",
        label: "Prendre soin des sentiers",
        credit: "blmcalifornia · domaine public",
        source: "https://commons.wikimedia.org/wiki/File:-NPLD_2016-_Bald_Mountain_Trails_%2B_Clean-up_(29658212980).jpg",
      },
    ],
    activities: {
      summer: [
        { title: "Trek en refuge", details: "Partir sur plusieurs jours avec un encadrement adapté et gérer l'eau, les déchets et l'énergie avec soin dans les milieux fragiles." },
        { title: "Chantier éco-citoyen", details: "Participer, selon les partenariats locaux, à une demi-journée de nettoyage de sentier ou de restauration d'un chemin avec des professionnels du territoire." },
        { title: "VTT de descente ou canyoning doux", details: "Découvrir une activité sportive encadrée et les enjeux de préservation des torrents alpins ; le choix dépend du site et des conditions." },
      ],
      winter: [
        { title: "Initiation au ski de randonnée", details: "Découvrir le ski de randonnée ou une randonnée alpine hivernale avec des professionnels, et aborder la nivologie ainsi que la prévention des risques." },
        { title: "Zones de tranquillité de la faune", details: "Comprendre comment le hors-piste peut déranger le tétras-lyre et les chamois, et apprendre à respecter les zones protégées." },
        { title: "Abri de neige et bivouac nordique", details: "Découvrir la construction d'un abri de neige et la vie dehors en hiver. Une nuit en bivouac n'est envisagée qu'avec un encadrement qualifié et si les conditions le permettent." },
      ],
    },
  },
  {
    ageGroup: "adult",
    title: "Adultes & Confirmés",
    ages: "15 ans et +",
    days: 7,
    theme: "Transition et performance outdoor",
    description: "Une semaine sportive au grand air pour conjuguer progression, sécurité et découverte des enjeux de la montagne.",
    illustrations: [
      {
        src: publicAsset("images/alpine-climbing.jpg"),
        alt: "Un alpiniste progresse sur un terrain glacé en haute montagne.",
        label: "Alpinisme en terrain d'altitude",
        credit: "AmandineM · CC BY 3.0",
        source: "https://commons.wikimedia.org/wiki/File:Alpine_Climbing_Kyrgyzstan.jpg",
      },
      {
        src: publicAsset("images/alpes-hiver.jpg"),
        alt: "Les Alpes suisses sous la neige en hiver.",
        label: "Activités de montagne en hiver",
        credit: "Giles Laurent · CC BY-SA 4.0",
        source: "https://commons.wikimedia.org/wiki/File:Swiss_alps_seen_from_Creux_du_Van_under_the_winter_snow_Photo_by_Giles_Laurent.jpg",
      },
      {
        src: publicAsset("images/alpine-flowers.jpg"),
        alt: "Différentes plantes de haute altitude poussent dans un milieu montagnard.",
        label: "Découvrir la biodiversité d'altitude",
        credit: "Alpsdake · CC0",
        source: "https://commons.wikimedia.org/wiki/File:Montage_of_Shirouma_mountains_alpine_plant_belt.jpg",
      },
    ],
    activities: {
      summer: [
        { title: "Alpinisme ou grande randonnée engagée", details: "Découvrir la haute montagne avec un encadrement qualifié, en approfondissant la connaissance du milieu et la prévention des risques météo." },
        { title: "Cartographie participative de la biodiversité", details: "Contribuer à des observations de la faune et de la flore avec des outils scientifiques adaptés au territoire et au programme." },
        { title: "Rencontre autour de la montagne durable", details: "Échanger avec des guides, écologues ou acteurs locaux sur l'avenir du tourisme et les pratiques outdoor responsables." },
      ],
      winter: [
        { title: "Ski-alpinisme et sécurité", details: "Pratiquer avec des professionnels, aborder le risque nivologique et s'initier à l'utilisation du DVA, de la pelle et de la sonde." },
        { title: "Bivouac d'altitude zéro déchet", details: "Découvrir l'autonomie et la cuisine hivernale avec des produits locaux. Un bivouac n'est envisagé qu'avec un encadrement qualifié et si les conditions le permettent." },
        { title: "Transition des sports d'hiver", details: "Observer les impacts des sports d'hiver et échanger sur les solutions de transition des stations et la préservation des espaces sauvages." },
      ],
    },
  },
];

const ageGroupName: Record<AgeGroup, string> = {
  little: "Les Petits",
  middle: "Les Moyens",
  teen: "Les Ados",
  adult: "Adultes & Confirmés",
};
const seasonName: Record<Season, string> = { summer: "Été", winter: "Hiver" };
const statusName: Record<Enrollment["status"], string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  cancelled: "Annulée",
};

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
} | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Le contexte de session doit être disponible.");
  return context;
}

function safeReturnPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

function minimumBirthDateForAge(startDate: string, age: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const birthYear = year! - age;
  const lastDayOfMonth = new Date(Date.UTC(birthYear, month!, 0)).getUTCDate();
  const birthDay = Math.min(day!, lastDayOfMonth);
  return `${birthYear}-${String(month).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    api<{ user: User | null }>("/api/auth/me")
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch((reason) => setSessionError(reason instanceof Error ? reason.message : "La session n'a pas pu être vérifiée."))
      .finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ user, loading, setUser }}>{children}{sessionError && <p className="camp-inline-error" role="alert">{sessionError}</p>}</AuthContext.Provider>;
}

function Header() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function logout() {
    setError("");
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La déconnexion a échoué.");
    }
  }

  return (
    <header className="camp-header">
      <div className="camp-nav">
        <Link className="camp-brand" to="/" aria-label="Alpes Camp, accueil">
          <span className="camp-brand-mark" aria-hidden="true">▲</span>
          <span>ALPES <b>CAMP</b><small>COLONIES OUTDOOR</small></span>
        </Link>
        <nav aria-label="Navigation principale">
          <Link to="/#programmes">Les séjours</Link>
          {user?.role === "customer" && <Link to="/mes-inscriptions">Mes inscriptions</Link>}
          {user?.role !== "admin" && <Link className="camp-button camp-button-outline" to="/aide-et-contact">Aide et contact</Link>}
        </nav>
        <div className="camp-nav-account">
          {user ? (
            <>
              {user.role === "admin" && <Link className="camp-button camp-button-primary camp-organizer-button" to="/organisateur">Espace organisateur</Link>}
              <span className="camp-user-name">{user.fullName}</span>
              <button className="camp-button camp-button-light" onClick={logout}>Déconnexion</button>
            </>
          ) : (
            <>
              <Link className="camp-nav-login" to="/connexion">Connexion</Link>
              <Link className="camp-button camp-button-light" to="/inscription">Créer un compte</Link>
            </>
          )}
        </div>
      </div>
      {error && <p className="camp-inline-error" role="alert">{error}</p>}
    </header>
  );
}

function PhotoBanner() {
  const photos = [
    {
      src: publicAsset("images/alpes-ete.jpg"),
      alt: "Vue d'une vallée alpine au petit matin pendant l'été.",
      label: "L'été dans les Alpes",
      credit: "Sternenjaeger · CC0",
      source: "https://commons.wikimedia.org/wiki/File:Summer_morning_in_the_Swiss_Alps.jpg",
    },
    {
      src: publicAsset("images/alpes-hiver.jpg"),
      alt: "Les Alpes suisses sous la neige en hiver.",
      label: "L'hiver en montagne",
      credit: "Giles Laurent · CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Swiss_alps_seen_from_Creux_du_Van_under_the_winter_snow_Photo_by_Giles_Laurent.jpg",
    },
    {
      src: publicAsset("images/enfants-randonnee-alpes.jpg"),
      alt: "Deux enfants font une pause pendant une randonnée dans les Alpes.",
      label: "Petits randonneurs, grands souvenirs",
      credit: "SWT666 · CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Two_kids_resting_during_a_hike_on_the_Alps.jpg",
    },
    {
      src: publicAsset("images/enfants-jeux-exterieur.jpg"),
      alt: "Deux enfants jouent au football en plein air.",
      label: "Un match improvisé en extérieur",
      credit: "Cecil Dzwowa · CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Children_playing_football_in_street.jpg",
    },
  ];
  const [activePhoto, setActivePhoto] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(preference.matches);
    const updatePreference = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => setActivePhoto((index) => (index + 1) % photos.length), 5500);
    return () => window.clearInterval(timer);
  }, [photos.length, paused, reducedMotion]);

  return (
    <section className="camp-photo-banner" aria-label="Photos des séjours Alpes Camp" aria-roledescription="carrousel">
      {photos.map((photo, index) => (
        <figure
          className={`camp-photo-slide${index === activePhoto ? " is-active" : ""}`}
          key={photo.src}
          aria-hidden={index !== activePhoto}
          aria-roledescription="diapositive"
          aria-label={`${index + 1} sur ${photos.length} : ${photo.label}`}
        >
          <img src={photo.src} alt={photo.alt} />
          <figcaption>
            <span>{photo.label}</span>
            <a href={photo.source} target="_blank" rel="noreferrer" tabIndex={index === activePhoto ? 0 : -1}>
              Photo : {photo.credit} · Wikimedia Commons
            </a>
          </figcaption>
        </figure>
      ))}
      <div className="camp-photo-controls" aria-label="Choisir une photo">
        <button type="button" className="camp-photo-step" aria-label="Photo précédente" onClick={() => setActivePhoto((index) => (index + photos.length - 1) % photos.length)}>←</button>
        {photos.map((photo, index) => (
          <button
            type="button"
            key={photo.src}
            className={index === activePhoto ? "is-active" : ""}
            aria-label={`Afficher la photo ${index + 1} : ${photo.label}`}
            aria-pressed={index === activePhoto}
            onClick={() => setActivePhoto(index)}
          />
        ))}
        <button type="button" className="camp-photo-step" aria-label="Photo suivante" onClick={() => setActivePhoto((index) => (index + 1) % photos.length)}>→</button>
        <button
          type="button"
          className="camp-photo-pause"
          onClick={() => setPaused((current) => !current)}
          aria-label={paused ? "Reprendre le défilement" : "Mettre en pause le défilement"}
        >
          {paused ? "Reprendre" : "Pause"}
        </button>
      </div>
    </section>
  );
}

function HomePage() {
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ageFilter, setAgeFilter] = useState<AgeGroup | "all">("all");

  useEffect(() => {
    const refresh = () => {
      api<{ sessions: CampSession[] }>("/api/camp-sessions")
        .then(({ sessions: availableSessions }) => {
          setSessions(availableSessions);
          setError("");
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Les départs n'ont pas pu être chargés."))
        .finally(() => setLoading(false));
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredSessions = useMemo(
    () => sessions.filter((session) => ageFilter === "all" || session.ageGroup === ageFilter),
    [sessions, ageFilter],
  );

  return (
    <main>
      <section className="camp-hero">
        <div className="camp-hero-copy">
          <span className="camp-eyebrow">COLONIES DE SPORT OUTDOOR · ALPES</span>
          <h1>Le grand air.<br /><em>La joie d'être ensemble.</em></h1>
          <p>Des séjours sportifs été et hiver, pensés par âge pour découvrir les Alpes et vivre une aventure en équipe.</p>
          <a className="camp-button camp-button-primary" href="#programmes">Découvrir les séjours <span aria-hidden="true">↓</span></a>
          <div className="camp-hero-points">
            <span>4 groupes d'âge</span><span>Des dates publiées par l'organisateur</span>
          </div>
        </div>
        <div className="camp-hero-aside">
          <div className="camp-hero-card">
            <span className="camp-mountain" aria-hidden="true">⌁</span>
            <strong>Les Alpes, terrain de jeu grandeur nature.</strong>
            <span>Activités et lieu détaillés au moment de la publication des départs.</span>
          </div>
        </div>
      </section>
      <PhotoBanner />

      <section className="camp-programs camp-container" id="programmes">
        <div className="camp-section-heading">
          <div>
            <span className="camp-eyebrow">À CHACUN SON AVENTURE</span>
            <h2>Choisir son séjour</h2>
          </div>
          <p>Les âges sont des repères. Une situation particulière ?<br />L'équipe pourra en discuter avec vous.</p>
        </div>
        <div className="camp-season-grid">
          {seasonSections.map(({ season, title }) => {
            const seasonSessions = filteredSessions.filter((session) => session.season === season);
            return (
              <section className={`camp-season-section camp-season-${season}`} key={season} aria-labelledby={`camp-season-${season}`}>
                <header className="camp-season-heading">
                  <span className="camp-eyebrow">{season === "winter" ? "DÉCEMBRE À MARS" : "MAI À SEPTEMBRE"}</span>
                  <h3 id={`camp-season-${season}`}>{title}</h3>
                </header>
                <div className="camp-program-grid">
                  {programs.filter((program) => ageFilter === "all" || program.ageGroup === ageFilter).map((program, index) => {
                    const programSessions = seasonSessions.filter((session) => session.ageGroup === program.ageGroup);
                    return (
                      <article className={`camp-program-card camp-tone-${index + 1}`} key={program.ageGroup}>
                        <span className="camp-program-number">0{index + 1}</span>
                        <span className="camp-program-days">{program.days} jours</span>
                        <h4>{program.title}</h4>
                        <p className="camp-program-ages">{program.ages} · âge recommandé</p>
                        <p>{program.description}</p>
                        <details className="camp-departure-menu">
                          <summary>{programSessions.length ? `Voir les créneaux (${programSessions.length})` : "Aucun créneau disponible"}</summary>
                          <div className="camp-departures">
                            {programSessions.map((session) => (
                              <div className="camp-departure" key={session.id}>
                                <div>
                                  <strong>{session.title}</strong>
                                  <span>{formatDate(session.startDate)} au {formatDate(session.endDate)}</span>
                                  <span>{session.remainingPlaces} place(s) restante(s)</span>
                                </div>
                                {session.remainingPlaces > 0
                                  ? <Link to={`/colonies/${session.id}/inscription`}>Réserver</Link>
                                  : <span className="camp-full-label">Complet</span>}
                              </div>
                            ))}
                            {!loading && !error && !programSessions.length && <span className="camp-no-departure">Aucun départ publié pour le moment</span>}
                          </div>
                        </details>
                        <Link className="camp-program-discover" to={`/sejours/${program.ageGroup}`} aria-label={`Découvrir le séjour ${program.title}`}>Découvrir les activités <span aria-hidden="true">→</span></Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <div className="camp-filters" aria-label="Filtres des départs">
          <label>
            <span>Groupe</span>
            <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as AgeGroup | "all")}>
              <option value="all">Tous les groupes</option>
              {programs.map((program) => <option key={program.ageGroup} value={program.ageGroup}>{program.title}</option>)}
            </select>
          </label>
          <p role="status">{loading ? "Chargement des départs…" : error || `${filteredSessions.length} créneau(x) disponible(s)`}</p>
        </div>
        <p className="camp-freshness">Les places restantes sont actualisées toutes les 15 secondes et toujours revérifiées au moment de l'inscription.</p>
      </section>
      <section className="camp-booking-note">
        <div className="camp-container camp-booking-note-inner">
          <span aria-hidden="true">✳</span>
          <div><h2>Une inscription, en toute confiance</h2><p>Connectez-vous pour inscrire un ou plusieurs participants. Les demandes restent en attente jusqu'à leur validation par l'organisateur ; elles bloquent les places pendant ce temps.</p></div>
          <Link className="camp-button camp-button-outline" to="/inscription">Créer un compte</Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function ProgramPage() {
  const { ageGroup: ageGroupParam = "" } = useParams();
  const { user } = useAuth();
  const program = programs.find((item) => item.ageGroup === ageGroupParam);
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      api<{ sessions: CampSession[] }>("/api/camp-sessions")
        .then(({ sessions: availableSessions }) => {
          setSessions(availableSessions);
          setError("");
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Les disponibilités n'ont pas pu être chargées."))
        .finally(() => setLoading(false));
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!program) {
    return <main className="camp-container camp-empty"><h1>Séjour introuvable</h1><Link to="/">Retour aux séjours</Link></main>;
  }

  const departures = sessions.filter((session) => session.ageGroup === program.ageGroup);

  return (
    <main className="camp-container camp-program-page">
      <Link className="camp-back-link" to="/#programmes">← Tous les séjours</Link>
      <header className="camp-program-detail-header">
        <span className="camp-eyebrow">{program.ages} · {program.days} jours</span>
        <h1>{program.title}</h1>
        <p className="camp-program-theme">« {program.theme} »</p>
        <p>{program.description}</p>
      </header>

      <div className="camp-program-detail-layout">
        <section className="camp-activity-section" aria-labelledby="camp-activities-title">
          <span className="camp-eyebrow">DÉCOUVRIR LE PROGRAMME</span>
          <h2 id="camp-activities-title">Activités outdoor & nature</h2>
          <div className="camp-activity-gallery" aria-label={`Photos illustrant les activités du séjour ${program.title}`}>
            {program.illustrations.map((illustration) => (
              <figure className="camp-activity-photo" key={illustration.src}>
                <img src={illustration.src} alt={illustration.alt} loading="lazy" decoding="async" />
                <figcaption>
                  <span>{illustration.label}</span>
                  <a href={illustration.source} target="_blank" rel="noreferrer">
                    Photo : {illustration.credit} · Wikimedia Commons
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="camp-season-activity-list">
            {seasonSections.map(({ season, title }) => (
              <section className={`camp-season-activities camp-season-activities-${season}`} key={season} aria-labelledby={`camp-activities-${season}`}>
                <h3 id={`camp-activities-${season}`}>{season === "summer" ? "☀️" : "❄️"} {title}</h3>
                <div className="camp-activity-list">
                  {program.activities[season].map((activity, index) => (
                    <article className="camp-activity-card" key={activity.title}>
                      <span className="camp-activity-number">0{index + 1}</span>
                      <div><h4>{activity.title}</h4><p>{activity.details}</p></div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <p className="camp-program-disclaimer">
            Ces activités sont des idées de programme et ne sont pas garanties. Les sorties techniques, bivouacs et activités avec des mineurs nécessitent un encadrement qualifié ; toute activité peut être adaptée selon la météo, la sécurité, le lieu et les autorisations.
          </p>
        </section>

        <aside className="camp-program-booking" aria-labelledby="camp-booking-title">
          <span className="camp-eyebrow">INSCRIPTIONS</span>
          <h2 id="camp-booking-title">Réserver ce séjour</h2>
          {loading && <p role="status">Chargement des créneaux disponibles…</p>}
          {error && <p className="camp-form-error" role="alert">{error}</p>}
          {!loading && !error && departures.length === 0 && <p className="camp-no-departure">Aucun départ ouvert à l'inscription pour le moment.</p>}
          <div className="camp-program-departures">
            {seasonSections.map(({ season, title }) => {
              const seasonDepartures = departures.filter((session) => session.season === season);
              if (!seasonDepartures.length) return null;
              return (
                <details className="camp-program-season-menu" key={season}>
                  <summary>{title} · {seasonDepartures.length} créneau(x)</summary>
                  <div className="camp-program-season-list">
                    {seasonDepartures.map((session) => (
                      <article className="camp-program-departure" key={session.id}>
                        <div>
                          <h3>{session.title}</h3>
                          <p>{formatDate(session.startDate)} – {formatDate(session.endDate)} · {session.durationDays} jours</p>
                          <strong className={session.remainingPlaces === 0 ? "camp-full-label" : ""}>
                            {session.remainingPlaces} place(s) restante(s)
                          </strong>
                          {session.description && <p>{session.description}</p>}
                          {session.activities && <p>Activités prévues : {session.activities}</p>}
                        </div>
                        {session.remainingPlaces > 0
                          ? <Link className="camp-button camp-button-primary" to={`/colonies/${session.id}/inscription`}>Réserver</Link>
                          : <span className="camp-full-label">Complet</span>}
                      </article>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
          {user?.role === "admin" && <Link className="camp-program-admin-link" to="/organisateur">Gérer les départs et inscriptions</Link>}
          <p className="camp-program-login-note">La connexion est demandée avant de finaliser une réservation. Une demande reste en attente jusqu'à sa validation par l'organisateur.</p>
        </aside>
      </div>
      <Footer />
    </main>
  );
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, setUser, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeReturnPath(searchParams.get("retour"), "/mes-inscriptions");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingPage />;
  if (user) return <Navigate to={redirect} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = Object.fromEntries(form.entries());
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const result = await api<{ user: User }>(path, { method: "POST", body: JSON.stringify(body) });
      setUser(result.user);
      navigate(redirect, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La connexion n'a pas abouti.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="camp-auth-page">
      <section className="camp-auth-card">
        <span className="camp-eyebrow">{mode === "login" ? "HEUREUX DE VOUS REVOIR" : "VOTRE PROCHAINE AVENTURE"}</span>
        <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        <p>{mode === "login" ? "Connectez-vous pour poursuivre l'inscription." : "Créez un compte parent ou participant pour réserver."}</p>
        {demoMode && <p className="camp-demo-notice" role="note">Site de démonstration : utilise uniquement des informations fictives, y compris pour ton adresse e-mail et ton mot de passe.</p>}
        <form className="camp-form" onSubmit={submit}>
          {mode === "register" && <label>Nom complet<input name="fullName" autoComplete="name" required minLength={2} maxLength={120} /></label>}
          <label>Adresse e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label>Mot de passe<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={200} /></label>
          {error && <p className="camp-form-error" role="alert">{error}</p>}
          <button className="camp-button camp-button-primary camp-button-wide" disabled={busy}>{busy ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
        </form>
        <p className="camp-auth-switch">
          {mode === "login" ? <>Pas encore de compte ? <Link to={`/inscription?retour=${encodeURIComponent(redirect)}`}>Créer un compte</Link></> : <>Déjà inscrit ? <Link to={`/connexion?retour=${encodeURIComponent(redirect)}`}>Se connecter</Link></>}
        </p>
        {mode === "login" && <p className="camp-auth-private">Merci de contacter l'organisateur pour tout oubli de mot de passe.</p>}
        <p className="camp-auth-private">Les comptes clients sont créés ici. L'accès organisateur n'est pas ouvert à l'inscription publique.</p>
      </section>
      <Footer />
    </main>
  );
}

const emptyParticipant = (): Participant => ({
  firstName: "",
  lastName: "",
  birthDate: "",
  dietaryRestrictions: "",
  medicalInstructions: "",
  specialRequests: "",
});

function EnrollmentPage() {
  const { id = "" } = useParams();
  const { user, setUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([emptyParticipant()]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ sessions: CampSession[] }>("/api/camp-sessions")
      .then(({ sessions: availableSessions }) => setSessions(availableSessions))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Le départ n'a pas pu être chargé."))
      .finally(() => setLoading(false));
  }, []);

  const campSession = sessions.find((session) => session.id === id);
  if (authLoading || loading) return <LoadingPage />;
  if (!user) return <Navigate to={`/connexion?retour=${encodeURIComponent(`/colonies/${id}/inscription`)}`} replace />;
  if (user.role !== "customer") return <Navigate to="/organisateur" replace />;
  if (!campSession) {
    return <main className="camp-container camp-empty"><h1>Départ introuvable</h1><p>{error || "Ce départ n'est plus disponible à l'inscription."}</p><Link className="camp-button camp-button-primary" to="/">Retour aux séjours</Link></main>;
  }

  function updateParticipant(index: number, field: keyof Participant, value: string) {
    setParticipants((current) => current.map((participant, participantIndex) =>
      participantIndex === index ? { ...participant, [field]: value } : participant));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minimumBirthDate = minimumBirthDateForAge(campSession!.startDate, 5);
    if (participants.some((participant) => participant.birthDate > minimumBirthDate)) {
      setError("Chaque participant doit avoir au moins 5 ans au début du séjour.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/camp-sessions/${id}/enrollments`, {
        method: "POST",
        body: JSON.stringify({ healthDataConsent: consent, participants }),
      });
      navigate("/mes-inscriptions?envoyee=oui");
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 401) {
        setUser(null);
        navigate(`/connexion?retour=${encodeURIComponent(`/colonies/${id}/inscription`)}`, { replace: true });
        return;
      }
      setError(reason instanceof Error ? reason.message : "L'inscription n'a pas pu être envoyée.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="camp-container camp-enroll-page">
      <Link className="camp-back-link" to="/">← Retour aux séjours</Link>
      <div className="camp-form-layout">
        <section>
          <span className="camp-eyebrow">DEMANDE D'INSCRIPTION</span>
          <h1>{campSession.title}</h1>
          <p className="camp-enroll-summary">{seasonName[campSession.season]} · {ageGroupName[campSession.ageGroup]} · {formatDate(campSession.startDate)} au {formatDate(campSession.endDate)} · {campSession.durationDays} jours</p>
          <p>Il reste <strong>{campSession.remainingPlaces} place(s)</strong>. Une demande en attente bloque les places jusqu'à son traitement par l'organisateur.</p>
          {demoMode && <p className="camp-demo-notice" role="note">Site de démonstration : utilise uniquement des informations fictives. Les données saisies ne sont pas chiffrées.</p>}
          <form className="camp-form camp-enrollment-form" onSubmit={submit}>
            {participants.map((participant, index) => (
              <fieldset className="camp-participant" key={index}>
                <legend>Participant {index + 1}</legend>
                {participants.length > 1 && <button className="camp-remove-participant" type="button" onClick={() => setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index))}>Retirer</button>}
                <div className="camp-input-grid">
                  <label>Prénom<input required maxLength={80} value={participant.firstName} onChange={(event) => updateParticipant(index, "firstName", event.target.value)} /></label>
                  <label>Nom<input required maxLength={80} value={participant.lastName} onChange={(event) => updateParticipant(index, "lastName", event.target.value)} /></label>
                  <label>Date de naissance<input type="date" required max={minimumBirthDateForAge(campSession.startDate, 5)} value={participant.birthDate} onChange={(event) => updateParticipant(index, "birthDate", event.target.value)} /></label>
                </div>
                <label>Allergies ou restrictions alimentaires<textarea maxLength={2000} value={participant.dietaryRestrictions} onChange={(event) => updateParticipant(index, "dietaryRestrictions", event.target.value)} /></label>
                <label>Consignes de santé ou traitement utile à l'encadrement<textarea maxLength={2000} value={participant.medicalInstructions} onChange={(event) => updateParticipant(index, "medicalInstructions", event.target.value)} /></label>
                <label>Fratrie, demande particulière ou échange sur l'âge recommandé<textarea maxLength={2000} value={participant.specialRequests} onChange={(event) => updateParticipant(index, "specialRequests", event.target.value)} /></label>
              </fieldset>
            ))}
            {participants.length < Math.min(campSession.remainingPlaces, 20) && (
              <button className="camp-button camp-button-outline camp-add-participant" type="button" onClick={() => setParticipants((current) => [...current, emptyParticipant()])}>+ Ajouter un participant</button>
            )}
            <label className="camp-consent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
              <span>{demoMode
                ? "Je confirme utiliser uniquement des informations fictives pour cette démonstration."
                : "Je confirme être autorisé(e) à communiquer ces informations et consens au traitement des informations de santé nécessaires à l'accueil des participants. Elles sont chiffrées et accessibles uniquement à mon compte et à l'organisateur. La politique de conservation reste à définir avant toute mise en production."}</span>
            </label>
            {error && <p className="camp-form-error" role="alert">{error}</p>}
            <button className="camp-button camp-button-primary camp-button-wide" disabled={busy || campSession.remainingPlaces === 0}>{busy ? "Envoi en cours…" : "Envoyer la demande d'inscription"}</button>
          </form>
        </section>
        <aside className="camp-enroll-aside">
          <span className="camp-eyebrow">À RETENIR</span>
          <h2>Votre demande sera en attente.</h2>
          <p>Les places sont bloquées pendant le traitement. L'organisateur vous informera de la confirmation ou du refus.</p>
          <p>Chaque participant doit avoir au moins 5 ans au début du séjour. L'âge recommandé reste indicatif ; une demande hors tranche sera signalée à l'organisateur.</p>
          <p><strong>Aucun paiement n'est demandé en ligne.</strong></p>
        </aside>
      </div>
      <Footer />
    </main>
  );
}

function EnrollmentCard({ enrollment, admin = false, onUpdate, onRequestCancel, onSaveNote, onNoteChange, noteSaving = false }: {
  enrollment: Enrollment;
  admin?: boolean;
  onUpdate?: (id: string, status: "confirmed" | "cancelled") => void;
  onRequestCancel?: (enrollment: Enrollment) => void;
  onSaveNote?: (id: string) => void;
  onNoteChange?: (id: string, note: string) => void;
  noteSaving?: boolean;
}) {
  return (
    <article className="camp-enrollment-card">
      <div className="camp-enrollment-card-head">
        <div><span className="camp-eyebrow">{seasonName[enrollment.session.season]} · {ageGroupName[enrollment.session.ageGroup]}</span><h2>{enrollment.session.title}</h2></div>
        <span className={`camp-status camp-status-${enrollment.status}`}>{statusName[enrollment.status]}</span>
      </div>
      <p>{formatDate(enrollment.session.startDate)} – {formatDate(enrollment.session.endDate)} · {enrollment.participants.length} participant(s)</p>
      {admin && enrollment.customer && <p className="camp-customer-line">{enrollment.customer.name} · <a href={`mailto:${enrollment.customer.email}`}>{enrollment.customer.email}</a></p>}
      <div className="camp-participant-list">
        {enrollment.participants.map((participant) => (
          <section className="camp-participant-summary" key={participant.id}>
            <h3>{participant.firstName} {participant.lastName} <span>{formatDate(participant.birthDate)}</span></h3>
            {!participant.matchesRecommendedAge && <p className="camp-age-alert">Âge hors tranche recommandée — à discuter avec la famille.</p>}
            {participant.dietaryRestrictions && <p><b>Alimentation :</b> {participant.dietaryRestrictions}</p>}
            {participant.medicalInstructions && <p><b>Consignes de santé :</b> {participant.medicalInstructions}</p>}
            {participant.specialRequests && <p><b>Demande particulière :</b> {participant.specialRequests}</p>}
          </section>
        ))}
      </div>
      {enrollment.adminNote && <p className="camp-admin-note"><b>Note de l'organisateur :</b> {enrollment.adminNote}</p>}
      {enrollment.cancellationReason && <p className="camp-cancellation-reason"><b>Motif d'annulation :</b> {enrollment.cancellationReason}</p>}
      {admin && (
        <form className="camp-form camp-internal-note-form" onSubmit={(event) => {
          event.preventDefault();
          onSaveNote?.(enrollment.id);
        }}>
          <label htmlFor={`internal-note-${enrollment.id}`}>Note interne (visible uniquement par l'organisateur)</label>
          <textarea
            id={`internal-note-${enrollment.id}`}
            maxLength={1000}
            value={enrollment.internalNote ?? ""}
            onChange={(event) => onNoteChange?.(enrollment.id, event.target.value)}
          />
          <button className="camp-button camp-button-light" type="submit" disabled={noteSaving}>
            {noteSaving ? "Enregistrement…" : "Enregistrer la note interne"}
          </button>
        </form>
      )}
      {!admin && enrollment.status !== "cancelled" && onRequestCancel && (
        <div className="camp-admin-actions">
          <button className="camp-button camp-button-outline" onClick={() => onRequestCancel(enrollment)}>Annuler ma réservation</button>
        </div>
      )}
      {admin && enrollment.status === "pending" && onUpdate && (
        <div className="camp-admin-actions">
          <button className="camp-button camp-button-primary" onClick={() => onUpdate(enrollment.id, "confirmed")}>Confirmer</button>
          <button className="camp-button camp-button-outline" onClick={() => onUpdate(enrollment.id, "cancelled")}>Annuler</button>
        </div>
      )}
    </article>
  );
}

function CustomerPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancellationTarget, setCancellationTarget] = useState<Enrollment | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [cancellationError, setCancellationError] = useState("");

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      api<{ enrollments: Enrollment[] }>("/api/camp-enrollments/mine")
        .then(({ enrollments: items }) => {
          setEnrollments(items);
          setError("");
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Les inscriptions n'ont pas pu être chargées."))
        .finally(() => setLoading(false));
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, [user]);

  async function cancelEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancellationTarget) return;
    setCancellationBusy(true);
    setCancellationError("");
    try {
      const { enrollment: cancelled } = await api<{
        enrollment: { id: string; status: "cancelled"; cancellationReason: string };
      }>(`/api/camp-enrollments/${cancellationTarget.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancellationReason }),
      });
      setEnrollments((current) => current.map((enrollment) => enrollment.id === cancelled.id
        ? { ...enrollment, status: cancelled.status, cancellationReason: cancelled.cancellationReason }
        : enrollment));
      setCancellationTarget(null);
      setCancellationReason("");
      setNotice("Votre réservation a été annulée. Le motif a été transmis à l'organisateur.");
    } catch (reason) {
      setCancellationError(reason instanceof Error ? reason.message : "La réservation n'a pas pu être annulée.");
    } finally {
      setCancellationBusy(false);
    }
  }

  if (authLoading) return <LoadingPage />;
  if (!user) return <Navigate to={`/connexion?retour=${encodeURIComponent("/mes-inscriptions")}`} replace />;
  if (user.role === "admin") return <Navigate to="/organisateur" replace />;

  return (
    <main className="camp-container camp-account-page">
      <span className="camp-eyebrow">ESPACE FAMILLE</span>
      <h1>Mes inscriptions</h1>
      {searchParams.get("envoyee") && <p className="camp-success" role="status">Votre demande a bien été envoyée. Elle est en attente de traitement.</p>}
      {notice && <p className="camp-success" role="status">{notice}</p>}
      {loading && <p role="status">Chargement de vos inscriptions…</p>}
      {error && <p className="camp-form-error" role="alert">{error}</p>}
      {!loading && !error && !enrollments.length && <div className="camp-empty"><p>Vous n'avez pas encore d'inscription.</p><Link className="camp-button camp-button-primary" to="/">Découvrir les séjours</Link></div>}
      <div className="camp-enrollment-list">{enrollments.map((enrollment) => (
        <EnrollmentCard key={enrollment.id} enrollment={enrollment} onRequestCancel={(target) => {
          setCancellationTarget(target);
          setCancellationReason("");
          setCancellationError("");
        }} />
      ))}</div>
      {cancellationTarget && (
        <div className="camp-dialog-backdrop">
          <section className="camp-cancellation-dialog" role="dialog" aria-modal="true" aria-labelledby="camp-cancellation-title">
            <h2 id="camp-cancellation-title">Annuler ma réservation</h2>
            <p>Indiquez à l'organisateur la raison de l'annulation de votre séjour.</p>
            <form className="camp-form" onSubmit={cancelEnrollment}>
              <label htmlFor="camp-cancellation-reason">Motif de l'annulation</label>
              <textarea
                id="camp-cancellation-reason"
                required
                maxLength={1000}
                value={cancellationReason}
                onChange={(event) => setCancellationReason(event.target.value)}
                autoFocus
              />
              {cancellationError && <p className="camp-form-error" role="alert">{cancellationError}</p>}
              <div className="camp-admin-actions">
                <button className="camp-button camp-button-outline" type="button" disabled={cancellationBusy} onClick={() => setCancellationTarget(null)}>Retour</button>
                <button className="camp-button camp-button-primary" type="submit" disabled={cancellationBusy}>{cancellationBusy ? "Annulation…" : "Confirmer l'annulation"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      <Footer />
    </main>
  );
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [contactConversations, setContactConversations] = useState<ContactConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [enrollmentSearch, setEnrollmentSearch] = useState("");
  const [enrollmentSessionFilter, setEnrollmentSessionFilter] = useState("all");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState("all");
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);

  async function reload() {
    const [sessionResult, enrollmentResult, messageResult] = await Promise.all([
      api<{ sessions: CampSession[] }>("/api/admin/camp-sessions"),
      api<{ enrollments: Enrollment[] }>("/api/admin/camp-enrollments"),
      api<{ conversations: ContactConversation[] }>("/api/admin/contact-messages"),
    ]);
    setSessions(sessionResult.sessions);
    setEnrollments(enrollmentResult.enrollments);
    setContactConversations(messageResult.conversations);
    setError("");
  }

  useEffect(() => {
    if (user?.role !== "admin") return;
    const refresh = () => {
      reload()
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Les données n'ont pas pu être chargées."))
        .finally(() => setLoading(false));
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, [user]);

  if (authLoading) return <LoadingPage />;
  if (!user) return <Navigate to={`/connexion?retour=${encodeURIComponent("/organisateur")}`} replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  const normalizedSearch = enrollmentSearch.trim().toLocaleLowerCase("fr");
  const filteredEnrollments = enrollments.filter((enrollment) => {
    if (enrollmentSessionFilter !== "all" && enrollment.session.id !== enrollmentSessionFilter) return false;
    if (enrollmentStatusFilter !== "all" && enrollment.status !== enrollmentStatusFilter) return false;
    if (!normalizedSearch) return true;
    const searchable = [
      enrollment.customer?.name,
      enrollment.customer?.email,
      enrollment.session.title,
      ...enrollment.participants.flatMap((participant) => [participant.firstName, participant.lastName]),
    ].join(" ").toLocaleLowerCase("fr");
    return searchable.includes(normalizedSearch);
  });

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = Object.fromEntries(form.entries());
    body.registrationOpen = form.get("registrationOpen") === "on" ? "true" : "false";
    try {
      await api("/api/admin/camp-sessions", {
        method: "POST",
        body: JSON.stringify({
          ...body,
          registrationOpen: body.registrationOpen === "true",
        }),
      });
      formElement.reset();
      await reload();
      setNotice("Le départ a été créé.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le départ n'a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  }

  async function updateEnrollment(id: string, status: "confirmed" | "cancelled") {
    setError("");
    try {
      await api(`/api/admin/camp-enrollments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L'inscription n'a pas pu être traitée.");
    }
  }

  async function toggleRegistration(session: CampSession) {
    setError("");
    try {
      await api(`/api/admin/camp-sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ registrationOpen: !session.registrationOpen }),
      });
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le départ n'a pas pu être modifié.");
    }
  }

  async function saveSession(event: FormEvent<HTMLFormElement>, session: CampSession) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const updates: Record<string, string | boolean> = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      activities: String(form.get("activities") ?? ""),
      registrationOpen: form.get("registrationOpen") === "on",
    };
    if (!session.hasEnrollments) {
      updates.season = String(form.get("season") ?? "");
      updates.ageGroup = String(form.get("ageGroup") ?? "");
      updates.startDate = String(form.get("startDate") ?? "");
    }
    try {
      await api(`/api/admin/camp-sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setEditingSessionId(null);
      await reload();
      setNotice("Le départ a été mis à jour.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le départ n'a pas pu être modifié.");
    }
  }

  function updateInternalNote(id: string, value: string) {
    setEnrollments((current) => current.map((enrollment) => enrollment.id === id
      ? { ...enrollment, internalNote: value }
      : enrollment));
  }

  async function saveInternalNote(id: string) {
    const enrollment = enrollments.find((item) => item.id === id);
    if (!enrollment) return;
    setNoteSavingId(id);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/camp-enrollments/${id}/note`, {
        method: "PATCH",
        body: JSON.stringify({ internalNote: enrollment.internalNote ?? "" }),
      });
      setNotice("La note interne a été enregistrée.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La note interne n'a pas pu être enregistrée.");
    } finally {
      setNoteSavingId(null);
    }
  }

  async function deleteSession(session: CampSession) {
    if (!window.confirm(`Supprimer le départ « ${session.title} » ?`)) return;
    setError("");
    try {
      await api(`/api/admin/camp-sessions/${session.id}`, { method: "DELETE" });
      await reload();
      setNotice("Le départ a été supprimé.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le départ n'a pas pu être supprimé.");
    }
  }

  async function updateConversationReadState(conversation: ContactConversation) {
    setError("");
    try {
      await api(`/api/admin/contact-messages/${conversation.id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ isRead: !conversation.isRead }),
      });
      setContactConversations((current) => current.map((item) => item.id === conversation.id
        ? { ...item, isRead: !conversation.isRead }
        : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L'état de lecture n'a pas pu être modifié.");
    }
  }

  async function sendOrganizerReply(event: FormEvent<HTMLFormElement>, conversation: ContactConversation) {
    event.preventDefault();
    const message = replyDrafts[conversation.id] ?? "";
    setReplyBusyId(conversation.id);
    setError("");
    try {
      const { message: reply } = await api<{ message: ContactMessage }>(
        `/api/admin/contact-messages/${conversation.id}/replies`,
        { method: "POST", body: JSON.stringify({ message }) },
      );
      setContactConversations((current) => current.map((item) => item.id === conversation.id
        ? { ...item, isRead: true, messages: [...item.messages, reply] }
        : item));
      setReplyDrafts((current) => ({ ...current, [conversation.id]: "" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "La réponse n'a pas pu être envoyée.");
    } finally {
      setReplyBusyId(null);
    }
  }

  function exportEnrollments() {
    const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ["Séjour", "Groupe", "Saison", "Début", "Fin", "Statut", "Client", "E-mail", "Participants"],
      ...filteredEnrollments.map((enrollment) => [
        enrollment.session.title,
        ageGroupName[enrollment.session.ageGroup],
        seasonName[enrollment.session.season],
        enrollment.session.startDate,
        enrollment.session.endDate,
        statusName[enrollment.status],
        enrollment.customer?.name ?? "",
        enrollment.customer?.email ?? "",
        enrollment.participants.map((participant) => `${participant.firstName} ${participant.lastName}`).join(", "),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inscriptions-alpes-camp-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="camp-container camp-admin-page">
      <span className="camp-eyebrow">ESPACE ORGANISATEUR</span>
      <h1>Gérer les séjours</h1>
      <p>Les départs sont configurés ici. La jauge de chaque séjour est fixée à 20 participants.</p>
      {error && <p className="camp-form-error" role="alert">{error}</p>}
      {notice && <p className="camp-success" role="status">{notice}</p>}
      <section className="camp-admin-section">
        <h2>Créer un départ</h2>
        <form className="camp-form camp-session-form" onSubmit={createSession}>
          <label>Titre du départ<input name="title" required minLength={2} maxLength={160} placeholder="Ex. Séjour d'été dans les Alpes" /></label>
          <div className="camp-input-grid">
            <label>Saison<select name="season" defaultValue="summer"><option value="summer">Été</option><option value="winter">Hiver</option></select></label>
            <label>Groupe d'âge<select name="ageGroup" defaultValue="little">{programs.map((program) => <option key={program.ageGroup} value={program.ageGroup}>{program.title} — {program.ages}</option>)}</select></label>
            <label>Date de début<input name="startDate" type="date" required /></label>
          </div>
          <label>Description<textarea name="description" maxLength={3000} /></label>
          <label>Activités prévues<textarea name="activities" maxLength={3000} placeholder="Décris les activités confirmées pour ce départ." /></label>
          <p className="camp-form-hint">La durée est calculée automatiquement : 4 jours pour Les Petits, 7 jours pour les autres groupes. La date de fin est incluse.</p>
          <label className="camp-consent"><input name="registrationOpen" type="checkbox" /><span>Ouvrir les inscriptions dès la création</span></label>
          <button className="camp-button camp-button-primary" disabled={busy}>{busy ? "Création…" : "Créer le départ"}</button>
        </form>
      </section>
      <section className="camp-admin-section">
        <h2>Départs configurés</h2>
        {loading && <p role="status">Chargement…</p>}
        {!loading && !sessions.length && <p>Aucun départ créé pour le moment.</p>}
        <div className="camp-session-admin-seasons">
          {seasonSections.map(({ season, title }) => {
            const seasonalSessions = sessions.filter((session) => session.season === season);
            if (!seasonalSessions.length) return null;
            return (
              <section className="camp-session-season" key={season}>
                <h3>{season === "summer" ? "☀️" : "❄️"} {title}</h3>
                <div className="camp-session-admin-groups">
                  {programs.map((program) => {
                    const groupSessions = seasonalSessions.filter((session) => session.ageGroup === program.ageGroup);
                    if (!groupSessions.length) return null;
                    return (
                      <details className="camp-session-season-group" key={program.ageGroup}>
                        <summary>{program.title} · {groupSessions.length} départ(s)</summary>
                        <div className="camp-session-admin-list">
                          {groupSessions.map((session) => (
            <article className="camp-session-admin-card" key={session.id}>
              <div className="camp-session-admin-heading">
                <span className="camp-eyebrow">{seasonName[session.season]} · {ageGroupName[session.ageGroup]}</span>
                <h3>{session.title}</h3>
                <p>{formatDate(session.startDate)} – {formatDate(session.endDate)} · {session.durationDays} jours · {session.remainingPlaces}/20 place(s) restante(s)</p>
                {session.activities && <p>Activités : {session.activities}</p>}
              </div>
              <div className="camp-session-admin-actions">
                <button className="camp-button camp-button-outline" onClick={() => toggleRegistration(session)}>{session.registrationOpen ? "Fermer les inscriptions" : "Ouvrir les inscriptions"}</button>
                <button className="camp-button camp-button-light" onClick={() => setEditingSessionId(editingSessionId === session.id ? null : session.id)}>{editingSessionId === session.id ? "Terminer" : "Modifier"}</button>
                {!session.hasEnrollments && <button className="camp-button camp-button-outline" onClick={() => deleteSession(session)}>Supprimer</button>}
              </div>
              {editingSessionId === session.id && (
                <form className="camp-form camp-session-form camp-session-edit" onSubmit={(event) => saveSession(event, session)}>
                  <label>Titre<input name="title" defaultValue={session.title} required minLength={2} maxLength={160} /></label>
                  <div className="camp-input-grid">
                    <label>Saison<select name="season" defaultValue={session.season} disabled={session.hasEnrollments}>{session.season === "summer" ? <><option value="summer">Été</option><option value="winter">Hiver</option></> : <><option value="winter">Hiver</option><option value="summer">Été</option></>}</select></label>
                    <label>Groupe d'âge<select name="ageGroup" defaultValue={session.ageGroup} disabled={session.hasEnrollments}>{programs.map((program) => <option key={program.ageGroup} value={program.ageGroup}>{program.title}</option>)}</select></label>
                    <label>Date de début<input name="startDate" type="date" defaultValue={session.startDate} disabled={session.hasEnrollments} required /></label>
                  </div>
                  {session.hasEnrollments && <p className="camp-form-hint">Les dates et le groupe ne sont plus modifiables car une inscription existe déjà.</p>}
                  <label>Description<textarea name="description" defaultValue={session.description} maxLength={3000} /></label>
                  <label>Activités prévues<textarea name="activities" defaultValue={session.activities} maxLength={3000} /></label>
                  <label className="camp-consent"><input name="registrationOpen" type="checkbox" defaultChecked={session.registrationOpen} /><span>Inscriptions ouvertes</span></label>
                  <button className="camp-button camp-button-primary">Enregistrer les modifications</button>
                </form>
              )}
            </article>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </section>
      <section className="camp-admin-section">
        <h2>Demandes reçues <span>{filteredEnrollments.length}/{enrollments.length}</span></h2>
        {loading && <p role="status">Chargement…</p>}
        {!loading && !enrollments.length && <p>Aucune demande pour le moment.</p>}
        {!!enrollments.length && (
          <div className="camp-enrollment-filters">
            <label>Rechercher<input value={enrollmentSearch} onChange={(event) => setEnrollmentSearch(event.target.value)} placeholder="Nom, e-mail ou séjour" /></label>
            <label>Séjour<select value={enrollmentSessionFilter} onChange={(event) => setEnrollmentSessionFilter(event.target.value)}>
              <option value="all">Tous les séjours</option>
              {sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
            </select></label>
            <label>Statut<select value={enrollmentStatusFilter} onChange={(event) => setEnrollmentStatusFilter(event.target.value)}>
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="cancelled">Annulée</option>
            </select></label>
            <button className="camp-button camp-button-outline" type="button" onClick={exportEnrollments} disabled={!filteredEnrollments.length}>Exporter en CSV</button>
          </div>
        )}
        {!loading && enrollments.length > 0 && !filteredEnrollments.length && <p>Aucune inscription ne correspond à ces filtres.</p>}
        <div className="camp-enrollment-list">{filteredEnrollments.map((enrollment) => (
          <EnrollmentCard
            key={enrollment.id}
            enrollment={enrollment}
            admin
            onUpdate={updateEnrollment}
            onNoteChange={updateInternalNote}
            onSaveNote={saveInternalNote}
            noteSaving={noteSavingId === enrollment.id}
          />
        ))}</div>
      </section>
      <section className="camp-admin-section">
        <h2>Aide et contact <span>{contactConversations.filter((conversation) => !conversation.isRead).length} non lu(s) · {contactConversations.length}</span></h2>
        {loading && <p role="status">Chargement…</p>}
        {!loading && !contactConversations.length && <p>Aucun message reçu.</p>}
        <div className="camp-contact-message-list">
          {contactConversations.map((conversation) => (
            <article className={`camp-contact-message${conversation.isRead ? "" : " camp-contact-message-unread"}`} key={conversation.id}>
              <div className="camp-contact-message-heading">
                <b>{conversation.customer.name}</b>
                <a href={`mailto:${conversation.customer.email}`}>{conversation.customer.email}</a>
                <time dateTime={conversation.updatedAt}>{formatDate(conversation.updatedAt.slice(0, 10))}</time>
                <button className="camp-button camp-button-light" onClick={() => updateConversationReadState(conversation)}>
                  {conversation.isRead ? "Marquer comme non lu" : "Marquer comme lu"}
                </button>
              </div>
              <div className="camp-contact-thread">
                {conversation.messages.map((message) => (
                  <article className={`camp-contact-bubble camp-contact-bubble-${message.senderRole}`} key={message.id}>
                    <b>{message.senderRole === "admin" ? "Organisateur" : conversation.customer.name}</b>
                    <p>{message.message}</p>
                    <time dateTime={message.createdAt}>{formatDate(message.createdAt.slice(0, 10))}</time>
                  </article>
                ))}
              </div>
              <form className="camp-form camp-contact-reply" onSubmit={(event) => sendOrganizerReply(event, conversation)}>
                <label htmlFor={`reply-${conversation.id}`}>Répondre au client</label>
                <textarea
                  id={`reply-${conversation.id}`}
                  required
                  maxLength={3000}
                  value={replyDrafts[conversation.id] ?? ""}
                  onChange={(event) => setReplyDrafts((current) => ({ ...current, [conversation.id]: event.target.value }))}
                />
                <button className="camp-button camp-button-primary" disabled={replyBusyId === conversation.id}>
                  {replyBusyId === conversation.id ? "Envoi…" : "Envoyer la réponse"}
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function ContactPage() {
  const { user, loading: authLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conversation, setConversation] = useState<ContactConversation | null>(null);
  const [conversationLoading, setConversationLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    api<{ conversation: ContactConversation | null }>("/api/contact-messages/mine")
      .then(({ conversation: current }) => {
        setConversation(current);
        setError("");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "La conversation n'a pas pu être chargée."))
      .finally(() => setConversationLoading(false));
  }, [user]);

  if (authLoading) return <LoadingPage />;
  if (!user) return <Navigate to={`/connexion?retour=${encodeURIComponent("/aide-et-contact")}`} replace />;
  if (user.role === "admin") return <Navigate to="/organisateur" replace />;
  const customer = { name: user.fullName, email: user.email };

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { message: sent } = await api<{
        message: ContactMessage & { conversationId: string };
      }>("/api/contact-messages", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setConversation((current) => ({
        id: sent.conversationId,
        isRead: false,
        updatedAt: sent.createdAt,
        customer: current?.customer ?? customer,
        messages: [...(current?.messages ?? []), sent],
      }));
      setMessage("");
      setNotice("Votre message a bien été envoyé. Tu retrouveras la réponse de l'organisateur dans cette conversation.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le message n'a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="camp-container camp-contact-page">
      <Link className="camp-back-link" to="/">← Retour aux séjours</Link>
      <span className="camp-eyebrow">ESPACE FAMILLE</span>
      <h1>Aide et contact</h1>
      <p>Écris à l'organisateur pour toute question sur les séjours ou ta réservation. Il pourra te répondre à l'adresse {user.email}.</p>
      {notice && <p className="camp-success" role="status">{notice}</p>}
      {error && <p className="camp-form-error" role="alert">{error}</p>}
      {conversationLoading && <p role="status">Chargement de la conversation…</p>}
      {conversation && (
        <section className="camp-contact-customer-thread" aria-labelledby="camp-contact-thread-title">
          <h2 id="camp-contact-thread-title">Conversation avec l'organisateur</h2>
          <div className="camp-contact-thread">
            {conversation.messages.map((item) => (
              <article className={`camp-contact-bubble camp-contact-bubble-${item.senderRole}`} key={item.id}>
                <b>{item.senderRole === "admin" ? "Organisateur" : "Vous"}</b>
                <p>{item.message}</p>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt.slice(0, 10))}</time>
              </article>
            ))}
          </div>
        </section>
      )}
      <form className="camp-form camp-contact-form" onSubmit={sendMessage}>
        <label htmlFor="camp-contact-message">{conversation ? "Répondre à l'organisateur" : "Ton message"}</label>
        <textarea
          id="camp-contact-message"
          required
          maxLength={3000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Écris ton message à l'organisateur…"
        />
        <p className="camp-form-hint">Ton nom et ton adresse e-mail seront transmis avec ton message. Maximum 3 000 caractères.</p>
        <button className="camp-button camp-button-primary" type="submit" disabled={busy}>
          {busy ? "Envoi…" : "Envoyer à l'organisateur"}
        </button>
      </form>
      <Footer />
    </main>
  );
}

function LoadingPage() {
  return <main className="camp-container camp-loading" role="status">Chargement…</main>;
}

function Footer() {
  return <footer className="camp-footer"><div className="camp-container"><span>ALPES CAMP</span><span>Des séjours outdoor dans les Alpes · Été & hiver</span></div></footer>;
}

export function CampApp() {
  return (
    <AuthProvider>
      <div className="camp-app">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sejours/:ageGroup" element={<ProgramPage />} />
          <Route path="/connexion" element={<AuthPage mode="login" />} />
          <Route path="/inscription" element={<AuthPage mode="register" />} />
          <Route path="/colonies/:id/inscription" element={<EnrollmentPage />} />
          <Route path="/mes-inscriptions" element={<CustomerPage />} />
          <Route path="/aide-et-contact" element={<ContactPage />} />
          <Route path="/organisateur" element={<AdminPage />} />
          <Route path="*" element={<main className="camp-container camp-empty"><h1>Page introuvable</h1><Link to="/">Retour à l'accueil</Link></main>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
