"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { ItemLookupContent } from "@/components/ItemLookup";
import type { Theme } from "@/components/AppShell";

type ItemLookupDialogProps = {
  itemId: number;
  itemName: string;
  onClose: () => void;
  theme: Theme;
};

export function ItemLookupDialog({ itemId, itemName, onClose, theme }: ItemLookupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      aria-label={`Item lookup for ${itemName}`}
      className="item-lookup-dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      ref={dialogRef}
    >
      <div className="item-lookup-dialog-content">
        <div className="item-lookup-dialog-head">
          <button aria-label="Close quick lookup" className="detail-panel-close" onClick={close} title="Close quick lookup" type="button">
            <X size={17} />
          </button>
        </div>
        <ItemLookupContent initialItemId={itemId} showSearch={false} theme={theme} />
      </div>
    </dialog>
  );
}
