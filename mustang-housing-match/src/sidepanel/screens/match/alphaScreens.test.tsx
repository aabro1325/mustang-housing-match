// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/preact";
import { FOOTHILL, MAYA } from "@/core/fixtures";
import { visibleTabs } from "../../components/TabBar";
import { PreferencesScreen } from "./PreferencesScreen";
import { ReviewScreen } from "./ReviewScreen";
import type { ReviewDraft } from "../../state/match";

const review: ReviewDraft = {
  mode: "captured",
  source: "zillow",
  sourceUrl: FOOTHILL.sourceUrl,
  title: FOOTHILL.title,
  facts: FOOTHILL.facts,
  floorPlans: [],
  floorPlanId: null,
  warnings: [],
  captured: FOOTHILL.facts,
};

describe("alpha preferences and review", () => {
  it("keeps only the Match tab", () => {
    expect(visibleTabs("full").map((t) => t.id)).toEqual(["match", "saved", "compare", "roommates"]);
    expect(visibleTabs("alpha").map((t) => t.id)).toEqual(["match"]);
  });

  it("keeps transportation and hides commute time and the commute priority", () => {
    render(<PreferencesScreen initial={MAYA} onSave={vi.fn()} onBack={vi.fn()} canGoBack scope="alpha" />);
    expect(screen.getByRole("radiogroup", { name: "Getting to Cal Poly" })).toBeTruthy();
    expect(screen.getByLabelText("Maximum monthly budget")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Lease length" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Your room" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Cost priority" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Lease priority" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Amenities priority" })).toBeTruthy();
    expect(screen.queryByLabelText("Maximum commute time")).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Commute priority" })).toBeNull();
    cleanup();
  });

  it("hides fees and deposit on review and still shows captured facts", () => {
    const noop = () => {};
    render(
      <ReviewScreen review={review} scope="alpha" onEdit={noop} onAmenity={noop} onRentBasis={noop} onPlan={noop} onConfirm={noop} onBack={noop} />,
    );
    expect(screen.getByLabelText(/Address/)).toBeTruthy();
    expect(screen.getByLabelText(/Monthly rent/)).toBeTruthy();
    expect(screen.getByLabelText(/Bedrooms/)).toBeTruthy();
    expect(screen.getByLabelText(/Bathrooms/)).toBeTruthy();
    expect(screen.getByLabelText(/Lease length/)).toBeTruthy();
    expect(screen.getByText("Parking")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Fees and deposit" })).toBeNull();
    expect(screen.queryByLabelText("Deposit")).toBeNull();
    cleanup();

    render(
      <ReviewScreen review={review} scope="full" onEdit={noop} onAmenity={noop} onRentBasis={noop} onPlan={noop} onConfirm={noop} onBack={noop} />,
    );
    expect(screen.getByRole("heading", { name: "Fees and deposit" })).toBeTruthy();
    cleanup();
  });
});
