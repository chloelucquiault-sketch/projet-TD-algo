// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./pages";

const complexId = "1c7d9a72-40db-4d2e-aadf-0e8ce1b10f80";
const user = {
  id: "45d80966-6edb-4836-9a22-8a10e6d868c0",
  email: "club@example.test",
  fullName: "Camille Martin",
  role: "customer" as const,
};
const details = {
  complex: {
    id: complexId,
    name: "Domaine des Cèdres",
    description: "Un séjour pour jouer collectif.",
    region: "Nouvelle-Aquitaine",
    address: "Landes, France",
    image_url: null,
  },
  facilities: [{
    id: "cdacb303-27f7-47f6-bac5-c8e5c21fba68",
    name: "Terrain de football",
    facilityType: "Terrain",
    description: "Terrain en gazon.",
    sportIds: ["a1c75f84-bdbb-4d32-b983-8dba998df004", "f750bcef-aeb6-482a-9669-abccf2623810"],
    sportNames: ["Football", "Rugby"],
    sportSlugs: ["football", "rugby"],
  }],
  dormitories: [{
    id: "9e40ae15-ae50-4de0-a54d-419a6d93d1e2",
    name: "Dortoir des Pins",
    description: "Dortoir collectif.",
    bedCount: 24,
  }],
  mealOptions: [{ id: "82cbf7fa-643b-46e5-95a6-d7a24f4f44a9", name: "Pension sportive", description: "Repas collectifs." }],
};
const complexSummary = {
  ...details.complex,
  available_beds: 40,
  facility_count: 2,
};

function dateIn(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mockApi(signedIn = false) {
  let authenticated = signedIn;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    let body: unknown;
    let status = 200;
    if (path === "/api/auth/me") body = { user: authenticated ? user : null };
    else if (path === "/api/auth/login" && init?.method === "POST") {
      authenticated = true;
      body = { user };
    }
    else if (path === "/api/complexes") body = { complexes: [complexSummary] };
    else if (path === "/api/sports") body = { sports: details.facilities[0]!.sportIds.map((id, index) => ({ id, name: details.facilities[0]!.sportNames[index], slug: details.facilities[0]!.sportSlugs[index] })) };
    else if (path === `/api/complexes/${complexId}`) body = details;
    else if (path.startsWith(`/api/complexes/${complexId}/availability`)) {
      body = { available: true, availableBeds: 24, dormitories: [{ id: details.dormitories[0]!.id, name: "Dortoir des Pins", available_beds: 24 }] };
    } else if (path.startsWith(`/api/complexes/${complexId}/day-availability`)) {
      body = { slots: [
        { startTime: "08:00", available: true },
        { startTime: "11:30", available: true },
        { startTime: "17:00", available: true },
      ] };
    } else if (path === "/api/bookings" && init?.method === "POST") {
      body = { booking: { id: "booking-id", status: "pending" } };
      status = 201;
    } else {
      body = { error: { message: "Route de test inconnue." } };
      status = 404;
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }));
}

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("application web", () => {
  it("fait défiler automatiquement les photos du bandeau", () => {
    mockApi();
    vi.useFakeTimers();
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(screen.getByRole("img", { name: /vallée alpine au petit matin/i })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(5500); });
    expect(screen.getByRole("img", { name: /Alpes suisses sous la neige/i })).toBeTruthy();
  });

  it("fait défiler les photos des séjours dans un carrousel accessible", async () => {
    mockApi();
    const { container } = render(<BrowserRouter><App /></BrowserRouter>);

    const carousel = await screen.findByRole("region", { name: "Photos des séjours sportifs" });
    expect(container.querySelector(".hero-art, .hero-sticker")).toBeNull();
    expect(carousel.querySelectorAll("figure")).toHaveLength(4);
    expect(screen.getByRole("img", { name: /vallée alpine au petit matin/i })).toBeTruthy();
    expect(screen.queryByText("LE SÉJOUR, SANS LES COMPLICATIONS")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Photo suivante" }));
    expect(screen.getByRole("img", { name: /Alpes suisses sous la neige/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause le défilement" }));
    expect(screen.getByRole("button", { name: "Reprendre le défilement" })).toBeTruthy();
  });

  it("affiche le catalogue et ouvre une fiche de complexe", async () => {
    mockApi();
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(await screen.findByRole("heading", { name: "On part où ?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Découvrir Domaine des Cèdres" }));
    expect(await screen.findByRole("heading", { name: "Domaine des Cèdres" })).toBeTruthy();
    expect(screen.getByText("Terrain de football")).toBeTruthy();
    expect(screen.getByText(/Football · Rugby/)).toBeTruthy();
    expect(screen.getByText("Dortoir des Pins")).toBeTruthy();
  });

  it("impose la connexion avant d'afficher les choix de réservation", async () => {
    mockApi();
    window.history.replaceState({}, "", `/reservation/${complexId}`);
    render(<BrowserRouter><App /></BrowserRouter>);

    expect(await screen.findByRole("heading", { name: "On reprend le jeu." })).toBeTruthy();
    expect(window.location.search).toContain(encodeURIComponent(`/reservation/${complexId}`));
    fireEvent.change(screen.getByLabelText("ADRESSE E-MAIL"), { target: { value: user.email } });
    fireEvent.change(screen.getByLabelText(/MOT DE PASSE/), { target: { value: "mot-de-passe-test" } });
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("heading", { name: /Comment voulez-vous jouer/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Réserver à la journée/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Réserver un séjour/i })).toBeTruthy();
  });

  it("permet de créer une demande depuis le parcours guidé", async () => {
    mockApi(true);
    window.history.replaceState({}, "", `/reservation/${complexId}`);
    render(<BrowserRouter><App /></BrowserRouter>);

    fireEvent.click(await screen.findByRole("button", { name: /Réserver un séjour/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Continuer/i }));
    fireEvent.change(screen.getByLabelText("DATE D'ARRIVÉE"), { target: { value: dateIn(10) } });
    fireEvent.change(screen.getByLabelText("DATE DE DÉPART"), { target: { value: dateIn(13) } });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Vérifier les disponibilités/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Continuer/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Envoyer ma demande/i }));

    expect(await screen.findByText("DEMANDE TRANSMISE")).toBeTruthy();
    await waitFor(() => {
      const requests = vi.mocked(fetch).mock.calls;
      expect(requests.some(([path]) => path === "/api/bookings")).toBe(true);
    });
  });

  it("permet de réserver plusieurs créneaux à la journée", async () => {
    mockApi(true);
    window.history.replaceState({}, "", `/reservation/${complexId}`);
    render(<BrowserRouter><App /></BrowserRouter>);

    fireEvent.click(await screen.findByRole("button", { name: /Réserver à la journée/i }));
    fireEvent.change(screen.getByLabelText("DATE"), { target: { value: dateIn(10) } });
    fireEvent.click(screen.getByRole("button", { name: "Vérifier les créneaux" }));
    fireEvent.click(await screen.findByRole("button", { name: /08:00/ }));
    fireEvent.click(screen.getByRole("button", { name: /11:30/ }));
    fireEvent.click(screen.getByRole("button", { name: /Envoyer ma demande/i }));

    expect(await screen.findByText("DEMANDE TRANSMISE")).toBeTruthy();
    const request = vi.mocked(fetch).mock.calls.find(([path]) => path === "/api/bookings");
    expect(request).toBeTruthy();
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      bookingType: "day",
      startTimes: ["08:00", "11:30"],
    });
  });
});
