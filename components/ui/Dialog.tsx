"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import s from "./ui.module.css";

let locks = 0;
const lock = () => {
  if (locks++ === 0) document.documentElement.classList.add("lock");
};
const unlock = () => {
  if (--locks <= 0) {
    locks = 0;
    document.documentElement.classList.remove("lock");
  }
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  label: string;
  /** drawer slides in from the right. modal is centred on desktop and a bottom sheet on phones. */
  variant?: "modal" | "drawer";
  className?: string;
  children: React.ReactNode;
}

/** The native dialog element: focus is trapped, Escape closes, the page behind is inert. */
export function Dialog({ open, onClose, label, variant = "modal", className = "", children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (!locked.current) {
        lock();
        locked.current = true;
      }
    } else if (!open && d.open) {
      d.close();
    }
    if (!open && locked.current) {
      unlock();
      locked.current = false;
    }
  }, [open]);

  useEffect(
    () => () => {
      if (locked.current) {
        unlock();
        locked.current = false;
      }
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`${s.dialog} ${variant === "drawer" ? s.drawer : `${s.modal} ${s.modalSheet}`} ${open ? s.dialogOpen : ""} ${variant === "modal" ? s.modalSheet : ""} ${className}`}
      onClose={() => {
        if (locked.current) {
          unlock();
          locked.current = false;
        }
        if (open) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}

export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className={s.xb} onClick={onClick} aria-label={label}>
      <Icon name="close" />
    </button>
  );
}
