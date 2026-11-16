import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { updateProfileSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/profile — current user's profile
export async function GET() {
  try {
    const user = await requireUser();
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, avatarColor: true, title: true },
    });
    return NextResponse.json({ profile });
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/profile — update name, title, avatar color
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = updateProfileSchema.parse(await req.json());
    const profile = await prisma.user.update({
      where: { id: user.id },
      data: body,
      select: { id: true, name: true, email: true, avatarColor: true, title: true },
    });
    return NextResponse.json({ profile });
  } catch (err) {
    return errorResponse(err);
  }
}
