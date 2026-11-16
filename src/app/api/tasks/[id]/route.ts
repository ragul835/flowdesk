import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireProjectAccess, HttpError } from "@/lib/access";
import { updateTaskSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// PATCH /api/tasks/:id — edit fields and/or move between columns (drag & drop)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, "Task not found.");
    const { project } = await requireProjectAccess(user.id, existing.projectId);

    const body = updateTaskSchema.parse(await req.json());

    // If moving columns, make sure the target column is in the same project.
    let movedTo: string | null = null;
    if (body.columnId && body.columnId !== existing.columnId) {
      const column = await prisma.column.findUnique({ where: { id: body.columnId } });
      if (!column || column.projectId !== existing.projectId) {
        throw new HttpError(400, "Invalid target column.");
      }
      movedTo = column.name;
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        priority: body.priority,
        columnId: body.columnId,
        order: body.order,
        assigneeId: body.assigneeId === undefined ? undefined : body.assigneeId,
        dueDate:
          body.dueDate === undefined
            ? undefined
            : body.dueDate
              ? new Date(body.dueDate)
              : null,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });

    if (movedTo) {
      await logActivity({
        workspaceId: project.workspaceId,
        actorId: user.id,
        projectId: project.id,
        type: movedTo === "Done" ? "TASK_COMPLETED" : "TASK_MOVED",
        message:
          movedTo === "Done"
            ? `${user.name} completed “${task.title}”`
            : `${user.name} moved “${task.title}” to ${movedTo}`,
      });
    }

    return NextResponse.json({ task });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/tasks/:id
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, "Task not found.");
    const { project } = await requireProjectAccess(user.id, existing.projectId);
    await prisma.task.delete({ where: { id: params.id } });
    await logActivity({
      workspaceId: project.workspaceId,
      actorId: user.id,
      projectId: project.id,
      type: "TASK_DELETED",
      message: `${user.name} deleted “${existing.title}”`,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
