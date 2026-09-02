import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { AccessDeniedState } from "@/components/ui-states";

export const metadata: Metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <>
      <Breadcrumbs current="Access denied" />
      <AccessDeniedState />
    </>
  );
}
