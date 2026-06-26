const originalWarn = console.warn;
const originalError = console.error;

const filter = (...args: unknown[]) => {
	const msg = args.join(' ');
	return msg.includes('derived_inert');
};

console.warn = (...args: unknown[]) => {
	if (filter(...args)) return;
	originalWarn(...args);
};

console.error = (...args: unknown[]) => {
	if (filter(...args)) return;
	originalError(...args);
};
