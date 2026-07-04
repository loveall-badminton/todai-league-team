<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import Card from '$lib/components/Card.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';
	import { triggerBackup } from './backup.remote';

	let { data }: PageProps = $props();

	let generating = $state(false);
	let message = $state('');
	let errorMessage = $state('');

	const tokenQuery = $derived(`?token=${encodeURIComponent(data.token)}`);
	const fileUrl = $derived((file: string) => `${data.workerUrl}/${file}${tokenQuery}`);

	function formatJst(iso: string): string {
		return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' JST';
	}

	async function generateNow() {
		generating = true;
		message = '';
		errorMessage = '';
		try {
			const result = await triggerBackup();
			message = `緊急パケットを生成しました (最終イベント番号: ${result.lastEventId}${result.pdfGenerated ? '' : ' / PDFは未生成'})`;
			await invalidateAll();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : '生成に失敗しました';
		} finally {
			generating = false;
		}
	}

	const procedureSteps = [
		'本部PCの ~/tournament-backup/emergency.html を開く。',
		'開けない場合は下の「緊急HTMLを開く」のURL(要ブックマーク)を開く。',
		'emergency.pdf または emergency.html を印刷する。',
		'各コートに該当する紙スコアシートを配布する。',
		'各コートでは以後の得点を紙に記録する。',
		'本部は団体戦進行表に勝敗を転記する。',
		'システム復旧後、最終イベント番号以降の紙記録を再入力する。',
		'再入力後、紙の勝敗・スコアとシステム表示を照合する。'
	];
</script>

<svelte:head>
	<title>緊急バックアップ | 東大リーグ団体戦</title>
</svelte:head>

<PageHeader title="緊急バックアップ" />

{#if !data.configured}
	<Card>
		<p class="text-sm text-muted-foreground">
			バックアップWorkerが未設定です。環境変数 <code>BACKUP_WORKER_URL</code> /
			<code>BACKUP_DOWNLOAD_TOKEN</code> / <code>BACKUP_SECRET</code> を設定してください (workers/backup/README.md
			参照)。
		</p>
	</Card>
{:else}
	<Card>
		{#snippet header()}
			<h2 class="font-semibold text-default">最新バックアップ</h2>
		{/snippet}
		{#if data.manifest}
			<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
				<dt class="text-muted-foreground">生成時刻</dt>
				<dd>{formatJst(data.manifest.generatedAt)}</dd>
				<dt class="text-muted-foreground">最終イベント番号</dt>
				<dd>{data.manifest.lastEventId}</dd>
				<dt class="text-muted-foreground">PDF</dt>
				<dd>{data.manifest.pdfGenerated ? '生成済み' : '未生成 (HTMLを印刷してください)'}</dd>
			</dl>
		{:else}
			<p class="text-sm text-muted-foreground">
				バックアップがまだ生成されていないか、バックアップWorkerに接続できません。
			</p>
		{/if}

		<div class="mt-4 flex flex-wrap gap-2">
			<AppButton onclick={generateNow} disabled={generating}>
				{generating ? '生成中…' : '今すぐ緊急パケット生成'}
			</AppButton>
			<AppButton variant="secondary" href={fileUrl('emergency.html')} target="_blank">
				緊急HTMLを開く
			</AppButton>
			<AppButton variant="secondary" href={fileUrl('emergency.pdf')} target="_blank">
				緊急PDFを開く
			</AppButton>
			<AppButton variant="secondary" href={fileUrl('scores.csv')}>スコアCSVをダウンロード</AppButton
			>
			<AppButton variant="secondary" href={fileUrl('state.json')}
				>state.jsonをダウンロード</AppButton
			>
		</div>
		{#if message}
			<p class="mt-2 text-sm text-green-700">{message}</p>
		{/if}
		{#if errorMessage}
			<p class="mt-2 text-sm text-red-600">{errorMessage}</p>
		{/if}
		<p class="mt-3 text-xs text-muted-foreground">
			管理画面が落ちた場合に備えて、「緊急HTMLを開く」のURLを本部PCと責任者スマホにブックマークしておいてください。
		</p>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="font-semibold text-default">障害時の運営手順</h2>
		{/snippet}
		<ol class="list-decimal space-y-1 pl-5 text-sm">
			{#each procedureSteps as step (step)}
				<li>{step}</li>
			{/each}
		</ol>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="font-semibold text-default">本部PC用スクリプト</h2>
		{/snippet}
		<p class="text-sm text-muted-foreground">
			5分ごとに最新バックアップをローカル保存するには、リポジトリの
			<code>scripts/fetch-backup.sh</code> を使います。
		</p>
		<pre
			class="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">BACKUP_BASE_URL="{data.workerUrl}" \
BACKUP_DOWNLOAD_TOKEN="&lt;トークン&gt;" \
./scripts/fetch-backup.sh</pre>
		<p class="mt-2 text-xs text-muted-foreground">
			macOSで自動実行する場合は <code>scripts/fetch-backup.plist</code> を launchd に登録します。
		</p>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="font-semibold text-default">生成履歴 (直近30件)</h2>
		{/snippet}
		{#if data.snapshots.length === 0}
			<p class="text-sm text-muted-foreground">履歴がありません。</p>
		{:else}
			<ul class="space-y-1 text-sm">
				{#each data.snapshots as snapshot (snapshot)}
					<li>
						<!-- バックアップWorkerへの外部URLのため resolve() 不要 -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							class="underline"
							href={`${data.workerUrl}/emergency.html${tokenQuery}&snapshot=${encodeURIComponent(snapshot)}`}
							target="_blank"
						>
							{snapshot}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
{/if}
