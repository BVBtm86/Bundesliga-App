import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const origin = process.env.TACTICAL_DNA_API_ORIGIN ?? "http://127.0.0.1:8000";
    const endpoint = new URL("/tactical-dna/metrics", origin);
    endpoint.search = new URL(request.url).search;
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(7000)])
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ detail: "Tactical DNA statistics are temporarily unavailable." }, { status: 503 });
  }
}
