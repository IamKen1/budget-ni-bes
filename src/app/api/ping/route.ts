import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Unauthenticated keep-warm endpoint — pinged on a schedule (see
 * .github/workflows/keep-warm.yml) so the serverless function and its Prisma
 * connection stay warm instead of cold-starting on the family's next real
 * request. Deliberately returns no account/financial data.
 */
export async function GET() {
  await prisma.account.count();
  return NextResponse.json({ ok: true });
}
