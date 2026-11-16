"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ ok: true; resetUrl?: string }>("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
      setResetUrl(res.resetUrl ?? null);
    } catch {
      setSent(true); // same response regardless, to avoid email enumeration
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm px-6">
      <Link href="/" className="mb-8 block text-center text-xl font-bold tracking-tight">
        Flow<span className="text-brand-600">Desk</span>
      </Link>
      <div className="card p-6">
        <h1 className="text-lg font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {sent ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </p>
            {resetUrl && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No mail server is configured, so here is your link:{" "}
                <Link href={resetUrl} className="font-medium underline">
                  Reset password
                </Link>
              </p>
            )}
            <Link href="/login" className="block text-center text-sm text-brand-600">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
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
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <Link href="/login" className="block text-center text-sm text-slate-500">
              Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
