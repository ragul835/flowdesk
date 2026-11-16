import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireProjectAccess, HttpError } from "@/lib/access";
import { createCommentSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/tasks/:id/comments — list comments (oldest first)
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task) throw new HttpError(404, "Task not found.");
    await requireProjectAccess(user.id, task.projectId);

    const comments = await prisma.comment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true, avatarColor: true } } },
    });

    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: c.author,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/tasks/:id/comments — add a comment
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task) throw new HttpError(404, "Task not found.");
    const { project } = await requireProjectAccess(user.id, task.projectId);

    const body = createCommentSchema.parse(await req.json());
    const comment = await prisma.comment.create({
      data: { body: body.body, taskId: params.id, authorId: user.id },
      include: { author: { select: { id: true, name: true, avatarColor: true } } },
    });

    await logActivity({
      workspaceId: project.workspaceId,
      actorId: user.id,
      projectId: project.id,
      type: "COMMENT_ADDED",
      message: `${user.name} commented on “${task.title}”`,
    });

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          author: comment.author,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
