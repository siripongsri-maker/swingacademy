import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffLayout } from "@/components/staff/staff-layout";
import { StaffAccessGate } from "@/components/staff/staff-access-gate";
import { StaffProvider } from "@/lib/staff-context";
import { ConsoleRoleProvider } from "@/lib/console-role-context";

export const Route = createFileRoute("/staff")({
  component: StaffShell,
});

// Auth is a client-side Supabase session, so the guard runs in the browser:
// nothing under StaffAccessGate (layout, child routes) mounts until the
// signed-in user is confirmed to hold a staff-side role.
function StaffShell() {
  return (
    <ConsoleRoleProvider>
      <StaffAccessGate>
        <StaffProvider>
          <StaffLayout>
            <Outlet />
          </StaffLayout>
        </StaffProvider>
      </StaffAccessGate>
    </ConsoleRoleProvider>
  );
}
