export function Checkbox({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <label class="checkbox" for={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)} />
      <span class="checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
      <span>{label}</span>
    </label>
  );
}
