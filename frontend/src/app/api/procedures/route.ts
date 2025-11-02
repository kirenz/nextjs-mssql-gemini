// src/app/api/procedures/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("http://localhost:8000/api/procedures", {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch stored procedures" },
      { status: 500 },
    );
  }
}
