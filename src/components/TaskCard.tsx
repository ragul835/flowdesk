"use client";
import type { Priority, TaskDTO } from "@/lib/types";
import Avatar from "@/components/Avatar";

const PRIORITY_STYLE: Record<Priority, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-brand-100 text-brand-700",
  LOW: "bg-slate-100 text-slate-500",
};

function formatDue(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso) < today;
}

export default function TaskCard({
  task,
  isDone,
  onDragStart,
  onClick,
}: {
  task: TaskDTO;
  isDone: boolean;
  onDragStart: () => void;
  onClick: () => void;
}) {
  const overdue = task.dueDate && !isDone && isOverdue(task.dueDate);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group cursor-pointer rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[task.priority]}`}
        >
          {task.priority}
        </span>
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>
      )}

      {(task.dueDate || task.commentCount > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                overdue ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {formatDue(task.dueDate)}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {task.commentCount}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        {task.assignee ? (
          <div className="flex items-center gap-1.5">
            <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size={20} />
            <span className="text-xs text-slate-500">{task.assignee.name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        )}
      </div>
    </div>
  );
}
