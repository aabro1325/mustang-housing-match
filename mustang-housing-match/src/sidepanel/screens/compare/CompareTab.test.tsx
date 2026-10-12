// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/preact";
import { CHORRO, CHORRO_COMMUTE, FOOTHILL, FOOTHILL_COMMUTE, HATHWAY, HATHWAY_COMMUTE, MAYA } from "@/core/fixtures";
import type { SavedListing } from "@/core/domain";
import { memoryStore } from "@/core/storage";
import { fixtureCommuteProvider } from "@/providers/commute/fixture";
import { localSharingProvider } from "@/providers/sharing/local";
import { SharingController, initialSharingState, type SharingState } from "../../state/sharing";
import { createStore } from "../../state/store";
import { CompareTab } from "../CompareTab";
import { compareView, shortName } from "./compareView";

function saved(id: string, listing: typeof FOOTHILL, commute: typeof FOOTHILL_COMMUTE, finalist = true): SavedListing {
  return { id, listing, commute, status: "saved", finalist, tourAt: null, landlordQuestions: [], notes: [], fitScores: {}, addedBy: "me", createdAt: id, updatedAt: id, version: 1 };
}

function controllerWith(rows: SavedListing[]) {
  const local = memoryStore();
  const store = createStore<SharingState>({ ...initialSharingState, loaded: true, status: { kind: "ready" }, prefs: MAYA, saved: rows, identityId: "me" });
  const services = {
    sync: memoryStore(), local, commute: fixtureCommuteProvider(), sharing: localSharingProvider({ store: local }),
    tabs: { listingTab: async () => undefined, onChange: () => () => {} }, capture: async () => { throw new Error("unused"); }, selectedText: async () => "", now: () => new Date(),
  };
  const c = new SharingController(services, { store });
  c.init = async () => {};
  return c;
}

describe("compareView", () => {
  it("shortens street addresses to the street name", () => {
    expect(shortName("870 Foothill Blvd, San Luis Obispo, CA 93405")).toBe("Foothill");
    expect(shortName("124 Hathway Ave")).toBe("Hathway");
    expect(shortName("1150 Chorro St")).toBe("Chorro");
  });

  it("picks the highest-scoring finalist as leader and builds a verdict", () => {
    const v = compareView([saved("a", FOOTHILL, FOOTHILL_COMMUTE), saved("b", HATHWAY, HATHWAY_COMMUTE), saved("c", CHORRO, CHORRO_COMMUTE)], MAYA);
    expect(v.columns).toHaveLength(3);
    expect(v.leaderId).toBe("b");
    expect(v.verdict?.title).toMatch(/^Hathway leads/);
    expect(v.columns[0]!.minutesOk).toBe(true);
    expect(v.columns[2]!.minutesOk).toBe(false);
    expect(v.columns[1]!.utilities).toBe("Included");
  });
});

describe("CompareTab", () => {
  it("asks for two finalists when there is one", () => {
    render(<CompareTab controller={controllerWith([saved("a", FOOTHILL, FOOTHILL_COMMUTE)])} onNavigate={vi.fn()} />);
    expect(screen.getByText("One finalist so far")).toBeTruthy();
    cleanup();
  });

  it("renders two finalists side by side with the three blocks and the verdict", () => {
    const nav = vi.fn();
    render(<CompareTab controller={controllerWith([saved("a", FOOTHILL, FOOTHILL_COMMUTE), saved("b", HATHWAY, HATHWAY_COMMUTE), saved("c", CHORRO, CHORRO_COMMUTE, false)])} onNavigate={nav} />);
    expect(screen.getByText("2-listing comparison")).toBeTruthy();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Foothill", "Hathway*", "Foothill", "Hathway*", "Foothill", "Hathway*"]);
    expect(screen.getByRole("table", { name: "Total cost, not just rent" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Your everyday fit" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Amenities and unknowns" })).toBeTruthy();
    expect(screen.getByText(/^Hathway leads/)).toBeTruthy();
    expect(screen.queryByText("Chorro")).toBeNull();
    screen.getByRole("button", { name: "Review with roommates" }).click();
    expect(nav).toHaveBeenCalledWith("roommates");
    cleanup();
  });
});
