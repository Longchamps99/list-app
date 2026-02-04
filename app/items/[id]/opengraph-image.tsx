
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
                        background: '#000000', // Pure Black
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        padding: '0',
                        fontFamily: 'sans-serif',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Split Layout: 50% Image, 50% Content */}

                    {/* Left: Full Bleed Image */}
                    <div style={{
                        width: '50%',
                        height: '100%',
                        position: 'relative',
                        backgroundColor: '#111',
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
                            <div style={{ fontSize: '120px', color: '#333', fontWeight: 'bold' }}>
                                ?
                            </div>
                        )}
                        {/* Subtle Overlay to ensure edge definition */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: '4px',
                            background: 'rgba(255,255,255,0.1)'
                        }} />
                    </div>

                    {/* Right: Typography */}
                    <div style={{
                        width: '50%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '60px',
                        background: '#000000',
                    }}>
                        {/* Owner / Context */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                            {item.owner.image ? (
                                <img
                                    src={item.owner.image}
                                    width="40"
                                    height="40"
                                    style={{ borderRadius: '50%', border: '2px solid #333' }}
                                />
                            ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#333' }} />
                            )}
                            <div style={{ color: '#999', fontSize: '20px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                {item.owner.name}&apos;s Pick
                            </div>
                        </div>

                        {/* Title - Massive Helvetica Style */}
                        <div style={{
                            fontSize: '84px',
                            fontWeight: 800,
                            color: 'white',
                            lineHeight: 0.9,
                            marginBottom: '32px',
                            letterSpacing: '-3px'
                        }}>
                            {item.title}
                        </div>

                        {/* Tags Pill Row */}
                        {item.tags.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: 'auto' }}>
                                {item.tags.slice(0, 3).map(({ tag }) => (
                                    <div
                                        key={tag.id}
                                        style={{
                                            padding: '8px 20px',
                                            border: '2px solid #333',
                                            borderRadius: '99px',
                                            color: '#ccc',
                                            fontSize: '18px',
                                            fontWeight: 600,
                                        }}
                                    >
                                        #{tag.name}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Footer Brand */}
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                    <h1>Error Generating Item OG Image</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '24px' }}>{e.message}</pre>
                    <pre>{e.stack}</pre>
                </div>
            ),
            { ...size }
        );
    }
}
