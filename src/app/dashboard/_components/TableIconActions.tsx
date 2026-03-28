"use client";

import { Pencil, Trash2 } from "lucide-react";

type Props = {
  /** Omita ou use com `showEdit={false}` — duplo clique na linha abre consulta. */
  onEdit?: () => void;
  onDelete: () => void;
  disabled?: boolean;
  editLabel?: string;
  deleteLabel?: string;
  /** default true. Se false, só o botão excluir (consulta via duplo clique na linha). */
  showEdit?: boolean;
};

/**
 * Ações na grid: editar + excluir, ou só excluir quando `showEdit={false}`.
 */
export default function TableIconActions({
  onEdit,
  onDelete,
  disabled,
  showEdit = true,
  editLabel = "Editar",
  deleteLabel = "Excluir",
}: Props) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {showEdit ? (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          title={editLabel}
          aria-label={editLabel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-60"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        title={deleteLabel}
        aria-label={deleteLabel}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
