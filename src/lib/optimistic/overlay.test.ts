import { describe, expect, test } from 'vitest';
import { OptimisticOverlay } from './overlay.svelte';

interface TestData {
	seqNo: number;
	value: string;
}

interface TestPayload {
	seqNo: number;
	value: string;
}

function newer(a: TestData, b: TestData): boolean {
	return a.seqNo > b.seqNo;
}

describe('OptimisticOverlay', () => {
	test('データは初期状態でサーバーデータを返す', () => {
		const overlay = new OptimisticOverlay<TestData, TestPayload>({
			getServerData: () => ({ seqNo: 0, value: 'server' }),
			apply: (payload) => ({ seqNo: payload.seqNo, value: payload.value }),
			isNewer: newer
		});
		expect(overlay.data).toEqual({ seqNo: 0, value: 'server' });
		expect(overlay.hasOverlay).toBe(false);
	});

	test('apply で payload が適用され data が更新される', () => {
		const overlay = new OptimisticOverlay<TestData, TestPayload>({
			getServerData: () => ({ seqNo: 0, value: 'server' }),
			apply: (payload) => ({ seqNo: payload.seqNo, value: payload.value }),
			isNewer: newer
		});
		const result = overlay.apply({ seqNo: 1, value: 'overlay' });
		expect(result).toBe('applied');
		expect(overlay.data).toEqual({ seqNo: 1, value: 'overlay' });
		expect(overlay.hasOverlay).toBe(true);
	});

	test('apply が refresh を返した場合 data は更新されない', () => {
		const overlay = new OptimisticOverlay<TestData, TestPayload>({
			getServerData: () => ({ seqNo: 0, value: 'server' }),
			apply: () => 'refresh',
			isNewer: newer
		});
		const result = overlay.apply({ seqNo: 1, value: 'overlay' });
		expect(result).toBe('refresh');
		expect(overlay.data).toEqual({ seqNo: 0, value: 'server' });
		expect(overlay.hasOverlay).toBe(false);
	});

	test('apply が null を返した場合 data は更新されない', () => {
		const overlay = new OptimisticOverlay<TestData, TestPayload>({
			getServerData: () => ({ seqNo: 0, value: 'server' }),
			apply: () => null,
			isNewer: newer
		});
		const result = overlay.apply({ seqNo: 1, value: 'overlay' });
		expect(result).toBe('ignore');
		expect(overlay.data).toEqual({ seqNo: 0, value: 'server' });
		expect(overlay.hasOverlay).toBe(false);
	});

	test('isNewer で overlay が古いと判定されるとサーバーデータを優先する', () => {
		const serverData = { seqNo: 5, value: 'newer-server' };
		const overlay = new OptimisticOverlay<TestData, TestPayload>({
			getServerData: () => serverData,
			apply: (payload) => ({ seqNo: payload.seqNo, value: payload.value }),
			isNewer: (o, s) => o.seqNo > s.seqNo
		});
		// overlay seqNo=3 は server seqNo=5 より古い
		overlay.apply({ seqNo: 3, value: 'old-overlay' });
		expect(overlay.data).toEqual({ seqNo: 5, value: 'newer-server' });
	});

	test('reset で overlay がクリアされサーバーデータに戻る', () => {
		const overlay = new OptimisticOverlay<TestData, TestPayload>({
			getServerData: () => ({ seqNo: 0, value: 'server' }),
			apply: (payload) => ({ seqNo: payload.seqNo, value: payload.value }),
			isNewer: newer
		});
		overlay.apply({ seqNo: 1, value: 'overlay' });
		expect(overlay.hasOverlay).toBe(true);
		overlay.reset();
		expect(overlay.data).toEqual({ seqNo: 0, value: 'server' });
		expect(overlay.hasOverlay).toBe(false);
	});
});
