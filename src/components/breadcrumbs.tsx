import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link href="/dashboard" aria-label="Home">
            <Home size={15} />
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={14} />
        </li>
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}
