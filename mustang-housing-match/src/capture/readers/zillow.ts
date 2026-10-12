import { emptyFacts, listed, type FloorPlan, type ListingFacts } from "@/core/domain";
import { leaseTypeFromMonths, leaseTypeFromText, parseMoney } from "@/core/textListing";
import { applyAmenityText, get, hasType, jsonLd, num, postalAddress, str } from "./shared";
import type { RawCapture } from "./types";

function nextData(doc: Document): unknown {
  const el = doc.getElementById("__NEXT_DATA__");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent ?? "");
  } catch {
    return null;
  }
}

function amenityBlob(res: Record<string, unknown> | undefined): string {
  if (!res) return "";
  const bits: string[] = [];
  for (const k of ["utilities", "parkingFeatures", "laundryFeatures", "appliances", "petsAllowed", "hasPetsAllowed", "furnished", "flooring", "communityFeatures", "exteriorFeatures", "interiorFeatures"]) {
    const v = res[k];
    const name = k.replace(/^has/, "").replace(/Allowed$/, "").replace(/Features$/, "");
    if (Array.isArray(v)) bits.push(`${name}: ${v.map(String).join(", ")}`);
    else if (typeof v === "string") bits.push(`${name} ${v}`);
    else if (typeof v === "boolean") bits.push(v ? `${name} allowed` : `no ${name}, not ${name}`);
  }
  return bits.join(". ");
}

function readHome(nd: unknown, facts: ListingFacts, warnings: string[]): boolean {
  const cacheRaw = get(nd, "props.pageProps.componentProps.gdpClientCache");
  let cache: unknown = cacheRaw;
  if (typeof cacheRaw === "string") {
    try {
      cache = JSON.parse(cacheRaw);
    } catch {
      warnings.push("gdpClientCache was not valid JSON");
      return false;
    }
  }
  if (!cache || typeof cache !== "object") return false;
  const firstKey = Object.keys(cache as object)[0];
  const property = firstKey ? get(cache, `${firstKey}.property`) : undefined;
  if (!property || typeof property !== "object") {
    warnings.push("No property in gdpClientCache");
    return false;
  }
  const p = property as Record<string, unknown>;
  const addr = postalAddress(p.address) ?? str(p.streetAddress);
  if (addr) facts.address = listed(addr);
  const price = num(p.price);
  if (price != null) facts.rent = listed(price);
  const beds = num(p.bedrooms);
  if (beds != null) facts.bedrooms = listed(beds);
  const baths = num(p.bathrooms);
  if (baths != null) facts.bathrooms = listed(baths);

  const reso = (p.resoFacts && typeof p.resoFacts === "object" ? p.resoFacts : {}) as Record<string, unknown>;
  const lease = leaseTypeFromMonths(num(get(p, "rentalCostsAndFees.leaseDuration"))) ?? leaseTypeFromText(str(reso.leaseTerm));
  if (lease) facts.leaseType = listed(lease);
  else if (str(reso.leaseTerm)) warnings.push(`Lease term "${str(reso.leaseTerm)}" not recognised`);

  const fees = Array.isArray(reso.feesAndDues) ? (reso.feesAndDues as Record<string, unknown>[]) : [];
  const dep = fees.find((f) => /deposit/i.test(String(f.type ?? f.name ?? "")));
  const depAmt = dep ? parseMoney(str(dep.fee) ?? str(dep.amount)) : null;
  if (depAmt != null) facts.deposit = listed(depAmt);

  const appCents = num(get(p, "rentalApplicationPriceDetail.actualPriceInCents"));
  if (appCents != null) facts.applicationFee = listed(Math.round(appCents) / 100);

  // Monthly fee groups: sum everything that is not parking; parking goes to parkingFee.
  const groups = get(p, "rentalCostsAndFees.fees.monthly.feeGroup");
  let other = 0;
  let sawOther = false;
  if (Array.isArray(groups)) {
    for (const g of groups as Record<string, unknown>[]) {
      const list = Array.isArray(g.fees) ? (g.fees as Record<string, unknown>[]) : [];
      for (const f of list) {
        const amt = parseMoney(str(f.fee) ?? str(f.amount) ?? (typeof f.amount === "number" ? String(f.amount) : null));
        if (amt == null) continue;
        if (/parking|garage/i.test(String(f.name ?? f.type ?? g.name ?? ""))) facts.parkingFee = listed(amt);
        else {
          other += amt;
          sawOther = true;
        }
      }
    }
  }
  if (sawOther) facts.otherMonthlyFees = listed(other);
  applyAmenityText(facts, amenityBlob(reso));
  return true;
}

function unitPlan(planName: string, unit: Record<string, unknown>, warnings: string[]): FloorPlan {
  const beds = num(unit.beds);
  const baths = num(unit.baths);
  const price = num(unit.price) ?? parseMoney(str(unit.price));
  const leaseDetail = (unit.leaseTermDetail && typeof unit.leaseTermDetail === "object" ? unit.leaseTermDetail : {}) as Record<string, unknown>;
  const lease = leaseTypeFromText(str(leaseDetail.leaseTerm));
  const deposit = parseMoney(str(leaseDetail.deposit) ?? (typeof leaseDetail.deposit === "number" ? String(leaseDetail.deposit) : null)) ?? parseMoney(str(unit.depositsAndFees));
  if (str(leaseDetail.leaseTerm) && !lease) warnings.push(`Lease term "${str(leaseDetail.leaseTerm)}" not recognised`);
  const unitNo = str(unit.unitNumber) ?? str(unit.name);
  const label = [beds != null ? `${beds} bd` : null, baths != null ? `${baths} ba` : null].filter(Boolean).join(" / ");
  const facts: FloorPlan["facts"] = {};
  if (price != null) facts.rent = listed(price);
  if (beds != null) facts.bedrooms = listed(beds);
  if (baths != null) facts.bathrooms = listed(baths);
  if (deposit != null) facts.deposit = listed(deposit);
  if (lease) facts.leaseType = listed(lease);
  return {
    id: [planName, unitNo].filter(Boolean).join("#") || label,
    name: `${planName}${unitNo ? ` · Unit ${unitNo}` : ""} · ${label}${price != null ? ` · $${price.toLocaleString("en-US")}` : ""}`,
    facts,
  };
}

function readBuilding(nd: unknown, facts: ListingFacts, warnings: string[]): FloorPlan[] | null {
  const b = get(nd, "props.pageProps.componentProps.initialReduxState.gdp.building");
  if (!b || typeof b !== "object") return null;
  const building = b as Record<string, unknown>;
  const addr = postalAddress(building.address);
  if (addr) facts.address = listed(addr);
  const attrs = (building.buildingAttributes && typeof building.buildingAttributes === "object" ? building.buildingAttributes : {}) as Record<string, unknown>;
  const app = num(attrs.applicationFee);
  if (app != null) facts.applicationFee = listed(app);
  const depMin = num(attrs.depositFeeMin);
  if (depMin != null) facts.deposit = listed(depMin);
  const blob: string[] = [];
  if (Array.isArray(attrs.utilitiesIncluded) && attrs.utilitiesIncluded.length) blob.push("utilities included: " + attrs.utilitiesIncluded.join(", "));
  if (Array.isArray(attrs.parkingTypes) && attrs.parkingTypes.length) blob.push("parking: " + attrs.parkingTypes.join(", "));
  const pets = attrs.petPolicies;
  if (Array.isArray(pets) && pets.length) blob.push("pets allowed: " + pets.map((p) => (typeof p === "object" && p ? JSON.stringify(p) : String(p))).join(", "));
  else if (pets && typeof pets === "object") blob.push("pets allowed " + JSON.stringify(pets));
  const raw = get(building, "amenityDetails.customAmenities.rawAmenities");
  if (Array.isArray(raw)) blob.push(raw.map(String).join(", "));
  const structured = building.structuredAmenities;
  if (structured && typeof structured === "object") blob.push(JSON.stringify(structured));
  applyAmenityText(facts, blob.join(". "));

  const plans: FloorPlan[] = [];
  const fps = Array.isArray(building.floorPlans) ? (building.floorPlans as Record<string, unknown>[]) : [];
  for (const fp of fps) {
    const planName = str(fp.name) ?? "Floor plan";
    const units = Array.isArray(fp.units) ? (fp.units as Record<string, unknown>[]) : [];
    if (units.length === 0) plans.push(unitPlan(planName, fp, warnings));
    for (const u of units) plans.push(unitPlan(planName, u, warnings));
  }
  if (plans.length === 1) {
    Object.assign(facts, plans[0]!.facts);
  }
  const buildingLease = Array.isArray(attrs.leaseTerms) && attrs.leaseTerms.length ? leaseTypeFromText(attrs.leaseTerms.map(String).join(" ")) : null;
  if (buildingLease && facts.leaseType.provenance === "NotListed") facts.leaseType = listed(buildingLease);
  return plans;
}

function readJsonLdFallback(doc: Document, facts: ListingFacts): boolean {
  let found = false;
  for (const node of jsonLd(doc)) {
    if (!hasType(node, "RealEstateListing") && !hasType(node, "Product")) continue;
    found = true;
    const offers = node.offers as Record<string, unknown> | undefined;
    const price = num(offers?.price) ?? num(offers?.lowPrice);
    if (price != null && facts.rent.provenance === "NotListed") facts.rent = listed(price);
    const item = (node.itemOffered ?? offers?.itemOffered ?? node.about) as Record<string, unknown> | undefined;
    const addr = postalAddress(item?.address) ?? postalAddress(node.address);
    if (addr && facts.address.provenance === "NotListed") facts.address = listed(addr);
    const beds = num(item?.numberOfBedrooms);
    if (beds != null && facts.bedrooms.provenance === "NotListed") facts.bedrooms = listed(beds);
    const baths = num(item?.numberOfBathroomsTotal);
    if (baths != null && facts.bathrooms.provenance === "NotListed") facts.bathrooms = listed(baths);
    const amen = item?.amenityFeature;
    if (Array.isArray(amen)) applyAmenityText(facts, amen.map((a) => (a && typeof a === "object" ? String((a as Record<string, unknown>).name ?? "") : String(a))).join(", "));
    if (item?.petsAllowed === true) applyAmenityText(facts, "pets allowed");
  }
  return found;
}

export function readZillow(doc: Document, url: string, kind: "home" | "building"): RawCapture {
  const warnings: string[] = [];
  const facts = emptyFacts();
  facts.rentBasis = "per-unit";
  const nd = nextData(doc);
  let floorPlans: FloorPlan[] | undefined;
  let ok = false;
  if (nd) {
    if (kind === "home") ok = readHome(nd, facts, warnings);
    else {
      const plans = readBuilding(nd, facts, warnings);
      if (plans) {
        ok = true;
        if (plans.length > 1) floorPlans = plans;
      }
    }
    if (!ok) warnings.push("__NEXT_DATA__ did not have the expected shape; used JSON-LD");
  } else warnings.push("No __NEXT_DATA__ on the page; used JSON-LD");
  if (!ok && !readJsonLdFallback(doc, facts)) warnings.push("No JSON-LD listing data found either");
  else if (!ok) readJsonLdFallback(doc, facts);
  const result: RawCapture = { url, title: doc.title, source: "zillow", kind, facts, warnings };
  if (floorPlans) result.floorPlans = floorPlans;
  return result;
}
