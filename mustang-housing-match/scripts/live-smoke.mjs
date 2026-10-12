// Smoke-test the deployed Shared List API as an anonymous guest, the way the side panel does.
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";
import { readFileSync } from "node:fs";
const o = JSON.parse(readFileSync(process.argv[2], "utf8"));
Amplify.configure({
  Auth: { Cognito: { identityPoolId: o.auth.identity_pool_id, allowGuestAccess: true } },
  API: { GraphQL: { endpoint: o.custom.sharedListApi.url, region: o.custom.sharedListApi.region, defaultAuthMode: "identityPool" } },
});
const session = await fetchAuthSession();
console.log("guest identity:", session.identityId ? "ok" : "MISSING");
const client = generateClient();
const q = async (query, variables) => {
  let r;
  try { r = await client.graphql({ query, variables }); } catch (e) { throw new Error(e?.errors?.[0]?.message ?? e?.message ?? String(e)); }
  if (r.errors) throw new Error(r.errors[0]?.message ?? JSON.stringify(r.errors));
  return r.data;
};
const L = "id name ownerId createdAt members { id displayName role joinedAt }";
const before = await q(`query { myLists { ${L} } }`);
console.log("myLists before:", before.myLists.length);
const token = "smoke-" + Math.random().toString(16).slice(2);
const created = await q(`mutation($n:String!,$t:String!,$d:String!){ createList(name:$n, inviteToken:$t, displayName:$d){ list { ${L} } inviteToken } }`, { n: "Smoke test", t: token, d: "Smoke" });
const listId = created.createList.list.id;
console.log("createList:", listId ? "ok" : "FAIL", "members:", created.createList.list.members.length);
const got = await q(`query($id:String!){ getList(listId:$id){ ${L} } }`, { id: listId });
console.log("getList:", got.getList.name, got.getList.members.map((m) => m.role).join(","));
const listing = { id: "manual:smoke", source: "manual", sourceUrl: null, floorPlanId: null, title: "Smoke", facts: { address: { value: "1 Grand Ave", provenance: "Listed" } }, capturedAt: new Date().toISOString() };
const added = await q(`mutation($l:String!,$j:AWSJSON!,$qs:[String!]){ addSavedListing(listId:$l, listing:$j, landlordQuestions:$qs){ kind savedListingId savedListing { id status version listing } } }`, { l: listId, j: JSON.stringify(listing), qs: ["Q1?"] });
const sid = added.addSavedListing.savedListingId;
console.log("addSavedListing:", added.addSavedListing.kind, "status", added.addSavedListing.savedListing.status);
const upd = await q(`mutation($l:String!,$s:String!,$p:AWSJSON!){ updateSavedListing(listId:$l, savedListingId:$s, patch:$p){ savedListing { status version tourAt } } }`, { l: listId, s: sid, p: JSON.stringify({ status: "considering", tourAt: "2026-10-20T17:00:00Z" }) });
console.log("updateSavedListing:", upd.updateSavedListing.savedListing.status, "v", upd.updateSavedListing.savedListing.version);
const note = await q(`mutation($l:String!,$s:String!,$t:String!){ addNote(listId:$l, savedListingId:$s, text:$t){ savedListing { notes } } }`, { l: listId, s: sid, t: "hello" });
console.log("addNote:", JSON.parse(note.addNote.savedListing.notes).length, "note(s)");
const fit = await q(`mutation($l:String!,$s:String!,$sc:Int!){ setFitScore(listId:$l, savedListingId:$s, score:$sc){ savedListing { fitScores } } }`, { l: listId, s: sid, sc: 81 });
console.log("setFitScore:", Object.values(JSON.parse(fit.setFitScore.savedListing.fitScores))[0].score);
const list = await q(`query($l:String!){ listSavedListings(listId:$l){ id status landlordQuestions } }`, { l: listId });
console.log("listSavedListings:", list.listSavedListings.length, list.listSavedListings[0].landlordQuestions);
const rot = await q(`mutation($l:String!,$t:String!){ rotateInviteToken(listId:$l, newToken:$t){ inviteToken } }`, { l: listId, t: token + "-2" });
console.log("rotateInviteToken:", rot.rotateInviteToken.inviteToken.endsWith("-2") ? "ok" : "FAIL");
try { await q(`mutation($l:String!,$t:String!,$d:String!){ joinList(listId:$l, inviteToken:$t, displayName:$d){ kind } }`, { l: listId, t: "wrong", d: "Intruder" }); console.log("joinList wrong token: NOT REJECTED (bug)"); }
catch (e) { console.log("joinList wrong token: rejected as expected ->", /unauthori/i.test(String(e.message)) ? "Unauthorized" : e.message.slice(0, 120)); }
try { await q(`query($id:String!){ getList(listId:$id){ id } }`, { id: "no-such-list" }); console.log("getList unknown: NOT REJECTED"); } catch (e) { console.log("getList unknown list: rejected ->", /unauthori/i.test(String(e.message)) ? "Unauthorized" : e.message.slice(0, 120)); }
await q(`mutation($l:String!,$s:String!){ removeSavedListing(listId:$l, savedListingId:$s){ kind } }`, { l: listId, s: sid });
const after = await q(`query($l:String!){ listSavedListings(listId:$l){ id } }`, { l: listId });
console.log("removeSavedListing:", after.listSavedListings.length === 0 ? "ok" : "FAIL");
console.log("DONE");
