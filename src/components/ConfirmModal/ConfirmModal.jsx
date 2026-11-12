import React, { useEffect, useRef } from "react";
import "./ConfirmModal.scss";

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Escape") onCancel();
  }

  return (
    <div
      className="confirm-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        aria-describedby="confirm-modal-message"
        aria-labelledby="confirm-modal-title"
        aria-modal="true"
        className="confirm-modal"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <p className="eyebrow"><span className="eyebrow-dot" /> CONFIRMAR ACCIÓN</p>
        <h2 id="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-message" id="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button
            className="button button-light"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Cancelar
          </button>
          <button className="button button-dark" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmModal;
