import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * A modal in the browser's top layer: the page behind it cannot be clicked or
 * tabbed to, Escape closes it, and focus starts inside it.
 */
export default function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", cancel);
    return () => dialog.removeEventListener("cancel", cancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
