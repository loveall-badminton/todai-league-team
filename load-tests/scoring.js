import http from 'k6/http';
import { sleep, group } from 'k6';

export const options = {
	stages: [
		{ duration: '20s', target: 50 },
		{ duration: '2m', target: 50 },
		{ duration: '20s', target: 0 }
	],
	thresholds: {
		http_req_duration: ['p(95)<3000'],
		http_req_failed: ['rate<0.10']
	}
};

var BASE_URL = __ENV.BASE_URL || 'http://localhost:4173';
var ADMIN_EMAIL = 'testadmin@accounts.local';
var ADMIN_PASSWORD = 'TestAdmin123';

// Load match assignments at init context (k6 requires open() only at top level)
var ALL_MATCHES = JSON.parse(open(__ENV.ASSIGNMENTS_PATH || './match-assignments.json'));

export function setup() {
	var loginRes = http.post(
		BASE_URL + '/api/auth/sign-in/email',
		JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
		{ headers: { 'Content-Type': 'application/json', Origin: BASE_URL } }
	);

	var setCookie = loginRes.headers['Set-Cookie'] || loginRes.headers['set-cookie'] || '';
	var match = setCookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
	if (!match) {
		throw new Error('Login failed: ' + loginRes.status + ' ' + String(loginRes.body).slice(0, 200));
	}
	return { token: match[1] };
}

export default function (data) {
	var cookie = '__Secure-better-auth.session_token=' + data.token;
	var vuIdx = __VU - 1;

	// Spread matches evenly across VUs
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
						headers: { Cookie: cookie, Origin: BASE_URL, Accept: 'text/html' },
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
