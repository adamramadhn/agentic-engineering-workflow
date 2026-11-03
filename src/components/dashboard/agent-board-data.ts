export type AgentTaskState = "waiting" | "failed" | "running" | "done";
export type AgentColumnId = "needs-you" | "running" | "done";

export interface AgentStep {
  text: string;
  time: string;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  state: AgentTaskState;
  duration: string;
  sources: number;
  toolCalls: number;
  agent: string;
  steps: AgentStep[];
}

export const agentColumns: { id: AgentColumnId; label: string }[] = [
  { id: "needs-you", label: "Needs You" },
  { id: "running", label: "Running" },
  { id: "done", label: "Done" },
];

export function agentTaskColumn(state: AgentTaskState): AgentColumnId {
  return state === "waiting" || state === "failed" ? "needs-you" : state;
}

export function resumeAgentTask(task: AgentTask): AgentTask {
  if (task.state !== "waiting" && task.state !== "failed") return task;
  return {
    ...task,
    state: "running",
    duration: "0s",
    steps: [...task.steps, { text: "Resumed in this local demo — no agent is connected", time: "now" }],
  };
}

export const demoAgentTasks: AgentTask[] = [
  {
    id: "agent-migrate",
    title: "Migrate users table",
    description: "Split users into accounts and profiles on Postgres 17. The dry run on staging passed.",
    state: "waiting",
    duration: "6m 14s",
    sources: 9,
    toolCalls: 14,
    agent: "Opus 5.5",
    steps: [
      { text: "Read schema and 14 migrations", time: "6m ago" },
      { text: "Wrote migration 0042_split_users", time: "4m ago" },
      { text: "Dry run on staging – no errors", time: "2m ago" },
      { text: "Wants to run it on production", time: "1m ago" },
    ],
  },
  {
    id: "agent-crm",
    title: "Clean up CRM contacts",
    description: "Matched 1,312 likely duplicates, then the merge hit the API rate limit.",
    state: "failed",
    duration: "2m 08s",
    sources: 4,
    toolCalls: 6,
    agent: "Haiku 5.5",
    steps: [
      { text: "Loaded 18,240 contacts", time: "9m ago" },
      { text: "Matched 1,312 likely duplicates", time: "8m ago" },
      { text: "Merge stopped – API rate limit (429)", time: "7m ago" },
    ],
  },
  {
    id: "agent-review",
    title: "Review PR #482",
    description: "Billing webhooks: reading the diff and the test run, writing review notes.",
    state: "running",
    duration: "3m 42s",
    sources: 12,
    toolCalls: 21,
    agent: "Sonnet 5.5",
    steps: [
      { text: "Read the diff – 412 lines across 9 files", time: "3m ago" },
      { text: "Checked signature validation paths", time: "2m ago" },
      { text: "Writing review notes", time: "now" },
    ],
  },
  {
    id: "agent-release",
    title: "Release notes v2.4",
    description: "Grouping 23 merged pull requests into features and fixes.",
    state: "running",
    duration: "1m 20s",
    sources: 23,
    toolCalls: 5,
    agent: "Sonnet 5.5",
    steps: [
      { text: "Listed 23 merged pull requests", time: "1m ago" },
      { text: "Grouping into features and fixes", time: "now" },
    ],
  },
  {
    id: "agent-digest",
    title: "Weekly metrics digest",
    description: "Pulled numbers from three dashboards and posted the weekly summary.",
    state: "done",
    duration: "4m 12s",
    sources: 3,
    toolCalls: 8,
    agent: "Haiku 5.5",
    steps: [
      { text: "Pulled revenue, usage and support numbers", time: "4m ago" },
      { text: "Posted the weekly summary", time: "3m ago" },
    ],
  },
];
