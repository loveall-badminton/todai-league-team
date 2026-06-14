export function safeRedirectTo(value: FormDataEntryValue | string | null): string {
	const redirectTo = String(value ?? '/');
	return redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';
}
