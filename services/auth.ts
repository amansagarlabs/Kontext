import type { AuthSession, AuthUser } from "@/lib/types";
import { API_URL } from "@/services/api";

type AuthResponse = {
  user: AuthUser;
  session: AuthSession;
};

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  username?: string;
  full_name?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : `Signup failed (${res.status})`,
    );
  }
  return data as AuthResponse;
}

export async function loginWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : `Login failed (${res.status})`,
    );
  }
  return data as AuthResponse;
}

export async function fetchMe(token: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : `Profile failed (${res.status})`,
    );
  }
  return data as { user: AuthUser };
}
