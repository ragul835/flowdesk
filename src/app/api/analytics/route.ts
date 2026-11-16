import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { userWorkspaceIds } from "@/lib/access";
import { errorResponse } from "@/lib/http";
import type { Priority } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/analytics — portfolio-style metrics across the user's workspaces
export async function GET() {
  try {
    const user = await requireUser();
    const workspaceIds = await userWorkspaceIds(user.id);

    const [projects, tasks] = await Promise.all([
      prisma.project.count({ where: { workspaceId: { in: workspaceIds } } }),
      prisma.task.findMany({
        where: { project: { workspaceId: { in: workspaceIds } } },
        include: {
          column: { select: { name: true } },
          assignee: { select: { name: true } },
        },
      }),
    ]);

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.column.name === "Done").length;
    const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const priorities: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];
    const byPriority = priorities.map((priority) => ({
      priority,
      count: tasks.filter((t) => t.priority === priority).length,
    }));

    const assigneeMap = new Map<string, number>();
    for (const t of tasks) {
      const name = t.assignee?.name ?? "Unassigned";
      assigneeMap.set(name, (assigneeMap.get(name) ?? 0) + 1);
    }
    const byAssignee = [...assigneeMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const columnMap = new Map<string, number>();
    for (const t of tasks) {
      columnMap.set(t.column.name, (columnMap.get(t.column.name) ?? 0) + 1);
    }
    const byColumn = [...columnMap.entries()].map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      analytics: {
        totalProjects: projects,
        totalTasks,
        completionRate,
        byPriority,
        byAssignee,
        byColumn,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
