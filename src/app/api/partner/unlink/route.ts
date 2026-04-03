import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { partnershipId } = await request.json();

    if (!partnershipId || typeof partnershipId !== "string") {
      return NextResponse.json(
        { error: "Partnership ID is required." },
        { status: 400 }
      );
    }

    // Stub: In production, dissolve partnership and clean up shared data
    return NextResponse.json({
      success: true,
      message: "Partnership unlinked successfully.",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to unlink partnership." },
      { status: 500 }
    );
  }
}
