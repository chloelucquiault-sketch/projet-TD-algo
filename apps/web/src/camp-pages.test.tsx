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

function mockApi(signedIn = false) {
  let authenticated = signedIn;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    let body: unknown;
    let status = 200;
    if (path === "/api/auth/me") body = { user: authenticated ? customer : null };
    else if (path === "/api/auth/login" && init?.method === "POST") {
      authenticated = true;
      body = { user: customer };
    } else if (path === "/api/camp-sessions") body = { sessions: [campSession] };
    else if (path === `/api/camp-sessions/${sessionId}/enrollments` && init?.method === "POST") {
      body = { enrollment: { id: "enrollment-id", status: "pending" } };
      status = 201;
    } else if (path === "/api/camp-enrollments/mine") body = { enrollments: [] };
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
    expect(screen.getByRole("heading", { name: "Les Petits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Les Moyens" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Les Ados" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Adultes & Confirmés" })).toBeTruthy();
    expect(screen.getByRole("img", { name: /vallée alpine.*été/i })).toBeTruthy();
    expect(screen.getByAltText("Deux enfants jouent au football en plein air.")).toBeTruthy();
    expect(document.querySelector(".camp-hero-stamp")).toBeNull();
    expect(screen.queryByText("20 places maximum par départ")).toBeNull();
    expect(await screen.findByText("Colonie des Petits")).toBeTruthy();
    expect(screen.queryByText("Domaine des Cèdres")).toBeNull();
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
});
