import { useState } from "preact/hooks";
import { AMENITIES, CATEGORIES, type AmenityId, type Category, type LeaseType, type Preferences, type Priority, type RoomType, type TransportMode } from "@/core/domain";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Checkbox } from "../../components/Checkbox";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { Field } from "../../components/Field";
import { Header } from "../../components/Header";
import { WalkIcon, BikeIcon, BusIcon, CarIcon } from "../../components/icons";

const AMENITY_TEXT: Record<AmenityId, string> = {
  parking: "Parking", laundry: "Laundry", utilitiesIncluded: "Utilities included", pets: "Pets allowed", furnished: "Furnished",
};
const CATEGORY_TEXT: Record<Category, string> = { cost: "Cost", commute: "Commute", lease: "Lease", amenities: "Amenities" };

export function PreferencesScreen({ initial, onSave, onBack, onPreview, canGoBack }: {
  initial: Preferences; onSave: (p: Preferences) => void; onBack: () => void; onPreview?: (p: Preferences) => void; canGoBack: boolean;
}) {
  const [p, setP] = useState<Preferences>(initial);
  const [budgetText, setBudgetText] = useState(initial.budget === null ? "" : String(initial.budget));
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<Preferences>) => {
    const next = { ...p, ...patch };
    setP(next);
    onPreview?.(next);
  };
  const toggleAmenity = (id: AmenityId, on: boolean) =>
    update({ wantedAmenities: on ? AMENITIES.filter((a) => a === id || p.wantedAmenities.includes(a)) : p.wantedAmenities.filter((a) => a !== id) });

  const submit = (e: Event) => {
    e.preventDefault();
    const budget = budgetText.trim() === "" ? null : Number(budgetText.replace(/[^0-9.]/g, ""));
    if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) {
      setError("Enter a monthly amount, or leave it blank.");
      return;
    }
    if (!Number.isFinite(p.maxCommuteMinutes) || p.maxCommuteMinutes <= 0) {
      setError("Set a maximum commute in minutes.");
      return;
    }
    onSave({ ...p, budget });
  };

  return (
    <form class="stack" onSubmit={submit} aria-label="Preferences">
      <Header context="Your preferences" title="What feels like home?" lede="Your preferences shape the match. Monthly amounts are per person, not per property." />

      <Field label="Maximum monthly budget" id="budget" hint="Includes estimated rent, utilities, internet, and parking." trailing="$ / person" error={error && error.includes("amount") ? error : null}>
        <input id="budget" inputMode="decimal" placeholder="1,450" value={budgetText} onInput={(e) => setBudgetText((e.currentTarget as HTMLInputElement).value)} />
      </Field>

      <ChoiceGroup<TransportMode>
        label="Getting to Cal Poly"
        value={p.transportMode}
        onChange={(transportMode) => update({ transportMode })}
        choices={[
          { value: "walk", label: "Walk", icon: <WalkIcon /> },
          { value: "bike", label: "Bike", icon: <BikeIcon /> },
          { value: "bus", label: "Bus", icon: <BusIcon /> },
          { value: "car", label: "Car", icon: <CarIcon /> },
        ]}
      />

      <Field label="Maximum commute time" id="maxCommute" trailing="minutes" error={error && error.includes("commute") ? error : null}>
        <input id="maxCommute" inputMode="numeric" value={String(p.maxCommuteMinutes)} onInput={(e) => update({ maxCommuteMinutes: Number((e.currentTarget as HTMLInputElement).value) || 0 })} />
      </Field>

      <ChoiceGroup<LeaseType>
        label="Lease length"
        value={p.leaseType}
        onChange={(leaseType) => update({ leaseType })}
        choices={[{ value: "school-year", label: "School-year" }, { value: "12-month", label: "12-month" }]}
      />

      <ChoiceGroup<RoomType>
        label="Your room"
        value={p.roomType}
        onChange={(roomType) => update({ roomType })}
        choices={[{ value: "private", label: "Private room" }, { value: "shared", label: "Shared room" }]}
      />

      <div>
        <div class="row row--between"><span class="field__label" style="margin:0">Amenities you want</span><span class="fine">Select any</span></div>
        <Card class="amenities">
          {AMENITIES.map((a) => (
            <Checkbox key={a} id={`amenity-${a}`} label={AMENITY_TEXT[a]} checked={p.wantedAmenities.includes(a)} onChange={(on) => toggleAmenity(a, on)} />
          ))}
        </Card>
      </div>

      <div>
        <div class="field__label">How important is each?</div>
        <p class="small muted" style="margin-bottom:8px">Higher priorities count more toward your match.</p>
        <Card>
          <div class="prefs__priorities">
            {CATEGORIES.map((c) => (
              <div class="priority" key={c}>
                <span class="priority__label">{CATEGORY_TEXT[c]}</span>
                <ChoiceGroup<Priority>
                  label={`${CATEGORY_TEXT[c]} priority`}
                  hideLabel
                  compact
                  value={p.priorities[c]}
                  onChange={(v) => update({ priorities: { ...p.priorities, [c]: v } })}
                  choices={[{ value: "low", label: "Low" }, { value: "med", label: "Med" }, { value: "high", label: "High" }]}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div class="actions" style="margin-top:4px">
        <Button type="submit">Save preferences</Button>
        {canGoBack && <Button variant="secondary" onClick={onBack}>Back</Button>}
      </div>
    </form>
  );
}
