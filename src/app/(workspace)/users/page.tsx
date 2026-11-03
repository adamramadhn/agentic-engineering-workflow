import { UsersView } from "@/components/dashboard/users-view";
import { PagePermissionGate } from "@/components/dashboard/page-permission-gate";

export default function UsersPage() {
  return (
    <PagePermissionGate permission="users.view">
      <UsersView />
    </PagePermissionGate>
  );
}
