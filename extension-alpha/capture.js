(function() {
	//#region src/core/supportedPage.ts
	var FIXTURE_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1"]);
	/** Returns the Source and page kind for a Supported Page, or null for an Unsupported Page. */
	function detectSource(url) {
		let u;
		try {
			u = new URL(url);
		} catch {
			return null;
		}
		const host = u.hostname.toLowerCase();
		const path = u.pathname;
		if (FIXTURE_HOSTS.has(host)) {
			const source = u.searchParams.get("mhm-source");
			const kind = u.searchParams.get("kind");
			if (source === "zillow") return {
				source,
				kind: kind === "building" ? "building" : "home"
			};
			if (source === "craigslist" || source === "apartments") return {
				source,
				kind: "listing"
			};
			return null;
		}
		if (host === "zillow.com" || host.endsWith(".zillow.com")) {
			if (/^\/homedetails\/[^/]+\/\d+_zpid\/?$/.test(path)) return {
				source: "zillow",
				kind: "home"
			};
			if (/^\/apartments\/[^/]+\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path)) return {
				source: "zillow",
				kind: "building"
			};
			return null;
		}
		if (host === "craigslist.org" || host.endsWith(".craigslist.org")) {
			if (/^\/view\/d\/[^/]+\/[A-Za-z0-9]+\/?$/.test(path)) return {
				source: "craigslist",
				kind: "listing"
			};
			if (/^\/[a-z]{3}\/d\/[^/]+\/\d+\.html$/.test(path)) return {
				source: "craigslist",
				kind: "listing"
			};
			return null;
		}
		if (host === "apartments.com" || host.endsWith(".apartments.com")) {
			if (/^\/[a-z0-9-]+\/[a-z0-9]{7}\/?$/.test(path)) return {
				source: "apartments",
				kind: "listing"
			};
			return null;
		}
		return null;
	}
	//#endregion
	//#region src/core/domain.ts
	var notListed = () => ({
		value: null,
		provenance: "NotListed"
	});
	var listed = (value) => ({
		value,
		provenance: "Listed"
	});
	function emptyFacts() {
		return {
			address: notListed(),
			rent: notListed(),
			rentBasis: "per-unit",
			bedrooms: notListed(),
			bathrooms: notListed(),
			leaseType: notListed(),
			amenities: {
				parking: notListed(),
				laundry: notListed(),
				utilitiesIncluded: notListed(),
				pets: notListed(),
				furnished: notListed()
			},
			deposit: notListed(),
			applicationFee: notListed(),
			parkingFee: notListed(),
			otherMonthlyFees: notListed()
		};
	}
	//#endregion
	//#region src/core/textListing.ts
	/** "$2,900" | "2,900" | "$1,250.00" → 2900 | 1250. Null when no number. */
	function parseMoney(text) {
		if (!text) return null;
		const m = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/.exec(text);
		if (!m || !m[1]) return null;
		const n = Number(m[1].replace(/,/g, ""));
		return Number.isFinite(n) ? n : null;
	}
	/** Maps lease wording to a Lease Type. Null when nothing recognisable. */
	function leaseTypeFromText(text) {
		if (!text) return null;
		const t = text.toLowerCase();
		if (/month[\s-]*to[\s-]*month|\bm2m\b|\bmtm\b|monthly lease/.test(t)) return "month-to-month";
		if (/school[\s-]*year|academic[\s-]*year|\b(9|10)[\s-]*months?\b|\bnine[\s-]*month|\bten[\s-]*month|sept(ember)?\s*(to|-|–|through)\s*june|fall\s*(to|-|–|through)\s*spring/.test(t)) return "school-year";
		if (/\b12[\s-]*months?\b|\btwelve[\s-]*month|\b1[\s-]*year\b|one[\s-]*year|year[\s-]*lease|\bannual\b|\byearly\b|12[\s-]*mo\b/.test(t)) return "12-month";
		return null;
	}
	/** Lease Type from a numeric lease duration in months. */
	function leaseTypeFromMonths(months) {
		if (months == null || !Number.isFinite(months)) return null;
		if (months <= 1) return "month-to-month";
		if (months >= 9 && months <= 10) return "school-year";
		if (months === 12) return "12-month";
		return null;
	}
	/** Positive mentions of each amenity in free text. Absent → NotListed (we never infer "no"). */
	function amenityHints(text) {
		if (!text) return {};
		const t = text.toLowerCase();
		const out = {};
		if (/\bno (off[\s-]*street )?parking\b|parking not (included|available)/.test(t)) out.parking = false;
		else if (/\bparking\b|\bgarage\b|\bcarport\b|\bdriveway\b/.test(t)) out.parking = true;
		if (/\bno laundry\b|no washer/.test(t)) out.laundry = false;
		else if (/\blaundry\b|washer|w\/d\b|\bdryer\b/.test(t)) out.laundry = true;
		if (/utilities?\s*(not|aren'?t|are not)\s*included|plus utilities|\+\s*utilities|utilities?\s*(extra|separate)/.test(t)) out.utilitiesIncluded = false;
		else if (/utilities?\s*(are\s*)?(included|incl\b|inc\b)|all utilities|includes? (all )?utilities|utils? included/.test(t)) out.utilitiesIncluded = true;
		if (/\bno pets\b|pets? not allowed|no animals/.test(t)) out.pets = false;
		else if (/\bpets?\s*(ok|okay|allowed|friendly|welcome|negotiable)|\b(cats?|dogs?)\s*(are\s*)?(ok|okay|allowed|welcome)|pet[\s-]*friendly/.test(t)) out.pets = true;
		if (/\bunfurnished\b|not furnished/.test(t)) out.furnished = false;
		else if (/\bfurnished\b/.test(t)) out.furnished = true;
		return out;
	}
	//#endregion
	//#region src/capture/readers/shared.ts
	function text(el) {
		return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
	}
	function jsonLd(doc) {
		const out = [];
		for (const s of Array.from(doc.querySelectorAll("script[type=\"application/ld+json\"]"))) try {
			const parsed = JSON.parse(s.textContent ?? "");
			if (Array.isArray(parsed)) out.push(...parsed);
			else if (parsed && typeof parsed === "object" && Array.isArray(parsed["@graph"])) out.push(...parsed["@graph"]);
			else out.push(parsed);
		} catch {}
		return out;
	}
	function hasType(node, type) {
		if (!node || typeof node !== "object") return false;
		const t = node["@type"];
		return t === type || Array.isArray(t) && t.includes(type);
	}
	function num(v) {
		if (typeof v === "number" && Number.isFinite(v)) return v;
		if (typeof v === "string") {
			const n = Number(v.replace(/[^0-9.]/g, ""));
			return v.trim() !== "" && Number.isFinite(n) ? n : null;
		}
		return null;
	}
	function str(v) {
		return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
	}
	function get(obj, path) {
		let cur = obj;
		for (const key of path.split(".")) {
			if (cur == null || typeof cur !== "object") return void 0;
			cur = cur[key];
		}
		return cur;
	}
	function postalAddress(a) {
		if (!a || typeof a !== "object") return null;
		const r = a;
		const parts = [
			str(r.streetAddress),
			str(r.addressLocality) ?? str(r.city),
			[str(r.addressRegion) ?? str(r.state), str(r.postalCode) ?? str(r.zipcode)].filter(Boolean).join(" ")
		].filter(Boolean);
		return parts.length ? parts.join(", ") : null;
	}
	/** Applies positive/negative amenity mentions from a blob of text, leaving unmentioned ones untouched. */
	function applyAmenityText(facts, blob) {
		const hints = amenityHints(blob);
		for (const [k, v] of Object.entries(hints)) if (v !== void 0 && facts.amenities[k].provenance === "NotListed") facts.amenities[k] = listed(v);
	}
	//#endregion
	//#region src/capture/readers/apartments.ts
	function bedsBaths(s) {
		const b = /(\d+|studio)\s*(?:bd|bed|beds)\b/i.exec(s);
		const ba = /(\d+(?:\.\d)?)\s*(?:ba|bath|baths)\b/i.exec(s);
		return {
			beds: b && b[1] ? /studio/i.test(b[1]) ? 0 : Number(b[1]) : null,
			baths: ba && ba[1] ? Number(ba[1]) : null
		};
	}
	function readApartments(doc, url) {
		const warnings = [];
		const facts = emptyFacts();
		facts.rentBasis = "per-unit";
		const addr = text(doc.querySelector("#propertyAddressRow")) || text(doc.querySelector(".propertyAddressContainer")) || text(doc.querySelector(".delivery-address"));
		const ld = jsonLd(doc).find((n) => hasType(n, "RealEstateListing") || hasType(n, "Product"));
		const main = ld?.mainEntity ?? ld?.about;
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
		applyAmenityText(facts, [
			text(doc.querySelector("#amenitiesSection")),
			Array.isArray(main?.amenityFeature) ? main.amenityFeature.map((a) => a && typeof a === "object" ? String(a.name ?? "") : String(a)).join(", ") : "",
			fees
		].join(". "));
		if (main?.petsAllowed === true && facts.amenities.pets.provenance === "NotListed") facts.amenities.pets = listed(true);
		if (facts.amenities.parking.provenance === "NotListed" && facts.parkingFee.value != null) facts.amenities.parking = listed(true);
		const plans = Array.from(doc.querySelectorAll(".pricingGridItem")).map((row, i) => {
			const name = text(row.querySelector(".modelName")) || `Plan ${i + 1}`;
			const t = text(row);
			const price = parseMoney(text(row.querySelector(".rentLabel")) || t);
			const bb = bedsBaths(text(row.querySelector(".detailsTextWrapper")) || t);
			const dep = /\$\s*([\d,]+)\s*deposit/i.exec(t);
			const f = {};
			if (price != null) f.rent = listed(price);
			if (bb.beds != null) f.bedrooms = listed(bb.beds);
			if (bb.baths != null) f.bathrooms = listed(bb.baths);
			if (dep && dep[1]) f.deposit = listed(Number(dep[1].replace(/,/g, "")));
			return {
				id: name,
				name: `${name} · ${[bb.beds != null ? `${bb.beds} bd` : null, bb.baths != null ? `${bb.baths} ba` : null].filter(Boolean).join(" / ")}${price != null ? ` · $${price.toLocaleString("en-US")}` : ""}`,
				facts: f
			};
		});
		if (plans.length === 1) Object.assign(facts, plans[0].facts);
		else if (plans.length === 0) {
			const dep = /\$\s*([\d,]+)\s*deposit/i.exec(text(doc.body));
			if (dep && dep[1]) facts.deposit = listed(Number(dep[1].replace(/,/g, "")));
		}
		const result = {
			url,
			title: doc.title,
			source: "apartments",
			kind: "listing",
			facts,
			warnings
		};
		if (plans.length > 1) result.floorPlans = plans;
		if (!summary && !ld) warnings.push("Neither the price summary nor JSON-LD was found");
		return result;
	}
	//#endregion
	//#region src/capture/readers/craigslist.ts
	function readCraigslist(doc, url) {
		const warnings = [];
		const facts = emptyFacts();
		const apt = jsonLd(doc).find((n) => hasType(n, "Apartment"));
		const addr = postalAddress(apt?.address) ?? text(doc.querySelector("h2.street-address")) ?? "";
		const mapAddr = text(doc.querySelector(".mapaddress"));
		if (addr) facts.address = listed(addr);
		else if (mapAddr) facts.address = listed(mapAddr);
		const period = text(doc.querySelector(".attr.rent_period")).toLowerCase();
		const price = parseMoney(text(doc.querySelector(".postingtitletext .price")) || text(doc.querySelector(".price")));
		if (price != null) {
			if (period && !/month/.test(period)) warnings.push(`Rent period is "${period.replace(/rent period:\s*/, "")}", not monthly; rent left Not Listed`);
			else facts.rent = listed(price);
		}
		const important = Array.from(doc.querySelectorAll(".attrgroup .attr.important, .attrgroup .shared-line-bubble")).map(text).join(" ");
		const bb = /(\d+)\s*BR\s*\/\s*(\d+(?:\.\d)?)\s*Ba/i.exec(important);
		if (bb && bb[1] && bb[2]) {
			facts.bedrooms = listed(Number(bb[1]));
			facts.bathrooms = listed(Number(bb[2]));
		} else {
			const beds = num(apt?.numberOfBedrooms);
			if (beds != null) facts.bedrooms = listed(beds);
			const baths = num(apt?.numberOfBathroomsTotal);
			if (baths != null) facts.bathrooms = listed(baths);
		}
		applyAmenityText(facts, Array.from(doc.querySelectorAll(".attrgroup .attr")).map(text).filter((t) => !/^\d+BR/i.test(t) && !/rent period/i.test(t)).join(". "));
		const crumbs = jsonLd(doc).find((n) => hasType(n, "BreadcrumbList"));
		const crumbText = JSON.stringify(crumbs ?? {}) + " " + text(doc.querySelector(".breadcrumbs"));
		const title = text(doc.querySelector("#titletextonly")) || doc.title;
		if (/cat=roo|cat=sub|rooms\s*(\/|&)\s*shared|sublets?/i.test(crumbText) || /\broom\b/i.test(title)) facts.rentBasis = "per-person";
		const body = text(doc.querySelector("#postingbody"));
		const lease = leaseTypeFromText(body);
		if (lease) facts.leaseType = listed(lease);
		applyAmenityText(facts, body);
		const dep = /deposit[^$\d]{0,20}\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,5})/i.exec(body);
		if (dep && dep[1]) facts.deposit = listed(Number(dep[1].replace(/,/g, "")));
		if (!apt && !price) warnings.push("Neither JSON-LD Apartment nor a .price element was found");
		return {
			url,
			title,
			source: "craigslist",
			kind: "listing",
			facts,
			warnings
		};
	}
	//#endregion
	//#region src/capture/readers/zillow.ts
	function nextData(doc) {
		const el = doc.getElementById("__NEXT_DATA__");
		if (!el) return null;
		try {
			return JSON.parse(el.textContent ?? "");
		} catch {
			return null;
		}
	}
	function amenityBlob(res) {
		if (!res) return "";
		const bits = [];
		for (const k of [
			"utilities",
			"parkingFeatures",
			"laundryFeatures",
			"appliances",
			"petsAllowed",
			"hasPetsAllowed",
			"furnished",
			"flooring",
			"communityFeatures",
			"exteriorFeatures",
			"interiorFeatures"
		]) {
			const v = res[k];
			const name = k.replace(/^has/, "").replace(/Allowed$/, "").replace(/Features$/, "");
			if (Array.isArray(v)) bits.push(`${name}: ${v.map(String).join(", ")}`);
			else if (typeof v === "string") bits.push(`${name} ${v}`);
			else if (typeof v === "boolean") bits.push(v ? `${name} allowed` : `no ${name}, not ${name}`);
		}
		return bits.join(". ");
	}
	function readHome(nd, facts, warnings) {
		const cacheRaw = get(nd, "props.pageProps.componentProps.gdpClientCache");
		let cache = cacheRaw;
		if (typeof cacheRaw === "string") try {
			cache = JSON.parse(cacheRaw);
		} catch {
			warnings.push("gdpClientCache was not valid JSON");
			return false;
		}
		if (!cache || typeof cache !== "object") return false;
		const firstKey = Object.keys(cache)[0];
		const property = firstKey ? get(cache, `${firstKey}.property`) : void 0;
		if (!property || typeof property !== "object") {
			warnings.push("No property in gdpClientCache");
			return false;
		}
		const p = property;
		const addr = postalAddress(p.address) ?? str(p.streetAddress);
		if (addr) facts.address = listed(addr);
		const price = num(p.price);
		if (price != null) facts.rent = listed(price);
		const beds = num(p.bedrooms);
		if (beds != null) facts.bedrooms = listed(beds);
		const baths = num(p.bathrooms);
		if (baths != null) facts.bathrooms = listed(baths);
		const reso = p.resoFacts && typeof p.resoFacts === "object" ? p.resoFacts : {};
		const lease = leaseTypeFromMonths(num(get(p, "rentalCostsAndFees.leaseDuration"))) ?? leaseTypeFromText(str(reso.leaseTerm));
		if (lease) facts.leaseType = listed(lease);
		else if (str(reso.leaseTerm)) warnings.push(`Lease term "${str(reso.leaseTerm)}" not recognised`);
		const dep = (Array.isArray(reso.feesAndDues) ? reso.feesAndDues : []).find((f) => /deposit/i.test(String(f.type ?? f.name ?? "")));
		const depAmt = dep ? parseMoney(str(dep.fee) ?? str(dep.amount)) : null;
		if (depAmt != null) facts.deposit = listed(depAmt);
		const appCents = num(get(p, "rentalApplicationPriceDetail.actualPriceInCents"));
		if (appCents != null) facts.applicationFee = listed(Math.round(appCents) / 100);
		const groups = get(p, "rentalCostsAndFees.fees.monthly.feeGroup");
		let other = 0;
		let sawOther = false;
		if (Array.isArray(groups)) for (const g of groups) {
			const list = Array.isArray(g.fees) ? g.fees : [];
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
		if (sawOther) facts.otherMonthlyFees = listed(other);
		applyAmenityText(facts, amenityBlob(reso));
		return true;
	}
	function unitPlan(planName, unit, warnings) {
		const beds = num(unit.beds);
		const baths = num(unit.baths);
		const price = num(unit.price) ?? parseMoney(str(unit.price));
		const leaseDetail = unit.leaseTermDetail && typeof unit.leaseTermDetail === "object" ? unit.leaseTermDetail : {};
		const lease = leaseTypeFromText(str(leaseDetail.leaseTerm));
		const deposit = parseMoney(str(leaseDetail.deposit) ?? (typeof leaseDetail.deposit === "number" ? String(leaseDetail.deposit) : null)) ?? parseMoney(str(unit.depositsAndFees));
		if (str(leaseDetail.leaseTerm) && !lease) warnings.push(`Lease term "${str(leaseDetail.leaseTerm)}" not recognised`);
		const unitNo = str(unit.unitNumber) ?? str(unit.name);
		const label = [beds != null ? `${beds} bd` : null, baths != null ? `${baths} ba` : null].filter(Boolean).join(" / ");
		const facts = {};
		if (price != null) facts.rent = listed(price);
		if (beds != null) facts.bedrooms = listed(beds);
		if (baths != null) facts.bathrooms = listed(baths);
		if (deposit != null) facts.deposit = listed(deposit);
		if (lease) facts.leaseType = listed(lease);
		return {
			id: [planName, unitNo].filter(Boolean).join("#") || label,
			name: `${planName}${unitNo ? ` · Unit ${unitNo}` : ""} · ${label}${price != null ? ` · $${price.toLocaleString("en-US")}` : ""}`,
			facts
		};
	}
	function readBuilding(nd, facts, warnings) {
		const b = get(nd, "props.pageProps.componentProps.initialReduxState.gdp.building");
		if (!b || typeof b !== "object") return null;
		const building = b;
		const addr = postalAddress(building.address);
		if (addr) facts.address = listed(addr);
		const attrs = building.buildingAttributes && typeof building.buildingAttributes === "object" ? building.buildingAttributes : {};
		const app = num(attrs.applicationFee);
		if (app != null) facts.applicationFee = listed(app);
		const depMin = num(attrs.depositFeeMin);
		if (depMin != null) facts.deposit = listed(depMin);
		const blob = [];
		if (Array.isArray(attrs.utilitiesIncluded) && attrs.utilitiesIncluded.length) blob.push("utilities included: " + attrs.utilitiesIncluded.join(", "));
		if (Array.isArray(attrs.parkingTypes) && attrs.parkingTypes.length) blob.push("parking: " + attrs.parkingTypes.join(", "));
		const pets = attrs.petPolicies;
		if (Array.isArray(pets) && pets.length) blob.push("pets allowed: " + pets.map((p) => typeof p === "object" && p ? JSON.stringify(p) : String(p)).join(", "));
		else if (pets && typeof pets === "object") blob.push("pets allowed " + JSON.stringify(pets));
		const raw = get(building, "amenityDetails.customAmenities.rawAmenities");
		if (Array.isArray(raw)) blob.push(raw.map(String).join(", "));
		const structured = building.structuredAmenities;
		if (structured && typeof structured === "object") blob.push(JSON.stringify(structured));
		applyAmenityText(facts, blob.join(". "));
		const plans = [];
		const fps = Array.isArray(building.floorPlans) ? building.floorPlans : [];
		for (const fp of fps) {
			const planName = str(fp.name) ?? "Floor plan";
			const units = Array.isArray(fp.units) ? fp.units : [];
			if (units.length === 0) plans.push(unitPlan(planName, fp, warnings));
			for (const u of units) plans.push(unitPlan(planName, u, warnings));
		}
		if (plans.length === 1) Object.assign(facts, plans[0].facts);
		const buildingLease = Array.isArray(attrs.leaseTerms) && attrs.leaseTerms.length ? leaseTypeFromText(attrs.leaseTerms.map(String).join(" ")) : null;
		if (buildingLease && facts.leaseType.provenance === "NotListed") facts.leaseType = listed(buildingLease);
		return plans;
	}
	function readJsonLdFallback(doc, facts) {
		let found = false;
		for (const node of jsonLd(doc)) {
			if (!hasType(node, "RealEstateListing") && !hasType(node, "Product")) continue;
			found = true;
			const offers = node.offers;
			const price = num(offers?.price) ?? num(offers?.lowPrice);
			if (price != null && facts.rent.provenance === "NotListed") facts.rent = listed(price);
			const item = node.itemOffered ?? offers?.itemOffered ?? node.about;
			const addr = postalAddress(item?.address) ?? postalAddress(node.address);
			if (addr && facts.address.provenance === "NotListed") facts.address = listed(addr);
			const beds = num(item?.numberOfBedrooms);
			if (beds != null && facts.bedrooms.provenance === "NotListed") facts.bedrooms = listed(beds);
			const baths = num(item?.numberOfBathroomsTotal);
			if (baths != null && facts.bathrooms.provenance === "NotListed") facts.bathrooms = listed(baths);
			const amen = item?.amenityFeature;
			if (Array.isArray(amen)) applyAmenityText(facts, amen.map((a) => a && typeof a === "object" ? String(a.name ?? "") : String(a)).join(", "));
			if (item?.petsAllowed === true) applyAmenityText(facts, "pets allowed");
		}
		return found;
	}
	function readZillow(doc, url, kind) {
		const warnings = [];
		const facts = emptyFacts();
		facts.rentBasis = "per-unit";
		const nd = nextData(doc);
		let floorPlans;
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
		const result = {
			url,
			title: doc.title,
			source: "zillow",
			kind,
			facts,
			warnings
		};
		if (floorPlans) result.floorPlans = floorPlans;
		return result;
	}
	//#endregion
	//#region src/capture/readers/index.ts
	/** Captures the Listing Facts of the page. Never throws: failures come back as warnings. */
	function capturePage(doc, url) {
		const detected = detectSource(url);
		if (!detected) return {
			url,
			title: doc.title,
			source: "unsupported",
			warnings: []
		};
		try {
			switch (detected.source) {
				case "zillow": return readZillow(doc, url, detected.kind === "building" ? "building" : "home");
				case "craigslist": return readCraigslist(doc, url);
				case "apartments": return readApartments(doc, url);
			}
		} catch (e) {
			return {
				url,
				title: doc.title,
				source: detected.source,
				kind: detected.kind,
				warnings: [`Capture failed: ${e instanceof Error ? e.message : String(e)}`]
			};
		}
	}
	//#endregion
	//#region src/capture/capture.ts
	globalThis.__mhmCapture = capturePage(document, location.href);
	//#endregion
})();
(() => {
	const r = globalThis.__mhmCapture;
	delete globalThis.__mhmCapture;
	return r;
})();
