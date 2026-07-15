"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { saveAuthSession } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/onboarding";
import { loginWithEmail, signUpWithEmail } from "@/services/auth";

type Mode = "login" | "signup";

function AuthFormInner({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = isSignup
        ? await signUpWithEmail({
            email,
            password,
            username: username || undefined,
            full_name: fullName || undefined,
          })
        : await loginWithEmail({ email, password });

      saveAuthSession(result.session, result.user);
      const needsOnboarding = isSignup || !hasCompletedOnboarding(result.user.id);
      router.push(needsOnboarding ? "/onboarding" : redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[460px] rounded-[24px] border border-white/10 bg-[#0d0d0c] p-6 shadow-[0_30px_80px_-42px_rgba(0,0,0,0.9)] sm:p-8">
      <div className="mb-8">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f6e879]">
          Kontext workspace
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.05em] text-[#f4f3ec] sm:text-4xl">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-white/50">
          {isSignup
            ? "Use email and password to open your workspace."
            : "Sign in to access your chats, profile, and artifact history."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {isSignup ? (
          <>
            <Field
              label="Full name"
              value={fullName}
              onChange={setFullName}
              placeholder="Aman Sagar"
            />
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="aman"
            />
          </>
        ) : null}

        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          type="email"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Minimum 8 characters"
          type="password"
        />

        {error ? (
          <p className="rounded-[1rem] border border-red-500/15 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="auth-submit-button group relative isolate w-full overflow-hidden rounded-[12px] px-4 py-3 text-sm font-semibold shadow-[0_12px_28px_-18px_rgba(246,232,121,0.7)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e879]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0c] disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className="auth-submit-fill pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
            style={{ background: "#f6e879" }}
          />
          <span className="relative z-10 text-[#171814]">
            {loading
              ? isSignup
                ? "Creating account..."
                : "Signing in..."
              : isSignup
                ? "Sign up"
                : "Login"}
          </span>
        </button>
      </form>

      <p className="mt-6 text-sm text-white/45">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-white underline decoration-[#f6e879]/45 underline-offset-4 transition hover:decoration-[#f6e879]"
        >
          {isSignup ? "Login" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-white/80">{label}</span>
      <div className="relative">
        <input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-[12px] border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/15 focus:border-[#f6e879]/55 focus:ring-2 focus:ring-[#f6e879]/10"
          style={isPassword ? { paddingRight: "2.75rem" } : undefined}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </label>
  );
}

export default function AuthForm({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={null}>
      <AuthFormInner mode={mode} />
    </Suspense>
  );
}
