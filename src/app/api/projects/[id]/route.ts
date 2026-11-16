import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireProjectAccess } from "@/lib/access";
import { updateProjectSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/projects/:id — full board (columns + tasks + members)
export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { project, role } = await requireProjectAccess(user.id, params.id);

    const columns = await prisma.column.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            assignee: { select: { id: true, name: true, avatarColor: true } },
            _count: { select: { comments: true } },
          },
        },
      },
    });

    const memberships = await prisma.membership.findMany({
      where: { workspaceId: project.workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarColor: true, title: true } },
      },
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        role,
        columns: columns.map((c) => ({
          id: c.id,
          name: c.name,
          order: c.order,
          tasks: c.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            order: t.order,
            priority: t.priority,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            columnId: t.columnId,
            assignee: t.assignee,
            commentCount: t._count.comments,
          })),
        })),
        members: memberships.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarColor: m.user.avatarColor,
          title: m.user.title,
          role: m.role,
        })),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/projects/:id — rename / edit description (ADMIN+)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    await requireProjectAccess(user.id, params.id, "ADMIN");
    const body = updateProjectSchema.parse(await req.json());
    const project = await prisma.project.update({
      where: { id: params.id },
      data: body,
      select: { id: true, name: true, description: true },
    });
    return NextResponse.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/projects/:id — remove project (OWNER only)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    await requireProjectAccess(user.id, params.id, "OWNER");
    await prisma.project.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
