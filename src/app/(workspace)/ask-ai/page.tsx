import { AskAIView } from "@/components/dashboard/ask-ai-view";
import { PagePermissionGate } from "@/components/dashboard/page-permission-gate";

export default function AskAIPage() {
  return (
    <PagePermissionGate permission="ask-ai.view">
      <AskAIView />
    </PagePermissionGate>
  );
}
