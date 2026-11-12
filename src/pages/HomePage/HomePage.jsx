import React, { useEffect, useMemo, useState } from "react";
import "./HomePage.scss";
import LoginModal from "../../components/LoginModal/LoginModal";
import SiteHeader from "../../components/SiteHeader/SiteHeader";
import { useAppContext } from "../../context";
import fightfusLargeLogo from "url:../../../public/assets/figtfus-large-logo.png";

const ENTRY_FEES = [500000, 1000000];
const formatKamas = (amount) => `${new Intl.NumberFormat("es-CO").format(amount)} kamas`;

function HomePage({ authenticated, onLogin, onLogout }) {
  const {
    tournament,
    dataStatus,
    dataError,
    prizePool,
    prizeShares,
    addPlayer,
    removePlayer,
    startTournament,
    selectWinner,
    startNewTournament,
  } = useAppContext();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState(ENTRY_FEES[0]);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const playerById = useMemo(
    () => new Map(tournament.players.map((player) => [player.id, player])),
    [tournament.players],
  );
  const currentRound = tournament.rounds[tournament.rounds.length - 1];
  const isRegistration = tournament.status === "registration";
  const isActive = tournament.status === "active";
  const isComplete = tournament.status === "completed";
  const podiumPlaces = [
    { key: "first", label: "1.º lugar", share: prizeShares.first },
    { key: "second", label: "2.º lugar", share: prizeShares.second },
    { key: "third", label: "3.º lugar", share: prizeShares.third },
  ];

  useEffect(() => {
    if (authenticated) setLoginModalOpen(false);
  }, [authenticated]);

  async function performAction(action, successMessage) {
    setBusy(true);
    setActionError("");
    setFeedback("");
    try {
      await action();
      if (successMessage) setFeedback(successMessage);
      return true;
    } catch (error) {
      console.warn("No se pudo actualizar el torneo:", error);
      const errorCode = error && typeof error === "object" ? error.code : "";
      const message = errorCode === "permission-denied"
        ? "Firebase rechazó la operación. Verifica que firestore.rules esté desplegado en fightfus-league y que autorice el UID administrador."
        : error?.message || "No se pudo guardar el cambio en Firebase.";
      setActionError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAddPlayer(event) {
    event.preventDefault();
    const playerName = name.trim();
    if (!playerName) {
      setActionError("Escribe el nombre del jugador.");
      return;
    }
    const saved = await performAction(
      () => addPlayer(playerName, Number(entryFee)),
      `${playerName} quedó inscrito.`,
    );
    if (saved) setName("");
  }

  function handleRemovePlayer(player) {
    if (!window.confirm(`¿Quitar a ${player.name} de las inscripciones?`)) return;
    performAction(() => removePlayer(player.id), `${player.name} fue retirado del torneo.`);
  }

  function handleStartTournament() {
    if (!window.confirm("Se sortearán los combates iniciales y se cerrarán las inscripciones. ¿Iniciar el torneo?")) {
      return;
    }
    performAction(() => startTournament(), "Torneo iniciado. El cuadro aleatorio ya está disponible.");
  }

  function handleNewTournament() {
    if (!window.confirm("El resultado actual se guardará en el historial y se abrirán nuevas inscripciones. ¿Continuar?")) {
      return;
    }
    performAction(() => startNewTournament(), "Nuevo torneo abierto.");
  }

  function handleSelectWinner(roundId, match, winnerId) {
    const winner = playerById.get(winnerId);
    if (!window.confirm(`¿Confirmar a ${winner.name} como ganador de este combate?`)) return;
    performAction(() => selectWinner(roundId, match.id, winnerId));
  }

  async function handleLogout() {
    setActionError("");
    try {
      await onLogout();
    } catch (error) {
      console.log("No se pudo cerrar la sesión:", error);
      setActionError("No se pudo cerrar la sesión. Inténtalo de nuevo.");
    }
  }

  const stageDescription = isRegistration
    ? "Inscripciones abiertas"
    : isActive
      ? `En curso · ${currentRound?.name || "cuadro activo"}`
      : "Torneo finalizado";

  return (
    <>
      <main className="app-shell">
        <SiteHeader
          authenticated={authenticated}
          onLoginClick={() => setLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        <section className="league-hero">
          <p className="eyebrow"><span className="eyebrow-dot" /> DOFUS · TORNEO PVP 1 VS 1</p>
          <h1>Fightfus <span>League</span></h1>
          <p className="hero-copy">
            Conviértete en el rey del PvP y en el capo de tu gremio. <br/> ¡Que Gultar esté orgulloso de ti!
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <span>Jugadores</span>
              <strong>{tournament.players.length}</strong>
            </div>
            <div className="hero-stat">
              <span>Pozo acumulado</span>
              <strong>{formatKamas(prizePool)}</strong>
            </div>
            <div className="hero-stat">
              <span>Estado</span>
              <strong className={`status-value ${isRegistration ? "status-open" : "status-closed"}`}>
                <span aria-hidden="true" className="status-dot" />
                {stageDescription}
              </strong>
            </div>
          </div>
        </section>

        {dataStatus === "loading" && (
          <p className="notice" role="status">Conectando con Firebase…</p>
        )}
        {dataError && (
          <p className="notice notice-error" role="alert">No se pudieron cargar los datos: {dataError}</p>
        )}
        {actionError && <p className="notice notice-error" role="alert">{actionError}</p>}
        {feedback && <p className="notice notice-success" role="status">{feedback}</p>}

        <div className="league-layout">
          <div className="main-column">
            <section className="panel tournament-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow"><span className="eyebrow-dot" /> CUADRO</p>
                  <h2>{isRegistration ? "Próximo torneo" : "Camino al podio"}</h2>
                </div>
                {isActive && currentRound && (
                  <span className="round-chip">{currentRound.name}</span>
                )}
              </div>

              {isRegistration && (
                <div className="empty-bracket">
                  <span className="empty-bracket-icon" aria-hidden="true">⚔</span>
                  <p>El cuadro aparecerá cuando el organizador inicie el torneo.</p>
                  <span>Se requieren al menos 4 jugadores para disputar el podio completo.</span>
                </div>
              )}

              {tournament.rounds.length > 0 && (
                <div className="round-list">
                  {tournament.rounds.map((round, roundIndex) => (
                    <section className="round-section" key={round.id}>
                      <div className="round-heading">
                        <h3>{round.name}</h3>
                        <span>{roundIndex + 1} / {tournament.rounds.length}</span>
                      </div>
                      <div className="match-list">
                        {round.matches.map((match, matchIndex) => {
                          const player1 = playerById.get(match.player1Id);
                          const player2 = match.player2Id ? playerById.get(match.player2Id) : null;
                          const canSelect = authenticated
                            && isActive
                            && currentRound?.id === round.id
                            && match.winnerId === null;
                          return (
                            <article className="match-card" key={match.id}>
                              <div className="match-topline">
                                <span>
                                  {match.placement === "champion"
                                    ? "GRAN FINAL"
                                    : match.placement === "third"
                                      ? "TERCER PUESTO"
                                      : `COMBATE ${String(matchIndex + 1).padStart(2, "0")}`}
                                </span>
                                {match.winnerId && (
                                  <span className="match-status">
                                    {match.player2Id ? "FINALIZADO" : "PASA DE RONDA"}
                                  </span>
                                )}
                              </div>
                              <div className="match-players">
                                <div className={`match-player ${match.winnerId === match.player1Id ? "is-winner" : match.winnerId ? "is-loser" : ""}`}>
                                  <span>{player1?.name || "Jugador"}</span>
                                  {match.winnerId === match.player1Id && <b>GANADOR</b>}
                                </div>
                                {player2 ? (
                                  <div className={`match-player ${match.winnerId === match.player2Id ? "is-winner" : match.winnerId ? "is-loser" : ""}`}>
                                    <span>{player2.name}</span>
                                    {match.winnerId === match.player2Id && <b>GANADOR</b>}
                                  </div>
                                ) : (
                                  <div className="match-bye">Pasa directo · sin rival</div>
                                )}
                              </div>
                              {canSelect && (
                                <div className="winner-actions">
                                  <span>Seleccionar ganador</span>
                                  {[player1, player2].filter(Boolean).map((player) => (
                                    <button
                                      className="button button-light winner-button"
                                      disabled={busy}
                                      key={player.id}
                                      onClick={() => handleSelectWinner(round.id, match, player.id)}
                                      type="button"
                                    >
                                      {player.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>

            {isComplete && tournament.podium && (
              <section className="panel podium-panel">
                <p className="eyebrow"><span className="eyebrow-dot" /> PODIO FIGHTFUS</p>
                <h2>Los campeones</h2>
                <div className="podium-list">
                  {podiumPlaces.map((place) => {
                    const player = playerById.get(tournament.podium[place.key]);
                    return (
                      <div className={`podium-place podium-${place.key}`} key={place.key}>
                        <span className="podium-medal">{place.key === "first" ? "I" : place.key === "second" ? "II" : "III"}</span>
                        <div className="podium-name">
                          <span>{place.label}</span>
                          <strong>{player?.name || "—"}</strong>
                        </div>
                        <b className="podium-prize">{formatKamas(Math.floor(prizePool * place.share))}</b>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <aside className="side-column">
            <section className="panel prize-panel">
              <p className="eyebrow"><span className="eyebrow-dot" /> RECOMPENSAS</p>
              <h2>Pozo del torneo</h2>
              <p className="prize-total">{formatKamas(prizePool)}</p>
              <p className="muted-copy">El pozo se calcula sumando las inscripciones registradas.</p>
              <div className="prize-breakdown">
                {podiumPlaces.map((place) => (
                  <div className="prize-row" key={place.key}>
                    <span>{place.label} · {Math.round(place.share * 100)}%</span>
                    <strong>{formatKamas(Math.floor(prizePool * place.share))}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel registration-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow"><span className="eyebrow-dot" /> INSCRIPCIONES</p>
                  <h2>Jugadores <span className="count-chip">{tournament.players.length}</span></h2>
                </div>
              </div>

              {authenticated && isRegistration && (
                <form className="registration-form" onSubmit={handleAddPlayer}>
                  <label className="field">
                    <span>Nombre del jugador</span>
                    <input
                      autoComplete="off"
                      maxLength={60}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Nombre del personaje"
                      value={name}
                    />
                  </label>
                  <label className="field">
                    <span>Valor de inscripción</span>
                    <select onChange={(event) => setEntryFee(event.target.value)} value={entryFee}>
                      {ENTRY_FEES.map((fee) => (
                        <option key={fee} value={fee}>{formatKamas(fee)}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button button-dark full-button"
                    disabled={busy || dataStatus !== "ready"}
                    type="submit"
                  >
                    Registrar jugador
                  </button>
                </form>
              )}

              {!authenticated && isRegistration && (
                <p className="muted-copy">
                  El organizador registra a los jugadores y confirma el valor de cada inscripción.
                </p>
              )}
              {!isRegistration && (
                <p className="muted-copy">
                  {isComplete
                    ? "Inscripciones cerradas. El torneo terminó."
                    : "Inscripciones cerradas: el torneo ya está en marcha."}
                </p>
              )}

              {tournament.players.length > 0 ? (
                <ul className="player-list">
                  {tournament.players.map((player, index) => (
                    <li key={player.id}>
                      <span className="player-position">{String(index + 1).padStart(2, "0")}</span>
                      <span className="player-name">{player.name}</span>
                      <span className="player-fee">{formatKamas(player.entryFee)}</span>
                      {authenticated && isRegistration && (
                        <button
                          aria-label={`Quitar a ${player.name}`}
                          className="remove-player"
                          disabled={busy}
                          onClick={() => handleRemovePlayer(player)}
                          type="button"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-roster">Todavía no hay jugadores inscritos.</p>
              )}

              {authenticated && isRegistration && (
                <button
                  className="button button-dark full-button start-button"
                  disabled={busy || dataStatus !== "ready" || tournament.players.length < 4}
                  onClick={handleStartTournament}
                  type="button"
                >
                  {busy ? "Guardando…" : `Iniciar torneo · ${tournament.players.length} jugadores`}
                </button>
              )}
              {authenticated && isComplete && (
                <button
                  className="button button-dark full-button start-button"
                  disabled={busy || dataStatus !== "ready"}
                  onClick={handleNewTournament}
                  type="button"
                >
                  Abrir nuevo torneo
                </button>
              )}
            </section>

            <p className="admin-note">
              El administrador registra los pagos y define manualmente el ganador de cada combate.
            </p>
          </aside>
        </div>

        <footer className="site-footer">
          <img alt="Fightfus League" className="footer-logo" src={fightfusLargeLogo} />
          <p>© 2026 Fightfus League todos los derechos reservados - MalaCode · Torneos comunitarios de Dofus.</p>
          <p>Fightfus League es un proyecto comunitario sin animo de lucro y no está afiliado a Ankama Games.<br/>DOFUS y Ankama son marcas registradas de Ankama Games.</p>
        </footer>
      </main>
      {!authenticated && loginModalOpen && (
        <LoginModal
          onContinueAsGuest={() => setLoginModalOpen(false)}
          onLogin={onLogin}
        />
      )}
    </>
  );
}

export default HomePage;
