/**
 * Runs once per Node server instance (useful for structured cold-start logs on Vercel / containers).
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const revision =
    (sha && sha.length >= 7 ? sha.slice(0, 7) : undefined) ||
    process.env.npm_package_version ||
    null;

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: 'auto-coder-web',
      event: 'instrumentation_register',
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL === '1',
      revision,
    })
  );
}
