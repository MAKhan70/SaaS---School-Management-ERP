"use client";

import { Menu, X } from "lucide-react";
import { useRef, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";

export function MobileNavigation({
  permissionKeys,
  trustName,
}: {
  permissionKeys: readonly string[];
  trustName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function openNavigation() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function closeNavigation() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        className="icon-button mobile-menu-button"
        type="button"
        aria-label="Open navigation"
        aria-controls="mobile-navigation"
        aria-expanded={open}
        onClick={openNavigation}
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <dialog
        className="mobile-navigation-dialog"
        id="mobile-navigation"
        ref={dialogRef}
        aria-label="Navigation"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeNavigation();
        }}
      >
        <button
          className="icon-button mobile-navigation-close"
          type="button"
          aria-label="Close navigation"
          onClick={closeNavigation}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <AppSidebar
          permissionKeys={permissionKeys}
          onMobile
          onNavigate={closeNavigation}
          trustName={trustName}
        />
      </dialog>
    </>
  );
}
