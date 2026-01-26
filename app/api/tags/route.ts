import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// GET all unique tags used by the current user's items
export async function GET(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    // TEMPORARY: Hardcode user ID for testing
    const userId = 'cmkkbjmdg0007epqjcz6qwkn2'; // Phil.reed@gmail.com

    try {
        // Get all tags that are used by items owned by this user
        const tags = await prisma.tag.findMany({
            where: {
                OR: [
                    {
                        items: {
                            some: {
                                item: {
                                    // @ts-ignore
                                    ownerId: userId
                                }
                            }
                        }
                    }
                ]
            },
            orderBy: {
                name: "asc"
            },
            select: {
                id: true,
                name: true
            }
        });

        return NextResponse.json(tags);
    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
