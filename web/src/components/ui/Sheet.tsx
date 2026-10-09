"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Spodní sheet (na desktopu dialog) nad nativním <dialog>. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // klik na pozadí
      }}
    >
      {open && (
        <>
          <div className="grab" />
          <div className="dlg">{children}</div>
        </>
      )}
    </dialog>
  );
}

export function SheetList({ children }: { children: ReactNode }) {
  return <div className="list sheet-list">{children}</div>;
}
