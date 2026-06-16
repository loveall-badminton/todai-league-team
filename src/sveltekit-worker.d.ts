/**
 * `src/worker.ts` が読み込む、adapter-cloudflare の生成ワーカーの型宣言。
 *
 * 実体は `.svelte-kit/cloudflare/_worker.js`（ビルド時に生成される）で、
 * wrangler の `alias` 設定で `sveltekit-worker` にマップしている。alias を
 * 非相対指定にすることで、型チェック時は常にこの宣言が使われ、生成ファイルの
 * 有無やサイズに左右されない。
 */
declare module 'sveltekit-worker' {
	// 生成ワーカーは必ず fetch ハンドラを持つ。fetch を必須にして、
	// リクエスト型を ExportedHandler と揃える。
	const worker: Required<Pick<ExportedHandler<Env>, 'fetch'>>;
	export default worker;
}
