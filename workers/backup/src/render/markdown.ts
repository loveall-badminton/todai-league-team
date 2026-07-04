import type { EmergencyView } from './view';
import { RUBBER_ORDER } from './view';

function cell(value: unknown): string {
	return String(value ?? '')
		.replaceAll('|', '\\|')
		.replaceAll('\n', ' ');
}

export function renderEmergencyMarkdown(view: EmergencyView): string {
	const { state } = view;
	const lines: string[] = [];

	lines.push('# 緊急運営継続パケット');
	lines.push('');
	lines.push(`大会: ${state.tournamentName}`);
	lines.push(`生成時刻: ${view.generatedAtJst}`);
	lines.push(`最終イベント番号: ${state.lastEventId}`);
	lines.push('');

	lines.push('## 現在の進行状況');
	lines.push('');
	lines.push('| コート | 状態 | 対戦 | 試合 | 現在スコア | 備考 |');
	lines.push('| ------ | ---- | ---- | ---- | ---------- | ---- |');
	for (const c of view.courts) {
		const mv = c.current;
		lines.push(
			`| ${cell(c.courtName)} | ${cell(mv?.statusLabel ?? '空き')} | ${cell(mv?.tieLabel ?? '-')} | ${cell(
				mv?.rubberCode ?? '-'
			)} | ${cell(mv?.currentScoreLabel ?? '-')} | ${cell(mv?.playersLabel ?? '')} |`
		);
	}
	lines.push('');

	lines.push('## 団体戦結果');
	lines.push('');
	lines.push(`| 対戦 | ${RUBBER_ORDER.join(' | ')} | 勝敗 |`);
	lines.push(`| ---- | ${RUBBER_ORDER.map(() => '---').join(' | ')} | ---- |`);
	for (const tv of view.ties) {
		lines.push(
			`| ${cell(tv.label)} | ${tv.rubberCells.map(cell).join(' | ')} | ${cell(tv.resultLabel)} |`
		);
	}
	lines.push('');

	lines.push('## 未実施試合');
	lines.push('');
	lines.push('| 優先 | 対戦 | 種目 | コート候補 | 備考 |');
	lines.push('| ---: | ---- | ---- | ---------- | ---- |');
	view.pendingMatches.forEach((mv, i) => {
		lines.push(
			`| ${i + 1} | ${cell(mv.tieLabel)} | ${cell(mv.rubberCode)} | ${cell(
				mv.match.court_name ?? '未定'
			)} | ${cell(mv.playersLabel)} |`
		);
	});
	lines.push('');

	lines.push('## 障害時の運営手順');
	lines.push('');
	lines.push('1. このファイルまたは emergency.html を開く。');
	lines.push('2. 必要なページを印刷する。');
	lines.push('3. 各コートに紙スコアシートを配布する。');
	lines.push('4. 以後のスコアは紙に記録する。');
	lines.push(`5. 復旧後、最終イベント番号(${state.lastEventId})以降をシステムに再入力する。`);
	lines.push('');

	return lines.join('\n');
}
