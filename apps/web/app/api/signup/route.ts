import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const withoutTrailingSlash = configured.replace(/\/+$/, "");
  return withoutTrailingSlash.replace(/\/api\/v1$/i, "");
}

const API_URL = getApiBaseUrl();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${API_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as unknown;
      return NextResponse.json(data, { status: res.status });
    }

    const text = (await res.text()).trim();
    if (res.ok) {
      return NextResponse.json({ ok: true }, { status: res.status });
    }

    return NextResponse.json(
      {
        detail:
          text || `Signup failed with status ${res.status} from upstream API.`,
      },
      { status: res.status },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while creating account.";

    return NextResponse.json(
      {
        detail: `Could not reach signup service: ${message}`,
      },
      { status: 502 },
    );
  }
}
