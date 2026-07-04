import type { EmergencyView, MatchView } from './view';
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
	/* Browser Run のヘッドレス Chrome には日本語フォントが無く中華フォントで
	   代替されるため、Webフォント (Noto Sans JP) を明示的に読み込む */
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

.sheet-header {
	margin: 4px 0;
	font-size: 10pt;
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

function scoreSheetHtml(mv: MatchView, courtName: string, lastEventId: number): string {
	const startNo = lastEventId + 1;
	const rows = Array.from({ length: 20 }, (_, i) => {
		return `<tr><td style="text-align:right">${startNo + i}</td><td style="width:6em"></td><td style="width:6em"></td><td style="width:4em"></td><td style="width:4em"></td><td></td></tr>`;
	}).join('\n');

	return `<section class="page-break no-break">
	<h2>紙スコアシート — コート ${esc(courtName)}</h2>
	<div class="sheet-header">
		<div>対戦: ${esc(mv.tieLabel)}</div>
		<div>種目: ${esc(mv.rubberCode)}</div>
		<div>選手: ${esc(mv.playersLabel)}</div>
		<div>現在スコア: ${esc(mv.currentScoreLabel)}</div>
		<div><strong>以後は下の表に手書きで記録する。Home = ${esc(mv.sideAName)} / Away = ${esc(mv.sideBName)}</strong></div>
	</div>
	<table>
		<thead>
			<tr><th style="text-align:right">No</th><th>時刻</th><th>得点側</th><th>Home</th><th>Away</th><th>備考</th></tr>
		</thead>
		<tbody>
${rows}
		</tbody>
	</table>
</section>`;
}

function blankScoreSheetHtml(courtName: string, lastEventId: number): string {
	const startNo = lastEventId + 1;
	const rows = Array.from({ length: 20 }, (_, i) => {
		return `<tr><td style="text-align:right">${startNo + i}</td><td></td><td></td><td></td><td></td><td></td></tr>`;
	}).join('\n');
	return `<section class="page-break no-break">
	<h2>紙スコアシート — コート ${esc(courtName)}(試合なし・予備)</h2>
	<div class="sheet-header">
		<div>対戦: ________________________ 種目: ________ 選手: ________________________</div>
	</div>
	<table>
		<thead>
			<tr><th style="text-align:right">No</th><th>時刻</th><th>得点側</th><th>Home</th><th>Away</th><th>備考</th></tr>
		</thead>
		<tbody>
${rows}
		</tbody>
	</table>
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

	const sheets = view.courts
		.map((c) =>
			c.current
				? scoreSheetHtml(c.current, c.courtName, state.lastEventId)
				: blankScoreSheetHtml(c.courtName, state.lastEventId)
		)
		.join('\n');

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

${sheets}

</body>
</html>`;
}
