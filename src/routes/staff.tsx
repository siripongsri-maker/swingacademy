import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffLayout } from "@/components/staff/staff-layout";
import { StaffProvider } from "@/lib/staff-context";

export const Route = createFileRoute("/staff")({
  component: StaffShell,
});

function StaffShell() {
  return (
    <StaffProvider>
      <StaffLayout>
        <Outlet />
      </StaffLayout>
    </StaffProvider>
  );
}
