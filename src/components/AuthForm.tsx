"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = isRegister ? "/api/auth/register" : "/api/auth/login";
      const payload = isRegister ? { name, email, password } : { email, password };
      await api(path, { method: "POST", body: JSON.stringify(payload) });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-6">
      <Link href="/" className="mb-8 block text-center text-xl font-bold tracking-tight">
        Flow<span className="text-brand-600">Desk</span>
      </Link>
      <div className="card p-6">
        <h1 className="text-lg font-semibold">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isRegister ? "Start managing projects in minutes." : "Log in to your workspace."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isRegister && (
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Cooper"
                required
              />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              {!isRegister && (
                <Link href="/forgot" className="mb-1 text-xs font-medium text-brand-600">
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Please wait…" : isRegister ? "Create account" : "Log in"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-slate-600">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to FlowDesk?{" "}
            <Link href="/register" className="font-medium text-brand-600">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
