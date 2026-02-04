
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

        // Fetch list details and top 3 items based on Smart List filtering logic or manual list items
        // Since List schema has `filterTags` for smart lists, we need to handle that.
        // BUT for now, the prompt implies "Smart List Name" but lists in this app seem to be "Smart Lists" based on tags.
        // Wait, looking at schema: List has `filterTags`.
        // So we need to find items that match these tags.

        const list = await prisma.list.findUnique({
            where: { id },
            include: {
                owner: true,
                filterTags: {
                    include: { tag: true }
                }
            }
        });

        if (!list) {
            return new ImageResponse(
                (
                    <div
                        style={{
                            background: 'linear-gradient(to bottom right, #020617, #1e1b4b)',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '48px',
                        }}
                    >
                        List Not Found
                    </div>
                )
            );
        }

        // Fetch logic for "Top 3 items"
        // If it's a smart list (has filterTags), we find items with those tags.
        // If no filterTags, maybe it's empty? Schema suggests Lists are primarily Smart Lists.

        let topItems: any[] = [];

        if (list.filterTags.length > 0) {
            const tagIds = list.filterTags.map(ft => ft.tagId);
            topItems = await prisma.item.findMany({
                where: {
                    tags: {
                        some: {
                            tagId: { in: tagIds }
                        }
                    },
                    ownerId: list.ownerId // Scoped to owner
                },
                take: 5, // Requesting top 5
                orderBy: { createdAt: 'desc' }, // Simple ordering for now
                include: {
                    tags: { include: { tag: true } }
                }
            });
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(to bottom right, #000000, #111111)', // Pure Swiss Black
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '60px',
                        justifyContent: 'space-between',
                        fontFamily: 'sans-serif',
                        position: 'relative',
                    }}
                >
                    {/* Abstract Swiss Grid Background */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
                            backgroundSize: '40px 40px',
                            zIndex: -1,
                        }}
                    />

                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div
                            style={{
                                fontSize: '20px',
                                color: '#9CA3AF', // gray-400
                                textTransform: 'uppercase',
                                letterSpacing: '4px',
                                fontWeight: 700,
                            }}
                        >
                            Vaulted Smart List
                        </div>
                        <div
                            style={{
                                fontSize: '80px',
                                fontWeight: 800,
                                color: 'white',
                                lineHeight: 1,
                                maxWidth: '1000px',
                                letterSpacing: '-2px',
                            }}
                        >
                            {list.title}
                        </div>
                    </div>

                    {/* Top 5 Items Strip */}
                    <div style={{ display: 'flex', gap: '24px', margin: '20px 0', alignItems: 'flex-end' }}>
                        {topItems.map((item, i) => (
                            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', width: '200px', position: 'relative' }}>
                                {/* Floating Rank Number */}
                                <div style={{
                                    position: 'absolute',
                                    top: '-20px',
                                    left: '-10px',
                                    color: 'white',
                                    fontSize: '80px',
                                    fontWeight: 900,
                                    zIndex: 10,
                                    textShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                    lineHeight: 1,
                                    opacity: 0.9,
                                    fontFamily: 'serif' // Editorial touch
                                }}>
                                    {i + 1}
                                </div>

                                {/* Image Container */}
                                <div style={{
                                    width: '180px',
                                    height: '240px',
                                    borderRadius: '4px', // Tighter radius for Swiss look
                                    overflow: 'hidden',
                                    backgroundColor: '#1f2937',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    display: 'flex',
                                    position: 'relative',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
                                }}>
                                    {item.imageUrl ? (
                                        <img
                                            src={item.imageUrl}
                                            alt={item.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '32px',
                                            color: '#6b7280',
                                            fontWeight: 'bold'
                                        }}>
                                            ?
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    marginTop: '12px',
                                    color: 'white',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    width: '180px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {item.title}
                                </div>
                            </div>
                        ))}

                        {/* Fillers if less than 5 items */}
                        {Array.from({ length: Math.max(0, 5 - topItems.length) }).map((_, i) => (
                            <div key={`empty-${i}`} style={{
                                width: '180px',
                                height: '240px',
                                borderRadius: '4px',
                                border: '2px dashed rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '36px' // Account for title height offset
                            }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                            </div>
                        ))}
                    </div>

                    {/* Footer: Brand */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {list.owner.image ? (
                                <img
                                    src={list.owner.image}
                                    width="48"
                                    height="48"
                                    style={{ borderRadius: '50%', border: '2px solid white' }}
                                />
                            ) : (
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#374151', border: '2px solid white' }} />
                            )}
                            <div style={{ color: 'white', fontSize: '24px', fontWeight: 600 }}>
                                {list.owner.name}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                background: 'white',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'black',
                                fontWeight: 'bold',
                                fontSize: '20px'
                            }}>
                                V
                            </div>
                            <span style={{ color: 'white', fontSize: '24px', fontWeight: 800 }}>Vaulted</span>
                        </div>
                    </div>

                </div>
            ),
            {
                ...size,
            }
        );
    } catch (e: any) {
        console.error(e);
        return new ImageResponse(
            (
                <div style={{
                    background: 'white',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '40px',
                    color: 'red',
                    fontFamily: 'monospace'
                }}>
                    <h1>Error Generating OG Image</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '24px' }}>{e.message}</pre>
                    <pre>{e.stack}</pre>
                </div>
            ),
            { ...size }
        );
    }
}
