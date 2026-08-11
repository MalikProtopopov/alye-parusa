"use client";

// Sticky-панель действий формы: «Сохранить» (остаться) /
// «Сохранить и выйти» / «Удалить». Единый блок для всех форм админки.

export default function FormActions({
  saving,
  deleting,
  createMode,
  singleton,
  onSave,
  onSaveExit,
  onDelete,
}: {
  saving: boolean;
  deleting?: boolean;
  /** true — форма создания: подписи «Создать» / «Создать и выйти». */
  createMode?: boolean;
  /** true — singleton (баннер/настройки): только «Сохранить». */
  singleton?: boolean;
  onSave: () => void;
  onSaveExit?: () => void;
  onDelete?: () => void;
}) {
  const saveLabel = saving
    ? "Сохранение…"
    : createMode
    ? "Создать"
    : "Сохранить";
  return (
    <div className="form-actions">
      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || deleting}
        onClick={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        {saveLabel}
      </button>
      {!singleton && onSaveExit && (
        <button
          type="button"
          className="btn"
          disabled={saving || deleting}
          onClick={onSaveExit}
        >
          {createMode ? "Создать и выйти" : "Сохранить и выйти"}
        </button>
      )}
      <span className="spacer" />
      {onDelete && (
        <button
          type="button"
          className="btn btn-danger"
          disabled={saving || deleting}
          onClick={onDelete}
        >
          {deleting ? "Удаление…" : "Удалить"}
        </button>
      )}
    </div>
  );
}
