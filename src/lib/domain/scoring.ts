import {
	DEFAULT_BWF_SCORING_CONFIG,
	type GameScore,
	type GameState,
	type MatchDiscipline,
	type MatchPlayer,
	type MatchState,
	type MatchStatus,
	type ScoringConfig,
	type ScoreEventInput,
	type ServiceState,
	type Side,
	type TerminalReason
} from './types';
import {
	applyDoublesServiceAfterRally,
	applySinglesServiceAfterRally,
	createInitialDoublesServiceState,
	createInitialSinglesServiceState,
	otherSide,
	scoreOfSide
} from './service';
import { ACTIVE_MATCH_STATUSES, CONFIRMABLE_MATCH_STATUSES } from './matchStatus';

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

	return withSeq(applyEvent(state, input, players), now);
}

/**
 * イベント種別ごとの状態遷移。遷移元ステータスの検証は各ハンドラ先頭の
 * assertStatusIn に集約し、seqNo/updatedAt の更新は呼び出し側(withSeq)が担う。
 */
function applyEvent(state: MatchState, input: ScoreEventInput, players: MatchPlayer[]): MatchState {
	switch (input.type) {
		case 'match_started':
			return startMatch(state, players, input.initialServerPlayerId, input.initialReceiverPlayerId);
		case 'game_started':
			return startGame(
				state,
				players,
				input.gameNo,
				input.initialServerPlayerId,
				input.initialReceiverPlayerId
			);
		case 'rally_won':
			return applyRallyWon(state, players, input.side);
		case 'undo':
			if (!input.restoreState) throw new Error('Undo restore state is required');
			return { ...input.restoreState, lastSeqNo: state.lastSeqNo };
		case 'correction':
			return applyCorrection(state, input.gameNo, input.score, input.gamesWon, input.service);
		case 'let_called':
			assertStatusIn(state, ['playing'], 'Let can be recorded only while playing');
			return state;
		case 'match_suspended':
			assertStatusIn(
				state,
				['playing', 'interval'],
				'Match can be suspended only while playing or during interval'
			);
			return { ...state, status: 'suspended' };
		case 'match_resumed':
			assertStatusIn(state, ['suspended'], 'Match can be resumed only from suspended');
			return { ...state, status: 'playing' };
		case 'side_forfeited':
			assertStatusIn(
				state,
				['scheduled', ...ACTIVE_MATCH_STATUSES],
				'不戦敗を記録できるのは試合開始前または進行中のみです'
			);
			return terminateWithWinner(state, otherSide(input.side), 'forfeited', 'forfeit');
		case 'side_retired':
			assertStatusIn(state, ACTIVE_MATCH_STATUSES, '棄権を記録できるのは試合進行中のみです');
			return terminateWithWinner(state, otherSide(input.side), 'retired', 'retirement');
		case 'match_confirmed':
			assertStatusIn(state, CONFIRMABLE_MATCH_STATUSES, 'Only terminal matches can be confirmed');
			return { ...state, status: 'confirmed', confirmedFromStatus: state.status };
		case 'match_unconfirmed':
			assertStatusIn(state, ['confirmed'], 'Only confirmed matches can be unconfirmed');
			return {
				...state,
				status: state.confirmedFromStatus ?? 'finished',
				confirmedFromStatus: null
			};
	}
}

/**
 * 運営による試合の打ち切り(スコアイベントを経由しない管理操作)。
 * 種目打ち切り時のスナップショット更新に使う。
 */
export function applyMatchCancellation(state: MatchState, now: string): MatchState {
	return withSeq({ ...state, status: 'cancelled', service: null }, now);
}

function assertStatusIn(state: MatchState, allowed: readonly MatchStatus[], message: string): void {
	if (!allowed.includes(state.status)) throw new Error(message);
}

function terminateWithWinner(
	state: MatchState,
	winnerSide: Side,
	status: MatchStatus,
	terminalReason: TerminalReason
): MatchState {
	return { ...state, status, winnerSide, terminalReason, service: null };
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
	assertStatusIn(state, ['scheduled'], 'Match can be started only from scheduled');
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
	assertStatusIn(state, ['interval'], 'Game can be started only from interval');
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
	assertStatusIn(state, ['playing'], 'Rally can be recorded only while playing');

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
