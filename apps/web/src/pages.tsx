import { createContext, FormEvent, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Dumbbell,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Utensils,
  Waves,
  X,
} from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ComplexDetails, ComplexSummary, Facility, formatDate, MealOption, User } from "./api";

const AuthContext = createContext<{
  user: User | null;
  ready: boolean;
  refresh: () => Promise<void>;
}>({ user: null, ready: false, refresh: async () => undefined });

function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = async () => {
    try {
      const result = await api<{ user: User | null }>("/api/auth/me");
      setUser(result.user);
    } finally {
      setReady(true);
    }
  };
  useEffect(() => {
    void refresh().catch(() => {
      setUser(null);
      setReady(true);
    });
  }, []);
  return <AuthContext.Provider value={{ user, ready, refresh }}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

function Header() {
  const { user, refresh } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    await refresh();
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link className="brand" to="/" aria-label="Terrain Commun, accueil">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span>terrain<span className="brand-light">commun</span><small>LES SÉJOURS QUI FONT ÉQUIPE</small></span>
        </Link>
        <button className="mobile-menu-button" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={menuOpen ? "main-nav open" : "main-nav"}>
          <a href="/#sejours" onClick={() => setMenuOpen(false)}>Les séjours</a>
          <a href="/#concept" onClick={() => setMenuOpen(false)}>Le concept</a>
          {user ? (
            <>
              <Link to={user.role === "customer" ? "/mon-espace" : user.role === "admin" ? "/administration" : "/gestion"} className="nav-account">
                <CircleUserRound size={17} /> Mon espace
              </Link>
              <button className="nav-logout" onClick={logout}>Déconnexion</button>
            </>
          ) : (
            <>
              <Link className="nav-login" to="/connexion">Se connecter</Link>
              <Link className="button button-dark button-small" to="/inscription">Créer un compte <ArrowUpRight size={15} /></Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/complexes/:id" element={<ComplexPage />} />
        <Route path="/reservation/:id" element={<BookingPage />} />
        <Route path="/connexion" element={<AuthPage mode="login" />} />
        <Route path="/inscription" element={<AuthPage mode="register" />} />
        <Route path="/mon-espace" element={<CustomerPage />} />
        <Route path="/gestion" element={<ManagerPage />} />
        <Route path="/administration" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </AuthProvider>
  );
}

function HomePage() {
  const [params, setParams] = useSearchParams();
  const [complexes, setComplexes] = useState<ComplexSummary[]>([]);
  const [sports, setSports] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [region, setRegion] = useState(params.get("region") ?? "");
  const [sport, setSport] = useState(params.get("sport") ?? "");
  const [capacity, setCapacity] = useState(params.get("capacity") ?? "");
  const [checkIn, setCheckIn] = useState(params.get("checkIn") ?? "");
  const [checkOut, setCheckOut] = useState(params.get("checkOut") ?? "");

  const query = useMemo(() => params.toString(), [params]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    Promise.all([
      api<{ complexes: ComplexSummary[] }>(`/api/complexes${query ? `?${query}` : ""}`),
      api<{ sports: { id: string; name: string; slug: string }[] }>("/api/sports"),
    ]).then(([complexResult, sportResult]) => {
      if (!current) return;
      setComplexes(complexResult.complexes);
      setSports(sportResult.sports);
      setError("");
    }).catch((reason: Error) => {
      if (current) setError(reason.message);
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [query]);

  function search(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (region) next.set("region", region);
    if (sport) next.set("sport", sport);
    if (capacity) next.set("capacity", capacity);
    if (checkIn && checkOut) {
      next.set("checkIn", checkIn);
      next.set("checkOut", checkOut);
    }
    setParams(next);
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> POUR LES CLUBS QUI VONT PLUS LOIN</div>
            <h1>Un séjour.<br />Toute votre <span>équipe.</span></h1>
            <p>Le bon terrain, un dortoir pour tout le monde et les repas déjà pensés. Concentrez-vous sur le jeu, on s'occupe du reste.</p>
            <a className="button button-lime" href="#sejours">Trouver votre séjour <ArrowDownRight size={17} /></a>
            <div className="hero-proof"><span className="proof-avatars"><i>J</i><i>M</i><i>A</i></span><span><strong>Les équipes d'abord.</strong><br />Des séjours pensés pour les clubs.</span></div>
          </div>
          <div className="hero-art" aria-label="Illustration d'un terrain de sport">
            <div className="art-sun" />
            <div className="art-tag"><span className="tag-dot" /> VOTRE PROCHAINE AVENTURE</div>
            <div className="art-field">
              <div className="field-line field-top" /><div className="field-line field-center" /><div className="field-line field-bottom" />
              <div className="field-circle" /><div className="field-box field-box-left" /><div className="field-box field-box-right" />
              <span className="player player-a">●</span><span className="player player-b">●</span><span className="player player-c">●</span>
            </div>
            <div className="hero-sticker"><span>2</span><small>NUITS<br />MINIMUM</small></div>
            <div className="hero-card"><span className="hero-card-icon"><MapPin size={18} /></span><span><b>Le terrain est à vous.</b><small>Et le dortoir aussi.</small></span><ArrowUpRight size={19} /></div>
            <span className="art-caption">L'ESPRIT D'ÉQUIPE, EN GRAND.</span>
          </div>
        </div>
        <div className="hero-bottom"><span>SPORT · SÉJOUR · SOUVENIRS</span><a href="#concept">DÉCOUVRIR LE CONCEPT <ArrowDownRight size={14} /></a></div>
      </section>

      <section className="search-section" id="sejours">
        <div className="section-heading">
          <div><span className="eyebrow"><span className="eyebrow-line" /> LE TERRAIN DE VOS ENVIES</span><h2>On part où ?</h2></div>
          <p>Des infrastructures, des dortoirs et une option repas.<br className="desktop-break" /> Tout pour se retrouver et progresser ensemble.</p>
        </div>
        <form className="search-panel" onSubmit={search}>
          <label className="search-field"><span>RÉGION</span><div><MapPin size={17} /><input placeholder="Partout en France" value={region} onChange={(event) => setRegion(event.target.value)} /></div></label>
          <label className="search-field"><span>VOTRE SPORT</span><div><Dumbbell size={17} /><select value={sport} onChange={(event) => setSport(event.target.value)}><option value="">Tous les sports</option>{sports.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div></label>
          <label className="search-field search-date"><span>ARRIVÉE</span><div><CalendarDays size={17} /><input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></div></label>
          <label className="search-field search-date"><span>DÉPART</span><div><CalendarDays size={17} /><input type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></div></label>
          <label className="search-field capacity-field"><span>VOTRE GROUPE</span><div><BedDouble size={17} /><input type="number" min="1" max="500" placeholder="Nombre de couchages" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></div></label>
          <button className="search-submit" type="submit" aria-label="Rechercher"><Search size={19} /><span>Explorer</span></button>
        </form>
        <div className="results-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> NOS COMPLEXES</span><h3>Des lieux faits pour jouer collectif<span>.</span></h3></div><span className="results-count">{loading ? "Recherche…" : `${complexes.length} séjour${complexes.length > 1 ? "s" : ""}`}</span></div>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {loading ? <div className="loading-card"><span className="spinner" /> On prépare le terrain…</div> : complexes.length === 0 ? (
          <div className="empty-state"><span className="empty-icon"><Search size={24} /></span><h4>Pas de séjour trouvé pour le moment</h4><p>Essayez d'élargir les filtres ou de choisir d'autres dates.</p><button className="button button-outline" onClick={() => { setRegion(""); setSport(""); setCapacity(""); setCheckIn(""); setCheckOut(""); setParams(new URLSearchParams()); }}>Effacer les filtres</button></div>
        ) : (
          <div className="complex-grid">
            {complexes.map((complex, index) => <ComplexCard key={complex.id} complex={complex} index={index} />)}
          </div>
        )}
      </section>

      <section className="concept-section" id="concept">
        <div className="concept-intro"><span className="eyebrow"><span className="eyebrow-line" /> LE SÉJOUR, SANS LES COMPLICATIONS</span><h2>Du premier coup<br />de sifflet au <em>dernier.</em></h2><p>Tout au même endroit. Pas de réservation à droite, de dortoir à gauche et de repas à organiser au milieu.</p><Link className="text-link" to="/inscription">On y va ? <ArrowRight size={17} /></Link></div>
        <div className="concept-steps">
          <div className="concept-step"><span className="step-number">01</span><span className="step-icon"><Dumbbell /></span><div><h3>Choisissez vos terrains</h3><p>Une ou plusieurs disciplines, selon le programme de votre équipe.</p></div><ChevronRight /></div>
          <div className="concept-step"><span className="step-number">02</span><span className="step-icon"><BedDouble /></span><div><h3>Réunissez votre équipe</h3><p>Des couchages en dortoir pour tout le groupe, à partir de deux nuits.</p></div><ChevronRight /></div>
          <div className="concept-step"><span className="step-number">03</span><span className="step-icon"><Utensils /></span><div><h3>Ajoutez l'option repas</h3><p>Un séjour à la carte, puis une demande envoyée au gestionnaire.</p></div><ChevronRight /></div>
        </div>
      </section>
      <section className="cta-strip"><div><span className="eyebrow">PRÊTS À JOUER EN ÉQUIPE ?</span><h2>Le prochain souvenir<br />se joue maintenant.</h2></div><Link className="button button-lime" to="/inscription">Créer un compte <ArrowUpRight size={17} /></Link><span className="cta-ball">✳</span></section>
    </main>
  );
}

function ComplexCard({ complex, index }: { complex: ComplexSummary; index: number }) {
  const themes = ["card-green", "card-yellow", "card-blue"];
  return (
    <article className="complex-card">
      <Link to={`/complexes/${complex.id}`} className={`complex-card-image ${themes[index % themes.length]}`} aria-label={`Découvrir ${complex.name}`}>
        <span className="card-art-sun" />
        <span className="card-art-hill" />
        <span className="card-art-field"><i /><i /><i /></span>
        <span className="card-label"><span /> SÉJOUR SPORTIF</span>
        <span className="card-open"><ArrowUpRight size={19} /></span>
        <span className="card-illustration">{index % 2 ? <Waves size={66} strokeWidth={1.1} /> : <Dumbbell size={65} strokeWidth={1.1} />}</span>
      </Link>
      <div className="complex-card-body">
        <div className="card-location"><MapPin size={13} /> {complex.region}</div>
        <Link to={`/complexes/${complex.id}`} className="card-title">{complex.name}</Link>
        <p>{complex.description}</p>
        <div className="card-meta"><span><Dumbbell size={14} /> {complex.facility_count} espaces</span><span><BedDouble size={14} /> Jusqu'à {complex.available_beds} couchages</span></div>
        <Link className="card-link" to={`/complexes/${complex.id}`}>Découvrir le séjour <ArrowRight size={15} /></Link>
      </div>
    </article>
  );
}

function ComplexPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<ComplexDetails | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<ComplexDetails>(`/api/complexes/${id}`).then(setData).catch((reason: Error) => setError(reason.message));
  }, [id]);
  if (error) return <main className="page-shell"><div className="notice notice-error">{error}</div><Link className="text-link" to="/">Retour aux séjours</Link></main>;
  if (!data) return <main className="page-shell"><div className="loading-card"><span className="spinner" /> Chargement du complexe…</div></main>;

  const grouped = data.facilities.reduce<Record<string, Facility[]>>((groups, facility) => {
    (groups[facility.sportName] ??= []).push(facility);
    return groups;
  }, {});
  return (
    <main className="page-shell">
      <div className="breadcrumbs"><Link to="/">Séjours</Link><ChevronRight size={14} /><span>{data.complex.name}</span></div>
      <section className="detail-hero">
        <div className="detail-image card-green"><span className="card-art-sun" /><span className="card-art-hill" /><span className="card-art-field"><i /><i /><i /></span><span className="detail-image-title">LE GRAND AIR.<br />LE JEU. L'ÉQUIPE.</span></div>
        <div className="detail-copy"><span className="eyebrow"><span className="eyebrow-line" /> SÉJOUR SPORTIF</span><span className="detail-location"><MapPin size={15} /> {data.complex.region} · {data.complex.address}</span><h1>{data.complex.name}</h1><p>{data.complex.description}</p><div className="detail-highlights"><span><Dumbbell /> {data.facilities.length} infrastructures</span><span><BedDouble /> {data.dormitories.reduce((sum, dorm) => sum + dorm.bedCount, 0)} couchages</span><span><Clock3 /> 2 nuits minimum</span></div><Link className="button button-dark" to={`/reservation/${id}`}>Composer mon séjour <ArrowUpRight size={16} /></Link></div>
      </section>
      <section className="detail-content">
        <div className="detail-main">
          <div className="detail-section-title"><span className="eyebrow">À VOUS DE JOUER</span><h2>Les infrastructures</h2></div>
          {Object.entries(grouped).map(([sport, facilities]) => <div className="facility-group" key={sport}><h3>{sport}</h3><div className="facility-list">{facilities.map((facility) => <div className="facility-item" key={facility.id}><span className="facility-icon"><Dumbbell size={18} /></span><span><b>{facility.name}</b><small>{facility.facilityType} · {facility.description}</small></span><CheckCircle2 className="facility-check" size={18} /></div>)}</div></div>)}
        </div>
        <aside className="detail-aside">
          <div className="detail-aside-card"><span className="aside-icon"><BedDouble size={19} /></span><h3>On dort sur place</h3><p>Des dortoirs pour garder l'équipe réunie.</p>{data.dormitories.map((dorm) => <div className="dorm-summary" key={dorm.id}><span>{dorm.name}<small>{dorm.description}</small></span><b>{dorm.bedCount} lits</b></div>)}</div>
          <div className="detail-aside-card meal-aside"><span className="aside-icon"><Utensils size={19} /></span><h3>Et on passe à table</h3><p>L'option restauration se choisit au moment de votre demande.</p>{data.mealOptions.length ? data.mealOptions.map((meal) => <div className="meal-summary" key={meal.id}><Check size={15} /><span>{meal.name}<small>{meal.description}</small></span></div>) : <small>Pas d'option repas renseignée pour l'instant.</small>}</div>
        </aside>
      </section>
    </main>
  );
}

const bookingSteps = ["Les sports", "Les dates", "Le groupe", "Les options", "Récapitulatif"];

interface BookingDraft {
  step: number;
  facilityIds: string[];
  checkIn: string;
  checkOut: string;
  groupSize: number;
  groupType: string;
  dormitories: Record<string, number>;
  mealOptionId: string;
}

function BookingPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const draft = (location.state as { bookingDraft?: BookingDraft } | null)?.bookingDraft;
  const [data, setData] = useState<ComplexDetails | null>(null);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [facilityIds, setFacilityIds] = useState<string[]>(draft?.facilityIds ?? []);
  const [checkIn, setCheckIn] = useState(draft?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(draft?.checkOut ?? "");
  const [groupSize, setGroupSize] = useState(draft?.groupSize ?? 12);
  const [groupType, setGroupType] = useState(draft?.groupType ?? "Club sportif");
  const [dormitories, setDormitories] = useState<Record<string, number>>(draft?.dormitories ?? {});
  const [mealOptionId, setMealOptionId] = useState(draft?.mealOptionId ?? "");
  const [availability, setAvailability] = useState<{ available: boolean; availableBeds: number; dormitories: { id: string; name: string; available_beds: number }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api<ComplexDetails>(`/api/complexes/${id}`).then((result) => {
      setData(result);
      if (!draft?.facilityIds.length && result.facilities[0]) setFacilityIds([result.facilities[0].id]);
    }).catch((reason: Error) => setError(reason.message));
  }, [id]);

  const selectedFacilities = data?.facilities.filter((facility) => facilityIds.includes(facility.id)) ?? [];
  const selectedBeds = Object.values(dormitories).reduce((sum, beds) => sum + beds, 0);

  function toggleFacility(facilityId: string) {
    setFacilityIds((current) => current.includes(facilityId) ? current.filter((idValue) => idValue !== facilityId) : [...current, facilityId]);
    setAvailability(null);
  }

  async function checkAvailability() {
    if (!facilityIds.length || !checkIn || !checkOut) {
      setError("Choisissez au moins un sport et vos dates de séjour.");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ checkIn, checkOut, groupSize: String(groupSize), facilityIds: facilityIds.join(",") });
      const result = await api<typeof availability>(`/api/complexes/${id}/availability?${query}`);
      if (!result) return false;
      setAvailability(result);
      if (!result.available) {
        setError(`Ces dates ne conviennent pas à toutes les ressources ou à votre groupe. ${result.availableBeds} couchage(s) restent disponibles.`);
        return false;
      }
      setDormitories((current) => {
        const next: Record<string, number> = {};
        let remaining = groupSize;
        for (const dorm of result.dormitories) {
          const beds = Math.min(remaining, dorm.available_beds);
          if (beds > 0) next[dorm.id] = beds;
          remaining -= beds;
        }
        return Object.keys(current).length ? current : next;
      });
      return true;
    } catch (reason) {
      setError((reason as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function continueStep() {
    setError("");
    if (step === 0 && facilityIds.length === 0) {
      setError("Sélectionnez au moins une infrastructure sportive.");
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!Number.isInteger(groupSize) || groupSize < 1) {
        setError("Indiquez un nombre de personnes valide.");
        return;
      }
      if (!(await checkAvailability())) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (selectedBeds < groupSize) {
        setError(`Sélectionnez au moins ${groupSize} couchages.`);
        return;
      }
      setStep(4);
      return;
    }
    setStep((current) => Math.min(current + 1, bookingSteps.length - 1));
  }

  async function submitBooking() {
    if (!user) {
      navigate("/connexion", {
        state: {
          from: `/reservation/${id}`,
          bookingDraft: { step, facilityIds, checkIn, checkOut, groupSize, groupType, dormitories, mealOptionId },
        },
      });
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          complexId: id,
          checkIn,
          checkOut,
          groupSize,
          groupType,
          facilityIds,
          dormitories: Object.entries(dormitories).filter(([, beds]) => beds > 0).map(([dormitoryId, bedsReserved]) => ({ dormitoryId, bedsReserved })),
          mealOptionId: mealOptionId || null,
        }),
      });
      setSuccess(true);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <main className="page-shell">{error ? <div className="notice notice-error">{error}</div> : <div className="loading-card"><span className="spinner" /> Chargement…</div>}</main>;
  if (success) return <main className="page-shell"><div className="success-page"><span className="success-icon"><Check size={30} /></span><span className="eyebrow">DEMANDE TRANSMISE</span><h1>À vous de jouer,<br /><em>la suite est collective.</em></h1><p>Votre demande a bien été envoyée au gestionnaire. Les ressources restent bloquées pendant son examen ; la réservation sera confirmée après validation.</p><Link className="button button-dark" to="/mon-espace">Suivre ma demande <ArrowRight size={16} /></Link></div></main>;

  return (
    <main className="page-shell booking-shell">
      <div className="breadcrumbs"><Link to={`/complexes/${id}`}>{data.complex.name}</Link><ChevronRight size={14} /><span>Composer mon séjour</span></div>
      <div className="booking-heading"><span className="eyebrow"><span className="eyebrow-line" /> VOTRE PROCHAIN SÉJOUR</span><h1>On compose <em>l'équipe.</em></h1><p>Quelques étapes, et votre demande part au gestionnaire.</p></div>
      <div className="booking-layout">
        <div className="booking-main">
          <div className="stepper" aria-label="Étapes de réservation">
            {bookingSteps.map((label, index) => <div className={`stepper-item ${index === step ? "active" : ""} ${index < step ? "complete" : ""}`} key={label}><span>{index < step ? <Check size={14} /> : `0${index + 1}`}</span><small>{label}</small></div>)}
          </div>
          <section className="booking-card">
            <div className="booking-card-heading"><span className="eyebrow">ÉTAPE 0{step + 1} / 05</span><h2>{["Quels sports vous rassemblent ?", "Quand est-ce qu'on part ?", "Qui vient jouer ?", "On s'occupe du confort.", "Votre séjour, en bref."][step]}</h2><p>{["Sélectionnez les infrastructures à réserver pour tout votre séjour.", "Deux nuits minimum pour profiter vraiment du séjour.", "On adapte les couchages et les options à votre groupe.", "Répartissez les couchages et choisissez, si vous le souhaitez, les repas.", "Vérifiez les informations avant d'envoyer la demande."][step]}</p></div>
            {step === 0 && <div className="choice-grid">{data.facilities.map((facility) => <button type="button" key={facility.id} className={`choice-card ${facilityIds.includes(facility.id) ? "selected" : ""}`} onClick={() => toggleFacility(facility.id)}><span className="choice-icon"><Dumbbell size={20} /></span><span><b>{facility.name}</b><small>{facility.sportName} · {facility.facilityType}</small></span><span className="choice-check">{facilityIds.includes(facility.id) && <Check size={13} />}</span></button>)}</div>}
            {step === 1 && <div className="date-pair"><label className="form-field"><span>DATE D'ARRIVÉE</span><input type="date" value={checkIn} onChange={(event) => { setCheckIn(event.target.value); setAvailability(null); }} required /></label><label className="form-field"><span>DATE DE DÉPART</span><input type="date" value={checkOut} onChange={(event) => { setCheckOut(event.target.value); setAvailability(null); }} required /></label><div className="inline-hint"><Clock3 size={15} /> Minimum 2 nuits · les ressources sont réservées sur l'ensemble du séjour.</div></div>}
            {step === 2 && <div className="group-form"><label className="form-field"><span>NOMBRE DE PERSONNES</span><input type="number" min="1" max="500" value={groupSize} onChange={(event) => { setGroupSize(Number(event.target.value)); setAvailability(null); }} /></label><label className="form-field"><span>NATURE DU GROUPE</span><select value={groupType} onChange={(event) => setGroupType(event.target.value)}><option>Club sportif</option><option>Association</option><option>Club professionnel</option><option>Groupe sportif</option><option>Autre</option></select></label><p className="inline-hint"><ShieldCheck size={15} /> Nous vérifions les équipements et les couchages disponibles avant de continuer.</p></div>}
            {step === 3 && <div className="options-step"><div className="dorm-options">{data.dormitories.map((dorm) => { const stock = availability?.dormitories.find((entry) => entry.id === dorm.id)?.available_beds ?? dorm.bedCount; return <div className="dorm-option" key={dorm.id}><span className="dorm-option-icon"><BedDouble size={18} /></span><span className="dorm-option-info"><b>{dorm.name}</b><small>{stock} couchages disponibles · {dorm.description}</small></span><label className="number-picker"><span className="sr-only">Nombre de lits dans {dorm.name}</span><input type="number" min="0" max={stock} value={dormitories[dorm.id] ?? 0} onChange={(event) => setDormitories((current) => ({ ...current, [dorm.id]: Number(event.target.value) }))} /></label></div>; })}</div><div className={`bed-total ${selectedBeds < groupSize ? "bed-total-warning" : ""}`}><span>Couchages sélectionnés</span><b>{selectedBeds} / {groupSize}</b></div><div className="meal-choice"><div><span className="choice-icon"><Utensils size={19} /></span><span><b>Option repas</b><small>Ajoutez une formule de restauration à votre demande.</small></span></div><label className="form-field"><span>FORMULE</span><select value={mealOptionId} onChange={(event) => setMealOptionId(event.target.value)}><option value="">Sans option repas</option>{data.mealOptions.map((meal: MealOption) => <option key={meal.id} value={meal.id}>{meal.name}</option>)}</select></label></div></div>}
            {step === 4 && <div className="recap-list"><RecapRow label="Complexe" value={data.complex.name} /><RecapRow label="Dates" value={checkIn && checkOut ? `${formatDate(checkIn)} — ${formatDate(checkOut)}` : "Dates non renseignées"} /><RecapRow label="Groupe" value={`${groupSize} personnes · ${groupType}`} /><RecapRow label="Sports" value={selectedFacilities.map((facility) => facility.name).join(", ")} /><RecapRow label="Dortoirs" value={`${selectedBeds} couchages · ${data.dormitories.filter((dorm) => (dormitories[dorm.id] ?? 0) > 0).map((dorm) => `${dorm.name} (${dormitories[dorm.id]})`).join(", ")}`} /><RecapRow label="Repas" value={data.mealOptions.find((meal) => meal.id === mealOptionId)?.name ?? "Aucune option"} /><div className="recap-note"><ShieldCheck size={17} /><span>Votre demande sera en attente jusqu'à validation du gestionnaire. Aucun paiement n'est demandé à cette étape.</span></div></div>}
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            <div className="booking-actions">{step > 0 && <button className="button button-quiet" onClick={() => { setError(""); setStep((current) => current - 1); }}><ArrowLeft size={16} /> Retour</button>}{step < 4 ? <button className="button button-dark" onClick={() => void continueStep()} disabled={busy}>{busy ? "Vérification…" : step === 2 ? "Vérifier les disponibilités" : "Continuer"} <ArrowRight size={16} /></button> : <button className="button button-lime" onClick={() => void submitBooking()} disabled={busy}>{busy ? "Envoi…" : user ? "Envoyer ma demande" : "Se connecter pour envoyer"} <ArrowUpRight size={16} /></button>}</div>
          </section>
        </div>
        <aside className="booking-aside"><span className="aside-icon"><CalendarDays size={19} /></span><span className="eyebrow">VOTRE SÉJOUR</span><h3>{data.complex.name}</h3><p><MapPin size={14} /> {data.complex.region}</p><div className="booking-aside-line" /><div className="booking-aside-facts"><span><Clock3 size={15} /> 2 nuits minimum</span><span><BedDouble size={15} /> Dortoirs sur place</span><span><Utensils size={15} /> Repas en option</span></div><div className="booking-aside-tip"><CheckCircle2 size={16} /> Les disponibilités seront revérifiées à l'envoi.</div></aside>
      </div>
    </main>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return <div className="recap-row"><span>{label}</span><b>{value}</b></div>;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      await api(`/api/auth/${isRegister ? "register" : "login"}`, { method: "POST", body: JSON.stringify(body) });
      await refresh();
      const redirect = params.get("redirect") || (location.state as { from?: string } | null)?.from;
      navigate(redirect || (isRegister ? "/mon-espace" : "/"), { state: location.state });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <main className="auth-page"><div className="auth-art"><span className="eyebrow"><span className="eyebrow-line" /> C'EST L'ESPRIT D'ÉQUIPE</span><h2>Un peu de sport.<br />Beaucoup de <em>souvenirs.</em></h2><div className="auth-art-field"><span /><span /><span /></div><p>Les meilleurs séjours ne se jouent jamais en solo.</p></div><div className="auth-panel"><Link className="back-link" to="/"><ArrowLeft size={15} /> Retour à l'accueil</Link><span className="eyebrow">{isRegister ? "REJOIGNEZ L'ÉQUIPE" : "HEUREUX DE VOUS REVOIR"}</span><h1>{isRegister ? "On fait équipe ?" : "On reprend le jeu."}</h1><p>{isRegister ? "Créez un compte pour organiser votre prochain séjour." : "Connectez-vous pour suivre vos séjours et demandes."}</p><form className="stack-form" onSubmit={submit}>{isRegister && <><label className="form-field"><span>VOTRE NOM</span><input name="fullName" autoComplete="name" required minLength={2} maxLength={120} placeholder="Camille Martin" /></label><label className="form-field"><span>CLUB OU ASSOCIATION <small>(FACULTATIF)</small></span><input name="organizationName" autoComplete="organization" maxLength={160} placeholder="AS du quartier" /></label></>}<label className="form-field"><span>ADRESSE E-MAIL</span><input type="email" name="email" autoComplete="email" required placeholder="vous@exemple.fr" /></label><label className="form-field"><span>MOT DE PASSE {isRegister && <small>(12 CARACTÈRES MINIMUM)</small>}</span><input type="password" name="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 12 : 1} maxLength={200} placeholder="••••••••••••" /></label>{error && <div className="notice notice-error" role="alert">{error}</div>}<button className="button button-dark auth-submit" disabled={busy}>{busy ? "Un instant…" : isRegister ? "Créer mon compte" : "Se connecter"} <ArrowRight size={16} /></button></form><p className="auth-switch">{isRegister ? "Déjà un compte ?" : "Pas encore de compte ?"} <Link to={isRegister ? "/connexion" : "/inscription"}>{isRegister ? "Se connecter" : "Créer un compte"}</Link></p></div></main>;
}

interface BookingItem {
  id: string;
  complexName: string;
  checkIn: string;
  checkOut: string;
  groupSize: number;
  groupType: string;
  status: "pending" | "confirmed" | "cancelled";
  mealOption: string | null;
}

const statusLabels = { pending: "En attente", confirmed: "Confirmée", cancelled: "Annulée" };

function CustomerPage() {
  const { user, ready } = useAuth();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user?.role === "customer") api<{ bookings: BookingItem[] }>("/api/bookings/mine").then((result) => setBookings(result.bookings)).catch((reason: Error) => setError(reason.message));
  }, [user]);
  if (!ready) return <main className="page-shell"><div className="loading-card"><span className="spinner" /> Chargement de votre espace…</div></main>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.role !== "customer") return <Navigate to="/gestion" replace />;
  return <main className="page-shell account-page"><div className="account-heading"><span className="eyebrow"><span className="eyebrow-line" /> VOTRE ESPACE</span><h1>Bonjour, {user.fullName.split(" ")[0]}<em>.</em></h1><p>Vos demandes de séjour, au même endroit.</p></div>{error && <div className="notice notice-error">{error}</div>}<div className="account-section-heading"><h2>Mes séjours</h2><Link className="button button-dark button-small" to="/#sejours">Explorer les séjours <ArrowRight size={15} /></Link></div>{bookings.length ? <div className="booking-list">{bookings.map((booking) => <article className="booking-list-card" key={booking.id}><div className="booking-list-icon"><CalendarDays /></div><div className="booking-list-info"><b>{booking.complexName}</b><span>{formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}</span><small>{booking.groupSize} personnes · {booking.groupType}{booking.mealOption ? ` · ${booking.mealOption}` : ""}</small></div><span className={`status-pill status-${booking.status}`}>{booking.status === "confirmed" && <Check size={13} />}{statusLabels[booking.status]}</span></article>)}</div> : <div className="empty-state"><span className="empty-icon"><CalendarDays size={24} /></span><h4>Pas encore de séjour</h4><p>Votre prochaine aventure d'équipe commence ici.</p><Link className="button button-dark" to="/#sejours">Explorer les complexes <ArrowRight size={16} /></Link></div>}</main>;
}

interface ManagerBooking extends BookingItem {
  customerName: string;
  customerEmail: string;
  managerNote: string | null;
  dormitories: { name: string; beds: number }[];
  facilities: { name: string; sport: string }[];
}

function ManagerPage() {
  const { user, ready } = useAuth();
  const [bookings, setBookings] = useState<ManagerBooking[]>([]);
  const [complexes, setComplexes] = useState<{ id: string; name: string }[]>([]);
  const [sports, setSports] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [resourceType, setResourceType] = useState<"facility" | "dormitory" | "meal">("facility");

  async function load() {
    const [bookingResult, complexResult, sportResult] = await Promise.all([
      api<{ bookings: ManagerBooking[] }>("/api/manager/bookings"),
      api<{ complexes: { id: string; name: string }[] }>("/api/manager/complexes"),
      api<{ sports: { id: string; name: string }[] }>("/api/sports"),
    ]);
    setBookings(bookingResult.bookings);
    setComplexes(complexResult.complexes);
    setSports(sportResult.sports);
  }
  useEffect(() => {
    if (user && user.role !== "customer") load().catch((reason: Error) => setError(reason.message));
  }, [user]);

  async function updateStatus(id: string, status: "confirmed" | "cancelled") {
    setBusyId(id);
    setError("");
    try {
      await api(`/api/manager/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setMessage(status === "confirmed" ? "Demande confirmée. Le client verra la mise à jour." : "Demande annulée. Les ressources sont de nouveau disponibles.");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusyId("");
    }
  }

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const complexId = String(form.get("complexId"));
    const name = String(form.get("name"));
    const description = String(form.get("description") ?? "");
    const path = resourceType === "facility" ? "facilities" : resourceType === "dormitory" ? "dormitories" : "meals";
    const body = resourceType === "facility"
      ? { name, description, facilityType: String(form.get("facilityType")), sportId: String(form.get("sportId")) }
      : resourceType === "dormitory"
        ? { name, description, bedCount: Number(form.get("bedCount")) }
        : { name, description };
    setError("");
    setMessage("");
    try {
      await api(`/api/manager/complexes/${complexId}/${path}`, { method: "POST", body: JSON.stringify(body) });
      setMessage("La ressource a bien été ajoutée.");
      formElement.reset();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!ready) return <main className="page-shell"><div className="loading-card"><span className="spinner" /> Chargement de votre espace…</div></main>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.role === "customer") return <Navigate to="/mon-espace" replace />;
  return <main className="page-shell manager-page"><div className="account-heading"><span className="eyebrow"><span className="eyebrow-line" /> ESPACE GESTIONNAIRE</span><h1>Le jeu se prépare <em>ici.</em></h1><p>Gérez les demandes et les ressources de vos complexes.</p></div>{error && <div className="notice notice-error" role="alert">{error}</div>}{message && <div className="notice notice-success" role="status">{message}</div>}<section className="manager-section"><div className="account-section-heading"><h2>Demandes de séjour <span className="heading-count">{bookings.filter((booking) => booking.status === "pending").length}</span></h2></div>{bookings.length ? <div className="manager-bookings">{bookings.map((booking) => <article className="manager-booking-card" key={booking.id}><div className="manager-booking-top"><div><span className="eyebrow">{booking.complexName}</span><h3>{booking.customerName} <small>· {booking.groupType}, {booking.groupSize} personnes</small></h3></div><span className={`status-pill status-${booking.status}`}>{statusLabels[booking.status]}</span></div><div className="manager-booking-details"><span><CalendarDays size={14} /> {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}</span><span><Dumbbell size={14} /> {booking.facilities.map((item) => item.name).join(", ")}</span><span><BedDouble size={14} /> {booking.dormitories.map((item) => `${item.name} · ${item.beds} lits`).join(", ")}</span><span><Utensils size={14} /> {booking.mealOption ?? "Sans option repas"}</span><a href={`mailto:${booking.customerEmail}`}>{booking.customerEmail}</a></div>{booking.status === "pending" && <div className="manager-actions"><button className="button button-dark button-small" disabled={busyId === booking.id} onClick={() => void updateStatus(booking.id, "confirmed")}><Check size={14} /> Confirmer</button><button className="button button-outline button-small" disabled={busyId === booking.id} onClick={() => void updateStatus(booking.id, "cancelled")}><X size={14} /> Annuler la demande</button></div>}</article>)}</div> : <div className="empty-state"><h4>Aucune demande pour le moment</h4><p>Les nouvelles demandes apparaitront ici.</p></div>}</section><section className="manager-section resource-section"><div className="account-section-heading"><h2>Ajouter une ressource</h2></div><form className="resource-form" onSubmit={createResource}><label className="form-field"><span>COMPLEXE</span><select name="complexId" required defaultValue=""><option value="" disabled>Choisir un complexe</option>{complexes.map((complex) => <option value={complex.id} key={complex.id}>{complex.name}</option>)}</select></label><label className="form-field"><span>TYPE DE RESSOURCE</span><select value={resourceType} onChange={(event) => setResourceType(event.target.value as typeof resourceType)}><option value="facility">Infrastructure sportive</option><option value="dormitory">Dortoir</option><option value="meal">Option repas</option></select></label><label className="form-field"><span>NOM</span><input name="name" required minLength={2} maxLength={160} placeholder="Nom de la ressource" /></label>{resourceType === "facility" && <><label className="form-field"><span>SPORT</span><select name="sportId" required defaultValue="">{sports.map((sport) => <option value={sport.id} key={sport.id}>{sport.name}</option>)}</select></label><label className="form-field"><span>TYPE D'INFRASTRUCTURE</span><input name="facilityType" required placeholder="Terrain, salle…" /></label></>}{resourceType === "dormitory" && <label className="form-field"><span>NOMBRE DE LITS</span><input type="number" name="bedCount" required min="1" max="500" /></label>}<label className="form-field resource-description"><span>DESCRIPTION</span><textarea name="description" rows={3} maxLength={2000} placeholder="Informations utiles pour les clubs" /></label><button className="button button-dark">Ajouter cette ressource <ArrowRight size={15} /></button></form></section></main>;
}

function AdminPage() {
  const { user, ready } = useAuth();
  const [complexes, setComplexes] = useState<{ id: string; name: string; region: string; isPublished: boolean; managerEmail: string | null }[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; fullName: string; role: string; complexName: string | null }[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [complexResult, userResult] = await Promise.all([
      api<{ complexes: { id: string; name: string; region: string; isPublished: boolean; managerEmail: string | null }[] }>("/api/manager/complexes"),
      api<{ users: typeof users }>("/api/admin/users"),
    ]);
    setComplexes(complexResult.complexes);
    setUsers(userResult.users);
  }

  useEffect(() => {
    if (user?.role === "admin") load().catch((reason: Error) => setError(reason.message));
  }, [user]);

  async function createComplex(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api("/api/admin/complexes", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          region: form.get("region"),
          address: form.get("address"),
          description: form.get("description"),
          isPublished: false,
        }),
      });
      formElement.reset();
      setMessage("Complexe créé en brouillon. Ajoutez un gestionnaire et ses ressources avant de le publier.");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api("/api/admin/managers", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          fullName: form.get("fullName"),
          password: form.get("password"),
          complexId: form.get("complexId"),
        }),
      });
      formElement.reset();
      setMessage("Compte gestionnaire créé et assigné au complexe.");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publishComplex(id: string) {
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/complexes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: true }),
      });
      setMessage("Complexe publié dans le catalogue.");
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  if (!ready) return <main className="page-shell"><div className="loading-card"><span className="spinner" /> Chargement de votre espace…</div></main>;
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.role !== "admin") return <Navigate to={user.role === "customer" ? "/mon-espace" : "/gestion"} replace />;
  return (
    <main className="page-shell manager-page">
      <div className="account-heading"><span className="eyebrow"><span className="eyebrow-line" /> ADMINISTRATION</span><h1>Tout le monde <em>dans le jeu.</em></h1><p>Gérez les comptes, préparez les complexes et leur publication.</p></div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {message && <div className="notice notice-success" role="status">{message}</div>}
      <section className="manager-section">
        <div className="account-section-heading"><h2>Complexes <span className="heading-count">{complexes.length}</span></h2></div>
        {complexes.length ? <div className="admin-complex-list">{complexes.map((complex) => {
          return <article className="admin-complex-row" key={complex.id}><span className="facility-icon"><MapPin size={17} /></span><span className="admin-complex-info"><b>{complex.name}</b><small>{complex.region} · {complex.managerEmail ?? "Gestionnaire non assigné"}</small></span><span className={`status-pill ${complex.isPublished ? "status-confirmed" : "status-pending"}`}>{complex.isPublished ? "Publié" : "Brouillon"}</span>{!complex.isPublished && complex.managerEmail && <button className="button button-dark button-small" onClick={() => void publishComplex(complex.id)}>Publier <ArrowUpRight size={14} /></button>}</article>;
        })}</div> : <div className="empty-state"><h4>Aucun complexe configuré</h4><p>Créez un complexe puis attribuez-lui un gestionnaire.</p></div>}
      </section>
      <section className="manager-section resource-section">
        <div className="account-section-heading"><h2>Créer un complexe</h2></div>
        <form className="resource-form" onSubmit={createComplex}>
          <label className="form-field"><span>NOM DU COMPLEXE</span><input name="name" required minLength={2} maxLength={160} /></label>
          <label className="form-field"><span>RÉGION</span><input name="region" required minLength={2} maxLength={100} /></label>
          <label className="form-field"><span>ADRESSE</span><input name="address" maxLength={300} /></label>
          <label className="form-field resource-description"><span>DESCRIPTION</span><textarea name="description" rows={3} maxLength={5000} /></label>
          <button className="button button-dark" disabled={busy}>Créer en brouillon <ArrowRight size={15} /></button>
        </form>
      </section>
      <section className="manager-section resource-section">
        <div className="account-section-heading"><h2>Créer un compte gestionnaire</h2></div>
        <form className="resource-form" onSubmit={createManager}>
          <label className="form-field"><span>NOM COMPLET</span><input name="fullName" required minLength={2} maxLength={120} /></label>
          <label className="form-field"><span>ADRESSE E-MAIL</span><input type="email" name="email" required maxLength={254} /></label>
          <label className="form-field"><span>MOT DE PASSE TEMPORAIRE <small>(12 CARACTÈRES MINIMUM)</small></span><input type="password" name="password" required minLength={12} maxLength={200} /></label>
          <label className="form-field"><span>COMPLEXE À GÉRER</span><select name="complexId" required defaultValue=""><option value="" disabled>Choisir un complexe sans gestionnaire</option>{complexes.filter((complex) => !complex.managerEmail).map((complex) => <option key={complex.id} value={complex.id}>{complex.name}</option>)}</select></label>
          <button className="button button-dark" disabled={busy}>Créer le compte <ArrowRight size={15} /></button>
        </form>
      </section>
      <section className="manager-section">
        <div className="account-section-heading"><h2>Comptes de la plateforme</h2></div>
        <div className="admin-users">{users.map((item) => <div className="admin-user-row" key={item.id}><span className="admin-user-avatar"><CircleUserRound size={17} /></span><span><b>{item.fullName}</b><small>{item.email}</small></span><span className="user-role">{item.role === "admin" ? "Administrateur" : item.role === "manager" ? "Gestionnaire" : "Client"}</span><small>{item.complexName ?? ""}</small></div>)}</div>
      </section>
    </main>
  );
}

function NotFound() {
  return <main className="page-shell not-found"><span className="eyebrow">HORS-JEU ?</span><h1>On ne trouve pas cette page.</h1><Link className="button button-dark" to="/">Retourner au terrain <ArrowRight size={16} /></Link></main>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-main"><Link className="brand footer-brand" to="/"><span className="brand-mark"><span /><span /><span /><span /></span><span>terrain<span className="brand-light">commun</span><small>LES SÉJOURS QUI FONT ÉQUIPE</small></span></Link><p>Le sport rassemble.<br />Les séjours aussi.</p><div className="footer-links"><a href="/#sejours">Les séjours</a><a href="/#concept">Le concept</a><Link to="/inscription">Créer un compte</Link></div></div><div className="footer-bottom"><span>© Terrain Commun · Les équipes d'abord.</span><span>FAIT POUR JOUER COLLECTIF <span className="footer-star">✳</span></span></div></footer>;
}
