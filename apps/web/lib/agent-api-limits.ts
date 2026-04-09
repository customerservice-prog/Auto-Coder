/** Max length for `mission` in `POST /api/agent` (Zod). */
export const AGENT_MISSION_MAX_CHARS = 2000;

/** Max length for `projectContext` in `POST /api/agent` (Zod). */
export const AGENT_PROJECT_CONTEXT_MAX_CHARS = 100_000;

/**
 * Raw JSON body cap (streaming read). Larger than nominal field maxes to allow UTF-8
 * expansion and JSON structure overhead.
 */
export const AGENT_POST_BODY_MAX_BYTES = 512 * 1024;
