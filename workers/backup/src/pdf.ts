import puppeteer from '@cloudflare/puppeteer';
import type { Env } from './types';

/**
 * Browser Run (旧 Browser Rendering) で HTML を A4 PDF に変換する。
 * 失敗しても呼び出し側でバックアップ全体を失敗扱いにしないこと (emergency.html が主ファイル)。
 */
export async function renderPdfFromHtml(env: Env, html: string): Promise<Uint8Array> {
	const browser = await puppeteer.launch(env.BROWSER);
	try {
		const page = await browser.newPage();
		// networkidle0 + fonts.ready で Webフォント (Noto Sans JP) の読み込みを待つ。
		// 待たないと日本語が中華フォント代替でレンダリングされる。
		await page.setContent(html, { waitUntil: 'networkidle0' });
		await page.evaluateHandle('document.fonts.ready');
		const pdf = await page.pdf({
			format: 'a4',
			printBackground: true,
			margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }
		});
		return pdf;
	} finally {
		await browser.close();
	}
}
