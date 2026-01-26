import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { searchCandidates } from "@/lib/enrich";

export async function GET(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query) return new NextResponse("Missing query", { status: 400 });

    try {
        const candidates = await searchCandidates(query);
        return NextResponse.json(candidates);
    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
