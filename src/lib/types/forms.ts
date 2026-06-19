export interface FormFieldOptions {
	name: string;
	[key: string]: unknown;
}

export interface FormField<T = string> {
	as(type: string, ...args: unknown[]): FormFieldOptions;
	value(): T | undefined;
	set(value: T | undefined): void;
	issues(): Array<{ message: string }> | undefined;
}

export interface FormActionResult {
	message?: string;
}

export interface FormActionResultWithWarnings extends FormActionResult {
	warnings?: string[];
}

export interface FormInstance<TFields extends Record<string, unknown>, TOutput> {
	method: 'POST';
	action: string;
	fields: { [K in keyof TFields]: FormField<TFields[K]> };
	result: TOutput | undefined;
}

export interface ScopedForm<TFields extends Record<string, unknown>, TOutput> {
	for(id: string): FormInstance<TFields, TOutput>;
}
