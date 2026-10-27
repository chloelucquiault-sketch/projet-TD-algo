import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, formatDate } from "./api";

type User = { id: string; email: string; fullName: string; role: "customer" | "admin" };
type AgeGroup = "little" | "middle" | "teen" | "adult";
type Season = "summer" | "winter";
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
  createdAt: string;
  processedAt: string | null;
  consentRecordedAt: string;
  customer?: { id: string; name: string; email: string };
  session: Pick<CampSession, "id" | "title" | "season" | "ageGroup" | "startDate" | "endDate">;
  participants: Participant[];
};

const programs: { ageGroup: AgeGroup; title: string; ages: string; days: number; description: string }[] = [
  { ageGroup: "little", title: "Les Petits", ages: "5–7 ans", days: 4, description: "Une première aventure sportive, à leur rythme." },
  { ageGroup: "middle", title: "Les Moyens", ages: "8–11 ans", days: 7, description: "Une semaine pour explorer et progresser ensemble." },
  { ageGroup: "teen", title: "Les Ados", ages: "12–14 ans", days: 7, description: "Des défis outdoor et de beaux souvenirs d'équipe." },
  { ageGroup: "adult", title: "Adultes & Confirmés", ages: "15 ans et +", days: 7, description: "Une semaine sportive au grand air dans les Alpes." },
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
          <a href="/#programmes">Les séjours</a>
          {user?.role === "customer" && <Link to="/mes-inscriptions">Mes inscriptions</Link>}
          {user?.role === "admin" && <Link to="/organisateur">Espace organisateur</Link>}
        </nav>
        <div className="camp-nav-account">
          {user ? (
            <>
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
      src: "/images/alpes-ete.jpg",
      alt: "Vue d'une vallée alpine au petit matin pendant l'été.",
      label: "L'été dans les Alpes",
      credit: "Sternenjaeger · CC0",
      source: "https://commons.wikimedia.org/wiki/File:Summer_morning_in_the_Swiss_Alps.jpg",
    },
    {
      src: "/images/alpes-hiver.jpg",
      alt: "Les Alpes suisses sous la neige en hiver.",
      label: "L'hiver en montagne",
      credit: "Giles Laurent · CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Swiss_alps_seen_from_Creux_du_Van_under_the_winter_snow_Photo_by_Giles_Laurent.jpg",
    },
    {
      src: "/images/enfants-randonnee-alpes.jpg",
      alt: "Deux enfants font une pause pendant une randonnée dans les Alpes.",
      label: "Petits randonneurs, grands souvenirs",
      credit: "SWT666 · CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:Two_kids_resting_during_a_hike_on_the_Alps.jpg",
    },
    {
      src: "/images/enfants-jeux-exterieur.jpg",
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
  const [seasonFilter, setSeasonFilter] = useState<Season | "all">("all");
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
    () => sessions.filter((session) =>
      (seasonFilter === "all" || session.season === seasonFilter)
      && (ageFilter === "all" || session.ageGroup === ageFilter)),
    [sessions, seasonFilter, ageFilter],
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
        <div className="camp-program-grid">
          {programs.filter((program) => ageFilter === "all" || program.ageGroup === ageFilter).map((program, index) => {
            const programSessions = filteredSessions.filter((session) => session.ageGroup === program.ageGroup);
            return (
              <article className={`camp-program-card camp-tone-${index + 1}`} key={program.ageGroup}>
                <span className="camp-program-number">0{index + 1}</span>
                <span className="camp-program-days">{program.days} jours</span>
                <h3>{program.title}</h3>
                <p className="camp-program-ages">{program.ages} · âge recommandé</p>
                <p>{program.description}</p>
                <div className="camp-departures">
                  {programSessions.map((session) => (
                    <div className="camp-departure" key={session.id}>
                      <div>
                        <strong>{session.title}</strong>
                        <span>{seasonName[session.season]} · {formatDate(session.startDate)} au {formatDate(session.endDate)} · {session.remainingPlaces} place(s)</span>
                        {session.activities && <span>Activités : {session.activities}</span>}
                      </div>
                      {session.remainingPlaces > 0
                        ? <Link to={`/colonies/${session.id}/inscription`} aria-label={`Inscrire à ${session.title}`}>S'inscrire <span aria-hidden="true">→</span></Link>
                        : <span className="camp-full-label">Complet</span>}
                    </div>
                  ))}
                  {!loading && !error && !programSessions.length && <span className="camp-no-departure">Aucun départ publié pour le moment</span>}
                </div>
              </article>
            );
          })}
        </div>
        <div className="camp-filters" aria-label="Filtres des départs">
          <label>
            <span>Saison</span>
            <select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value as Season | "all")}>
              <option value="all">Toutes les saisons</option><option value="summer">Été</option><option value="winter">Hiver</option>
            </select>
          </label>
          <label>
            <span>Groupe</span>
            <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as AgeGroup | "all")}>
              <option value="all">Tous les groupes</option>
              {programs.map((program) => <option key={program.ageGroup} value={program.ageGroup}>{program.title}</option>)}
            </select>
          </label>
          <p role="status">{loading ? "Chargement des départs…" : error || `${filteredSessions.length} départ(s) disponible(s)`}</p>
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
  const { user, loading: authLoading } = useAuth();
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
    setBusy(true);
    setError("");
    try {
      await api(`/api/camp-sessions/${id}/enrollments`, {
        method: "POST",
        body: JSON.stringify({ healthDataConsent: consent, participants }),
      });
      navigate("/mes-inscriptions?envoyee=oui");
    } catch (reason) {
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
          <form className="camp-form camp-enrollment-form" onSubmit={submit}>
            {participants.map((participant, index) => (
              <fieldset className="camp-participant" key={index}>
                <legend>Participant {index + 1}</legend>
                {participants.length > 1 && <button className="camp-remove-participant" type="button" onClick={() => setParticipants((current) => current.filter((_, participantIndex) => participantIndex !== index))}>Retirer</button>}
                <div className="camp-input-grid">
                  <label>Prénom<input required maxLength={80} value={participant.firstName} onChange={(event) => updateParticipant(index, "firstName", event.target.value)} /></label>
                  <label>Nom<input required maxLength={80} value={participant.lastName} onChange={(event) => updateParticipant(index, "lastName", event.target.value)} /></label>
                  <label>Date de naissance<input type="date" required value={participant.birthDate} onChange={(event) => updateParticipant(index, "birthDate", event.target.value)} /></label>
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
              <span>Je confirme être autorisé(e) à communiquer ces informations et consens au traitement des informations de santé nécessaires à l'accueil des participants. Elles sont chiffrées et accessibles uniquement à mon compte et à l'organisateur. La politique de conservation reste à définir avant toute mise en production.</span>
            </label>
            {error && <p className="camp-form-error" role="alert">{error}</p>}
            <button className="camp-button camp-button-primary camp-button-wide" disabled={busy || campSession.remainingPlaces === 0}>{busy ? "Envoi en cours…" : "Envoyer la demande d'inscription"}</button>
          </form>
        </section>
        <aside className="camp-enroll-aside">
          <span className="camp-eyebrow">À RETENIR</span>
          <h2>Votre demande sera en attente.</h2>
          <p>Les places sont bloquées pendant le traitement. L'organisateur vous informera de la confirmation ou du refus.</p>
          <p>L'âge indiqué est un repère. Une demande hors tranche recommandée sera signalée à l'organisateur pour échange.</p>
          <p><strong>Aucun paiement n'est demandé en ligne.</strong></p>
        </aside>
      </div>
      <Footer />
    </main>
  );
}

function EnrollmentCard({ enrollment, admin = false, onUpdate }: {
  enrollment: Enrollment;
  admin?: boolean;
  onUpdate?: (id: string, status: "confirmed" | "cancelled") => void;
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

  if (authLoading) return <LoadingPage />;
  if (!user) return <Navigate to={`/connexion?retour=${encodeURIComponent("/mes-inscriptions")}`} replace />;
  if (user.role === "admin") return <Navigate to="/organisateur" replace />;

  return (
    <main className="camp-container camp-account-page">
      <span className="camp-eyebrow">ESPACE FAMILLE</span>
      <h1>Mes inscriptions</h1>
      {searchParams.get("envoyee") && <p className="camp-success" role="status">Votre demande a bien été envoyée. Elle est en attente de traitement.</p>}
      {loading && <p role="status">Chargement de vos inscriptions…</p>}
      {error && <p className="camp-form-error" role="alert">{error}</p>}
      {!loading && !error && !enrollments.length && <div className="camp-empty"><p>Vous n'avez pas encore d'inscription.</p><Link className="camp-button camp-button-primary" to="/">Découvrir les séjours</Link></div>}
      <div className="camp-enrollment-list">{enrollments.map((enrollment) => <EnrollmentCard key={enrollment.id} enrollment={enrollment} />)}</div>
      <Footer />
    </main>
  );
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<CampSession[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  async function reload() {
    const [sessionResult, enrollmentResult] = await Promise.all([
      api<{ sessions: CampSession[] }>("/api/admin/camp-sessions"),
      api<{ enrollments: Enrollment[] }>("/api/admin/camp-enrollments"),
    ]);
    setSessions(sessionResult.sessions);
    setEnrollments(enrollmentResult.enrollments);
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
        <div className="camp-session-admin-list">
          {sessions.map((session) => (
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
      </section>
      <section className="camp-admin-section">
        <h2>Demandes reçues <span>{enrollments.length}</span></h2>
        {loading && <p role="status">Chargement…</p>}
        {!loading && !enrollments.length && <p>Aucune demande pour le moment.</p>}
        <div className="camp-enrollment-list">{enrollments.map((enrollment) => (
          <EnrollmentCard key={enrollment.id} enrollment={enrollment} admin onUpdate={updateEnrollment} />
        ))}</div>
      </section>
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
          <Route path="/connexion" element={<AuthPage mode="login" />} />
          <Route path="/inscription" element={<AuthPage mode="register" />} />
          <Route path="/colonies/:id/inscription" element={<EnrollmentPage />} />
          <Route path="/mes-inscriptions" element={<CustomerPage />} />
          <Route path="/organisateur" element={<AdminPage />} />
          <Route path="*" element={<main className="camp-container camp-empty"><h1>Page introuvable</h1><Link to="/">Retour à l'accueil</Link></main>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
