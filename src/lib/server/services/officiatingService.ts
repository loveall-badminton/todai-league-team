export type OfficiatingAssignmentStatus = 'scheduled' | 'confirmed' | 'changed' | 'cancelled';

export type OfficiatingAssignmentForDecision = {
	assignedTeamId: string | null;
	note: string | null;
	status: OfficiatingAssignmentStatus;
};

export type TieForOfficiatingCheck = {
	officiatingTeamId?: string | null;
	officiatingTeamName?: string | null;
	officiatingTeamIds?: string[] | null;
	officiatingTeamNames?: string[] | null;
};

export function nextOfficiatingAssignmentStatus(params: {
	existing: OfficiatingAssignmentForDecision | null;
	assignedTeamId: string | null;
	note: string | null;
}): OfficiatingAssignmentStatus {
	if (!params.existing) return 'scheduled';
	if (
		params.existing.assignedTeamId !== params.assignedTeamId ||
		(params.existing.note ?? null) !== (params.note ?? null)
	) {
		return 'changed';
	}
	return params.existing.status;
}

export function listUnassignedOfficiatingTies<TTie extends TieForOfficiatingCheck>(
	ties: TTie[]
): TTie[] {
	return ties.filter((tie) => {
		if (tie.officiatingTeamIds && tie.officiatingTeamIds.length > 0) return false;
		if (tie.officiatingTeamNames && tie.officiatingTeamNames.length > 0) return false;
		return !tie.officiatingTeamId && !tie.officiatingTeamName;
	});
}
