import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireProjectAccess, HttpError } from "@/lib/access";
import { createTaskSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

// POST /api/tasks — create a task in a column
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createTaskSchema.parse(await req.json());
    const { project } = await requireProjectAccess(user.id, body.projectId);

    // The column must belong to this project.
    const column = await prisma.column.findUnique({ where: { id: body.columnId } });
    if (!column || column.projectId !== body.projectId) {
      throw new HttpError(400, "Invalid column for this project.");
    }

    // Validate assignee is a workspace member, if provided.
    if (body.assigneeId) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: body.assigneeId,
            workspaceId: project.workspaceId,
          },
        },
      });
      if (!membership) throw new HttpError(400, "Assignee is not a workspace member.");
    }

    const count = await prisma.task.count({ where: { columnId: body.columnId } });

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description ?? "",
        priority: body.priority ?? "MEDIUM",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        order: count,
        projectId: body.projectId,
        columnId: body.columnId,
        assigneeId: body.assigneeId ?? null,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });

    await logActivity({
      workspaceId: project.workspaceId,
      actorId: user.id,
      projectId: project.id,
      type: "TASK_CREATED",
      message: `${user.name} created task “${task.title}” in ${project.name}`,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
