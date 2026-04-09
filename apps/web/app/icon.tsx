import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** Dynamic favicon — gradient matches `globals.css` accent/purple nav treatment. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #58a6ff 0%, #bc8cff 100%)',
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 700,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        A
      </div>
    ),
    { ...size }
  );
}
