import React from "react";
import "./SiteHeader.scss";
import fightfusLogo from "url:../../../public/assets/fightfus-logo.png";

function SiteHeader({ authenticated, onLoginClick, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img alt="" className="brand-mark" src={fightfusLogo} />
      </div>
      <div className="topbar-actions">
        {authenticated ? (
          <>
            <span className="admin-label">Panel de organizador</span>
            <button className="button button-light" onClick={onLogout} type="button">
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <span className="admin-label">Torneo PVP de Dofus</span>
            <button className="button button-light" onClick={onLoginClick} type="button">
              Acceso organizador
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default SiteHeader;
