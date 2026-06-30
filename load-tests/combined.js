import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
	scenarios: {
		live_viewers: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '30s', target: 500 },
				{ duration: '2m', target: 500 },
				{ duration: '30s', target: 0 }
			],
			exec: 'liveViewer',
			gracefulStop: '10s'
		},
		referees: {
			executor: 'ramping-vus',
			startVUs: 0,
			stages: [
				{ duration: '20s', target: 50 },
				{ duration: '2m', target: 50 },
				{ duration: '20s', target: 0 }
			],
			exec: 'referee',
			gracefulStop: '10s',
			startTime: '0s'
		}
	},
	thresholds: {
		http_req_duration: ['p(95)<3000'],
		http_req_failed: ['rate<0.10']
	}
};

var BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
var ADMIN_EMAIL = 'testadmin@accounts.local';
var ADMIN_PASSWORD = 'TestAdmin123';
// Number of distinct viewer sessions. Each VU picks a token by index so that
// concurrent live_viewers carry different session cookies — matching production
// where each spectator/participant has their own account.
var VIEWER_ACCOUNT_COUNT = parseInt(__ENV.VIEWER_ACCOUNT_COUNT || '100');
var ALL_MATCHES = JSON.parse(open(__ENV.ASSIGNMENTS_PATH || './match-assignments.json'));

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

function createViewerAndLogin(index) {
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
	// Admin token for referee mutations. Referee POSTs bypass the session cache
	// (hooks.server.ts skips cache for mutations) so a single shared token is fine.
	var refereeToken = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
	if (!refereeToken) throw new Error('Admin login failed');

	// Distinct viewer tokens for realistic GET cache behavior on /live
	var viewerTokens = [];
	for (var i = 0; i < VIEWER_ACCOUNT_COUNT; i++) {
		var token = createViewerAndLogin(i);
		if (token) viewerTokens.push(token);
	}
	if (viewerTokens.length === 0) {
		console.warn('No viewer accounts created; falling back to admin session for live viewers');
		viewerTokens.push(refereeToken);
	}

	console.log('Setup: ' + viewerTokens.length + ' viewer sessions, 1 referee session');
	return { viewerTokens: viewerTokens, refereeToken: refereeToken };
}

export function liveViewer(data) {
	// Each VU uses a distinct token; wraps around if VUs > VIEWER_ACCOUNT_COUNT
	var token = data.viewerTokens[(__VU - 1) % data.viewerTokens.length];
	var cookie = '__Secure-better-auth.session_token=' + token;

	group('live page view', function () {
		var res = http.get(BASE_URL + '/live', {
			headers: { Cookie: cookie }
		});
		check(res, {
			'live OK': function (r) {
				return r.status === 200;
			},
			'live fast': function (r) {
				return r.timings.duration < 2000;
			}
		});
	});

	sleep(Math.random() * 5 + 5);
}

export function referee(data) {
	var cookie = '__Secure-better-auth.session_token=' + data.refereeToken;
	var vuIdx = __VU - 1;
	var myMatches = [];

	for (var i = vuIdx; i < ALL_MATCHES.length; i += 50) {
		myMatches.push(ALL_MATCHES[i]);
	}

	for (var mi = 0; mi < myMatches.length; mi++) {
		var m = myMatches[mi];
		var refereeUrl = BASE_URL + '/referee/' + m.matchId;
		var rallyCount = 0;
		var start = Date.now() / 1000;
		var timeout = 30;

		group('match ' + m.matchId, function () {
			while (Date.now() / 1000 - start < timeout) {
				var side = rallyCount % 2 === 0 ? 'A' : 'B';
				var encodedSide = encodeURIComponent('"' + side + '"');
				var res = http.post(
					refereeUrl + '?/remote=ards3a/rallyWon/' + encodedSide,
					'side=' + side,
					{
						headers: {
							Cookie: cookie,
							Origin: BASE_URL,
							Accept: 'text/html',
							'Content-Type': 'application/x-www-form-urlencoded'
						},
						redirects: 0
					}
				);
				var ok = res.status === 200 || res.status === 204;
				if (!ok) break;
				rallyCount++;
				sleep(0.2 + Math.random() * 0.3);
			}
		});
	}

	sleep(0.5);
}
