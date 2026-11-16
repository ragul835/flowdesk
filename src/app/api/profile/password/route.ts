import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, verifyPassword, hashPassword } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

// POST /api/profile/password — change password (requires current password)
export async function POST(req: Request) {
  try {
    const sessionUser = await requireUser();
    const body = changePasswordSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
