"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { saveAuthSession } from "@/lib/auth";
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
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[440px] rounded-[2rem] border border-[#e5d8c9] bg-[rgba(255,253,250,0.92)] p-6 shadow-[0_18px_42px_-18px_rgba(64,43,24,0.14)] backdrop-blur-sm sm:p-8 dark:border-white/10 dark:bg-[rgba(15,23,42,0.82)] dark:shadow-[0_18px_42px_-18px_rgba(0,0,0,0.45)]">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c9671d] dark:text-orange-300">
          AmanAgent Lab
        </p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.05em] text-[#201510] dark:text-white">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[#737373] dark:text-slate-300">
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
          className="w-full rounded-full bg-[#e67d2b] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgba(230,125,43,0.7)] transition hover:bg-[#d96f1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e67d2b]/35 disabled:opacity-50 dark:bg-[#f08a35] dark:text-[#201510] dark:hover:bg-[#f39a4e] dark:focus-visible:ring-[#f08a35]/30"
        >
          {loading
            ? isSignup
              ? "Creating account..."
              : "Signing in..."
            : isSignup
              ? "Sign up"
              : "Login"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[#737373] dark:text-slate-400">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-[#201510] underline decoration-[#e67d2b]/50 underline-offset-4 transition hover:decoration-[#e67d2b] dark:text-white dark:decoration-orange-300/50 dark:hover:decoration-orange-200"
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
      <span className="mb-1.5 block text-sm font-medium text-[#201510] dark:text-slate-100">{label}</span>
      <div className="relative">
        <input
          type={isPassword && showPassword ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-[1rem] border border-[#e0d2c2] bg-white px-4 py-3 text-sm text-[#201510] outline-none transition placeholder:text-[#a18672] focus:border-[#d8b18b] focus:ring-2 focus:ring-[#e67d2b]/15 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#f08a35] dark:focus:ring-[#f08a35]/20"
          style={isPassword ? { paddingRight: "2.75rem" } : undefined}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a18672] transition hover:text-[#201510] dark:text-slate-500 dark:hover:text-white"
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
