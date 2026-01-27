
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

// Image metadata
export const alt = 'Vaulted - The Ultimate List App';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
    try {
        return new ImageResponse(
            (
                <div
                    style={{
                        background: 'linear-gradient(to bottom right, #020617, #1e1b4b)', // slate-950 to indigo-950
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'sans-serif',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px',
                        }}
                    >
                        {/* Logo Icon */}
                        <div
                            style={{
                                width: '80px',
                                height: '80px',
                                background: 'linear-gradient(to bottom right, #4f46e5, #9333ea)', // indigo-600 to purple-600
                                borderRadius: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '48px',
                                fontWeight: 'bold',
                                color: 'white',
                                boxShadow: '0 20px 50px rgba(79, 70, 229, 0.3)',
                                marginRight: '24px',
                            }}
                        >
                            V
                        </div>
                        <div
                            style={{
                                fontSize: '84px',
                                fontWeight: 800,
                                color: 'white',
                                letterSpacing: '-2px',
                            }}
                        >
                            Vaulted
                        </div>
                    </div>

                    <div
                        style={{
                            fontSize: '32px',
                            color: '#94a3b8', // slate-400
                            textAlign: 'center',
                            marginTop: '20px',
                            fontWeight: 500,
                        }}
                    >
                        The place for your best lists
                    </div>

                    {/* Decorative elements */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '-10%',
                            left: '-10%',
                            width: '600px',
                            height: '600px',
                            background: 'rgba(79, 70, 229, 0.1)',
                            borderRadius: '50%',
                            filter: 'blur(100px)',
                            zIndex: -1,
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '-10%',
                            right: '-10%',
                            width: '600px',
                            height: '600px',
                            background: 'rgba(147, 51, 234, 0.1)',
                            borderRadius: '50%',
                            filter: 'blur(100px)',
                            zIndex: -1,
                        }}
                    />
                </div>
            ),
            {
                ...size,
            }
        );
    } catch (e: any) {
        return new ImageResponse(
            (
                <div style={{ background: 'white', padding: '40px', color: 'red' }}>
                    <h1>OG Error</h1>
                    <pre>{e.message}</pre>
                </div>
            ),
            { ...size }
        );
    }
}
