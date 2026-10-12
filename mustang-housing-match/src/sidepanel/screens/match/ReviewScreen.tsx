import { AMENITIES, corrected, notListed, type AmenityId, type Fact, type LeaseType, type ListingFacts, type RentBasis } from "@/core/domain";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { Header } from "../../components/Header";
import { Notice } from "../../components/Notice";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { Section } from "../../components/Section";
import { SOURCE_LABEL, type ReviewDraft } from "../../state/match";

const AMENITY_TEXT: Record<AmenityId, string> = {
  parking: "Parking", laundry: "Laundry", utilitiesIncluded: "Utilities included", pets: "Pets allowed", furnished: "Furnished",
};

type NumberKey = "rent" | "bedrooms" | "bathrooms" | "deposit" | "applicationFee" | "parkingFee" | "otherMonthlyFees";

function numberFact(raw: string, original: Fact<number>): Fact<number> {
  const t = raw.trim();
  if (t === "") return notListed();
  const n = Number(t.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return original;
  return original.value === n && original.provenance !== "NotListed" ? original : corrected(n);
}

function FactField({ label, fact, onChange, inputMode = "decimal", prefix, placeholder, id }: {
  label: string; fact: Fact<number>; onChange: (f: Fact<number>) => void; inputMode?: "decimal" | "numeric"; prefix?: string; placeholder?: string; id: string;
}) {
  return (
    <div class={`field ${fact.value === null ? "field--unlisted" : ""}`}>
      <label class="fact__label" for={id}><span>{label}</span><ProvenanceTag provenance={fact.provenance} /></label>
      <div class="field__control">
        <input
          id={id} inputMode={inputMode} placeholder={placeholder ?? "Not listed"}
          value={fact.value === null ? "" : `${prefix ?? ""}${fact.value}`}
          onChange={(e) => onChange(numberFact((e.currentTarget as HTMLInputElement).value, fact))}
        />
      </div>
    </div>
  );
}

export function ReviewScreen({ review, onEdit, onAmenity, onRentBasis, onPlan, onConfirm, onBack }: {
  review: ReviewDraft;
  onEdit: <K extends keyof ListingFacts>(key: K, value: ListingFacts[K]) => void;
  onAmenity: (id: AmenityId, value: boolean | null) => void;
  onRentBasis: (b: RentBasis) => void;
  onPlan: (id: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const f = review.facts;
  const manual = review.mode === "manual";
  const addressMissing = !f.address.value?.trim();
  const rentMissing = f.rent.value === null;
  const canConfirm = !(manual && (addressMissing || rentMissing));
  const unlisted = (["rent", "bedrooms", "bathrooms", "leaseType", "deposit"] as const).filter((k) => f[k].value === null).length
    + AMENITIES.filter((a) => f.amenities[a].value === null).length;
  const num = (key: NumberKey) => (fact: Fact<number>) => onEdit(key, fact);

  return (
    <div class="stack">
      <Header
        context={manual ? "Add a listing" : "Listing review"}
        title={manual ? "Tell us about the place" : "Here's what we found"}
        lede={manual ? "Address and rent are required. Anything you leave blank stays Not listed and becomes a question for the landlord." : "Check the details before matching this listing to your preferences. Edit anything that's off; your corrections are kept."}
      />

      {!manual && (
        <Card>
          <div class="row row--between">
            <span class="pagecard__source">{SOURCE_LABEL[review.source]}</span>
            {review.warnings.length === 0 ? <span class="pagecard__status">Listing detected</span> : <span class="small muted">Partially read</span>}
          </div>
          <div class="pagecard__title">{f.address.value ?? review.title}</div>
          {review.sourceUrl && <div class="pagecard__url">{review.sourceUrl}</div>}
        </Card>
      )}

      {review.floorPlans.length > 1 && (
        <Section title="Which floor plan?" aside={`${review.floorPlans.length} on this page`} id="plans">
          <div class="plans" role="radiogroup" aria-label="Floor plan">
            {review.floorPlans.map((p) => (
              <button type="button" role="radio" aria-checked={review.floorPlanId === p.id} class="plan" key={p.id} onClick={() => onPlan(p.id)}>
                <span class="plan__name">{p.name}</span>
                {review.floorPlanId === p.id && <span class="small">Selected</span>}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title={manual ? "The basics" : "Review or correct details"} aside="Editable fields" id="facts">
        <Card class="stack stack--tight">
          <div class={`field ${addressMissing ? "field--unlisted" : ""}`}>
            <label class="fact__label" for="f-address"><span>Address</span><ProvenanceTag provenance={f.address.provenance} /></label>
            <div class="field__control">
              <input id="f-address" value={f.address.value ?? ""} placeholder="870 Foothill Blvd, San Luis Obispo" required={manual}
                onChange={(e) => { const v = (e.currentTarget as HTMLInputElement).value.trim(); onEdit("address", v ? (v === f.address.value ? f.address : corrected(v)) : notListed()); }} />
            </div>
            {manual && addressMissing && <div class="field__hint">Required: the commute is measured from here.</div>}
          </div>

          <FactField id="f-rent" label="Monthly rent" fact={f.rent} onChange={num("rent")} prefix="$" placeholder="1250" />
          <ChoiceGroup<RentBasis>
            label="That rent is"
            value={f.rentBasis}
            onChange={onRentBasis}
            choices={[{ value: "per-unit", label: "For the whole unit" }, { value: "per-person", label: "Per person" }]}
          />
          <div class="factgrid">
            <FactField id="f-beds" label="Bedrooms" fact={f.bedrooms} onChange={num("bedrooms")} inputMode="numeric" placeholder="3" />
            <FactField id="f-baths" label="Bathrooms" fact={f.bathrooms} onChange={num("bathrooms")} placeholder="2" />
          </div>
          <div class={`field ${f.leaseType.value === null ? "field--unlisted" : ""}`}>
            <label class="fact__label" for="f-lease"><span>Lease length</span><ProvenanceTag provenance={f.leaseType.provenance} /></label>
            <div class="field__control">
              <select id="f-lease" value={f.leaseType.value ?? ""} onChange={(e) => { const v = (e.currentTarget as HTMLSelectElement).value as LeaseType | ""; onEdit("leaseType", v ? (v === f.leaseType.value ? f.leaseType : corrected(v)) : notListed()); }}>
                <option value="">Not listed</option>
                <option value="school-year">School-year</option>
                <option value="12-month">12-month</option>
                <option value="month-to-month">Month-to-month</option>
              </select>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Amenities" aside="Yes, no, or not listed" id="amenities">
        <Card>
          <div class="amenity-grid">
            {AMENITIES.map((a) => (
              <div class="amenity" key={a}>
                <span class="amenity__name">{AMENITY_TEXT[a]} {f.amenities[a].provenance === "Corrected" && <ProvenanceTag provenance="Corrected" />}</span>
                <ChoiceGroup<"yes" | "no" | "nl">
                  label={AMENITY_TEXT[a]} hideLabel compact
                  value={f.amenities[a].value === true ? "yes" : f.amenities[a].value === false ? "no" : "nl"}
                  onChange={(v) => onAmenity(a, v === "yes" ? true : v === "no" ? false : null)}
                  choices={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "nl", label: "Not listed" }]}
                />
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Fees and deposit" aside="Per unit, as listed" id="fees">
        <Card>
          <div class="factgrid">
            <FactField id="f-deposit" label="Deposit" fact={f.deposit} onChange={num("deposit")} prefix="$" />
            <FactField id="f-appfee" label="Application fee" fact={f.applicationFee} onChange={num("applicationFee")} prefix="$" />
            <FactField id="f-parkingfee" label="Parking fee / month" fact={f.parkingFee} onChange={num("parkingFee")} prefix="$" />
            <FactField id="f-otherfees" label="Other fees / month" fact={f.otherMonthlyFees} onChange={num("otherMonthlyFees")} prefix="$" />
          </div>
        </Card>
      </Section>

      {unlisted > 0 && (
        <Notice tone="warn" title="Missing details stay visible">
          {unlisted} {unlisted === 1 ? "detail wasn't" : "details weren't"} listed. We'll label estimates and unknowns instead of treating them as confirmed, and suggest questions for the landlord.
        </Notice>
      )}
      {review.warnings.length > 0 && <p class="fine">{review.warnings.join(" ")}</p>}

      <div class="actions">
        <Button onClick={onConfirm} disabled={!canConfirm}>Analyze listing</Button>
        <Button variant="secondary" onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}
