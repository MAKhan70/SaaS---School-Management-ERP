import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/ui-states";

export default function EmptyPage() {
  return (
    <>
      <Breadcrumbs current="Empty state" />
      <EmptyState />
    </>
  );
}
