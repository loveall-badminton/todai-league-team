import http from 'k6/http';
import { check, sleep } from 'k6';

var BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
var ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'testadmin@accounts.local';
var ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'TestAdmin123';
// Number of distinct viewer accounts — each gets its own session token so the
// server-side session cache behaves closer to production (different tokens →
// cache misses proportional to unique users, not 100% hits from one token).
var ACCOUNT_COUNT = parseInt(__ENV.ACCOUNT_COUNT || '500');

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
	},
	setupTimeout: '120s'
};

function extractToken(res) {
	var setCookie = res.headers['Set-Cookie'] || res.headers['set-cookie'] || [];
	if (typeof setCookie === 'string') setCookie = [setCookie];
	if (!Array.isArray(setCookie)) return null;
	for (var i = 0; i < setCookie.length; i++) {
		var m = setCookie[i].match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
		if (m) return decodeURIComponent(m[1]);
	}
	return null;
}

function loginAs(email, password) {
	var res = http.post(
		BASE_URL + '/api/auth/sign-in/email',
		JSON.stringify({ email: email, password: password }),
		{ headers: { 'Content-Type': 'application/json', Origin: BASE_URL } }
	);
	return extractToken(res);
}

function createAndLogin(index) {
	var email = 'load-viewer-' + index + '@accounts.local';
	var password = 'LoadTest123';
	// sign-up is idempotent: 409 if the account already exists from a previous run
	http.post(
		BASE_URL + '/api/auth/sign-up/email',
		JSON.stringify({ email: email, password: password, name: 'Load Viewer ' + index }),
		{ headers: { 'Content-Type': 'application/json', Origin: BASE_URL } }
	);
	return loginAs(email, password);
}

export function setup() {
	var tokens = [];
	for (var i = 0; i < ACCOUNT_COUNT; i++) {
		var token = createAndLogin(i);
		if (token) tokens.push(token);
	}

	if (tokens.length === 0) {
		// Fallback: viewer account creation failed — use admin session
		console.warn('No viewer accounts created; falling back to admin session');
		var adminToken = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
		if (adminToken) tokens.push(adminToken);
	}

	if (tokens.length === 0) {
		throw new Error('Could not obtain any session tokens — check BASE_URL and credentials');
	}

	console.log('Setup: ' + tokens.length + ' unique viewer sessions ready');
	return { tokens: tokens };
}

export default function (data) {
	// Each VU picks a distinct token; wraps around if VUs > ACCOUNT_COUNT
	var token = data.tokens[(__VU - 1) % data.tokens.length];

	var res = http.get(BASE_URL + '/live', {
		headers: {
			Cookie: '__Secure-better-auth.session_token=' + token
		}
	});

	check(res, {
		'live page OK': function (r) {
			return r.status === 200;
		},
		'live page fast': function (r) {
			return r.timings.duration < 2000;
		}
	});

	sleep(Math.random() * 2 + 1);
}
