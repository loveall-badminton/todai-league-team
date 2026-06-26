import {
	DEFAULT_BWF_SCORING_CONFIG,
	type GameScore,
	type GameState,
	type MatchDiscipline,
	type MatchPlayer,
	type MatchState,
	type ScoringConfig,
	type ScoreEventInput,
	type ServiceState,
	type Side
} from './types';
import {
	applyDoublesServiceAfterRally,
	applySinglesServiceAfterRally,
	createInitialDoublesServiceState,
	createInitialSinglesServiceState,
	otherSide,
	scoreOfSide
} from './service';

export {
	applyDoublesServiceAfterRally,
	createInitialDoublesServiceState,
	otherSide
} from './service';

export function createInitialMatchState(params: {
	matchId: string;
	tournamentId: string;
	courtId: string | null;
	discipline: MatchDiscipline;
	now: string;
	scoring?: ScoringConfig;
}): MatchState {
	const { matchId, tournamentId, courtId, discipline, now } = params;

	return {
		schemaVersion: 1,
		matchId,
		tournamentId,
		courtId,
		discipline,
		status: 'scheduled',
		scoring: params.scoring ?? DEFAULT_BWF_SCORING_CONFIG,
		currentGameNo: 1,
		games: [createEmptyGame(1)],
		gamesWon: { A: 0, B: 0 },
		winnerSide: null,
		terminalReason: null,
		service: null,
		lastSeqNo: 0,
		createdAt: now,
		updatedAt: now
	};
}

export function getCurrentGame(state: MatchState): GameState {
	const game = state.games.find((item) => item.gameNo === state.currentGameNo);
	if (!game) throw new Error(`Current game not found: ${state.currentGameNo}`);
	return game;
}

export function isGameWon(score: GameScore, side: Side, config: ScoringConfig): boolean {
	const own = scoreOfSide(score, side);
	const other = scoreOfSide(score, otherSide(side));
	if (own < config.pointsToWin) return false;
	if (own === config.maxPoints) return true;
	return own - other >= config.winBy;
}

export function isMatchWon(
	gamesWon: { A: number; B: number },
	side: Side,
	config: ScoringConfig
): boolean {
	return gamesWon[side] >= config.gamesToWin;
}

export function applyScoreEvent(params: {
	state: MatchState;
	input: ScoreEventInput;
	players: MatchPlayer[];
	now: string;
}): MatchState {
	const { state, input, players, now } = params;
	if (input.observedSeqNo !== state.lastSeqNo) {
		throw new Error(`Observed seqNo ${input.observedSeqNo} does not match ${state.lastSeqNo}`);
	}

	if (state.status === 'confirmed' && input.type !== 'match_unconfirmed') {
		throw new Error('承認済みの試合は変更できません。運営が承認を解除してください。');
	}

	switch (input.type) {
		case 'match_started':
			return withSeq(
				startMatch(state, players, input.initialServerPlayerId, input.initialReceiverPlayerId),
				now
			);
		case 'game_started':
			return withSeq(
				startGame(
					state,
					players,
					input.gameNo,
					input.initialServerPlayerId,
					input.initialReceiverPlayerId
				),
				now
			);
		case 'rally_won':
			return withSeq(applyRallyWon(state, players, input.side), now);
		case 'undo':
			if (!input.restoreState) throw new Error('Undo restore state is required');
			return withSeq({ ...input.restoreState, lastSeqNo: state.lastSeqNo }, now);
		case 'correction':
			return withSeq(
				applyCorrection(state, input.gameNo, input.score, input.gamesWon, input.service),
				now
			);
		case 'let_called':
			if (state.status !== 'playing') throw new Error('Let can be recorded only while playing');
			return withSeq(state, now);
		case 'match_suspended':
			if (state.status !== 'playing' && state.status !== 'interval') {
				throw new Error('Match can be suspended only while playing or during interval');
			}
			return withSeq({ ...state, status: 'suspended' }, now);
		case 'match_resumed':
			if (state.status !== 'suspended') throw new Error('Match can be resumed only from suspended');
			return withSeq({ ...state, status: 'playing' }, now);
		case 'side_forfeited': {
			const allowed = ['scheduled', 'playing', 'interval', 'suspended'] as const;
			if (!allowed.includes(state.status)) {
				throw new Error('不戦敗を記録できるのは試合開始前または進行中のみです');
			}
			return withSeq(
				{
					...state,
					status: 'forfeited',
					winnerSide: otherSide(input.side),
					terminalReason: 'forfeit',
					service: null
				},
				now
			);
		}
		case 'side_retired': {
			const allowed = ['playing', 'interval', 'suspended'] as const;
			if (!allowed.includes(state.status)) {
				throw new Error('棄権を記録できるのは試合進行中のみです');
			}
			return withSeq(
				{
					...state,
					status: 'retired',
					winnerSide: otherSide(input.side),
					terminalReason: 'retirement',
					service: null
				},
				now
			);
		}
		case 'match_confirmed':
			if (!['finished', 'forfeited', 'retired'].includes(state.status)) {
				throw new Error('Only terminal matches can be confirmed');
			}
			return withSeq({ ...state, status: 'confirmed', confirmedFromStatus: state.status }, now);
		case 'match_unconfirmed':
			if (state.status !== 'confirmed') {
				throw new Error('Only confirmed matches can be unconfirmed');
			}
			return withSeq(
				{
					...state,
					status: state.confirmedFromStatus ?? 'finished',
					confirmedFromStatus: null
				},
				now
			);
	}
}

function createEmptyGame(gameNo: number): GameState {
	return {
		gameNo,
		score: { A: 0, B: 0 },
		winnerSide: null,
		midGameIntervalTaken: false,
		changeEndsRequired: false,
		changeEndsCompleted: false
	};
}

function isDoubles(discipline: MatchDiscipline): boolean {
	return discipline === 'MD' || discipline === 'WD' || discipline === 'XD';
}

function withSeq(state: MatchState, now: string): MatchState {
	return {
		...state,
		lastSeqNo: state.lastSeqNo + 1,
		updatedAt: now
	};
}

function startMatch(
	state: MatchState,
	players: MatchPlayer[],
	initialServerPlayerId: string,
	initialReceiverPlayerId: string
): MatchState {
	if (state.status !== 'scheduled') throw new Error('Match can be started only from scheduled');
	return {
		...state,
		status: 'playing',
		service: createService(
			state.discipline,
			players,
			initialServerPlayerId,
			initialReceiverPlayerId
		)
	};
}

function startGame(
	state: MatchState,
	players: MatchPlayer[],
	gameNo: number,
	initialServerPlayerId: string,
	initialReceiverPlayerId: string
): MatchState {
	if (state.status !== 'interval') throw new Error('Game can be started only from interval');
	if (gameNo !== state.currentGameNo) throw new Error('Game number does not match current game');
	return {
		...state,
		status: 'playing',
		service: createService(
			state.discipline,
			players,
			initialServerPlayerId,
			initialReceiverPlayerId
		)
	};
}

function createService(
	discipline: MatchDiscipline,
	players: MatchPlayer[],
	initialServerPlayerId: string,
	initialReceiverPlayerId: string
): ServiceState {
	return isDoubles(discipline)
		? createInitialDoublesServiceState({ players, initialServerPlayerId, initialReceiverPlayerId })
		: createInitialSinglesServiceState({ players, initialServerPlayerId, initialReceiverPlayerId });
}

function applyRallyWon(state: MatchState, players: MatchPlayer[], side: Side): MatchState {
	if (state.status !== 'playing') throw new Error('Rally can be recorded only while playing');

	const currentGame = getCurrentGame(state);
	const nextScore = { ...currentGame.score, [side]: currentGame.score[side] + 1 };
	const gameWon = isGameWon(nextScore, side, state.scoring);
	const midGameIntervalTaken =
		currentGame.midGameIntervalTaken ||
		nextScore.A === state.scoring.midGameIntervalPoint ||
		nextScore.B === state.scoring.midGameIntervalPoint;
	const changeEndsRequired =
		currentGame.changeEndsRequired ||
		(state.currentGameNo === state.scoring.maxGames &&
			(nextScore.A === state.scoring.midGameIntervalPoint ||
				nextScore.B === state.scoring.midGameIntervalPoint));

	const games = state.games.map((game) =>
		game.gameNo === state.currentGameNo
			? {
					...game,
					score: nextScore,
					winnerSide: gameWon ? side : null,
					midGameIntervalTaken,
					changeEndsRequired
				}
			: game
	);

	if (!gameWon) {
		return {
			...state,
			games,
			service: applyServiceAfterRally(state.service, nextScore, side, players)
		};
	}

	const gamesWon = { ...state.gamesWon, [side]: state.gamesWon[side] + 1 };
	if (isMatchWon(gamesWon, side, state.scoring)) {
		return {
			...state,
			status: 'finished',
			games,
			gamesWon,
			winnerSide: side,
			terminalReason: 'normal',
			service: null
		};
	}

	const nextGameNo = state.currentGameNo + 1;
	return {
		...state,
		status: 'interval',
		currentGameNo: nextGameNo,
		games: [...games, createEmptyGame(nextGameNo)],
		gamesWon,
		service: null
	};
}

function applyServiceAfterRally(
	service: ServiceState | null,
	scoreAfter: GameScore,
	rallyWinner: Side,
	players: MatchPlayer[]
): ServiceState | null {
	if (!service) return null;
	if (service.discipline === 'doubles') {
		return applyDoublesServiceAfterRally({ before: service, scoreAfter, rallyWinner });
	}
	return applySinglesServiceAfterRally({ before: service, scoreAfter, rallyWinner, players });
}

function applyCorrection(
	state: MatchState,
	gameNo: number,
	score: GameScore,
	gamesWon: { A: number; B: number } | undefined,
	service: ServiceState | null | undefined
): MatchState {
	if (score.A < 0 || score.B < 0) throw new Error('Scores must be non-negative');
	if (score.A > state.scoring.maxPoints || score.B > state.scoring.maxPoints) {
		throw new Error('Scores cannot exceed maxPoints');
	}
	if (gameNo !== state.currentGameNo) {
		throw new Error('MVP correction supports only the current game');
	}

	return {
		...state,
		games: state.games.map((game) => (game.gameNo === gameNo ? { ...game, score } : game)),
		gamesWon: gamesWon ?? state.gamesWon,
		service: service === undefined ? state.service : service
	};
}
