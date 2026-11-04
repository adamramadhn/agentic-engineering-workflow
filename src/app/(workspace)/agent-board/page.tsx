import { AgentBoardView } from "@/components/dashboard/agent-board-view";
import { PagePermissionGate } from "@/components/dashboard/page-permission-gate";

export default function AgentBoardPage() {
  return (
    <PagePermissionGate permission="agent-board.view">
      <AgentBoardView />
    </PagePermissionGate>
  );
}
