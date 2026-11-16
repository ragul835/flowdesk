import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Normalizes thrown errors (auth, access, validation) into JSON responses. */
export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const status = (err as { status?: number })?.status ?? 500;
  const message = err instanceof Error ? err.message : "Internal server error";
  if (status === 500) console.error(err);
  return NextResponse.json({ error: message }, { status });
}
