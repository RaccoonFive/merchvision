import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getFlipCalibrationReport, runFlipCalibration } from "@/lib/flipCalibration";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorization = authorizeCron(request);
  if (authorization) return authorization;

  try {
    return NextResponse.json({ data: await getFlipCalibrationReport() });
  } catch {
    return NextResponse.json({ error: "Unable to load flip calibration report." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = authorizeCron(request);
  if (authorization) return authorization;

  try {
    return NextResponse.json({ data: await runFlipCalibration() });
  } catch {
    return NextResponse.json({ error: "Unable to run flip calibration." }, { status: 500 });
  }
}

function authorizeCron(request: Request): NextResponse | undefined {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Flip calibration is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  const authorized = providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
  if (!authorized) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return undefined;
}
