/** Rollout compatibility only for an explicitly missing template table. */
export function isMissingTemplateTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error || !["PGRST205", "42P01"].includes(error.code ?? "")) return false;
  const message = error.message ?? "";
  return /(?:public\.|public['".]|\")document_templates(?:['"\s]|$)/.test(message)
    || message.includes("'public.document_templates'");
}
