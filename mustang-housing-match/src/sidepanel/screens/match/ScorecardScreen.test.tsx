// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/preact";
import { FOOTHILL, FOOTHILL_COMMUTE, MAYA } from "@/core/fixtures";
import { fitScore } from "@/core/scoring";
import { ScorecardScreen, scoreBand } from "./ScorecardScreen";

const noop = () => {};

function renderFoothill(over: Partial<Parameters<typeof ScorecardScreen>[0]> = {}) {
  const result = fitScore(FOOTHILL.facts, FOOTHILL_COMMUTE, MAYA);
  return {
    result,
    ...render(
      <ScorecardScreen
        listing={FOOTHILL} result={result} prefs={MAYA} commute={{ status: "done", value: FOOTHILL_COMMUTE }} save={{ status: "idle" }}
        onSave={noop} onEdit={noop} onRetryCommute={noop} onEditAddress={noop} onAnother={noop} onPreferences={noop} {...over}
      />,
    ),
  };
}

describe("ScorecardScreen", () => {
  it("renders the Foothill fixture: score, address, cost lines, commute modes, insights, questions", () => {
    const { result } = renderFoothill();
    expect(screen.getByRole("img", { name: `Fit Score ${result.score} out of 100` })).toBeTruthy();
    expect(screen.getByText(/870 Foothill Blvd/)).toBeTruthy();
    expect(screen.getByText("Base rent")).toBeTruthy();
    expect(screen.getAllByText("Estimate").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Bike (your mode)")).toBeTruthy();
    expect(screen.getByText("9 min")).toBeTruthy();
    expect(screen.getAllByText(/12-month lease; you prefer school-year/).length).toBeGreaterThan(0);
    expect(screen.getByText("Which utilities are included in the rent?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save listing" })).toBeTruthy();
    cleanup();
  });

  it("shows the failure states with the fixed texts and their actions", () => {
    const retry = vi.fn();
    const edit = vi.fn();
    const result = fitScore(FOOTHILL.facts, { kind: "transient-failure", message: "Rate limited", referencePointVersion: 1 }, MAYA);
    render(
      <ScorecardScreen listing={FOOTHILL} result={result} prefs={MAYA} commute={{ status: "done", value: { kind: "transient-failure", message: "Rate limited", referencePointVersion: 1 } }} save={{ status: "idle" }}
        onSave={noop} onEdit={noop} onRetryCommute={retry} onEditAddress={edit} onAnother={noop} onPreferences={noop} />,
    );
    expect(screen.getByText("Commute lookup failed")).toBeTruthy();
    expect(screen.getByText("Commute lookup failed; retry")).toBeTruthy();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(retry).toHaveBeenCalled();
    cleanup();

    const nf = fitScore(FOOTHILL.facts, { kind: "address-not-found", referencePointVersion: 1 }, MAYA);
    render(
      <ScorecardScreen listing={FOOTHILL} result={nf} prefs={MAYA} commute={{ status: "done", value: { kind: "address-not-found", referencePointVersion: 1 } }} save={{ status: "idle" }}
        onSave={noop} onEdit={noop} onRetryCommute={retry} onEditAddress={edit} onAnother={noop} onPreferences={noop} />,
    );
    expect(screen.getByText("Address could not be located; Commute not scored")).toBeTruthy();
    screen.getByRole("button", { name: "Edit address" }).click();
    expect(edit).toHaveBeenCalled();
    expect(nf.categories.commute.points).toBe(0);
    cleanup();
  });

  it("bands the headline by score", () => {
    expect(scoreBand(85).title).toBe("A strong fit");
    expect(scoreBand(70).title).toBe("A solid fit, with tradeoffs");
    expect(scoreBand(40).title).toBe("A stretch for your priorities");
  });
});
