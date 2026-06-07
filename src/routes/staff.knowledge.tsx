import { createFileRoute } from "@tanstack/react-router";
import { StaffStub } from "@/components/staff/staff-stub";

export const Route = createFileRoute("/staff/knowledge")({
  component: () => <StaffStub title="KM Library" subtitle="Searchable knowledge asset library — coming next." />,
});
