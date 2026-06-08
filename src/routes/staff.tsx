import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffLayout } from "@/components/staff/staff-layout";
import { StaffProvider } from "@/lib/staff-context";
import { ConsoleRoleProvider } from "@/lib/console-role-context";

export const Route = createFileRoute("/staff")({
  component: StaffShell,
});

function StaffShell() {
  return (
    <ConsoleRoleProvider>
      <StaffProvider>
        <StaffLayout>
          <Outlet />
        </StaffLayout>
      </StaffProvider>
    </ConsoleRoleProvider>
  );
}
