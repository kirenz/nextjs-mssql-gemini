// src/app/api/procedures/[schema]/[name]/route.ts
import { NextResponse } from "next/server";

type RouteParams = Promise<{
  schema: string;
  name: string;
}>;

export async function GET(_request: Request, context: { params: RouteParams }) {
  const { schema, name } = await context.params;
  const backendUrl = `http://localhost:8000/api/procedures/${encodeURIComponent(
    schema,
  )}/${encodeURIComponent(name)}`;

  try {
    const response = await fetch(backendUrl, {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch stored procedure details" },
      { status: 500 },
    );
  }
}
