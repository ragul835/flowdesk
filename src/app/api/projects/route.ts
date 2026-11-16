import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireWorkspaceRole, userWorkspaceIds, HttpError } from "@/lib/access";
import { createProjectSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COLUMNS = ["Backlog", "To Do", "In Progress", "Done"];

// GET /api/projects — all projects across the user's workspaces
export async function GET() {
  try {
    const user = await requireUser();
    const workspaceIds = await userWorkspaceIds(user.id);

    const projects = await prisma.project.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "desc" },
      include: {
        workspace: { select: { name: true } },
        tasks: { select: { id: true, column: { select: { name: true } } } },
      },
    });

    const summaries = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      workspaceName: p.workspace.name,
      taskCount: p.tasks.length,
      doneCount: p.tasks.filter((t) => t.column.name === "Done").length,
    }));

    return NextResponse.json({ projects: summaries });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/projects — create a project with default columns
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createProjectSchema.parse(await req.json());

    let workspaceId = body.workspaceId;
    if (!workspaceId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id },
        orderBy: { role: "asc" },
      });
      if (!membership) throw new HttpError(400, "No workspace available.");
      workspaceId = membership.workspaceId;
    }

    // Must be at least ADMIN to create projects in a workspace.
    await requireWorkspaceRole(user.id, workspaceId, "ADMIN");

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description ?? "",
        workspaceId,
        columns: { create: DEFAULT_COLUMNS.map((name, i) => ({ name, order: i })) },
      },
      select: { id: true, name: true },
    });

    await logActivity({
      workspaceId,
      actorId: user.id,
      projectId: project.id,
      type: "PROJECT_CREATED",
      message: `${user.name} created project “${project.name}”`,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
