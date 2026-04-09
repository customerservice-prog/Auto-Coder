import { ImageResponse } from 'next/og';

export const alt = 'Auto-Coder — Autonomous AI IDE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default social preview (Twitter, Slack, iMessage, etc.). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 72,
          background: 'linear-gradient(145deg, #0d1117 0%, #161b22 45%, #21262d 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #58a6ff 0%, #bc8cff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 48,
              fontWeight: 700,
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            }}
          >
            A
          </div>
          <span
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: '#e6edf3',
              letterSpacing: '-0.02em',
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Auto-Coder
          </span>
        </div>
        <p
          style={{
            fontSize: 34,
            color: '#8b949e',
            maxWidth: 920,
            lineHeight: 1.4,
            margin: 0,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          }}
        >
          The AI-powered IDE that plans, executes, tests, and self-heals.
        </p>
      </div>
    ),
    { ...size }
  );
}
