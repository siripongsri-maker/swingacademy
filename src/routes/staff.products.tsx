import { createFileRoute } from "@tanstack/react-router";
import { StaffStub } from "@/components/staff/staff-stub";

export const Route = createFileRoute("/staff/products")({
  component: () => <StaffStub title="Products" subtitle="Courses, toolkits, briefs and media packaged from KM." />,
});
