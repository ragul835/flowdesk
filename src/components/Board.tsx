"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Priority, ProjectDetail, TaskDTO } from "@/lib/types";
import { useBoardSocket } from "@/lib/useBoardSocket";
import TaskCard from "@/components/TaskCard";
import TaskDialog from "@/components/TaskDialog";
import Avatar from "@/components/Avatar";

type DialogState =
  | { mode: "create"; columnId: string }
  | { mode: "edit"; task: TaskDTO }
  | null;

const PRIORITY_FILTERS: (Priority | "ALL")[] = ["ALL", "URGENT", "HIGH", "MEDIUM", "LOW"];

export default function Board({
  projectId,
  currentUser,
}: {
  projectId: string;
  currentUser: { id: string; name: string };
}) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const loadingRef = useRef(false);

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "ALL">("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await api<{ project: ProjectDetail }>(`/api/projects/${projectId}`);
      setProject(res.project);
    } finally {
      loadingRef.current = false;
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const { connected, viewers, broadcast } = useBoardSocket(projectId, currentUser, load);

  async function moveTask(taskId: string, toColumnId: string) {
    if (!project) return;
    setProject((prev) => {
      if (!prev) return prev;
      let moved: TaskDTO | undefined;
      const columns = prev.columns.map((c) => ({
        ...c,
        tasks: c.tasks.filter((t) => {
          if (t.id === taskId) {
            moved = { ...t, columnId: toColumnId };
            return false;
          }
          return true;
        }),
      }));
      if (moved) columns.find((c) => c.id === toColumnId)?.tasks.push(moved);
      return { ...prev, columns };
    });

    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ columnId: toColumnId }),
      });
      broadcast();
    } catch {
      load();
    }
  }

  async function afterMutation() {
    await load();
    broadcast();
  }

  async function renameProject() {
    if (!project) return;
    const name = window.prompt("Project name", project.name);
    if (!name || name.trim() === project.name) return;
    await api(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim() }),
    });
    setSettingsOpen(false);
    load();
  }

  async function deleteProject() {
    if (!project) return;
    if (!confirm(`Delete "${project.name}" and all its tasks? This cannot be undone.`)) return;
    await api(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  if (!project) return <p className="text-slate-500">Loading board…</p>;

  const canManage = project.role === "OWNER" || project.role === "ADMIN";
  const canDelete = project.role === "OWNER";

  const matches = (t: TaskDTO) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (assigneeFilter === "UNASSIGNED" && t.assignee) return false;
    if (assigneeFilter !== "ALL" && assigneeFilter !== "UNASSIGNED" && t.assignee?.id !== assigneeFilter)
      return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q))
        return false;
    }
    return true;
  };

  const filtering = search.trim() !== "" || priorityFilter !== "ALL" || assigneeFilter !== "ALL";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {viewers.slice(0, 5).map((v) => (
                <Avatar key={v.id} name={v.name} size={32} ring />
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connected ? "bg-green-500" : "bg-slate-300"
                }`}
              />
              {connected ? "Live" : "Offline"}
            </span>
          </div>

          {canManage && (
            <div className="relative">
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className="btn-ghost px-2"
                aria-label="Project settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200">
                    <button
                      onClick={renameProject}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      Rename project
                    </button>
                    {canDelete && (
                      <button
                        onClick={deleteProject}
                        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete project
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="input w-56 pl-9"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "ALL")}
          className="input w-auto"
        >
          {PRIORITY_FILTERS.map((p) => (
            <option key={p} value={p}>
              {p === "ALL" ? "All priorities" : p.charAt(0) + p.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="ALL">All assignees</option>
          <option value="UNASSIGNED">Unassigned</option>
          {project.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {filtering && (
          <button
            onClick={() => {
              setSearch("");
              setPriorityFilter("ALL");
              setAssigneeFilter("ALL");
            }}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Board columns */}
      <div className="scroll-thin flex gap-4 overflow-x-auto pb-4">
        {project.columns.map((column) => {
          const visibleTasks = column.tasks.filter(matches);
          const isDone = column.name === "Done";
          return (
            <div
              key={column.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverColumn(column.id);
              }}
              onDragLeave={() => setOverColumn((c) => (c === column.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverColumn(null);
                if (dragTaskId) moveTask(dragTaskId, column.id);
                setDragTaskId(null);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/70 p-3 transition ${
                overColumn === column.id ? "ring-2 ring-brand-400" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700">
                  {column.name}{" "}
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    {visibleTasks.length}
                  </span>
                </h3>
              </div>

              <div className="flex-1 space-y-2">
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDone={isDone}
                    onDragStart={() => setDragTaskId(task.id)}
                    onClick={() => setDialog({ mode: "edit", task })}
                  />
                ))}
                {visibleTasks.length === 0 && filtering && (
                  <p className="px-1 py-2 text-xs text-slate-400">No matching tasks</p>
                )}
              </div>

              <button
                onClick={() => setDialog({ mode: "create", columnId: column.id })}
                className="mt-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-200/60"
              >
                + Add task
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <TaskDialog
          projectId={projectId}
          members={project.members}
          state={dialog}
          currentUser={currentUser}
          onClose={() => setDialog(null)}
          onSaved={afterMutation}
        />
      )}
    </div>
  );
}
