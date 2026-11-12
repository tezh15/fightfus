import React, { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, runTransaction } from "@firebase/firestore";
import { db } from "./firebase";

const AppContext = createContext(null);
const TOURNAMENT_DOCUMENT = doc(db, "tournaments", "current");
const ENTRY_FEES = [500000, 1000000];
const MAX_PLAYERS = 128;
const PRIZE_SHARES = { first: 0.6, second: 0.3, third: 0.1 };

function createEmptyTournament() {
  return {
    mode: "tournament",
    players: [],
    status: "registration",
    rounds: [],
    challenge: null,
    podium: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };
}

function readTournament(data) {
  const validStatuses = ["registration", "active", "completed"];
  const mode = data.mode === undefined ? "tournament" : data.mode;
  if (
    !Array.isArray(data.players) ||
    !validStatuses.includes(data.status) ||
    !Array.isArray(data.rounds) ||
    !["tournament", "challenge"].includes(mode)
  ) {
    throw new Error("Los datos del torneo guardados en Firebase no tienen un formato válido.");
  }

  const playerIds = new Set();
  const players = data.players.map((player) => {
    if (
      !player ||
      typeof player.id !== "string" ||
      typeof player.name !== "string" ||
      !player.name.trim() ||
      !ENTRY_FEES.includes(player.entryFee) ||
      playerIds.has(player.id)
    ) {
      throw new Error("La lista de jugadores guardada en Firebase no tiene un formato válido.");
    }
    playerIds.add(player.id);
    return { id: player.id, name: player.name, entryFee: player.entryFee };
  });
  if (mode === "challenge" && players.length > 2) {
    throw new Error("Un desafío solo puede tener 2 jugadores.");
  }

  const rounds = data.rounds.map((round) => {
    if (!round || !Number.isInteger(round.stageKey) || !Array.isArray(round.matches)) {
      throw new Error("El cuadro guardado en Firebase no tiene un formato válido.");
    }
    const matches = round.matches.map((match) => {
      if (
        !match ||
        typeof match.id !== "string" ||
        !playerIds.has(match.player1Id) ||
        (match.player2Id !== null && !playerIds.has(match.player2Id)) ||
        (match.winnerId !== null && !playerIds.has(match.winnerId)) ||
        ![null, "champion", "third"].includes(match.placement)
      ) {
        throw new Error("Un combate guardado en Firebase no tiene un formato válido.");
      }
      return { ...match };
    });
    return { ...round, matches };
  });
  let challenge = data.challenge || null;
  if (challenge !== null) {
    if (
      mode !== "challenge" ||
      players.length !== 2 ||
      !Array.isArray(challenge.fightWinners) ||
      challenge.fightWinners.length > 3 ||
      challenge.fightWinners.some((winnerId) => !playerIds.has(winnerId)) ||
      (challenge.winnerId !== null && !playerIds.has(challenge.winnerId))
    ) {
      throw new Error("El desafío guardado en Firebase no tiene un formato válido.");
    }

    const winsByPlayer = challenge.fightWinners.reduce((wins, winnerId) => ({
      ...wins,
      [winnerId]: (wins[winnerId] || 0) + 1,
    }), {});
    const decidedWinner = players.find((player) => winsByPlayer[player.id] >= 2)?.id || null;
    if (
      challenge.winnerId !== decidedWinner ||
      (data.status === "completed" && decidedWinner === null) ||
      (data.status === "active" && decidedWinner !== null)
    ) {
      throw new Error("El resultado del desafío guardado en Firebase no tiene un formato válido.");
    }
    challenge = { fightWinners: [...challenge.fightWinners], winnerId: challenge.winnerId };
  }
  if (
    mode === "challenge" &&
    ((data.status === "registration" && challenge !== null) ||
      (data.status !== "registration" && challenge === null))
  ) {
    throw new Error("El desafío guardado en Firebase no tiene un formato válido.");
  }

  return {
    ...data,
    mode,
    players,
    rounds,
    challenge,
    podium: data.podium || null,
  };
}

function readTournamentFromTransaction(snapshot) {
  return snapshot.exists() ? readTournament(snapshot.data()) : createEmptyTournament();
}

function makeId() {
  return doc(collection(db, "tournamentIds")).id;
}

function makeRound(stageKey, matches) {
  return {
    id: makeId(),
    stageKey,
    name: getRoundName(stageKey),
    matches,
  };
}

function makeMatch(player1Id, player2Id, placement = null) {
  const winnerId = player2Id === null ? player1Id : null;
  return { id: makeId(), player1Id, player2Id, winnerId, placement };
}

function getRoundName(stageKey) {
  const names = {
    2: "Final y tercer puesto",
    4: "Semifinales",
    8: "Cuartos de final",
    16: "Octavos de final",
  };
  return names[stageKey] || `Ronda de ${stageKey}`;
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createFirstRound(players) {
  let stageKey = 2;
  while (stageKey < players.length) stageKey *= 2;

  const entrants = shuffled(players);
  const byes = stageKey - entrants.length;
  const matches = [];

  for (let index = 0; index < byes; index += 1) {
    matches.push(makeMatch(entrants[index].id, null));
  }
  for (let index = byes; index < entrants.length; index += 2) {
    matches.push(makeMatch(entrants[index].id, entrants[index + 1].id));
  }

  return makeRound(stageKey, matches);
}

function getPrizePool(players) {
  return players.reduce((total, player) => total + player.entryFee, 0);
}

export function AppProvider({ children }) {
  const [tournament, setTournament] = useState(createEmptyTournament);
  const [dataStatus, setDataStatus] = useState("loading");
  const [dataError, setDataError] = useState("");

  useEffect(() => onSnapshot(
    TOURNAMENT_DOCUMENT,
    (snapshot) => {
      try {
        setTournament(snapshot.exists()
          ? readTournament(snapshot.data())
          : createEmptyTournament());
        setDataError("");
        setDataStatus("ready");
      } catch (error) {
        console.log("Los datos del torneo de Firebase no son válidos:", error);
        setDataError(error.message);
        setDataStatus("error");
      }
    },
    (error) => {
      console.log("No se pudieron cargar los datos de Firebase:", error);
      setDataError(error.message);
      setDataStatus("error");
    },
  ), []);

  async function updateTournament(update) {
    if (dataStatus !== "ready") {
      throw new Error("Espera a que se carguen los datos del torneo e inténtalo de nuevo.");
    }

    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(TOURNAMENT_DOCUMENT);
      const current = readTournamentFromTransaction(snapshot);
      const next = update(current);
      transaction.set(TOURNAMENT_DOCUMENT, next);
      return next;
    });
  }

  async function addPlayer(name, entryFee) {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (!normalizedName || normalizedName.length > 60) {
      throw new Error("El nombre debe tener entre 1 y 60 caracteres.");
    }
    if (!ENTRY_FEES.includes(entryFee)) {
      throw new Error("El valor de inscripción seleccionado no es válido.");
    }

    await updateTournament((current) => {
      if (current.status !== "registration") {
        throw new Error("Las inscripciones están cerradas para este torneo.");
      }
      if (current.players.length >= MAX_PLAYERS) {
        throw new Error(`El torneo alcanzó el límite de ${MAX_PLAYERS} jugadores.`);
      }
      if (current.mode === "challenge" && current.players.length >= 2) {
        throw new Error("Un desafío solo puede tener 2 jugadores.");
      }
      const nameKey = normalizedName.normalize("NFKC").toLocaleLowerCase("es");
      if (current.players.some((player) => (
        player.name.normalize("NFKC").toLocaleLowerCase("es") === nameKey
      ))) {
        throw new Error("Ya hay un jugador registrado con ese nombre.");
      }

      return {
        ...current,
        players: [...current.players, { id: makeId(), name: normalizedName, entryFee }],
      };
    });
  }

  async function removePlayer(playerId) {
    await updateTournament((current) => {
      if (current.status !== "registration") {
        throw new Error("No se pueden editar las inscripciones después de iniciar el torneo.");
      }
      return { ...current, players: current.players.filter((player) => player.id !== playerId) };
    });
  }

  async function setCompetitionMode(mode) {
    if (!["tournament", "challenge"].includes(mode)) {
      throw new Error("El tipo de combate seleccionado no es válido.");
    }
    await updateTournament((current) => {
      if (current.status !== "registration" || current.players.length > 0) {
        throw new Error("El tipo de combate solo se puede cambiar antes de inscribir jugadores.");
      }
      return { ...current, mode, challenge: null };
    });
  }

  async function startTournament() {
    await updateTournament((current) => {
      if (current.status !== "registration") {
        throw new Error("Este torneo ya fue iniciado.");
      }
      if (current.mode === "challenge") {
        if (current.players.length !== 2) {
          throw new Error("El desafío necesita exactamente 2 jugadores.");
        }
        return {
          ...current,
          status: "active",
          challenge: { fightWinners: [], winnerId: null },
          startedAt: new Date().toISOString(),
        };
      }
      if (current.players.length < 4) {
        throw new Error("Se necesitan al menos 4 jugadores para disputar el podio completo.");
      }
      return {
        ...current,
        status: "active",
        rounds: [createFirstRound(current.players)],
        startedAt: new Date().toISOString(),
      };
    });
  }

  async function selectChallengeFightWinner(winnerId) {
    await updateTournament((current) => {
      if (current.mode !== "challenge" || current.status !== "active" || !current.challenge) {
        throw new Error("No hay un desafío activo.");
      }
      if (!current.players.some((player) => player.id === winnerId)) {
        throw new Error("El ganador debe ser uno de los participantes del desafío.");
      }
      if (current.challenge.winnerId) {
        throw new Error("Este desafío ya tiene un ganador.");
      }

      const fightWinners = [...current.challenge.fightWinners, winnerId];
      const wins = fightWinners.filter((fightWinnerId) => fightWinnerId === winnerId).length;
      const challengeWinnerId = wins === 2 ? winnerId : null;
      return {
        ...current,
        status: challengeWinnerId ? "completed" : "active",
        completedAt: challengeWinnerId ? new Date().toISOString() : null,
        challenge: { fightWinners, winnerId: challengeWinnerId },
      };
    });
  }

  async function selectWinner(roundId, matchId, winnerId) {
    await updateTournament((current) => {
      if (current.status !== "active") {
        throw new Error("No hay un torneo activo.");
      }

      const currentRound = current.rounds[current.rounds.length - 1];
      if (!currentRound || currentRound.id !== roundId) {
        throw new Error("Solo se pueden registrar resultados de la ronda actual.");
      }

      let foundMatch = false;
      const matches = currentRound.matches.map((match) => {
        if (match.id !== matchId) return match;
        foundMatch = true;
        if (match.winnerId !== null) {
          throw new Error("Este combate ya tiene un ganador registrado.");
        }
        if (![match.player1Id, match.player2Id].includes(winnerId)) {
          throw new Error("El ganador debe ser uno de los participantes del combate.");
        }
        return { ...match, winnerId };
      });

      if (!foundMatch) throw new Error("No se encontró el combate seleccionado.");
      const completedRound = { ...currentRound, matches };
      const rounds = [...current.rounds.slice(0, -1), completedRound];
      if (matches.some((match) => match.winnerId === null)) {
        return { ...current, rounds };
      }

      if (currentRound.stageKey === 2) {
        const finalMatch = matches.find((match) => match.placement === "champion");
        const thirdPlaceMatch = matches.find((match) => match.placement === "third");
        const runnerUp = finalMatch.player1Id === finalMatch.winnerId
          ? finalMatch.player2Id
          : finalMatch.player1Id;
        return {
          ...current,
          rounds,
          status: "completed",
          completedAt: new Date().toISOString(),
          podium: {
            first: finalMatch.winnerId,
            second: runnerUp,
            third: thirdPlaceMatch.winnerId,
          },
        };
      }

      let nextMatches;
      if (currentRound.stageKey === 4) {
        const finalists = [];
        const thirdPlaceContenders = [];
        matches.forEach((match) => {
          finalists.push(match.winnerId);
          thirdPlaceContenders.push(
            match.player1Id === match.winnerId ? match.player2Id : match.player1Id,
          );
        });
        nextMatches = [
          makeMatch(finalists[0], finalists[1], "champion"),
          makeMatch(thirdPlaceContenders[0], thirdPlaceContenders[1], "third"),
        ];
      } else {
        const winners = matches.map((match) => match.winnerId);
        nextMatches = [];
        for (let index = 0; index < winners.length; index += 2) {
          nextMatches.push(makeMatch(winners[index], winners[index + 1]));
        }
      }

      return {
        ...current,
        rounds: [...rounds, makeRound(currentRound.stageKey / 2, nextMatches)],
      };
    });
  }

  async function startNewTournament() {
    if (dataStatus !== "ready") {
      throw new Error("Espera a que se carguen los datos del torneo e inténtalo de nuevo.");
    }
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(TOURNAMENT_DOCUMENT);
      const current = readTournamentFromTransaction(snapshot);
      if (current.status !== "completed") {
        throw new Error("Solo se puede abrir un nuevo torneo cuando el actual haya finalizado.");
      }
      transaction.set(TOURNAMENT_DOCUMENT, createEmptyTournament());
    });
  }

  const prizePool = getPrizePool(tournament.players);

  return (
    <AppContext.Provider
      value={{
        tournament,
        dataStatus,
        dataError,
        prizePool,
        prizeShares: PRIZE_SHARES,
        addPlayer,
        removePlayer,
        setCompetitionMode,
        startTournament,
        selectWinner,
        selectChallengeFightWinner,
        startNewTournament,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext debe usarse dentro de AppProvider.");
  }
  return context;
}
