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
var ALL_MATCHES = JSON.parse(open(__ENV.ASSIGNMENTS_PATH || './match-assignments.json'));

function login() {
	var res = http.post(
		BASE_URL + '/api/auth/sign-in/email',
		JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
		{ headers: { 'Content-Type': 'application/json', Origin: BASE_URL } }
	);
	var setCookie = res.headers['Set-Cookie'] || res.headers['set-cookie'] || '';
	var match = setCookie.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
	if (!match) throw new Error('Login failed');
	return match[1];
}

export function setup() {
	return { token: login() };
}

export function liveViewer(data) {
	var cookie = '__Secure-better-auth.session_token=' + data.token;

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
	var cookie = '__Secure-better-auth.session_token=' + data.token;
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
