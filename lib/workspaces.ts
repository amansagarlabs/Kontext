import type { AuthUser, AuthWorkspace } from "@/lib/types";

const WORKSPACES_KEY = "kontext-local-workspaces";

function storageKey(userId: string) {
  return `${WORKSPACES_KEY}:${userId}`;
}

export function loadWorkspaces(user: AuthUser): AuthWorkspace[] {
  if (typeof window === "undefined") return user.workspaces || [];
  const stored = localStorage.getItem(storageKey(user.id));
  if (!stored) return user.workspaces || [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as AuthWorkspace[]) : user.workspaces || [];
  } catch {
    return user.workspaces || [];
  }
}

export function saveWorkspaces(userId: string, workspaces: AuthWorkspace[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(workspaces));
}
