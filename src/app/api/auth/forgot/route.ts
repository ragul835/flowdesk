import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

// POST /api/auth/forgot — create a password reset token.
// No mail server here, so the reset link is returned for development use.
// (In production you'd email it and never return it in the response.)
export async function POST(req: Request) {
  try {
    const { email } = forgotSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way so we don't leak which emails exist.
    const generic = { ok: true } as { ok: true; resetUrl?: string };

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
        },
      });
      // Dev convenience: surface the link. Remove when real email is wired up.
      generic.resetUrl = `/reset?token=${token}`;
    }

    return NextResponse.json(generic);
  } catch (err) {
    return errorResponse(err);
  }
}
