'use client';

import dynamic from 'next/dynamic';
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
import type { WebIdeWorkbenchProps } from '@/components/web-ide/WebIdeWorkbench';

const WebIdeWorkbench = dynamic<WebIdeWorkbenchProps>(
  () => import('@/components/web-ide/WebIdeWorkbench').then((m) => ({ default: m.WebIdeWorkbench })),
  {
    ssr: false,
    loading: () => (
      <div className="wb-app wb-app-boot" role="status" aria-live="polite">
        <span className="wb-app-boot-label">Loading workspace</span>
        <span className="wb-app-boot-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </div>
    ),
  },
);

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

export function DashboardClient() {
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
      <div className="wb-composer-chrome">
        <div className="wb-composer-headrow">
          <div className="wb-composer-path" aria-label="Composer context">
            <span className="wb-composer-bc">web-workspace</span>
            <span className="wb-composer-bc-sep" aria-hidden>
              ›
            </span>
            <span className="wb-composer-bc-cur">local</span>
          </div>
          <select
            className="wb-composer-model"
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            disabled={loading}
            aria-label="Model"
          >
            <option value="claude">Claude Sonnet</option>
            <option value="gpt4o">GPT-4o</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
        <p className="wb-composer-micro-inline">
          <span className="wb-composer-micro-muted">Streams to Output ·</span>{' '}
          <code className="ide-code-inline wb-composer-code">.env</code>
        </p>
      </div>
      <div className="wb-composer-stack wb-composer-stack-flat">
        <label className="wb-composer-sec">
          <span className="wb-composer-sec-label">Context</span>
          <textarea
            className="wb-composer-field wb-composer-context"
            value={projectContext}
            onChange={(e) => setProjectContext(e.target.value)}
            placeholder="@workspace — paths, errors, snippets…"
            maxLength={AGENT_PROJECT_CONTEXT_MAX_CHARS}
            disabled={loading}
            spellCheck={false}
          />
        </label>
        <label className="wb-composer-sec wb-composer-sec-grow">
          <span className="wb-composer-sec-label">Mission</span>
          <textarea
            data-composer-mission
            className="wb-composer-field wb-composer-mission"
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="What should the agent do?"
            maxLength={AGENT_MISSION_MAX_CHARS}
            disabled={loading}
            spellCheck={false}
          />
        </label>
        <div className="wb-composer-sendbar">
          <button
            type="button"
            className="wb-composer-submit"
            disabled={loading || !mission.trim()}
            onClick={runAssistant}
            aria-label={loading ? 'Generating' : 'Send to agent'}
          >
            {loading ? (
              <span className="wb-composer-submit-text">Generating…</span>
            ) : (
              <span className="wb-composer-submit-glyph" aria-hidden>
                ↑
              </span>
            )}
          </button>
        </div>
        {quotaHint ? <p className="wb-composer-quota">{quotaHint}</p> : null}
      </div>
    </>
  );

  return (
    <div className="dashboard web-dash-root">
      {isClerkEnabled() ? <PostCheckoutClerkRefresh show={checkoutSuccessBanner} /> : null}
      <header className="ide-titlebar wb-chrome">
        <div className="wb-chrome-left">
          <nav className="wb-menubar" aria-label="Application menu">
            {(['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'] as const).map((label) => (
              <span key={label} className="wb-menu-item">
                {label}
              </span>
            ))}
          </nav>
        </div>
        <div className="wb-chrome-center">
          <Link href="/" className="wb-app-title">
            Auto-Coder
          </Link>
        </div>
        <div className="ide-titlebar-right wb-chrome-right">
          {isClerkEnabled() ? (
            <StripePortalButton className="btn-outline ide-toolbar-btn">Billing</StripePortalButton>
          ) : null}
          {isClerkEnabled() ? <ProPlanBadge /> : null}
          <AccountMenu />
        </div>
      </header>

      {!isClerkEnabled() ? (
        <p className="ide-dev-strip wb-env-notice" role="status">
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
