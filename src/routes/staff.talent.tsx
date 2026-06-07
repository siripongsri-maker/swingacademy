import { createFileRoute } from "@tanstack/react-router";
import { StaffStub } from "@/components/staff/staff-stub";

export const Route = createFileRoute("/staff/talent")({
  component: () => <StaffStub title="Talent Map" subtitle="Who knows what, who can teach what — across sites." />,
});
