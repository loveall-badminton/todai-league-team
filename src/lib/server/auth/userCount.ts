import { getRequestEvent } from '$app/server';

type CountRow = { value: number };

export async function userCount(): Promise<number> {
	const { platform } = getRequestEvent();
	if (!platform?.env.DB) return 0;
	const result = await platform.env.DB.prepare(
		'select count(*) as value from "user"'
	).first<CountRow>();
	return Number(result?.value ?? 0);
}
