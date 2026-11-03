import type { AgentTaskState } from "./agent-board-data";

export type WorktreeAvatar = "claude" | "gemini" | "openai";
export type WorktreeTool = "slack" | "notion" | "github" | "figma" | "stripe" | "hubspot";

export type WorktreeNode = {
  id: string;
  agent: string;
  model: string;
  state: AgentTaskState;
  task: string;
  cost: string;
  time: string;
  avatar: WorktreeAvatar;
  tools: WorktreeTool[];
  children?: WorktreeNode[];
};

/** Static demo matching the Agent Tree preview; no agents execute. */
export const demoWorktreeRun: WorktreeNode = {
  id: "run-orchestrator",
  agent: "Orchestrator",
  model: "Opus 5.5",
  state: "running",
  task: "Launch the new pricing page by Friday",
  cost: "$1.11",
  time: "47s",
  avatar: "claude",
  tools: ["slack", "notion", "github"],
  children: [
    {
      id: "run-researcher",
      agent: "Researcher",
      model: "Sonnet 5.5",
      state: "running",
      task: "Compare the pricing of five competitors",
      cost: "$0.27",
      time: "40s",
      avatar: "claude",
      tools: ["notion", "slack"],
      children: [
        {
          id: "run-scraper",
          agent: "Scraper",
          model: "Gemini 3.8 Flash",
          state: "done",
          task: "Read the pricing pages of Linear, Notion and three more",
          cost: "$0.03",
          time: "22s",
          avatar: "gemini",
          tools: ["notion"],
        },
        {
          id: "run-analyst",
          agent: "Analyst",
          model: "Sonnet 5.5",
          state: "running",
          task: "Summarize 120 G2 reviews that mention price",
          cost: "$0.08",
          time: "26s",
          avatar: "claude",
          tools: ["hubspot", "notion"],
        },
      ],
    },
    {
      id: "run-writer",
      agent: "Writer",
      model: "Sonnet 5.5",
      state: "waiting",
      task: "Write the copy for the three plans",
      cost: "$0.12",
      time: "36s",
      avatar: "claude",
      tools: ["notion", "figma"],
    },
    {
      id: "run-coder",
      agent: "Coder",
      model: "GPT-6 Sol",
      state: "running",
      task: "Build the page and wire up checkout",
      cost: "$0.21",
      time: "31s",
      avatar: "openai",
      tools: ["github", "stripe", "figma"],
      children: [
        {
          id: "run-tester",
          agent: "Tester",
          model: "GPT-6 Mini",
          state: "running",
          task: "Write and run the checkout tests",
          cost: "$0.03",
          time: "18s",
          avatar: "openai",
          tools: ["github"],
        },
      ],
    },
  ],
};
