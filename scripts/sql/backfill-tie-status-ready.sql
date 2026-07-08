-- 「オーダー公開のみ」を表す ties.status='ready' を廃止したため、既存データを移行する。
-- ready は「オーダー公開済み・対戦未開始」を意味していたので、
-- lineup_submitted に戻す(lineups_revealed_at は保持し、公開状態はそのまま維持する)。
UPDATE ties
SET status = 'lineup_submitted'
WHERE status = 'ready';
