import { emptyFacts, listed } from "@/core/domain";
import { leaseTypeFromText, parseMoney } from "@/core/textListing";
import { applyAmenityText, get, hasType, jsonLd, num, postalAddress, text } from "./shared";
import type { RawCapture } from "./types";

function countFrom(label: string): number | null {
  if (/studio/i.test(label)) return 0;
  const m = /(\d+(?:\.\d+)?)/.exec(label);
  return m?.[1] ? Number(m[1]) : null;
}

/** Redfin rental and home pages. JSON-LD when present, otherwise the address/price/bed stats in the header. */
export function readRedfin(doc: Document, url: string): RawCapture {
  const warnings: string[] = [];
  const facts = emptyFacts();
  facts.rentBasis = "per-unit";

  const street = text(doc.querySelector('[data-rf-test-id="abp-streetLine"], .street-address'));
  const city = text(doc.querySelector('[data-rf-test-id="abp-cityStateZip"], .cityStateZip'));
  const domAddress = [street, city].filter(Boolean).join(", ");

  const listing = jsonLd(doc).find((n) =>
    hasType(n, "Product") || hasType(n, "SingleFamilyResidence") || hasType(n, "Apartment") || hasType(n, "Residence") || hasType(n, "Place"),
  );
  const ldAddr = listing ? postalAddress(listing.address) : null;
  if (domAddress) facts.address = listed(domAddress);
  else if (ldAddr) facts.address = listed(ldAddr);

  const priceText = text(doc.querySelector('[data-rf-test-id="abp-price"], [data-rf-test-id="homecardV2Price"]'));
  const rent = parseMoney(priceText) ?? (listing ? num(get(listing, "offers.price")) ?? num(get(listing, "offers.lowPrice")) : null);
  if (rent != null) facts.rent = listed(rent);

  const beds = countFrom(text(doc.querySelector('[data-rf-test-id="abp-beds"]'))) ?? (listing ? num(listing.numberOfBedrooms) : null);
  const baths = countFrom(text(doc.querySelector('[data-rf-test-id="abp-baths"]'))) ?? (listing ? num(listing.numberOfBathroomsTotal) : null);
  if (beds != null) facts.bedrooms = listed(beds);
  if (baths != null) facts.bathrooms = listed(baths);

  const body = text(doc.querySelector("#aboutThisHome, .AboutThisHomeSection, .amenities-container, #content"));
  const lease = leaseTypeFromText(body);
  if (lease) facts.leaseType = listed(lease);
  applyAmenityText(facts, body);
  const dep = /deposit[^$\d]{0,24}\$?\s*([\d,]{3,})/i.exec(body);
  if (dep?.[1]) facts.deposit = listed(Number(dep[1].replace(/,/g, "")));

  if (!facts.address.value && facts.rent.value === null) {
    warnings.push("Redfin page didn't include an address or rent. Add them on the review screen.");
  }
  return { url, title: doc.title, source: "redfin", kind: "listing", facts, warnings };
}
