import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StaffLayout } from "@/components/staff/staff-layout";
import { StaffProvider } from "@/lib/staff-context";
import { ProductKnowledgeProvider } from "@/lib/product-knowledge-store";

export const Route = createFileRoute("/staff")({
  component: StaffShell,
});

function StaffShell() {
  return (
    <StaffProvider>
      <ProductKnowledgeProvider>
        <StaffLayout>
          <Outlet />
        </StaffLayout>
      </ProductKnowledgeProvider>
    </StaffProvider>
  );
}
