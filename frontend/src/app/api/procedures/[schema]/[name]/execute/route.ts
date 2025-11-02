// src/app/api/procedures/[schema]/[name]/execute/route.ts
import { NextRequest, NextResponse } from "next/server";

type RouteParams = Promise<{
  schema: string;
  name: string;
}>;

export async function POST(
  request: NextRequest,
  context: { params: RouteParams },
) {
  const { schema, name } = await context.params;
  const backendUrl = `http://localhost:8000/api/procedures/${encodeURIComponent(
    schema,
  )}/${encodeURIComponent(name)}/execute`;

  try {
    const body = await request.json();
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to execute stored procedure" },
      { status: 500 },
    );
  }
}
