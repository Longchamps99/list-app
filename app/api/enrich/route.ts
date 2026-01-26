import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { enrichContent } from "@/lib/enrich";

export async function GET(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const entityId = searchParams.get("entityId") || undefined;
    const initialImageUrl = searchParams.get("imageUrl") || undefined;
    const candidateType = searchParams.get("type") || undefined;

    if (!query) return new NextResponse("Missing query", { status: 400 });

    try {
        const result = await enrichContent(query, entityId, initialImageUrl, candidateType);
        return NextResponse.json(result || {}); // Return empty object if no result to handle gracefully
    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
