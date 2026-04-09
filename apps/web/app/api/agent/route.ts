import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import {
  AGENT_MISSION_MAX_CHARS,
  AGENT_POST_BODY_MAX_BYTES,
  AGENT_PROJECT_CONTEXT_MAX_CHARS,
} from '@/lib/agent-api-limits';
import { consumeAgentApiQuota } from '@/lib/agent-rate-limit';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import { readUtf8BodyCapped } from '@/lib/read-utf8-body-capped';
import {
  STRIPE_ENTITLEMENT_TIER_KEY,
  agentApiRequiresPro,
  normalizeEntitlementTier,
} from '@/lib/stripe-entitlements';
import {
  clerkCorrelationFields,
  getOrCreateRequestId,
  logAgentApi,
  requestIdHeaders,
} from '@/lib/request-log';

const deepseekProvider = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
});

const RequestSchema = z.object({
  mission: z.string().min(1).max(AGENT_MISSION_MAX_CHARS),
  projectContext: z.string().optional(),
  model: z.enum(['claude', 'gpt4o', 'deepseek']).default('claude'),
});

function selectWebModel(model: z.infer<typeof RequestSchema>['model']) {
  switch (model) {
    case 'gpt4o':
      return openai('gpt-4o');
    case 'deepseek':
      return deepseekProvider('deepseek-chat');
    default:
      return anthropic('claude-sonnet-4-5');
  }
}

const LOCAL_DEV_USER_ID = 'local-dev-user';

/**
 * POST /api/agent
 * Streams an AI agent response for a given mission.
 * Used by the web IDE for real-time agent output.
 */
export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rid = requestIdHeaders(requestId);

  const session = await auth();
  let userId = session.userId;
  if (!userId && !isClerkEnabled()) {
    userId = LOCAL_DEV_USER_ID;
  }
  if (!userId) {
    logAgentApi('warn', { event: 'auth_missing', requestId });
    return NextResponse.json(
      { error: 'Unauthorized', requestId },
      { status: 401, headers: rid }
    );
  }

  if (agentApiRequiresPro() && isClerkEnabled()) {
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const tier = normalizeEntitlementTier(user.publicMetadata?.[STRIPE_ENTITLEMENT_TIER_KEY]);
      if (tier !== 'pro') {
        logAgentApi('warn', {
          event: 'pro_entitlement_required',
          requestId,
          userId,
          tier,
        });
        return NextResponse.json(
          {
            error: 'An active subscription is required to use the assistant.',
            code: 'pro_required',
            requestId,
          },
          { status: 403, headers: rid }
        );
      }
    } catch (err) {
      logAgentApi('error', {
        event: 'entitlement_lookup_failed',
        requestId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: 'Could not verify subscription status', requestId },
        { status: 503, headers: rid }
      );
    }
  }

  const cc = () =>
    clerkCorrelationFields({
      userId: session.userId,
      sessionId: session.sessionId,
      orgId: session.orgId,
      orgRole: session.orgRole,
    });

  const raw = await readUtf8BodyCapped(req, AGENT_POST_BODY_MAX_BYTES);
  if (!raw.ok) {
    logAgentApi('warn', { event: 'agent_body_too_large', requestId, userId, maxBytes: AGENT_POST_BODY_MAX_BYTES });
    return NextResponse.json(
      { error: 'Request body too large', requestId },
      { status: 413, headers: rid }
    );
  }

  let body: unknown;
  try {
    body = raw.text.trim() === '' ? {} : JSON.parse(raw.text);
  } catch {
    logAgentApi('warn', { event: 'invalid_json', requestId, userId });
    return NextResponse.json(
      { error: 'Invalid JSON body', requestId },
      { status: 400, headers: rid }
    );
  }

  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    logAgentApi('warn', {
      event: 'validation_error',
      requestId,
      userId,
      issues: parsed.error.flatten(),
      ...cc(),
    });
    return NextResponse.json(
      { error: parsed.error.flatten(), requestId },
      { status: 400, headers: rid }
    );
  }

  const quota = await consumeAgentApiQuota(userId);
  if (!quota.ok) {
    logAgentApi('warn', {
      event: 'quota_exceeded',
      requestId,
      userId,
      status: quota.status,
      body: quota.body,
    });
    const h = new Headers({ ...rid, ...quota.headers });
    return NextResponse.json({ ...quota.body, requestId }, { status: quota.status, headers: h });
  }

  const { mission, projectContext, model } = parsed.data;

  logAgentApi('info', {
    event: 'request_accepted',
    requestId,
    userId,
    model,
    missionChars: mission.length,
    contextChars: projectContext?.length ?? 0,
    ...cc(),
  });

  const streamStarted = Date.now();

  try {
    const aiModel = selectWebModel(model);

    const result = streamText({
      model: aiModel,
      system: `You are an autonomous AI coding assistant. 
    
Project Context:
${projectContext || 'No context provided.'}

Analyze the request, create a step-by-step plan, and provide detailed implementation guidance.
Format your response with clear sections: ANALYSIS, PLAN, IMPLEMENTATION.`,
      prompt: mission,
      maxTokens: 4096,
      onFinish: ({ finishReason, usage, text }) => {
        logAgentApi('info', {
          event: 'stream_complete',
          requestId,
          userId,
          model,
          ms: Date.now() - streamStarted,
          finishReason,
          usage,
          responseChars: text?.length ?? 0,
        });
      },
    });

    const stream = result.toTextStreamResponse();
    const headers = new Headers(stream.headers);
    for (const [key, value] of Object.entries(rid)) {
      headers.set(key, value);
    }
    for (const [key, value] of Object.entries(quota.headers)) {
      headers.set(key, value);
    }
    return new Response(stream.body, { status: stream.status, headers });
  } catch (err) {
    logAgentApi('error', {
      event: 'stream_error',
      requestId,
      userId,
      model,
      error: err instanceof Error ? err.message : String(err),
      ...cc(),
    });
    return NextResponse.json(
      { error: 'Assistant request failed', requestId },
      { status: 500, headers: rid }
    );
  }
}

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  const rid = requestIdHeaders(requestId);
  return NextResponse.json({ error: 'Method not allowed', requestId }, { status: 405, headers: rid });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Vercel / similar: extend for long model streams (adjust plan limits). */
export const maxDuration = 120;
