import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockUpdateTieSchedule = vi.hoisted(() => vi.fn());
const mockAssignOfficiatingTeams = vi.hoisted(() => vi.fn());
const mockNotifyLiveBoard = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/repositories/tokyoLeagueRepository', () => ({
	assignOfficiatingTeams: mockAssignOfficiatingTeams,
	updateTieSchedule: mockUpdateTieSchedule
}));

vi.mock('$lib/server/realtime/broadcast', () => ({
	notifyLiveBoard: mockNotifyLiveBoard
}));

import { persistUpdateTie } from './updateTieForm';

describe('persistUpdateTie', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('normalizes empty inputs and deduplicates officiating team ids before persisting', async () => {
		await persistUpdateTie({
			id: 'tie-1',
			tieCode: 'A-1',
			scheduledStartAt: ' 2026-07-02T10:00:00.000Z ',
			venue: 'first_gym',
			courtBlockCode: '  ',
			lineupDueAt: '',
			operationNote: '  note  ',
			scheduleChanged: 'on',
			assignedTeamIds: ['team-a', 'team-a', ' team-b ', '', 'team-b'],
			officiatingNote: '  umpire  ',
			now: '2026-07-02T00:00:00.000Z'
		});

		expect(mockUpdateTieSchedule).toHaveBeenCalledWith({
			id: 'tie-1',
			tieCode: 'A-1',
			scheduledStartAt: '2026-07-02T10:00:00.000Z',
			venue: 'first_gym',
			courtBlockCode: null,
			lineupDueAt: null,
			operationNote: 'note',
			scheduleChanged: true,
			now: '2026-07-02T00:00:00.000Z'
		});
		expect(mockAssignOfficiatingTeams).toHaveBeenCalledWith({
			tieId: 'tie-1',
			assignedTeamIds: ['team-a', 'team-b'],
			note: 'umpire',
			now: '2026-07-02T00:00:00.000Z'
		});
		expect(mockNotifyLiveBoard).toHaveBeenCalledWith(['schedule'], {
			schedule: { tieIds: ['tie-1'], scopes: ['tie_header', 'lineups'] }
		});
	});

	test('maps invalid venue strings to null and scheduleChanged off to false', async () => {
		await persistUpdateTie({
			id: 'tie-2',
			tieCode: 'A-2',
			venue: 'invalid',
			scheduleChanged: '',
			now: '2026-07-02T00:00:00.000Z'
		});

		expect(mockUpdateTieSchedule).toHaveBeenCalledWith({
			id: 'tie-2',
			tieCode: 'A-2',
			scheduledStartAt: null,
			venue: null,
			courtBlockCode: null,
			lineupDueAt: null,
			operationNote: null,
			scheduleChanged: false,
			now: '2026-07-02T00:00:00.000Z'
		});
		expect(mockAssignOfficiatingTeams).toHaveBeenCalledWith({
			tieId: 'tie-2',
			assignedTeamIds: [],
			note: null,
			now: '2026-07-02T00:00:00.000Z'
		});
	});
});
