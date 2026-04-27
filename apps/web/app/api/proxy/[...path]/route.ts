import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const withoutTrailingSlash = configured.replace(/\/+$/, "");
  return withoutTrailingSlash.replace(/\/api\/v1$/i, "");
}

function buildUpstreamUrl(req: NextRequest, path: string[]) {
  const base = getApiBaseUrl();
  const joinedPath = path.join("/");
  const search = req.nextUrl.search;
  return `${base}/${joinedPath}${search}`;
}

async function proxy(req: NextRequest, path: string[]) {
  const url = buildUpstreamUrl(req, path);
  const method = req.method;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const authorization = req.headers.get("authorization");

  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);

  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(url, init);
    const upstreamContentType = upstream.headers.get("content-type") ?? "";

    if (upstreamContentType.includes("application/json")) {
      const body = (await upstream.json()) as unknown;
      return NextResponse.json(body, { status: upstream.status });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: upstreamContentType
        ? { "content-type": upstreamContentType }
        : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach upstream API.";
    return NextResponse.json(
      { detail: `Proxy request failed: ${message}` },
      { status: 502 },
    );
  }
}

type RouteContext = {
  params: { path: string[] };
};

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx.params.path);
}