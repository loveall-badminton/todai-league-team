import type { EventRow } from '../types';

export function renderEventLogNdjson(events: EventRow[]): string {
	return (
		events
			.map((e) =>
				JSON.stringify({
					id: e.global_id,
					eventId: e.id,
					matchId: e.match_id,
					seqNo: e.seq_no,
					type: e.event_type,
					side: e.side,
					gameNo: e.game_no,
					scoreA: e.score_a_after,
					scoreB: e.score_b_after,
					actor: e.actor_name,
					createdAt: e.created_at
				})
			)
			.join('\n') + '\n'
	);
}
