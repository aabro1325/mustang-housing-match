/** Visible progress for capture and commute lookups. The spinner is decorative; the text is the status. */
export function LoadingStatus({ title, detail }: { title: string; detail?: string }) {
  return (
    <div class="loading" role="status" aria-live="polite">
      <span class="loading__spinner" aria-hidden="true" />
      <div>
        <div class="loading__title">{title}</div>
        {detail && <p class="loading__detail">{detail}</p>}
      </div>
    </div>
  );
}
