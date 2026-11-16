import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { primaryWorkspace, requireWorkspaceRole, HttpError } from "@/lib/access";
import { updateRoleSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

type Params = { params: { userId: string } };

// PATCH /api/team/:userId — change a member's role (OWNER only)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const ws = await primaryWorkspace(user.id);
    await requireWorkspaceRole(user.id, ws.workspaceId, "OWNER");

    if (params.userId === user.id) {
      throw new HttpError(400, "You can't change your own role.");
    }

    const { role } = updateRoleSchema.parse(await req.json());

    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: params.userId, workspaceId: ws.workspaceId } },
    });
    if (!membership) throw new HttpError(404, "Member not found.");

    await prisma.membership.update({
      where: { id: membership.id },
      data: { role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/team/:userId — remove a member (ADMIN+). Can't remove owners or yourself.
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const ws = await primaryWorkspace(user.id);
    await requireWorkspaceRole(user.id, ws.workspaceId, "ADMIN");

    if (params.userId === user.id) {
      throw new HttpError(400, "Use 'Leave workspace' to remove yourself.");
    }

    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: params.userId, workspaceId: ws.workspaceId } },
    });
    if (!membership) throw new HttpError(404, "Member not found.");
    if (membership.role === "OWNER") throw new HttpError(403, "You can't remove an owner.");

    await prisma.membership.delete({ where: { id: membership.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
