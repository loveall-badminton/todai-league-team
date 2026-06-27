-- match_sides が不足している場合に挿入する
INSERT OR IGNORE INTO match_sides (id, match_id, side, display_name, created_at, updated_at)
SELECT
	'ms-' || m.id || '-A',
	m.id,
	'A',
	(SELECT name FROM teams WHERE id = ti.team_a_id),
	datetime('now'),
	datetime('now')
FROM matches m
JOIN rubbers r ON r.match_id = m.id
JOIN ties ti ON ti.id = r.tie_id;

INSERT OR IGNORE INTO match_sides (id, match_id, side, display_name, created_at, updated_at)
SELECT
	'ms-' || m.id || '-B',
	m.id,
	'B',
	(SELECT name FROM teams WHERE id = ti.team_b_id),
	datetime('now'),
	datetime('now')
FROM matches m
JOIN rubbers r ON r.match_id = m.id
JOIN ties ti ON ti.id = r.tie_id;

-- match_side_players が不足している場合に挿入する（各サイド2名）
INSERT OR IGNORE INTO match_side_players (id, match_id, match_side_id, side, player_order, name, team_name, created_at, updated_at)
SELECT
	'msp-' || m.id || '-A-1',
	m.id,
	'ms-' || m.id || '-A',
	'A',
	1,
	(SELECT name FROM team_players WHERE team_id = ti.team_a_id ORDER BY display_order LIMIT 1 OFFSET 0),
	(SELECT name FROM teams WHERE id = ti.team_a_id),
	datetime('now'),
	datetime('now')
FROM matches m
JOIN rubbers r ON r.match_id = m.id
JOIN ties ti ON ti.id = r.tie_id;

INSERT OR IGNORE INTO match_side_players (id, match_id, match_side_id, side, player_order, name, team_name, created_at, updated_at)
SELECT
	'msp-' || m.id || '-A-2',
	m.id,
	'ms-' || m.id || '-A',
	'A',
	2,
	(SELECT name FROM team_players WHERE team_id = ti.team_a_id ORDER BY display_order LIMIT 1 OFFSET 1),
	(SELECT name FROM teams WHERE id = ti.team_a_id),
	datetime('now'),
	datetime('now')
FROM matches m
JOIN rubbers r ON r.match_id = m.id
JOIN ties ti ON ti.id = r.tie_id;

INSERT OR IGNORE INTO match_side_players (id, match_id, match_side_id, side, player_order, name, team_name, created_at, updated_at)
SELECT
	'msp-' || m.id || '-B-1',
	m.id,
	'ms-' || m.id || '-B',
	'B',
	1,
	(SELECT name FROM team_players WHERE team_id = ti.team_b_id ORDER BY display_order LIMIT 1 OFFSET 0),
	(SELECT name FROM teams WHERE id = ti.team_b_id),
	datetime('now'),
	datetime('now')
FROM matches m
JOIN rubbers r ON r.match_id = m.id
JOIN ties ti ON ti.id = r.tie_id;

INSERT OR IGNORE INTO match_side_players (id, match_id, match_side_id, side, player_order, name, team_name, created_at, updated_at)
SELECT
	'msp-' || m.id || '-B-2',
	m.id,
	'ms-' || m.id || '-B',
	'B',
	2,
	(SELECT name FROM team_players WHERE team_id = ti.team_b_id ORDER BY display_order LIMIT 1 OFFSET 1),
	(SELECT name FROM teams WHERE id = ti.team_b_id),
	datetime('now'),
	datetime('now')
FROM matches m
JOIN rubbers r ON r.match_id = m.id
JOIN ties ti ON ti.id = r.tie_id;
