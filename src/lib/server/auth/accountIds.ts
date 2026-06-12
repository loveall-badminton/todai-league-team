export const INTERNAL_EMAIL_DOMAIN = 'accounts.local';

const ACCOUNT_ID_PATTERN = /^[a-z0-9_.-]{3,64}$/;

export type AuthUserWithAccountId = {
	id: string;
	name?: string | null;
	email?: string | null;
	role?: string | null;
	username?: string | null;
	displayUsername?: string | null;
};

export function normalizeAccountId(raw: FormDataEntryValue | string | null): string {
	const accountId = String(raw ?? '')
		.trim()
		.toLowerCase();

	if (!ACCOUNT_ID_PATTERN.test(accountId)) {
		throw new Error(
			'ID は3〜64文字の半角英数字、ドット、アンダースコア、ハイフンで入力してください。'
		);
	}

	return accountId;
}

export function accountIdToInternalEmail(accountId: string): string {
	return `${accountId}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function displayAccountId(user: AuthUserWithAccountId): string {
	if (user.displayUsername) return user.displayUsername;
	if (user.username) return user.username;

	const email = user.email ?? '';
	const suffix = `@${INTERNAL_EMAIL_DOMAIN}`;
	if (email.endsWith(suffix)) return email.slice(0, -suffix.length);

	return email;
}
