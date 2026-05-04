import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const required = ["firstName", "lastName", "department", "email", "deptType", "rosterSize"];
  const missing = required.filter((key) => !String(body[key] ?? "").trim());

  if (missing.length) {
    return NextResponse.json(
      { error: "Missing required fields", fields: missing },
      { status: 400 }
    );
  }

  // TODO: wire to Resend / Mailchimp / CRM - swap the delay below for the API call.
  await new Promise((resolve) => setTimeout(resolve, 400));
  return NextResponse.json({ ok: true });
}
