
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs'; // Use nodejs runtime for Prisma

// Image metadata
export const alt = 'List Preview';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
    try {
        const { id } = await params;

        const list = await prisma.list.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                ownerId: true
            }
        });

        if (!list) {
            return new ImageResponse(
                (
                    <div style={{ fontSize: 48, background: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        List Not Found
                    </div>
                ),
                { ...size }
            );
        }

        // Skip items fetching for now to isolate list fetching
        let topItems: any[] = [];

        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(to bottom right, #000000, #111111)',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '60px',
                        color: 'white',
                    }}
                >
                    <div style={{ fontSize: '20px', color: '#9CA3AF' }}>Vaulted Smart List</div>
                    <div style={{ fontSize: '80px', fontWeight: 800 }}>{list.title}</div>

                    <div style={{ display: 'flex', gap: '20px', marginTop: '40px' }}>
                        {topItems.map((item, i) => (
                            <div key={item.id} style={{ border: '1px solid white', padding: '10px' }}>
                                <div style={{ fontSize: '24px' }}>{item.title}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 'auto', fontSize: '24px' }}>
                        {/* Owner removed for debug */}
                    </div>
                </div>
            ),
            { ...size }
        );
    } catch (e: any) {
        console.error(e);
        return new ImageResponse(
            (
                <div style={{ background: 'white', width: '100%', height: '100%', padding: 40, color: 'red' }}>
                    <h1>Error</h1>
                    <pre>{e.message}</pre>
                </div>
            ),
            { ...size }
        );
    }
}
