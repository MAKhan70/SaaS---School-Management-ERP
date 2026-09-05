import { Sparkles } from "lucide-react";
import React from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <Sparkles size={20} strokeWidth={2.25} />
      </span>
      {!compact && (
        <span>
          <strong>NASAQ</strong>
          <small>Academic Systems</small>
        </span>
      )}
    </div>
  );
}
