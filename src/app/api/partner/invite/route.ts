import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    // Stub: In production, send invite email and create invite record
    return NextResponse.json({
      success: true,
      inviteId: crypto.randomUUID(),
      message: `Invite sent to ${email}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process invite." },
      { status: 500 }
    );
  }
}
