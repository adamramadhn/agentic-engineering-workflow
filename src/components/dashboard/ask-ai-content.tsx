const DEMO_RESPONSES: Record<string, string> = {
  mrr: `## MRR Growth Analysis

Your Monthly Recurring Revenue is currently **$142,850**, representing an **18.2% increase** month-over-month.

### Key Highlights
- **Expansion Revenue**: $12,400 from Byteforge account upgrade
- **New Business**: $8,200 across 3 new enterprise accounts
- **Churn Rate**: 0.8% — well below the 2% industry benchmark
- **Net Revenue Retention**: 124%

### Trend
The growth trajectory has been consistently positive for the last 6 months, with acceleration in Q3 driven primarily by expansion within existing accounts.

> **Recommendation**: Focus on expansion plays with mid-market accounts showing high usage — they represent the highest conversion potential for tier upgrades.`,

  health: `## System Health Report

All systems are operating within normal parameters.

| Service | Status | Uptime | Latency |
|---------|--------|--------|---------|
| API Gateway | ✅ Healthy | 99.98% | 12ms |
| Database | ✅ Healthy | 99.99% | 3ms |
| Stripe Sync | ✅ Healthy | 99.95% | 45ms |
| Auth Service | ✅ Healthy | 100% | 8ms |

### Recent Events
- Stripe connection (Acct_•••4821) last synced **2 minutes ago**
- 1,204 invoices validated with **0 discrepancies**
- Database backup completed at 03:00 UTC

No action items at this time.`,

  report: `## Weekly Summary Report
**Period**: Oct 21 – Oct 27, 2026

### Revenue Metrics
- **Total Revenue**: $38,420 (+12% vs prior week)
- **New Subscriptions**: 14 accounts
- **Churned Accounts**: 2 (both voluntary, citing budget)
- **Average Deal Size**: $2,744

### Product Usage
- **Active Users**: 8,432 (DAU)
- **API Calls**: 2.1M requests
- **Feature Adoption**: Dashboard v2 at 67% rollout

### Action Items
1. Follow up with 3 trial accounts expiring this week
2. Review pricing feedback from enterprise survey
3. Schedule QBR with top 5 accounts`,

  alert: `## Recent Alerts Summary

You have **6 active alerts** requiring attention:

### 🔴 Critical (1)
- **Spike in API error rate** — 5xx errors increased to 2.3% at 14:22 UTC. Auto-scaled to 4 additional instances. Currently stabilized at 0.1%.

### 🟡 Warning (3)
- **Stripe webhook delivery delay** — Average latency 820ms (threshold: 500ms). Monitoring.
- **Storage utilization at 78%** — Projected to reach 85% in 12 days.
- **SSL certificate expiring** — api.acme.dev expires in 28 days. Renewal queued.

### 🔵 Info (2)
- **New Byteforge integration** connected successfully
- **Scheduled maintenance** window confirmed for Nov 3, 02:00–04:00 UTC`,
};

export function getDemoResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("mrr") || lower.includes("revenue") || lower.includes("growth")) return DEMO_RESPONSES.mrr;
  if (lower.includes("health") || lower.includes("status") || lower.includes("system")) return DEMO_RESPONSES.health;
  if (lower.includes("report") || lower.includes("weekly") || lower.includes("summary")) return DEMO_RESPONSES.report;
  if (lower.includes("alert") || lower.includes("notification") || lower.includes("warning")) return DEMO_RESPONSES.alert;
  return `I can help you with revenue analytics, system health monitoring, report generation, and alert management. Here's what I found for your query:\n\n**"${input}"**\n\nThis is a demo environment using sample data. Try asking about:\n- MRR growth and revenue trends\n- System health and uptime\n- Weekly reports\n- Active alerts and notifications`;
}

export function MarkdownRenderer({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableLines: string[] = [];
  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  const renderWords = (text: string, prefix: string) => streaming
    ? text.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : <span className="t-stream-w is-in" key={`${prefix}-${index}`}>{word}</span>)
    : text;

  const parseInline = (text: string): React.ReactNode => {
    // Bold and inline code; ordinary text remains React-escaped.
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Inline code `text`
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find earliest match
      const matches: { index: number; type: string; match: RegExpMatchArray }[] = [];
      if (boldMatch?.index !== undefined) matches.push({ index: boldMatch.index, type: "bold", match: boldMatch });
      if (codeMatch?.index !== undefined) matches.push({ index: codeMatch.index, type: "code", match: codeMatch });

      if (matches.length === 0) {
        parts.push(renderWords(remaining, `text-${key++}`));
        break;
      }

      matches.sort((a, b) => a.index - b.index);
      const first = matches[0];

      if (first.index > 0) {
        parts.push(renderWords(remaining.slice(0, first.index), `text-${key++}`));
      }

      if (first.type === "bold") {
        parts.push(
          <strong key={key++} className="font-semibold text-neutral-900 dark:text-neutral-100">
            {renderWords(first.match[1], `inline-${key}`)}
          </strong>
        );
      } else if (first.type === "code") {
        parts.push(
          <code key={key++} className="rounded-[4px] bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[12px] font-mono text-neutral-700 dark:text-neutral-300">
            {renderWords(first.match[1], `inline-${key}`)}
          </code>
        );
      }

      remaining = remaining.slice(first.index + first.match[0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const flushTable = () => {
    if (tableLines.length < 2) return;
    const headers = tableLines[0].split("|").map((h) => h.trim()).filter(Boolean);
    const rows = tableLines.slice(2).map((r) => r.split("|").map((c) => c.trim()).filter(Boolean));

    elements.push(
      <div key={elements.length} className="my-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900/60">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200 dark:border-neutral-800">
                  {parseInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-neutral-100 dark:border-neutral-800/60 last:border-0">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                    {parseInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableLines = [];
  };

  const flushBlockquote = () => {
    elements.push(
      <blockquote key={elements.length} className="my-3 border-l-2 border-neutral-300 dark:border-neutral-600 pl-3.5 text-[13px] text-neutral-600 dark:text-neutral-400 italic">
        {blockquoteLines.map((line, i) => (
          <p key={i}>{parseInline(line.replace(/^>\s*/, ""))}</p>
        ))}
      </blockquote>
    );
    blockquoteLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.includes("|") && line.trim().startsWith("|")) {
      if (!inTable) inTable = true;
      tableLines.push(line);
      continue;
    } else if (inTable) {
      inTable = false;
      flushTable();
    }

    // Blockquote detection
    if (line.startsWith(">")) {
      if (!inBlockquote) inBlockquote = true;
      blockquoteLines.push(line);
      continue;
    } else if (inBlockquote) {
      inBlockquote = false;
      flushBlockquote();
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={elements.length} className="mt-4 mb-1.5 text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
          {parseInline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={elements.length} className="mt-4 mb-1.5 text-[14px] font-semibold text-neutral-900 dark:text-neutral-100">
          {parseInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={elements.length} className="mt-4 mb-2 text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
          {parseInline(line.slice(2))}
        </h2>
      );
    }
    // Ordered list
    else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <div key={elements.length} className="flex gap-2 pl-1 text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">
          <span className="text-neutral-400 dark:text-neutral-500 shrink-0 font-medium tabular-nums">
            {line.match(/^(\d+)\./)?.[1]}.
          </span>
          <span>{parseInline(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
    }
    // Unordered list
    else if (line.startsWith("- ")) {
      elements.push(
        <div key={elements.length} className="flex gap-2 pl-1 text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">
          <span className="text-neutral-400 dark:text-neutral-500 shrink-0 mt-[7px]">
            <span className="block size-1 rounded-full bg-neutral-400 dark:bg-neutral-500" />
          </span>
          <span>{parseInline(line.slice(2))}</span>
        </div>
      );
    }
    // Horizontal rule
    else if (line.trim() === "---") {
      elements.push(
        <hr key={elements.length} className="my-3 border-neutral-200 dark:border-neutral-800" />
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={elements.length} className="h-2" />);
    }
    // Regular paragraph
    else {
      elements.push(
        <p key={elements.length} className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {parseInline(line)}
        </p>
      );
    }
  }

  // Flush remaining
  if (inTable) flushTable();
  if (inBlockquote) flushBlockquote();

  return <>{elements}</>;
}

