import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

const RequestSchema = z.object({
  mission: z.string().min(1).max(2000),
  projectContext: z.string().optional(),
  model: z.enum(['claude', 'gpt4o', 'deepseek']).default('claude'),
});

/**
 * POST /api/agent
 * Streams an AI agent response for a given mission.
 * Used by the web IDE for real-time agent output.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { mission, projectContext, model } = parsed.data;

  const aiModel = anthropic('claude-sonnet-4-5');

  const result = streamText({
    model: aiModel,
    system: `You are an autonomous AI coding assistant. 
    
Project Context:
${projectContext || 'No context provided.'}

Analyze the request, create a step-by-step plan, and provide detailed implementation guidance.
Format your response with clear sections: ANALYSIS, PLAN, IMPLEMENTATION.`,
    prompt: mission,
    maxTokens: 4096,
  });

  return result.toDataStreamResponse();
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
