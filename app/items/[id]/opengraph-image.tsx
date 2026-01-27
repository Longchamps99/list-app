
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

// Image metadata
export const alt = 'Item Preview';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export const runtime = 'nodejs'; // Use nodejs runtime for Prisma

export default async function Image({ params }: { params: { id: string } }) {
    try {
        const { id } = await params;

        const item = await prisma.item.findUnique({
            where: { id },
            include: {
                owner: true,
                tags: {
                    include: { tag: true }
                }
            }
        });

        if (!item) {
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
                        Item Not Found
                    </div>
                )
            );
        }

        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(to bottom right, #020617, #1e1b4b)', // slate-950 to indigo-950
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        padding: '60px',
                        fontFamily: 'sans-serif',
                        gap: '60px',
                    }}
                >
                    {/* Background Accent */}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-20%',
                            right: '-10%',
                            width: '800px',
                            height: '800px',
                            background: 'radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, transparent 70%)',
                            zIndex: -1,
                        }}
                    />

                    {/* Left: Poster Image */}
                    <div style={{
                        width: '350px',
                        height: '100%',
                        flexShrink: 0,
                        borderRadius: '24px',
                        overflow: 'hidden',
                        boxShadow: '0 30px 60px -10px rgba(0, 0, 0, 0.6)',
                        border: '2px solid rgba(255,255,255,0.1)',
                        backgroundColor: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {item.imageUrl ? (
                            <img
                                src={item.imageUrl}
                                alt={item.title || "Item"}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <div style={{
                                fontSize: '64px',
                                fontWeight: 800,
                                color: '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%'
                            }}>
                                ?
                            </div>
                        )}
                    </div>

                    {/* Right: Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>

                        {/* Owner badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', opacity: 0.8 }}>
                            {item.owner.image ? (
                                <img
                                    src={item.owner.image}
                                    width="32"
                                    height="32"
                                    style={{ borderRadius: '50%' }}
                                />
                            ) : (
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: '#334155',
                                }} />
                            )}
                            <span style={{ color: '#cbd5e1', fontSize: '20px', fontWeight: 500 }}>
                                {item.owner.name || 'Vaulted User'}
                            </span>
                        </div>

                        <div
                            style={{
                                fontSize: '64px',
                                fontWeight: 900,
                                color: 'white',
                                lineHeight: 1.1,
                                marginBottom: '24px',
                            }}
                        >
                            {item.title || "Untitled Item"}
                        </div>

                        {item.content && (
                            <div style={{
                                fontSize: '28px',
                                color: '#94a3b8',
                                lineHeight: 1.5,
                                marginBottom: '32px',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}>
                                {item.content}
                            </div>
                        )}

                        {/* Tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {item.tags.slice(0, 5).map(({ tag }) => (
                                <div
                                    key={tag.id}
                                    style={{
                                        padding: '8px 20px',
                                        background: 'rgba(5, 150, 105, 0.2)', // green-600/20
                                        border: '1px solid rgba(16, 185, 129, 0.3)', // green-500/30
                                        borderRadius: '99px',
                                        color: '#86efac', // green-300
                                        fontSize: '20px',
                                        fontWeight: 600,
                                    }}
                                >
                                    #{tag.name}
                                </div>
                            ))}
                        </div>

                        {/* Footer Logo */}
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.4 }}>
                            <div style={{
                                width: '24px',
                                height: '24px',
                                background: '#6366f1',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}>
                                V
                            </div>
                            <span style={{ color: 'white', fontSize: '18px', fontWeight: 700 }}>Vaulted</span>
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
                    <h1>Error Generating Item OG Image</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '24px' }}>{e.message}</pre>
                    <pre>{e.stack}</pre>
                </div>
            ),
            { ...size }
        );
    }
}
