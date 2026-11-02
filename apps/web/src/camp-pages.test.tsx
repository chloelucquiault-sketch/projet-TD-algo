// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampApp } from "./camp-pages";

const sessionId = "45d80966-6edb-4836-9a22-8a10e6d868c0";
const customer = {
  id: "c4164e80-0c54-4f48-984b-cd495079f530",
  email: "parent@example.test",
  fullName: "Camille Martin",
  role: "customer" as const,
};
const campSession = {
  id: sessionId,
  season: "summer" as const,
  ageGroup: "little" as const,
  title: "Colonie des Petits",
  description: "Une aventure sportive dans les Alpes.",
  activities: "Randonnée et jeux de plein air",
  startDate: "2030-07-10",
  endDate: "2030-07-13",
  durationDays: 4,
  capacity: 20,
  reservedPlaces: 2,
  remainingPlaces: 18,
};
const secondCampSession = {
  ...campSession,
  id: "80f77778-e1f2-4c7a-8d55-0d5443510068",
  title: "Colonie des Petits — créneau de janvier",
  startDate: "2031-01-01",
  endDate: "2031-01-04",
  reservedPlaces: 7,
  remainingPlaces: 13,
};
const activeEnrollment = {
  id: "enrollment-id",
  status: "pending" as const,
  adminNote: null,
  cancellationReason: null,
  internalNote: null,
  createdAt: "2030-01-01T10:00:00.000Z",
  processedAt: null,
  consentRecordedAt: "2030-01-01T10:00:00.000Z",
  session: {
    id: sessionId,
    title: campSession.title,
    season: campSession.season,
    ageGroup: campSession.ageGroup,
    startDate: campSession.startDate,
    endDate: campSession.endDate,
  },
  participants: [{
    id: "participant-id",
    firstName: "Lou",
    lastName: "Martin",
    birthDate: "2020-06-01",
  }],
};
const organizerEnrollment = {
  ...activeEnrollment,
  customer: { id: customer.id, name: customer.fullName, email: customer.email },
};
type TestContactConversation = {
  id: string;
  isRead: boolean;
  updatedAt: string;
  customer: { name: string; email: string };
  messages: { id: string; message: string; createdAt: string; senderRole: "customer" | "admin" }[];
};

function mockApi(
  signedIn = false,
  role: "customer" | "admin" = "customer",
  expireOnEnrollment = false,
  multipleSessions = false,
  enrollments: typeof activeEnrollment[] = [],
  contactConversations: TestContactConversation[] = [],
  organizerSessions: (typeof campSession & { hasEnrollments?: boolean })[] = [],
  organizerEnrollments: typeof organizerEnrollment[] = [],
) {
  let authenticated = signedIn;
  const signedInUser = { ...customer, role };
  let conversations = [...contactConversations];
  let customerConversation = conversations.find((conversation) => conversation.customer.email === customer.email) ?? null;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    let body: unknown;
    let status = 200;
    if (path === "/api/auth/me") body = { user: authenticated ? signedInUser : null };
    else if (path === "/api/auth/login" && init?.method === "POST") {
      authenticated = true;
      body = { user: signedInUser };
    } else if (path === "/api/camp-sessions") body = { sessions: multipleSessions ? [campSession, secondCampSession] : [campSession] };
    else if (path === `/api/camp-sessions/${sessionId}/enrollments` && init?.method === "POST") {
      if (expireOnEnrollment) {
        body = { error: { message: "Connecte-toi pour accéder à cette page." } };
        status = 401;
      } else {
        body = { enrollment: { id: "enrollment-id", status: "pending" } };
        status = 201;
      }
    } else if (path === "/api/camp-enrollments/mine") body = { enrollments };
    else if (path === "/api/contact-messages" && init?.method === "POST") {
      const submitted = JSON.parse(String(init.body)).message as string;
      const createdAt = "2030-01-02T10:00:00.000Z";
      customerConversation ??= {
        id: "contact-thread-id",
        isRead: false,
        updatedAt: createdAt,
        customer: { name: customer.fullName, email: customer.email },
        messages: [],
      };
      customerConversation = {
        ...customerConversation,
        isRead: false,
        updatedAt: createdAt,
        messages: [...customerConversation.messages, {
          id: "contact-message-id",
          message: submitted,
          createdAt,
          senderRole: role === "admin" ? "admin" : "customer",
        }],
      };
      conversations = [...conversations.filter((conversation) => conversation.id !== customerConversation!.id), customerConversation];
      body = { message: { id: "contact-message-id", conversationId: "contact-thread-id", message: submitted, senderRole: "customer", createdAt } };
      status = 201;
    } else if (path === "/api/contact-messages/mine") body = { conversation: customerConversation };
    else if (path === "/api/admin/contact-messages") body = { conversations };
    else if (path === "/api/admin/camp-sessions") body = { sessions: organizerSessions };
    else if (path === "/api/admin/camp-enrollments") body = { enrollments: organizerEnrollments };
    else if (path.match(/^\/api\/admin\/contact-messages\/[^/]+\/replies$/) && init?.method === "POST") {
      const threadId = path.split("/")[4]!;
      const submitted = JSON.parse(String(init.body)).message as string;
      const createdAt = "2030-01-03T10:00:00.000Z";
      conversations = conversations.map((conversation) => conversation.id === threadId ? {
        ...conversation,
        isRead: true,
        updatedAt: createdAt,
        messages: [...conversation.messages, { id: "reply-id", message: submitted, senderRole: "admin", createdAt }],
      } : conversation);
      body = { message: { id: "reply-id", message: submitted, senderRole: "admin", createdAt } };
      status = 201;
    } else if (path.match(/^\/api\/admin\/contact-messages\/[^/]+\/read$/) && init?.method === "PATCH") {
      const threadId = path.split("/")[4]!;
      const { isRead } = JSON.parse(String(init.body)) as { isRead: boolean };
      conversations = conversations.map((conversation) => conversation.id === threadId ? { ...conversation, isRead } : conversation);
      body = { conversation: { id: threadId, isRead } };
    } else if (path.match(/^\/api\/admin\/camp-enrollments\/[^/]+\/note$/) && init?.method === "PATCH") {
      body = { enrollment: { id: path.split("/")[4], internalNote: JSON.parse(String(init.body)).internalNote } };
    } else if (path.match(/^\/api\/admin\/camp-sessions\/[^/]+$/) && init?.method === "DELETE") {
      body = {};
    }
    else if (path === `/api/camp-enrollments/${activeEnrollment.id}/cancel` && init?.method === "POST") {
      body = {
        enrollment: {
          id: activeEnrollment.id,
          status: "cancelled",
          cancellationReason: JSON.parse(String(init.body)).reason,
        },
      };
    }
    else {
      body = { error: { message: "Route de test inconnue." } };
      status = 404;
    }
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }));
}

beforeEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("application Alpes Camp", () => {
  it("présente les quatre groupes d'âge et les départs configurés", async () => {
    mockApi();
    render(<BrowserRouter><CampApp /></BrowserRouter>);
    expect(await screen.findByRole("heading", { name: /Le grand air/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Séjours d'hiver" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Séjours d'été" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Les Petits" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Les Moyens" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Les Ados" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { name: "Adultes & Confirmés" })).toHaveLength(2);
    expect(screen.getByRole("img", { name: /vallée alpine.*été/i })).toBeTruthy();
    expect(screen.getByAltText("Deux enfants jouent au football en plein air.")).toBeTruthy();
    expect(document.querySelector(".camp-hero-stamp")).toBeNull();
    expect(screen.queryByText("20 places maximum par départ")).toBeNull();
    expect(await screen.findByText("Colonie des Petits")).toBeTruthy();
    fireEvent.click([...document.querySelectorAll(".camp-departure-menu summary")].find((summary) => summary.textContent === "Voir les créneaux (1)")!);
    expect(screen.getByText("18 place(s) restante(s)")).toBeTruthy();
    expect(screen.queryByText("Domaine des Cèdres")).toBeNull();
  });

  it("ouvre la fiche du séjour depuis sa catégorie et montre les places restantes avant réservation", async () => {
    mockApi();
    render(<BrowserRouter><CampApp /></BrowserRouter>);
    await screen.findByText("Colonie des Petits");
    fireEvent.click(screen.getAllByRole("link", { name: "Découvrir le séjour Les Petits" })[0]!);

    expect(await screen.findByRole("heading", { name: "Les Petits" })).toBeTruthy();
    expect(screen.getByText("« Premiers pas éco-aventuriers »")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "☀️ Séjours d'été" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "❄️ Séjours d'hiver" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Randonnées contées et douces" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Petits gardiens de la montagne" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Premières traces dans la neige" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Un groupe de bouquetins évolue sur une crête rocheuse des Alpes." })).toBeTruthy();
    expect(document.querySelectorAll(".camp-activity-photo a")).toHaveLength(3);
    fireEvent.click([...document.querySelectorAll(".camp-program-season-menu summary")].find((summary) => summary.textContent?.includes("Séjours d'été"))!);
    expect(screen.getByText("18 place(s) restante(s)")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Réserver" }));
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
  });

  it.each([
    ["little", "Les Petits"],
    ["middle", "Les Moyens"],
    ["teen", "Les Ados"],
    ["adult", "Adultes & Confirmés"],
  ] as const)("illustre les activités de la fiche %s avec des photos créditées", async (ageGroup, title) => {
    mockApi();
    window.history.replaceState({}, "", `/sejours/${ageGroup}`);
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    const images = document.querySelectorAll(".camp-activity-photo img");
    expect(images).toHaveLength(3);
    expect([...images].every((image) => image.getAttribute("alt"))).toBe(true);
    expect(document.querySelectorAll(".camp-activity-photo a")).toHaveLength(3);
  });

  it.each([
    ["little", "Les Petits", "Petits gardiens de la montagne", "Le manteau des animaux"],
    ["middle", "Les Moyens", "À la rencontre d'une estive", "Atelier « Neige et climat »"],
    ["teen", "Les Ados", "Chantier éco-citoyen", "Zones de tranquillité de la faune"],
    ["adult", "Adultes & Confirmés", "Cartographie participative de la biodiversité", "Ski-alpinisme et sécurité"],
  ] as const)("présente des activités distinctes par saison pour %s", async (ageGroup, title, summerActivity, winterActivity) => {
    mockApi();
    window.history.replaceState({}, "", `/sejours/${ageGroup}`);
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "☀️ Séjours d'été" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "❄️ Séjours d'hiver" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: summerActivity })).toBeTruthy();
    expect(screen.getByRole("heading", { name: winterActivity })).toBeTruthy();
  });

  it("affiche un bouton organisateur dans l'en-tête du compte administrateur", async () => {
    mockApi(true, "admin");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    const organizerLink = await screen.findByRole("link", { name: "Espace organisateur" });
    expect(organizerLink.getAttribute("href")).toBe("/organisateur");
  });

  it("impose la connexion puis transmet une inscription avec consentement", async () => {
    mockApi();
    window.history.replaceState({}, "", `/colonies/${sessionId}/inscription`);
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), { target: { value: customer.email } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "mot-de-passe-test" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByRole("heading", { name: "Colonie des Petits" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Lou" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Martin" } });
    fireEvent.change(screen.getByLabelText("Date de naissance"), { target: { value: "2020-06-01" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande d'inscription" }));

    expect(await screen.findByText("Votre demande a bien été envoyée. Elle est en attente de traitement.")).toBeTruthy();
    await waitFor(() => {
      const request = vi.mocked(fetch).mock.calls.find(([path]) => String(path).endsWith("/enrollments"));
      expect(request).toBeTruthy();
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        healthDataConsent: true,
        participants: [{ firstName: "Lou", lastName: "Martin", birthDate: "2020-06-01" }],
      });
    });
  });

  it("permet d'envoyer un message à l'organisateur depuis aide et contact", async () => {
    mockApi(true);
    window.history.replaceState({}, "", "/");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    fireEvent.click(await screen.findByRole("link", { name: "Aide et contact" }));
    expect(await screen.findByRole("heading", { name: /Aide et contact/ })).toBeTruthy();
    expect(screen.getByText(/parent@example\.test/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Ton message"), {
      target: { value: "Bonjour, pouvez-vous m'aider avec mon inscription ?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer à l'organisateur" }));

    expect(await screen.findByText(/Votre message a bien été envoyé/)).toBeTruthy();
    expect(screen.getByText("Bonjour, pouvez-vous m'aider avec mon inscription ?")).toBeTruthy();
    const request = vi.mocked(fetch).mock.calls.find(([path]) => String(path) === "/api/contact-messages");
    expect(request?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      message: "Bonjour, pouvez-vous m'aider avec mon inscription ?",
    });
  });

  it("affiche les messages reçus dans la boîte de réception organisateur", async () => {
    mockApi(true, "admin", false, false, [], [{
      id: "thread-id",
      isRead: false,
      updatedAt: "2030-01-02T10:00:00.000Z",
      customer: { name: "Camille Martin", email: "parent@example.test" },
      messages: [{
        id: "message-id",
        message: "Question sur les dates du séjour.",
        createdAt: "2030-01-02T10:00:00.000Z",
        senderRole: "customer",
      }],
    }]);
    window.history.replaceState({}, "", "/organisateur");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByRole("heading", { name: /Aide et contact/ })).toBeTruthy();
    expect(screen.getByText("Question sur les dates du séjour.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "parent@example.test" }).getAttribute("href")).toBe("mailto:parent@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Marquer comme lu" }));
    fireEvent.change(screen.getByLabelText("Répondre au client"), { target: { value: "Bonjour Camille, nous sommes disponibles pour vous aider." } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la réponse" }));
    expect(await screen.findByText("Bonjour Camille, nous sommes disponibles pour vous aider.")).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith("/thread-id/read"))).toBe(true);
    expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith("/thread-id/replies"))).toBe(true);
  });

  it("filtre les inscriptions et enregistre une note privée côté organisateur", async () => {
    mockApi(true, "admin", false, false, [], [], [campSession], [organizerEnrollment]);
    window.history.replaceState({}, "", "/organisateur");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByLabelText("Rechercher")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Rechercher"), { target: { value: "parent@example.test" } });
    expect(screen.getByText("Camille Martin ·")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Note interne (visible uniquement par l'organisateur)"), {
      target: { value: "Rappeler au sujet du transport." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la note interne" }));
    await screen.findByRole("status");
    const noteRequest = vi.mocked(fetch).mock.calls.find(([path]) => String(path).endsWith("/enrollment-id/note"));
    expect(noteRequest?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(noteRequest?.[1]?.body))).toEqual({ internalNote: "Rappeler au sujet du transport." });
    expect(screen.getByText(/visible uniquement par l'organisateur/)).toBeTruthy();
  });

  it("regroupe les départs par saison et groupe et permet de supprimer un départ vide", async () => {
    mockApi(true, "admin", false, false, [], [], [{ ...campSession, hasEnrollments: false }]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    window.history.replaceState({}, "", "/organisateur");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    await screen.findByText("☀️ Séjours d'été");
    fireEvent.click(document.querySelector(".camp-session-season-group summary")!);
    expect(screen.getByText("Les Petits · 1 départ(s)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(vi.mocked(fetch).mock.calls.some(([path, init]) => String(path).endsWith(`/${sessionId}`) && init?.method === "DELETE")).toBe(true);
    expect(await screen.findByText("Le départ a été supprimé.")).toBeTruthy();
    vi.mocked(window.confirm).mockRestore();
  });

  it("affiche et envoie les réponses du client dans le fil de discussion", async () => {
    const conversation: TestContactConversation = {
      id: "thread-id",
      isRead: true,
      updatedAt: "2030-01-02T10:00:00.000Z",
      customer: { name: customer.fullName, email: customer.email },
      messages: [{
        id: "admin-message",
        message: "Bonjour, votre départ est bien confirmé.",
        createdAt: "2030-01-02T10:00:00.000Z",
        senderRole: "admin",
      }],
    };
    mockApi(true, "customer", false, false, [], [conversation]);
    window.history.replaceState({}, "", "/aide-et-contact");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByText("Bonjour, votre départ est bien confirmé.")).toBeTruthy();
    expect(screen.getByText("Organisateur")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Répondre à l'organisateur"), { target: { value: "Merci pour votre retour." } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer à l'organisateur" }));
    expect(await screen.findByText("Merci pour votre retour.")).toBeTruthy();
  });

  it("annule une réservation avec un motif transmis à l'organisateur", async () => {
    mockApi(true, "customer", false, false, [activeEnrollment]);
    window.history.replaceState({}, "", "/mes-inscriptions");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Annuler ma réservation" }));
    expect(await screen.findByRole("dialog", { name: "Annuler ma réservation" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motif de l'annulation"), {
      target: { value: "Changement de programme familial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'annulation" }));

    expect(await screen.findByText("Votre réservation a été annulée. Le motif a été transmis à l'organisateur.")).toBeTruthy();
    expect(screen.getByText("Annulée")).toBeTruthy();
    expect(screen.getByText("Changement de programme familial")).toBeTruthy();
    const request = vi.mocked(fetch).mock.calls.find(([path]) => String(path).endsWith("/cancel"));
    expect(request?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ reason: "Changement de programme familial" });
    expect(screen.queryByRole("button", { name: "Annuler ma réservation" })).toBeNull();
  });

  it("affiche plusieurs créneaux et les places restantes pour chaque départ", async () => {
    mockApi(false, "customer", false, true);
    window.history.replaceState({}, "", "/sejours/little");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByRole("heading", { name: "Réserver ce séjour" })).toBeTruthy();
    fireEvent.click([...document.querySelectorAll(".camp-program-season-menu summary")].find((summary) => summary.textContent?.includes("Séjours d'été"))!);
    expect(screen.getByText("Colonie des Petits")).toBeTruthy();
    expect(screen.getByText("Colonie des Petits — créneau de janvier")).toBeTruthy();
    expect(screen.getByText("18 place(s) restante(s)")).toBeTruthy();
    expect(screen.getByText("13 place(s) restante(s)")).toBeTruthy();
    expect(screen.queryByText(/40 place\(s\) restante\(s\)/)).toBeNull();
    expect(screen.getAllByRole("link", { name: "Réserver" })).toHaveLength(2);
  });

  it("indique de contacter l'organisateur en cas d'oubli du mot de passe", async () => {
    mockApi();
    window.history.replaceState({}, "", "/connexion");
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    expect(await screen.findByText("Merci de contacter l'organisateur pour tout oubli de mot de passe.")).toBeTruthy();
    expect(document.querySelector(".camp-demo-banner")).toBeNull();
  });

  it("renvoie vers la connexion si la session expire lors de l'envoi", async () => {
    mockApi(false, "customer", true);
    window.history.replaceState({}, "", `/colonies/${sessionId}/inscription`);
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    fireEvent.change(await screen.findByLabelText("Adresse e-mail"), { target: { value: customer.email } });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "mot-de-passe-test" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    await screen.findByRole("heading", { name: "Colonie des Petits" });

    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Lou" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Martin" } });
    fireEvent.change(screen.getByLabelText("Date de naissance"), { target: { value: "2020-06-01" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer la demande d'inscription" }));

    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("retour")).toBe(`/colonies/${sessionId}/inscription`);
  });

  it("refuse un participant qui aura moins de 5 ans au début du séjour", async () => {
    mockApi(true);
    window.history.replaceState({}, "", `/colonies/${sessionId}/inscription`);
    render(<BrowserRouter><CampApp /></BrowserRouter>);

    await screen.findByRole("heading", { name: "Colonie des Petits" });
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Lou" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Martin" } });
    fireEvent.change(screen.getByLabelText("Date de naissance"), { target: { value: "2026-07-11" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(document.querySelector(".camp-enrollment-form")!);

    expect(await screen.findByText("Chaque participant doit avoir au moins 5 ans au début du séjour.")).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.some(([path]) => String(path).endsWith("/enrollments"))).toBe(false);
  });
});
