import { readCommuteKeys, writeCommuteKeys } from "@/chrome/commuteKeys";

const form = document.querySelector<HTMLFormElement>("#keys");
const ors = document.querySelector<HTMLInputElement>("#ors");
const transit = document.querySelector<HTMLInputElement>("#transit");
const status = document.querySelector<HTMLElement>("#status");

function say(message: string) {
  if (status) status.textContent = message;
}

async function load() {
  if (!ors || !transit) return;
  try {
    const keys = await readCommuteKeys();
    ors.value = keys.orsKey;
    transit.value = keys.transitlandKey;
    say(keys.orsKey && keys.transitlandKey ? "Keys are saved on this device." : "No keys saved yet.");
  } catch {
    say("Couldn't read saved keys.");
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const orsKey = ors?.value.trim() ?? "";
  const transitlandKey = transit?.value.trim() ?? "";
  if ((orsKey && !transitlandKey) || (!orsKey && transitlandKey)) {
    say("Save both keys, or clear both.");
    return;
  }
  void writeCommuteKeys({ orsKey, transitlandKey })
    .then(() => say(orsKey ? "Saved. Analyze a listing again to look up the commute." : "Cleared. Commute lookups stay off."))
    .catch(() => say("Couldn't save keys."));
});

void load();
