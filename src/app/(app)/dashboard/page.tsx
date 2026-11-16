"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Analytics, ActivityItem, ProjectSummary } from "@/lib/types";
import StatCard from "@/components/StatCard";
import NewProjectDialog from "@/components/NewProjectDialog";
import Avatar from "@/components/Avatar";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, a, act] = await Promise.all([
      api<{ projects: ProjectSummary[] }>("/api/projects"),
      api<{ analytics: Analytics }>("/api/analytics"),
      api<{ activities: ActivityItem[] }>("/api/activity"),
    ]);
    setProjects(p.projects);
    setAnalytics(a.analytics);
    setActivity(act.activities);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-slate-500">Loading your workspace…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">Your projects and team activity at a glance.</p>
        </div>
        <NewProjectDialog onCreated={load} />
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Projects" value={analytics.totalProjects} />
          <StatCard label="Total tasks" value={analytics.totalTasks} />
          <StatCard
            label="Completion rate"
            value={`${analytics.completionRate}%`}
            hint="Tasks in the Done column"
          />
          <StatCard
            label="Top contributor"
            value={analytics.byAssignee.find((a) => a.name !== "Unassigned")?.name ?? "—"}
            hint="By tasks assigned"
          />
        </div>
      )}

      {analytics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Tasks by status</h3>
            <BarList
              items={analytics.byColumn.map((c) => ({ label: c.name, value: c.count }))}
              total={analytics.totalTasks}
            />
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Tasks by priority</h3>
            <BarList
              items={analytics.byPriority.map((p) => ({ label: p.priority, value: p.count }))}
              total={analytics.totalTasks}
            />
          </div>
        </div>
      )}

      {activity.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">Recent activity</h3>
          <ul className="space-y-3">
            {activity.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <Avatar name={a.actor.name} color={a.actor.avatarColor} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">{a.message}</p>
                  <p className="text-xs text-slate-400">{relativeTime(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Projects</h2>
        {projects.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            No projects yet. Create your first one to get started.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/board/${p.id}`} className="card p-5 transition hover:ring-brand-300">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                  {p.workspaceName}
                </p>
                <h3 className="mt-1 font-semibold">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {p.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>{p.taskCount} tasks</span>
                  <span>{p.doneCount} done</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-brand-500"
                    style={{
                      width: `${p.taskCount ? (p.doneCount / p.taskCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BarList({
  items,
  total,
}: {
  items: { label: string; value: number }[];
  total: number;
}) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-sm text-slate-600">{it.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-brand-500"
              style={{ width: `${total ? (it.value / total) * 100 : 0}%` }}
            />
          </div>
          <span className="w-6 text-right text-sm tabular-nums text-slate-500">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
