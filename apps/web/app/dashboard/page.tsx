'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { AccountMenu } from '@/components/clerk-ui';
import { StripePortalButton } from '@/components/stripe-portal-button';
import { AGENT_MISSION_MAX_CHARS, AGENT_PROJECT_CONTEXT_MAX_CHARS } from '@/lib/agent-api-limits';
import { isClerkEnabled } from '@/lib/clerk-enabled';
import type { AgentErrorBody } from '@/lib/agent-error-format';
import { formatAgentApiError } from '@/lib/agent-error-format';
import {
  STRIPE_ENTITLEMENT_TIER_KEY,
  normalizeEntitlementTier,
} from '@/lib/stripe-entitlements';
import { WebIdeWorkbench } from '@/components/web-ide/WebIdeWorkbench';

type ModelId = 'claude' | 'gpt4o' | 'deepseek';

function ProPlanBadge() {
  const { user, isLoaded } = useUser();
  const tier = isLoaded
    ? normalizeEntitlementTier(user?.publicMetadata?.[STRIPE_ENTITLEMENT_TIER_KEY])
    : 'free';
  if (!isLoaded || tier !== 'pro') {
    return null;
  }
  return (
    <span className="dash-plan-badge" title="Synced from Stripe subscription status">
      Pro
    </span>
  );
}

/**
 * After hosted Checkout, Stripe webhooks update Clerk — `user.reload()` pulls fresh `publicMetadata` (e.g. Pro badge) without a hard refresh.
 * Only mounted when Clerk is enabled (requires `ClerkProvider`).
 */
function PostCheckoutClerkRefresh({ show }: { show: boolean }) {
  const { user } = useUser();
  const didReload = useRef(false);

  useEffect(() => {
    if (!show || !user || didReload.current) {
      return;
    }
    didReload.current = true;
    void user.reload().catch(() => {});
  }, [show, user]);

  return null;
}

export default function DashboardPage() {
  const [checkoutSuccessBanner, setCheckoutSuccessBanner] = useState(false);
  const [mission, setMission] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [model, setModel] = useState<ModelId>('claude');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaHint, setQuotaHint] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') {
      return;
    }
    setCheckoutSuccessBanner(true);
    params.delete('checkout');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

  async function runAssistant() {
    setLoading(true);
    setError(null);
    setOutput('');
    setQuotaHint(null);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission, projectContext, model }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as AgentErrorBody | null;
        setError(formatAgentApiError(res, body));
        return;
      }

      const rem = res.headers.get('X-RateLimit-Remaining');
      const lim = res.headers.get('X-RateLimit-Limit');
      const dayUsed = res.headers.get('X-Agent-Quota-Daily-Used');
      const dayLim = res.headers.get('X-Agent-Quota-Daily-Limit');
      if (rem != null && lim != null) {
        const hint = `This window: ${rem} / ${lim} requests left.`;
        setQuotaHint(
          dayUsed != null && dayLim != null ? `${hint} Today: ${dayUsed} / ${dayLim}.` : hint
        );
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError('No response body');
        return;
      }

      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setOutput(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const composer = (
    <>
      <div className="ide-sidebar-header">
        <h1 className="ide-sidebar-title">Composer</h1>
        <p className="ide-sidebar-sub">
          Same agent as desktop — streams to <strong>Output</strong> below the editor. Model keys from{' '}
          <code className="ide-code-inline">.env</code>.
        </p>
      </div>
      <div className="ide-form">
        <label className="ide-field">
          <span className="ide-field-label">Model</span>
          <select
            className="ide-input ide-select"
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            disabled={loading}
          >
            <option value="claude">Claude Sonnet</option>
            <option value="gpt4o">GPT-4o</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </label>

        <label className="ide-field">
          <span className="ide-field-label">Context</span>
          <textarea
            className="ide-input ide-textarea ide-textarea-tall"
            value={projectContext}
            onChange={(e) => setProjectContext(e.target.value)}
            placeholder="@workspace — paste paths, errors, snippets…"
            maxLength={AGENT_PROJECT_CONTEXT_MAX_CHARS}
            disabled={loading}
            spellCheck={false}
          />
        </label>

        <label className="ide-field">
          <span className="ide-field-label">Mission</span>
          <textarea
            data-composer-mission
            className="ide-input ide-textarea"
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="What should the agent do?"
            maxLength={AGENT_MISSION_MAX_CHARS}
            disabled={loading}
            spellCheck={false}
          />
        </label>

        <button
          type="button"
          className="ide-submit"
          disabled={loading || !mission.trim()}
          onClick={runAssistant}
        >
          {loading ? 'Generating…' : 'Submit'}
        </button>
        {quotaHint ? <p className="ide-quota">{quotaHint}</p> : null}
      </div>
    </>
  );

  return (
    <div className="dashboard web-dash-root">
      {isClerkEnabled() ? <PostCheckoutClerkRefresh show={checkoutSuccessBanner} /> : null}
      <header className="ide-titlebar wb-chrome">
        <div className="ide-titlebar-left">
          <Link href="/" className="ide-brand">
            <span className="ide-brand-mark" aria-hidden />
            <span className="ide-brand-text">Auto-Coder</span>
          </Link>
          <span className="ide-titlebar-sep" aria-hidden />
          <span className="ide-product-label">
            Web IDE
            {isClerkEnabled() ? <ProPlanBadge /> : null}
          </span>
        </div>
        <div className="ide-titlebar-right">
          {isClerkEnabled() ? (
            <StripePortalButton className="btn-outline ide-toolbar-btn">Billing</StripePortalButton>
          ) : null}
          <AccountMenu />
        </div>
      </header>

      {!isClerkEnabled() ? (
        <p className="ide-dev-strip" role="status">
          Local mode — sign-in off. Add real Clerk keys in <code className="ide-code-inline">.env</code> when you deploy;
          the API still runs with your model keys.
        </p>
      ) : null}

      {checkoutSuccessBanner ? (
        <p className="ide-checkout-banner dash-banner dash-banner-success" role="status">
          Checkout complete — we refreshed your Clerk session; the Pro badge appears once Stripe webhooks sync (usually
          within seconds).
        </p>
      ) : null}

      <WebIdeWorkbench
        composer={composer}
        agentOutput={output}
        agentError={error}
        loading={loading}
        onClearAgentOutput={() => {
          setOutput('');
          setError(null);
          setQuotaHint(null);
        }}
      />
    </div>
  );
}
