import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
import type * as v from 'valibot';

export type FormActionResult = { message?: string };

export type FormActionResultWithWarnings = FormActionResult & { warnings?: string[] };

type InferFormInput<T> =
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	T extends RemoteForm<infer Input, infer _Output>
		? Input
		: // eslint-disable-next-line @typescript-eslint/no-unused-vars
			T extends v.GenericSchema<infer Input, infer _Output, infer _Issue>
			? Input
			: T;

type SafeFormInput<T> =
	InferFormInput<T> extends RemoteFormInput ? InferFormInput<T> : Record<string, never>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type InferFormOutput<T> = T extends RemoteForm<infer _Input, infer Output> ? Output : object;

export type FormInstance<T = Record<string, never>> = RemoteForm<
	SafeFormInput<T>,
	InferFormOutput<T>
>;

export type ScopedForm<T = Record<string, never>> = Omit<FormInstance<T>, 'for'>;
