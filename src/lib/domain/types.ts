export type Side = 'A' | 'B';

export type MatchDiscipline = 'MS' | 'WS' | 'MD' | 'WD' | 'XD';

export type ServiceCourt = 'right' | 'left';

export type MatchStatus =
	| 'scheduled'
	| 'playing'
	| 'interval'
	| 'suspended'
	| 'finished'
	| 'confirmed'
	| 'forfeited'
	| 'retired'
	| 'cancelled';

export type TerminalReason =
	'normal' | 'forfeit' | 'retirement' | 'disqualification' | 'walkover' | 'cancelled';

export interface GameScore {
	A: number;
	B: number;
}

export interface MatchPlayer {
	id: string;
	side: Side;
	order: 1 | 2;
	name: string;
	teamName?: string | null;
}

export interface CourtAssignment {
	right: string;
	left: string;
}

export interface CourtAssignments {
	A: CourtAssignment;
	B: CourtAssignment;
}

export interface SinglesServiceState {
	discipline: 'singles';
	servingSide: Side;
	serviceCourt: ServiceCourt;
	serverPlayerId: string;
	receiverPlayerId: string;
}

export interface DoublesServiceState {
	discipline: 'doubles';
	servingSide: Side;
	serviceCourt: ServiceCourt;
	serverPlayerId: string;
	receiverPlayerId: string;
	courtAssignments: CourtAssignments;
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}

export type ServiceState = SinglesServiceState | DoublesServiceState;

export interface ScoringConfig {
	maxGames: number;
	gamesToWin: number;
	pointsToWin: number;
	winBy: number;
	maxPoints: number;
	midGameIntervalPoint: number;
}

export const DEFAULT_BWF_SCORING_CONFIG: ScoringConfig = {
	maxGames: 3,
	gamesToWin: 2,
	pointsToWin: 21,
	winBy: 2,
	maxPoints: 30,
	midGameIntervalPoint: 11
};

export interface GameState {
	gameNo: number;
	score: GameScore;
	winnerSide: Side | null;
	midGameIntervalTaken: boolean;
	changeEndsRequired: boolean;
	changeEndsCompleted: boolean;
}

export interface MatchState {
	schemaVersion: 1;
	matchId: string;
	tournamentId: string;
	courtId: string | null;
	discipline: MatchDiscipline;
	status: MatchStatus;
	scoring: ScoringConfig;
	currentGameNo: number;
	games: GameState[];
	gamesWon: {
		A: number;
		B: number;
	};
	winnerSide: Side | null;
	terminalReason: TerminalReason | null;
	service: ServiceState | null;
	lastSeqNo: number;
	confirmedFromStatus?: MatchStatus | null;
	createdAt: string;
	updatedAt: string;
}

export interface ScoreEventInputBase {
	idempotencyKey: string;
	observedSeqNo: number;
	clientSeqNo?: number;
	clientCreatedAt?: string;
}

export type ScoreEventInput =
	| MatchStartedInput
	| GameStartedInput
	| RallyWonInput
	| UndoInput
	| CorrectionInput
	| LetCalledInput
	| MatchSuspendedInput
	| MatchResumedInput
	| SideForfeitedInput
	| SideRetiredInput
	| MatchConfirmedInput
	| MatchUnconfirmedInput;

export interface MatchStartedInput extends ScoreEventInputBase {
	type: 'match_started';
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}

export interface GameStartedInput extends ScoreEventInputBase {
	type: 'game_started';
	gameNo: number;
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}

export interface RallyWonInput extends ScoreEventInputBase {
	type: 'rally_won';
	side: Side;
}

export interface UndoInput extends ScoreEventInputBase {
	type: 'undo';
	targetSeqNo?: number;
	reason?: string;
	restoreState?: MatchState;
}

export interface CorrectionInput extends ScoreEventInputBase {
	type: 'correction';
	gameNo: number;
	score: GameScore;
	gamesWon?: {
		A: number;
		B: number;
	};
	service?: ServiceState | null;
	reason: string;
}

export interface LetCalledInput extends ScoreEventInputBase {
	type: 'let_called';
	reason:
		| 'receiver_not_ready'
		| 'both_faulted'
		| 'shuttle_caught_on_net'
		| 'shuttle_disintegrated'
		| 'line_judge_unsighted'
		| 'unforeseen_situation'
		| 'other';
	note?: string;
}

export interface MatchSuspendedInput extends ScoreEventInputBase {
	type: 'match_suspended';
	reason:
		| 'injury'
		| 'equipment'
		| 'court_condition'
		| 'power_failure'
		| 'weather'
		| 'referee_decision'
		| 'other';
	note?: string;
}

export interface MatchResumedInput extends ScoreEventInputBase {
	type: 'match_resumed';
	note?: string;
}

export interface SideForfeitedInput extends ScoreEventInputBase {
	type: 'side_forfeited';
	side: Side;
	reason: 'no_show' | 'withdrawal' | 'disqualification' | 'other';
	note?: string;
}

export interface SideRetiredInput extends ScoreEventInputBase {
	type: 'side_retired';
	side: Side;
	reason: 'injury' | 'illness' | 'other';
	note?: string;
}

export interface MatchConfirmedInput extends ScoreEventInputBase {
	type: 'match_confirmed';
	note?: string;
}

export interface MatchUnconfirmedInput extends ScoreEventInputBase {
	type: 'match_unconfirmed';
	note?: string;
}
