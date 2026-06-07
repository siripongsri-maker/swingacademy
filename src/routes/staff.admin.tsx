import { createFileRoute } from "@tanstack/react-router";
import { StaffStub } from "@/components/staff/staff-stub";

export const Route = createFileRoute("/staff/admin")({
  component: () => <StaffStub title="Admin" subtitle="Users, taxonomies, funders and export presets." />,
});
