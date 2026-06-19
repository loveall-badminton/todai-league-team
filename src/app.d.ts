import type { User, Session } from 'better-auth';
import type { AuthProfile } from '$lib/server/auth/access';
import { createAuth } from '$lib/server/auth';
import '@total-typescript/ts-reset';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			authProfile?: AuthProfile;
			auth: ReturnType<typeof createAuth>;
		}

		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
