import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { enrichItems } from "@/lib/enrichment";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q) {
        return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    try {
        const enriched = await enrichItems([q]);
        if (enriched && enriched.length > 0) {
            return NextResponse.json(enriched[0]);
        }
        return NextResponse.json({});
    } catch (error) {
        console.error("[Enrichment API] GET Error:", error);
        return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session) {
        console.warn("[Enrichment API] Unauthorized access attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { items } = body;

        console.log("[Enrichment API] Received items:", items?.length, "first item:", items?.[0]);

        if (!Array.isArray(items) || items.length === 0) {
            console.warn("[Enrichment API] Invalid input body:", body);
            return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        }

        const enrichedItems = await enrichItems(items);
        return NextResponse.json({ items: enrichedItems });

    } catch (error: any) {
        console.error("[Enrichment API] Error:", error);
        return NextResponse.json({
            items: [] // Return empty items on catastrophic failure to avoid breaking frontend
        });
    }
}
