export function workspaceSaveStatus(current: string, persisted: string | null, loaded: boolean, error: string): "LOADING" | "ERROR" | "PENDING" | "SAVED" {
  if (!loaded) return "LOADING";
  if (error) return "ERROR";
  return current === persisted ? "SAVED" : "PENDING";
}
