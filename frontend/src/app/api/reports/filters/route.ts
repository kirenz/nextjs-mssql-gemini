// src/app/api/reports/filters/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const backendUrl = queryString
    ? `http://localhost:8000/api/reports/filters?${queryString}`
    : "http://localhost:8000/api/reports/filters";

  try {
    const response = await fetch(backendUrl, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load report filters" },
      { status: 500 },
    );
  }
}
