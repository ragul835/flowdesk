import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";
import { colorFor } from "@/lib/avatar";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = registerSchema.parse(await req.json());

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered." }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);

    // Create the user plus a personal workspace they own.
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        avatarColor: colorFor(body.email),
        memberships: {
          create: {
            role: "OWNER",
            workspace: { create: { name: `${body.name}'s Workspace` } },
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    setSessionCookie(signToken(user));
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
