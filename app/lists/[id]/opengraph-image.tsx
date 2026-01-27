
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
                take: 3,
                orderBy: { createdAt: 'desc' }, // Simple ordering for now, maybe best would be rank but rank is complex
                include: {
                    tags: { include: { tag: true } }
                }
            });
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(to bottom right, #020617, #1e1b4b)', // slate-950 to indigo-950
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '60px',
                        justifyContent: 'space-between',
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Background Accents */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-20%',
                            right: '-10%',
                            width: '600px',
                            height: '600px',
                            background: 'rgba(79, 70, 229, 0.15)', // indigo
                            borderRadius: '50%',
                            filter: 'blur(120px)',
                            zIndex: -1,
                        }}
                    />

                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                            style={{
                                fontSize: '24px',
                                color: '#94a3b8', // slate-400
                                textTransform: 'uppercase',
                                letterSpacing: '2px',
                                fontWeight: 600,
                            }}
                        >
                            Vaulted Smart List
                        </div>
                        <div
                            style={{
                                fontSize: '72px',
                                fontWeight: 800,
                                color: 'white',
                                lineHeight: 1.1,
                                maxWidth: '900px',
                            }}
                        >
                            {list.title}
                        </div>
                    </div>

                    {/* Top 3 Items Collage */}
                    <div style={{ display: 'flex', gap: '30px', margin: '40px 0' }}>
                        {topItems.map((item, i) => (
                            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', width: '220px' }}>
                                {/* Image Container */}
                                <div style={{
                                    width: '220px',
                                    height: '300px',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    backgroundColor: '#1e293b', // slate-800
                                    border: '2px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                                    display: 'flex',
                                    position: 'relative'
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
                                            fontSize: '48px',
                                            color: '#475569'
                                        }}>
                                            # {i + 1}
                                        </div>
                                    )}
                                    {/* Rank Badge */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '10px',
                                        left: '10px',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundColor: '#4f46e5',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        fontSize: '16px',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                    }}>
                                        {i + 1}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {topItems.length === 0 && (
                            <div style={{ color: '#64748b', fontSize: '24px', fontStyle: 'italic' }}>
                                No items in this list yet.
                            </div>
                        )}
                    </div>

                    {/* Footer: User & Brand */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {/* User Profile */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {list.owner.image ? (
                                <img
                                    src={list.owner.image}
                                    width="64"
                                    height="64"
                                    style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }}
                                />
                            ) : (
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: '#334155',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '24px'
                                }}>
                                    {list.owner.name?.[0] || 'U'}
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: '#94a3b8', fontSize: '18px' }}>Curated by</span>
                                <span style={{ color: 'white', fontSize: '24px', fontWeight: 600 }}>{list.owner.name || 'Anonymous user'}</span>
                            </div>
                        </div>

                        {/* Brand Mark */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8 }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'linear-gradient(to bottom right, #4f46e5, #9333ea)',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '24px'
                            }}>
                                V
                            </div>
                            <span style={{ color: 'white', fontSize: '24px', fontWeight: 800, letterSpacing: '-1px' }}>Vaulted</span>
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
