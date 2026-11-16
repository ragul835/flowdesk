import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireUser, hashPassword } from "@/lib/auth";
import { primaryWorkspace, requireWorkspaceRole, roleRank, HttpError } from "@/lib/access";
import { inviteSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";
import { logActivity } from "@/lib/activity";
import { colorFor } from "@/lib/avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/team — members of the user's primary workspace
export async function GET() {
  try {
    const user = await requireUser();
    const ws = await primaryWorkspace(user.id);

    const memberships = await prisma.membership.findMany({
      where: { workspaceId: ws.workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarColor: true, title: true } } },
      orderBy: { role: "asc" },
    });

    return NextResponse.json({
      workspace: { id: ws.workspaceId },
      myRole: ws.role,
      members: memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarColor: m.user.avatarColor,
        title: m.user.title,
        role: m.role,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/team — invite a member (ADMIN+). Creates the account if new and
// returns a setup link (no mail server here).
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const ws = await primaryWorkspace(user.id);
    await requireWorkspaceRole(user.id, ws.workspaceId, "ADMIN");

    const body = inviteSchema.parse(await req.json());

    // You can't grant a role higher than your own.
    if (roleRank(body.role) > roleRank(ws.role)) {
      throw new HttpError(403, "You cannot grant a role higher than your own.");
    }

    let invited = await prisma.user.findUnique({ where: { email: body.email } });
    let setupUrl: string | undefined;

    if (!invited) {
      // Create the account with a random password; return a reset link to set it.
      invited = await prisma.user.create({
        data: {
          email: body.email,
          name: body.name || body.email.split("@")[0],
          passwordHash: await hashPassword(crypto.randomBytes(16).toString("hex")),
          avatarColor: colorFor(body.email),
        },
      });
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { token, userId: invited.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
      });
      setupUrl = `/reset?token=${token}`;
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: invited.id, workspaceId: ws.workspaceId } },
    });
    if (existing) throw new HttpError(409, "That person is already a member.");

    await prisma.membership.create({
      data: { userId: invited.id, workspaceId: ws.workspaceId, role: body.role },
    });

    await logActivity({
      workspaceId: ws.workspaceId,
      actorId: user.id,
      type: "MEMBER_ADDED",
      message: `${user.name} added ${invited.name} to the workspace`,
    });

    return NextResponse.json(
      {
        member: {
          id: invited.id,
          name: invited.name,
          email: invited.email,
          avatarColor: invited.avatarColor,
          title: invited.title,
          role: body.role,
        },
        setupUrl,
      },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
