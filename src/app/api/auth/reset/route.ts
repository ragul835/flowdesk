import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setSessionCookie } from "@/lib/auth";
import { resetSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

// POST /api/auth/reset — consume a reset token and set a new password.
export async function POST(req: Request) {
  try {
    const { token, password } = resetSchema.parse(await req.json());

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Log them straight in after a successful reset.
    setSessionCookie(signToken({ id: record.user.id, email: record.user.email }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
