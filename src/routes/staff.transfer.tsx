import { createFileRoute } from "@tanstack/react-router";
import { StaffStub } from "@/components/staff/staff-stub";

export const Route = createFileRoute("/staff/transfer")({
  component: () => <StaffStub title="KT Transfer" subtitle="Track each KT journey from acquire to sustain." />,
});
