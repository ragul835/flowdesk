import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["Kanban boards", "Drag-and-drop tasks across customizable columns."],
  ["Real-time sync", "See teammates' changes and presence live, via WebSockets."],
  ["Role-based access", "Owner, admin, and member roles across workspaces."],
  ["Analytics", "Completion rate, workload, and priority breakdowns."],
];

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <nav className="mb-16 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">
          Flow<span className="text-brand-600">Desk</span>
        </span>
        <div className="flex gap-3">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started
          </Link>
        </div>
      </nav>

      <section className="text-center">
        <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Project management, done right
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          The workspace where your team ships faster.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Tasks, boards, and collaboration with real-time sync — so everyone stays on
          the same page, instantly.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Start free
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            Sign in
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Free for small teams · No credit card required
        </p>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(([title, desc]) => (
          <div key={title} className="card p-6">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
