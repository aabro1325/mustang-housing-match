import { emptyFacts, listed, type FloorPlan } from "@/core/domain";
import { leaseTypeFromText, parseMoney } from "@/core/textListing";
import { applyAmenityText, get, hasType, jsonLd, num, postalAddress, text } from "./shared";
import type { RawCapture } from "./types";

function bedsBaths(s: string): { beds: number | null; baths: number | null } {
  const b = /(\d+|studio)\s*(?:bd|bed|beds)\b/i.exec(s);
  const ba = /(\d+(?:\.\d)?)\s*(?:ba|bath|baths)\b/i.exec(s);
  return {
    beds: b && b[1] ? (/studio/i.test(b[1]) ? 0 : Number(b[1])) : null,
    baths: ba && ba[1] ? Number(ba[1]) : null,
  };
}

export function readApartments(doc: Document, url: string): RawCapture {
  const warnings: string[] = [];
  const facts = emptyFacts();
  facts.rentBasis = "per-unit";

  const addr = text(doc.querySelector("#propertyAddressRow")) || text(doc.querySelector(".propertyAddressContainer")) || text(doc.querySelector(".delivery-address"));
  const ld = jsonLd(doc).find((n) => hasType(n, "RealEstateListing") || hasType(n, "Product")) as Record<string, unknown> | undefined;
  const main = (ld?.mainEntity ?? ld?.about) as Record<string, unknown> | undefined;
  const ldAddr = postalAddress(main?.address);
  if (addr) facts.address = listed(addr);
  else if (ldAddr) facts.address = listed(ldAddr);

  const summary = text(doc.querySelector(".priceBedRangeInfoInnerContainer")) || text(doc.querySelector(".priceBedRangeInfo"));
  const rent = parseMoney(/rent[^$]*(\$[\d,]+)/i.exec(summary)?.[1] ?? summary) ?? num(get(ld, "offers.lowPrice"));
  if (rent != null) facts.rent = listed(rent);
  const { beds, baths } = bedsBaths(summary);
  const ldBeds = num(main?.numberOfBedrooms);
  const ldBaths = num(main?.numberOfBathroomsTotal);
  if (beds != null) facts.bedrooms = listed(beds);
  else if (ldBeds != null) facts.bedrooms = listed(ldBeds);
  if (baths != null) facts.bathrooms = listed(baths);
  else if (ldBaths != null) facts.bathrooms = listed(ldBaths);

  const fees = text(doc.querySelector("#feesSection"));
  const app = /application fee[^$]{0,40}\$\s*([\d,]+)/i.exec(fees);
  if (app && app[1]) facts.applicationFee = listed(Number(app[1].replace(/,/g, "")));
  const park = /(?:parking|garage|carport|surface lot|covered)[^$]{0,60}\$\s*([\d,]+)(?:\s*\/\s*(?:mo|month))?/i.exec(fees);
  if (park && park[1]) facts.parkingFee = listed(Number(park[1].replace(/,/g, "")));
  const leaseOpt = /lease options?:?\s*([^.]*?)(?:leases?\b|\.|$)/i.exec(fees);
  const lease = leaseTypeFromText(leaseOpt?.[1] ?? "") ?? leaseTypeFromText(/lease[^.]{0,60}/i.exec(fees)?.[0] ?? "");
  if (lease) facts.leaseType = listed(lease);
  else if (leaseOpt) warnings.push(`Lease options "${leaseOpt[1]?.trim()}" not recognised`);
  if (/parking[^.]{0,80}(included|free)|free parking/i.test(fees)) facts.parkingFee = listed(0);

  const amenities = text(doc.querySelector("#amenitiesSection"));
  const ldAmen = Array.isArray(main?.amenityFeature) ? (main!.amenityFeature as unknown[]).map((a) => (a && typeof a === "object" ? String((a as Record<string, unknown>).name ?? "") : String(a))).join(", ") : "";
  applyAmenityText(facts, [amenities, ldAmen, fees].join(". "));
  if (main?.petsAllowed === true && facts.amenities.pets.provenance === "NotListed") facts.amenities.pets = listed(true);
  if (facts.amenities.parking.provenance === "NotListed" && facts.parkingFee.value != null) facts.amenities.parking = listed(true);

  // Floor plans: pricing grid rows.
  const rows = Array.from(doc.querySelectorAll(".pricingGridItem"));
  const plans: FloorPlan[] = rows.map((row, i) => {
    const name = text(row.querySelector(".modelName")) || `Plan ${i + 1}`;
    const t = text(row);
    const price = parseMoney(text(row.querySelector(".rentLabel")) || t);
    const bb = bedsBaths(text(row.querySelector(".detailsTextWrapper")) || t);
    const dep = /\$\s*([\d,]+)\s*deposit/i.exec(t);
    const f: FloorPlan["facts"] = {};
    if (price != null) f.rent = listed(price);
    if (bb.beds != null) f.bedrooms = listed(bb.beds);
    if (bb.baths != null) f.bathrooms = listed(bb.baths);
    if (dep && dep[1]) f.deposit = listed(Number(dep[1].replace(/,/g, "")));
    const label = [bb.beds != null ? `${bb.beds} bd` : null, bb.baths != null ? `${bb.baths} ba` : null].filter(Boolean).join(" / ");
    return { id: name, name: `${name} · ${label}${price != null ? ` · $${price.toLocaleString("en-US")}` : ""}`, facts: f };
  });
  if (plans.length === 1) Object.assign(facts, plans[0]!.facts);
  else if (plans.length === 0) {
    const dep = /\$\s*([\d,]+)\s*deposit/i.exec(text(doc.body));
    if (dep && dep[1]) facts.deposit = listed(Number(dep[1].replace(/,/g, "")));
  }
  const result: RawCapture = { url, title: doc.title, source: "apartments", kind: "listing", facts, warnings };
  if (plans.length > 1) result.floorPlans = plans;
  if (!summary && !ld) warnings.push("Neither the price summary nor JSON-LD was found");
  return result;
}
