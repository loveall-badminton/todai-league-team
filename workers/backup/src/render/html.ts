import type { GameState, MatchPlayer } from '../../../../src/lib/domain/scoresheet';
import {
	buildScoresheetByGame,
	buildSheetColumns,
	type EventRow as SheetEventRow,
	type GameSheet,
	type SheetColumn
} from '../../../../src/lib/domain/scoresheet';
import type { BackupState } from '../types';
import type { EmergencyView, MatchView, ScoresheetView, SheetPlayer } from './view';
import { RUBBER_ORDER } from './view';

function esc(value: unknown): string {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

const STYLE = `
@page {
	size: A4;
	margin: 12mm;
}

body {
	font-family: 'Noto Sans JP', system-ui, sans-serif;
	font-size: 11pt;
	color: #111;
	margin: 0;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 9pt;
}

th,
td {
	border: 1px solid #333;
	padding: 3px 5px;
	text-align: left;
	vertical-align: top;
}

h1,
h2,
h3 {
	break-after: avoid;
}

.page-break {
	break-before: page;
}

.no-break {
	break-inside: avoid;
}

.critical {
	border: 2px solid #111;
	padding: 8px;
	margin: 8px 0;
}

.meta td:first-child {
	width: 12em;
	font-weight: 600;
}

ol.steps li {
	margin: 2px 0;
}

@page scoresheet {
	size: A4 landscape;
	margin: 10mm;
}

section.scoresheet {
	page: scoresheet;
	break-before: page;
}

.ss-title {
	text-align: center;
	font-size: 15pt;
	font-weight: 700;
	margin: 0 0 2mm;
}

.ss-subtitle {
	text-align: center;
	font-size: 9pt;
	margin: 0 0 3mm;
}

.ss-top {
	display: grid;
	grid-template-columns: 1fr 1.25fr 1fr;
	gap: 3mm;
	margin-bottom: 3mm;
}

.ss-panel {
	border: 1.5px solid #111;
	padding: 2mm;
}

.ss-panel table {
	font-size: 8.5pt;
}

.ss-panel td,
.ss-panel th {
	padding: 2px 4px;
}

.ss-panel td.label,
.ss-panel th.label {
	width: 5.5em;
	font-weight: 700;
	white-space: nowrap;
}

.ss-panel .fill {
	display: inline-block;
	min-width: 3em;
	border-bottom: 1px solid #111;
	padding: 0 2px;
	line-height: 1.1;
}

.ss-versus {
	font-size: 9pt;
	margin-bottom: 2mm;
}

.ss-versus table td {
	white-space: nowrap;
}

.ss-versus td.name {
	font-weight: 600;
}

.ss-note {
	font-size: 8pt;
	margin: 0 0 2mm;
}

.ss-block-title {
	font-size: 8pt;
	font-weight: 700;
	margin: 1.2mm 0 0.8mm;
}

table.ss-block {
	table-layout: fixed;
	border: 2px solid #111;
	margin-bottom: 1.6mm;
}

table.ss-block td {
	height: 5.6mm;
	padding: 0;
	font-size: 8pt;
	text-align: center;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	vertical-align: middle;
}

table.ss-block td.ss-name {
	width: 40mm;
	padding: 0 3px;
	text-align: left;
	font-weight: 600;
	white-space: nowrap;
}

table.ss-block td.ss-sr {
	width: 6mm;
	font-weight: 700;
	border-right: 2px solid #111;
}

table.ss-block td.cell {
	width: calc((100% - 46mm) / 28);
}

table.ss-block td.service-over {
	border-right: 2px solid #111;
}

.ss-footer {
	border: 1.5px solid #111;
	padding: 2mm;
	margin-top: 2mm;
}

.ss-footer h3 {
	font-size: 9pt;
	margin: 0 0 1.5mm;
}

.ss-remarks-line {
	height: 5.5mm;
	border-bottom: 1px solid #111;
}

.ss-signatures {
	display: grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 6mm;
	margin-top: 3mm;
	font-size: 9pt;
}

.ss-signatures span.line {
	display: inline-block;
	min-width: 30mm;
	border-bottom: 1px solid #111;
}
`;

const PROCEDURE_STEPS = [
	'本部PCで emergency.html または emergency.pdf を開く。開けない場合はバックアップ配信URL(ブックマーク済み)を開く。',
	'必要ページを印刷する。',
	'各コートに紙スコアシートを配布する。',
	'以後の得点は紙に記録する。',
	'本部は団体戦進行表に転記する。',
	'システム復旧後、最終イベント番号以降を手入力する。',
	'紙とシステムの勝敗・スコアを照合する。'
];

const REENTRY_STEPS = [
	'state.json で障害発生直前の状態を確認する。',
	'event-log.ndjson で最後に反映済みのイベントを確認する。',
	'紙スコアシートの内容を時系列に入力する。',
	'団体戦勝敗を再計算・確認する。',
	'紙の最終結果とシステムの最終結果を照合し、差分があれば修正イベントとして記録する。'
];

const BLOCK_COLUMNS = 28;
const MIN_BLOCKS_PER_SHEET = 6;
const TERMINAL_MATCH_STATUSES = new Set([
	'finished',
	'confirmed',
	'forfeited',
	'retired',
	'cancelled'
]);

interface RenderColumn {
	values: Map<string, string>;
	serviceOver: boolean;
}

interface RenderBlock {
	title: string;
	srMarks: Map<string, 'S' | 'R'>;
	columns: RenderColumn[];
}

function stepsHtml(steps: string[]): string {
	return `<ol class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
}

function matchRowsHtml(matches: MatchView[], withCourt: boolean): string {
	if (matches.length === 0) {
		return `<tr><td colspan="${withCourt ? 6 : 5}">なし</td></tr>`;
	}
	return matches
		.map(
			(mv) => `<tr>
	${withCourt ? `<td>${esc(mv.match.court_name ?? '未割当')}</td>` : ''}
	<td>${esc(mv.tieLabel)}</td>
	<td>${esc(mv.rubberCode)}</td>
	<td>${esc(mv.playersLabel)}</td>
	<td>${esc(mv.currentScoreLabel)}</td>
	<td>${esc(mv.statusLabel)}${mv.match.current_serving_side ? ` / サーブ:${esc(mv.match.current_serving_side)}` : ''}</td>
</tr>`
		)
		.join('\n');
}

function gameScoreLabel(score: { a: number; b: number } | null): string {
	return score ? `${score.a} ： ${score.b}` : '____ ： ____';
}

function formatDateJst(iso: string): string {
	return new Intl.DateTimeFormat('ja-JP', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(iso));
}

function basePlayers(sv: ScoresheetView): SheetPlayer[] {
	if (sv.matchView?.players.length) {
		return sv.matchView.players
			.slice()
			.sort((a, b) => a.side.localeCompare(b.side) || a.order - b.order);
	}

	return [
		{ id: `${sv.tieLabel}:${sv.rubberCode}:A1`, side: 'A', order: 1, name: sv.namesA[0] },
		{ id: `${sv.tieLabel}:${sv.rubberCode}:A2`, side: 'A', order: 2, name: sv.namesA[1] },
		{ id: `${sv.tieLabel}:${sv.rubberCode}:B1`, side: 'B', order: 1, name: sv.namesB[0] },
		{ id: `${sv.tieLabel}:${sv.rubberCode}:B2`, side: 'B', order: 2, name: sv.namesB[1] }
	];
}

function sheetDataForMatch(
	mv: MatchView,
	state: BackupState
): { sheets: GameSheet[]; players: MatchPlayer[] } {
	const events: SheetEventRow[] = state.scoreEvents
		.filter((e) => e.match_id === mv.match.id)
		.map((e) => ({
			seqNo: e.seq_no,
			eventType: e.event_type,
			side: e.side,
			gameNo: e.game_no,
			scoreAAfter: e.score_a_after,
			scoreBAfter: e.score_b_after,
			serverPlayerIdBefore: e.server_player_id_before,
			serverPlayerIdAfter: e.server_player_id_after,
			receiverPlayerIdBefore: e.receiver_player_id_before,
			receiverPlayerIdAfter: e.receiver_player_id_after,
			targetSeqNo: e.target_seq_no
		}));
	const games: GameState[] = mv.games.map((g) => ({
		gameNo: g.gameNo,
		score: g.score,
		winnerSide: g.winnerSide,
		midGameIntervalTaken: false,
		changeEndsRequired: false,
		changeEndsCompleted: false
	}));
	const players: MatchPlayer[] = mv.players.map((p) => ({
		id: p.id,
		side: p.side,
		order: p.order === 2 ? 2 : 1,
		name: p.name
	}));

	return {
		sheets: buildScoresheetByGame(events, games, players),
		players
	};
}

function chunkSheetColumns(columns: SheetColumn[]): SheetColumn[][] {
	if (columns.length === 0) return [[]];

	const chunks: SheetColumn[][] = [];
	for (let index = 0; index < columns.length; index += BLOCK_COLUMNS) {
		chunks.push(columns.slice(index, index + BLOCK_COLUMNS));
	}
	return chunks;
}

function renderColumns(source: SheetColumn[]): RenderColumn[] {
	return source.map((column) => ({
		values: new Map(
			column.cells.map((cell) => [
				cell.playerId,
				String(cell.side === 'A' ? cell.scoreA : cell.scoreB)
			])
		),
		serviceOver: column.serviceOver
	}));
}

function blocksForGame(sheet: GameSheet, gameIndex: number): RenderBlock[] {
	const columns = buildSheetColumns(sheet);
	const chunks = chunkSheetColumns(columns);
	const firstServer = sheet.serviceRuns.find((run) => !run.isPlaceholder)?.serverPlayerId;
	const firstReceiver = sheet.serviceRuns.find((run) => run.isPlaceholder)?.serverPlayerId;

	return chunks.map((chunk, blockIndex) => {
		const srMarks = new Map<string, 'S' | 'R'>();
		if (blockIndex === 0) {
			if (firstServer) srMarks.set(firstServer, 'S');
			if (firstReceiver) srMarks.set(firstReceiver, 'R');
		}

		const titleParts = [`第${gameIndex + 1}ゲーム`];
		if (blockIndex > 0) titleParts.push(`続き ${blockIndex + 1}`);
		if (blockIndex === 0 && sheet.winnerSide) {
			titleParts.push(`(${sheet.finalScoreA} - ${sheet.finalScoreB})`);
		}

		return {
			title: titleParts.join(' '),
			srMarks,
			columns: renderColumns(chunk)
		};
	});
}

function blankBlock(title: string): RenderBlock {
	return {
		title,
		srMarks: new Map(),
		columns: []
	};
}

function buildBlocks(sv: ScoresheetView, state: BackupState): RenderBlock[] {
	const blocks: RenderBlock[] = [];

	if (sv.matchView) {
		const { sheets } = sheetDataForMatch(sv.matchView, state);
		for (let gameIndex = 0; gameIndex < sheets.length; gameIndex += 1) {
			blocks.push(...blocksForGame(sheets[gameIndex], gameIndex));
		}
	}

	const usedGameTitles = new Set(
		blocks
			.map((block) => block.title.match(/^第(\d+)ゲーム/u)?.[1])
			.filter((value): value is string => value !== undefined)
	);

	for (const gameNo of [1, 2, 3]) {
		if (!usedGameTitles.has(String(gameNo))) {
			blocks.push(blankBlock(`第${gameNo}ゲーム`));
		}
	}

	while (blocks.length < MIN_BLOCKS_PER_SHEET) {
		blocks.push(blankBlock(`予備 ${blocks.length - 2}`));
	}

	return blocks.slice(0, Math.max(MIN_BLOCKS_PER_SHEET, blocks.length));
}

function blockTableHtml(players: SheetPlayer[], block: RenderBlock): string {
	const rows = players.map((player) => {
		const rowColumns = Array.from({ length: BLOCK_COLUMNS }, (_, index) => {
			const column = block.columns[index];
			const value = column?.values.get(player.id) ?? '';
			return `<td class="cell${column?.serviceOver ? ' service-over' : ''}">${esc(value)}</td>`;
		}).join('');

		return `<tr>
	<td class="ss-name">${esc(player.name || '________________')}</td>
	<td class="ss-sr">${esc(block.srMarks.get(player.id) ?? '')}</td>
${rowColumns}
</tr>`;
	});

	return `<div class="ss-block-title">${esc(block.title)}</div>
<table class="ss-block sheet-grid">
	<tbody>
${rows.join('\n')}
	</tbody>
</table>`;
}

function scoresheetHtml(sv: ScoresheetView, state: BackupState): string {
	const players = basePlayers(sv);
	const dateSource =
		sv.matchView?.match.actual_start_at ??
		sv.matchView?.match.scheduled_start_at ??
		state.generatedAt;
	const blocks = buildBlocks(sv, state);
	const isFinished = sv.matchView ? TERMINAL_MATCH_STATUSES.has(sv.matchView.match.status) : false;

	return `<section class="scoresheet">
<h2 class="ss-title">バドミントン・ダブルス用スコアシート</h2>
<div class="ss-subtitle">${esc(sv.tieLabel)} / ${esc(sv.rubberCode)}${sv.matchNo ? ` / 試合番号 ${sv.matchNo}` : ''}</div>

<div class="ss-top">
	<div class="ss-panel">
		<table>
			<tbody>
				<tr><td class="label">試合番号</td><td>${esc(sv.matchNo ?? '________')}</td></tr>
				<tr><td class="label">種目</td><td>${esc(sv.rubberCode)}</td></tr>
				<tr><td class="label">コート</td><td>${esc(sv.courtName ?? '________')}</td></tr>
				<tr><td class="label">日付</td><td>${esc(formatDateJst(dateSource))}</td></tr>
				<tr><td class="label">団体戦</td><td>${esc(sv.tieLabel)}</td></tr>
				<tr><td class="label">ラウンド</td><td>${esc(sv.roundLabel ?? '________')}</td></tr>
			</tbody>
		</table>
	</div>

	<div class="ss-panel">
		<div class="ss-versus">
			<table>
				<tbody>
					<tr><td class="label">左側ペア</td><td class="name">${esc(sv.namesA[0] || '________________')}</td><td>：</td><td class="name">${esc(sv.namesB[0] || '________________')}</td><td class="label">右側ペア</td></tr>
					<tr><td></td><td class="name">${esc(sv.namesA[1] || '________________')}</td><td>：</td><td class="name">${esc(sv.namesB[1] || '________________')}</td><td></td></tr>
					<tr><td class="label">所属</td><td>${esc(sv.teamAName || '________________')}</td><td>：</td><td>${esc(sv.teamBName || '________________')}</td><td class="label"></td></tr>
					<tr><td class="label">開始サイド</td><td colspan="3">左側ペア □ 左 □ 右 / 右側ペア □ 左 □ 右</td><td></td></tr>
				</tbody>
			</table>
		</div>
		<table>
			<tbody>
				<tr><td class="label">第1ゲーム</td><td>${esc(gameScoreLabel(sv.gameScores[0] ?? null))}</td></tr>
				<tr><td class="label">第2ゲーム</td><td>${esc(gameScoreLabel(sv.gameScores[1] ?? null))}</td></tr>
				<tr><td class="label">第3ゲーム</td><td>${esc(gameScoreLabel(sv.gameScores[2] ?? null))}</td></tr>
			</tbody>
		</table>
	</div>

	<div class="ss-panel">
		<table>
			<tbody>
				<tr><td class="label">主審</td><td>________________</td></tr>
				<tr><td class="label">サービスジャッジ</td><td>________________</td></tr>
				<tr><td class="label">開始</td><td>${esc(sv.startAtJst ?? '________')}</td></tr>
				<tr><td class="label">終了</td><td>________</td></tr>
				<tr><td class="label">試合時間</td><td>______ 分</td></tr>
				<tr><td class="label">シャトル数</td><td>______</td></tr>
			</tbody>
		</table>
	</div>
</div>

<p class="ss-note">
	得点は「ラリーに勝った側」ではなく、「次にサービスする選手の行」に記録する。S/R欄は各ゲーム開始時の初期サーバー / 初期レシーバーを示す。
</p>

${blocks.map((block) => blockTableHtml(players, block)).join('\n')}

<div class="ss-footer">
	<h3>備考</h3>
	<div class="ss-remarks-line"></div>
	<div class="ss-remarks-line"></div>
	<div class="ss-remarks-line"></div>
	<div class="ss-signatures">
		<div>主審署名 <span class="line"></span></div>
		<div>レフェリー署名 <span class="line"></span></div>
		<div>結果確認 <span class="line"></span></div>
	</div>
</div>

${isFinished ? '<p class="ss-note">この試合は終了済みです。</p>' : ''}
</section>`;
}

export function renderEmergencyHtml(view: EmergencyView): string {
	const { state } = view;
	const lastUpdated = state.recentEvents.at(-1)?.created_at;

	const courtRows =
		view.courts.length === 0
			? '<tr><td colspan="6">コート情報なし</td></tr>'
			: view.courts
					.map((c) => {
						const mv = c.current;
						return `<tr>
	<td>${esc(c.courtName)}</td>
	<td>${esc(mv?.statusLabel ?? '空き')}</td>
	<td>${esc(mv?.tieLabel ?? '-')}</td>
	<td>${esc(mv?.rubberCode ?? '-')}</td>
	<td>${esc(mv?.currentScoreLabel ?? '-')}</td>
	<td>${esc(mv?.playersLabel ?? '')}</td>
</tr>`;
					})
					.join('\n');

	const tieRows =
		view.ties.length === 0
			? `<tr><td colspan="${RUBBER_ORDER.length + 2}">なし</td></tr>`
			: view.ties
					.map(
						(tv) =>
							`<tr><td>${esc(tv.label)}</td>${tv.rubberCells
								.map((c) => `<td>${esc(c)}</td>`)
								.join('')}<td>${esc(tv.resultLabel)}</td></tr>`
					)
					.join('\n');

	const pendingRows =
		view.pendingMatches.length === 0
			? '<tr><td colspan="5">なし</td></tr>'
			: view.pendingMatches
					.map(
						(mv, i) => `<tr>
	<td style="text-align:right">${i + 1}</td>
	<td>${esc(mv.tieLabel)}</td>
	<td>${esc(mv.rubberCode)}</td>
	<td>${esc(mv.match.court_name ?? '未定')}</td>
	<td>${esc(mv.playersLabel)}</td>
</tr>`
					)
					.join('\n');

	const scoresheets =
		view.scoresheets.length === 0
			? ''
			: view.scoresheets.map((sv) => scoresheetHtml(sv, state)).join('\n');

	return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>緊急運営継続パケット — ${esc(state.tournamentName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
	href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap"
	rel="stylesheet"
/>
<style>${STYLE}</style>
</head>
<body>

<h1>緊急運営継続パケット</h1>
<div class="critical">
	<strong>システム障害時は、この資料を正として大会運営を継続する。</strong><br />
	紙運用開始後の得点記録は、最終イベント番号 <strong>${state.lastEventId}</strong> の次(<strong>${state.lastEventId + 1}</strong>)から通し番号を振ること。
</div>
<table class="meta">
	<tr><td>大会名</td><td>${esc(state.tournamentName)}</td></tr>
	<tr><td>生成時刻</td><td>${esc(view.generatedAtJst)}</td></tr>
	<tr><td>最終イベント番号</td><td>${state.lastEventId}</td></tr>
	<tr><td>最終更新時刻</td><td>${esc(lastUpdated ?? '-')}</td></tr>
</table>

<h2>障害時の運営手順</h2>
<div class="no-break">${stepsHtml(PROCEDURE_STEPS)}</div>

<h2>コート別進行状況</h2>
<table class="no-break">
	<thead><tr><th>コート</th><th>状態</th><th>対戦</th><th>種目</th><th>現在スコア</th><th>備考</th></tr></thead>
	<tbody>
${courtRows}
	</tbody>
</table>

<h2 class="page-break">団体戦別勝敗状況</h2>
<table>
	<thead><tr><th>対戦</th>${RUBBER_ORDER.map((c) => `<th>${c}</th>`).join('')}<th>勝敗</th></tr></thead>
	<tbody>
${tieRows}
	</tbody>
</table>

<h2>オーダー表</h2>
<table class="no-break">
	<thead><tr><th>対戦</th><th>チーム</th><th>状態</th>${RUBBER_ORDER.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
	<tbody>
${
	view.lineups.length === 0
		? `<tr><td colspan="${RUBBER_ORDER.length + 3}">提出済みオーダーなし</td></tr>`
		: view.lineups
				.map(
					(lv) =>
						`<tr><td>${esc(lv.tieLabel)}</td><td>${esc(lv.teamName)}</td><td>${esc(lv.statusLabel)}</td>${lv.pairCells
							.map((c) => `<td>${esc(c)}</td>`)
							.join('')}</tr>`
				)
				.join('\n')
}
	</tbody>
</table>

<h2>実施中試合</h2>
<table class="no-break">
	<thead><tr><th>コート</th><th>対戦</th><th>種目</th><th>選手</th><th>スコア</th><th>サーバー/備考</th></tr></thead>
	<tbody>
${matchRowsHtml(view.activeMatches, true)}
	</tbody>
</table>

<h2>未実施試合</h2>
<table class="no-break">
	<thead><tr><th style="text-align:right">優先</th><th>対戦</th><th>種目</th><th>コート候補</th><th>選手</th></tr></thead>
	<tbody>
${pendingRows}
	</tbody>
</table>

<h2>完了済み試合</h2>
<table class="no-break">
	<thead><tr><th>対戦</th><th>種目</th><th>選手</th><th>スコア</th><th>結果</th></tr></thead>
	<tbody>
${matchRowsHtml(view.finishedMatches, false)}
	</tbody>
</table>

<h2>復旧後の再入力手順</h2>
<div class="no-break">${stepsHtml(REENTRY_STEPS)}</div>

${scoresheets}

</body>
</html>`;
}
