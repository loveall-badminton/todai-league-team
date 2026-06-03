import type {
	CourtAssignments,
	DoublesServiceState,
	GameScore,
	MatchPlayer,
	ServiceCourt,
	Side,
	SinglesServiceState
} from './types';

export function otherSide(side: Side): Side {
	return side === 'A' ? 'B' : 'A';
}

export function otherCourt(court: ServiceCourt): ServiceCourt {
	return court === 'right' ? 'left' : 'right';
}

export function serviceCourtForScore(score: number): ServiceCourt {
	return score % 2 === 0 ? 'right' : 'left';
}

export function scoreOfSide(score: GameScore, side: Side): number {
	return side === 'A' ? score.A : score.B;
}

export function playerOnCourt(
	assignments: CourtAssignments,
	side: Side,
	court: ServiceCourt
): string {
	return assignments[side][court];
}

export function swapCourtsForSide(assignments: CourtAssignments, side: Side): CourtAssignments {
	return {
		...assignments,
		[side]: {
			right: assignments[side].left,
			left: assignments[side].right
		}
	};
}

export function sideOfPlayer(players: MatchPlayer[], playerId: string): Side {
	const player = players.find((p) => p.id === playerId);
	if (!player) throw new Error(`Player not found: ${playerId}`);
	return player.side;
}

export function validateDoublesPlayers(players: MatchPlayer[]): void {
	if (players.filter((p) => p.side === 'A').length !== 2) {
		throw new Error('Doubles match requires exactly two players on side A');
	}
	if (players.filter((p) => p.side === 'B').length !== 2) {
		throw new Error('Doubles match requires exactly two players on side B');
	}
}

export function createInitialSinglesServiceState(params: {
	players: MatchPlayer[];
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}): SinglesServiceState {
	const { players, initialServerPlayerId, initialReceiverPlayerId } = params;
	const servingSide = sideOfPlayer(players, initialServerPlayerId);
	if (sideOfPlayer(players, initialReceiverPlayerId) !== otherSide(servingSide)) {
		throw new Error('Initial receiver must belong to the opposite side');
	}

	return {
		discipline: 'singles',
		servingSide,
		serviceCourt: 'right',
		serverPlayerId: initialServerPlayerId,
		receiverPlayerId: initialReceiverPlayerId
	};
}

export function createInitialDoublesServiceState(params: {
	players: MatchPlayer[];
	initialServerPlayerId: string;
	initialReceiverPlayerId: string;
}): DoublesServiceState {
	const { players, initialServerPlayerId, initialReceiverPlayerId } = params;
	validateDoublesPlayers(players);

	const servingSide = sideOfPlayer(players, initialServerPlayerId);
	const receivingSide = otherSide(servingSide);
	if (sideOfPlayer(players, initialReceiverPlayerId) !== receivingSide) {
		throw new Error('Initial receiver must belong to the receiving side');
	}

	const servingPlayers = players.filter((p) => p.side === servingSide);
	const receivingPlayers = players.filter((p) => p.side === receivingSide);
	const serverPartner = servingPlayers.find((p) => p.id !== initialServerPlayerId);
	const receiverPartner = receivingPlayers.find((p) => p.id !== initialReceiverPlayerId);
	if (!serverPartner || !receiverPartner) throw new Error('Invalid doubles pair');

	const courtAssignments: CourtAssignments =
		servingSide === 'A'
			? {
					A: { right: initialServerPlayerId, left: serverPartner.id },
					B: { right: initialReceiverPlayerId, left: receiverPartner.id }
				}
			: {
					A: { right: initialReceiverPlayerId, left: receiverPartner.id },
					B: { right: initialServerPlayerId, left: serverPartner.id }
				};

	return {
		discipline: 'doubles',
		servingSide,
		serviceCourt: 'right',
		serverPlayerId: initialServerPlayerId,
		receiverPlayerId: initialReceiverPlayerId,
		courtAssignments,
		initialServerPlayerId,
		initialReceiverPlayerId
	};
}

export function applySinglesServiceAfterRally(params: {
	before: SinglesServiceState;
	scoreAfter: GameScore;
	rallyWinner: Side;
	players: MatchPlayer[];
}): SinglesServiceState {
	const { before, scoreAfter, rallyWinner, players } = params;
	const servingSide = rallyWinner === before.servingSide ? before.servingSide : rallyWinner;
	const serviceCourt = serviceCourtForScore(scoreOfSide(scoreAfter, servingSide));

	if (servingSide === before.servingSide) {
		return { ...before, serviceCourt };
	}

	const serverPlayer = players.find((p) => p.side === servingSide);
	const receiverPlayer = players.find((p) => p.side === otherSide(servingSide));
	if (!serverPlayer || !receiverPlayer)
		throw new Error('Singles match requires one player per side');

	return {
		discipline: 'singles',
		servingSide,
		serviceCourt,
		serverPlayerId: serverPlayer.id,
		receiverPlayerId: receiverPlayer.id
	};
}

export function applyDoublesServiceAfterRally(params: {
	before: DoublesServiceState;
	scoreAfter: GameScore;
	rallyWinner: Side;
}): DoublesServiceState {
	const { before, scoreAfter, rallyWinner } = params;
	const previousServingSide = before.servingSide;
	const previousReceivingSide = otherSide(previousServingSide);

	if (rallyWinner === previousServingSide) {
		const courtAssignments = swapCourtsForSide(before.courtAssignments, previousServingSide);
		const serviceCourt = serviceCourtForScore(scoreOfSide(scoreAfter, previousServingSide));
		return {
			...before,
			serviceCourt,
			serverPlayerId: before.serverPlayerId,
			receiverPlayerId: playerOnCourt(courtAssignments, previousReceivingSide, serviceCourt),
			courtAssignments
		};
	}

	const newServingSide = previousReceivingSide;
	const newReceivingSide = previousServingSide;
	const serviceCourt = serviceCourtForScore(scoreOfSide(scoreAfter, newServingSide));

	return {
		...before,
		servingSide: newServingSide,
		serviceCourt,
		serverPlayerId: playerOnCourt(before.courtAssignments, newServingSide, serviceCourt),
		receiverPlayerId: playerOnCourt(before.courtAssignments, newReceivingSide, serviceCourt)
	};
}
