import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'testadmin@accounts.local';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'TestAdmin123';

export const options = {
	stages: [
		// slow ramp-up to let DO cache warm
		{ duration: '30s', target: 5 },
		{ duration: '30s', target: 10 },
		// steady ramp-up to test
		{ duration: '1m', target: 50 },
		{ duration: '1m', target: 200 },
		{ duration: '1m', target: 500 },
		// sustained load
		{ duration: '1m', target: 500 },
		// ramp down
		{ duration: '30s', target: 0 }
	],
	thresholds: {
		http_req_duration: ['p(95)<2000'],
		http_req_failed: ['rate<0.10']
	}
};

export function setup() {
	var res = http.post(
		BASE_URL + '/api/auth/sign-in/email',
		JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
		{ headers: { 'Content-Type': 'application/json', Origin: BASE_URL } }
	);

	if (res.status !== 200) {
		return { token: '' };
	}

	var token = '';
	var rawHeaders = res.headers;
	var setCookie = rawHeaders['Set-Cookie'] || rawHeaders['set-cookie'] || [];
	if (typeof setCookie === 'string') setCookie = [setCookie];
	if (Array.isArray(setCookie)) {
		for (var i = 0; i < setCookie.length; i++) {
			var match = setCookie[i].match(/better-auth\.session_token=([^;]+)/);
			if (match) {
				token = decodeURIComponent(match[1]);
				break;
			}
		}
	}

	if (!token && res.json && res.json().token) {
		token = res.json().token;
	}

	return { token: token };
}

export default function (data) {
	if (!data.token) {
		check(null, { 'token obtained': false });
		sleep(1);
		return;
	}

	var res = http.get(BASE_URL + '/live', {
		headers: {
			Cookie: '__Secure-better-auth.session_token=' + data.token
		}
	});

	check(res, {
		'live page OK': (r) => r.status === 200,
		'live page fast': (r) => r.timings.duration < 2000
	});

	sleep(Math.random() * 2 + 1);
}
