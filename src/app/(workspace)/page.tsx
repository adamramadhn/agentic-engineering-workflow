import { HomeView } from "@/components/dashboard/home-view";
import { PagePermissionGate } from "@/components/dashboard/page-permission-gate";

export default function HomePage() {
  return (
    <PagePermissionGate permission="home.view">
      <HomeView />
    </PagePermissionGate>
  );
}
