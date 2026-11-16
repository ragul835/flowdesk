import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { userWorkspaceIds } from "@/lib/access";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/activity — recent activity across the user's workspaces
export async function GET() {
  try {
    const user = await requireUser();
    const workspaceIds = await userWorkspaceIds(user.id);

    const activities = await prisma.activity.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { id: true, name: true, avatarColor: true } } },
    });

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
        projectId: a.projectId,
        actor: a.actor,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
