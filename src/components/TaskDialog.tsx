"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CommentDTO, Member, Priority, TaskDTO } from "@/lib/types";
import Avatar from "@/components/Avatar";

type DialogState =
  | { mode: "create"; columnId: string }
  | { mode: "edit"; task: TaskDTO };

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TaskDialog({
  projectId,
  members,
  state,
  currentUser,
  onClose,
  onSaved,
}: {
  projectId: string;
  members: Member[];
  state: DialogState;
  currentUser: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = state.mode === "edit";
  const task = editing ? state.task : null;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string>(task?.assignee?.id ?? "");
  const [dueDate, setDueDate] = useState<string>(toDateInput(task?.dueDate ?? null));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Comments (edit mode only)
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (editing && task) {
      api<{ comments: CommentDTO[] }>(`/api/tasks/${task.id}/comments`)
        .then((r) => setComments(r.comments))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null,
      };
      if (editing) {
        await api(`/api/tasks/${task!.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ ...payload, projectId, columnId: state.columnId }),
        });
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing || !confirm("Delete this task?")) return;
    setSaving(true);
    try {
      await api(`/api/tasks/${task!.id}`, { method: "DELETE" });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setSaving(false);
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !newComment.trim()) return;
    setPostingComment(true);
    try {
      const res = await api<{ comment: CommentDTO }>(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newComment.trim() }),
      });
      setComments((c) => [...c, res.comment]);
      setNewComment("");
      onSaved(); // refresh board so the comment count updates
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-6">
          <h2 className="text-lg font-semibold">{editing ? "Edit task" : "New task"}</h2>
          <form onSubmit={save} className="mt-4 space-y-4">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details…"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Assignee</label>
                <select
                  className="input"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Due date</label>
                <input
                  type="date"
                  className="input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              {editing ? (
                <button
                  type="button"
                  onClick={remove}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                  disabled={saving}
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Create task"}
                </button>
              </div>
            </div>
          </form>

          {/* Comments */}
          {editing && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Comments {comments.length > 0 && <span className="text-slate-400">({comments.length})</span>}
              </h3>

              <div className="space-y-3">
                {comments.length === 0 && (
                  <p className="text-sm text-slate-400">No comments yet.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar name={c.author.name} color={c.author.avatarColor} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{c.author.name}</span>{" "}
                        <span className="text-xs text-slate-400">{relativeTime(c.createdAt)}</span>
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={postComment} className="mt-3 flex gap-2">
                <input
                  className="input"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={`Comment as ${currentUser.name}…`}
                />
                <button
                  type="submit"
                  className="btn-primary shrink-0"
                  disabled={postingComment || !newComment.trim()}
                >
                  {postingComment ? "…" : "Send"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
