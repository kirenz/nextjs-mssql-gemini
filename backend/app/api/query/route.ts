// src/app/api/query/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch("http://localhost:8000/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: body.query
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to process query');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in query route:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process query' },
      { status: 500 }
    );
  }
}