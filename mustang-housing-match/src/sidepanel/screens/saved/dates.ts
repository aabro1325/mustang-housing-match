/** Date helpers for the Saved Listing detail: tours and notes are stored as ISO strings. */

const TOUR_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const NOTE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function formatTour(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : TOUR_FORMAT.format(d);
}

export function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : NOTE_FORMAT.format(d);
}

/** ISO → the local "YYYY-MM-DDTHH:MM" an <input type="datetime-local"> expects. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local input value → ISO, or null when empty or unparseable. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
