// src/app/api/reports/pptx/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch("http://localhost:8000/api/reports/pptx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            errorData.error ||
            errorData.detail ||
            "Failed to build PPTX report",
        },
        { status: response.status },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const headers = new Headers();
    headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    const disposition =
      response.headers.get("Content-Disposition") ||
      response.headers.get("content-disposition");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to download PPTX report" },
      { status: 500 },
    );
  }
}
