'use strict';

// Wrapper script for n8n Execute Command node.
// Runs the 60fps.design scraper and prints clean JSON to stdout.
// Stdout contains ONLY JSON on success. Any errors go to stderr and exit code is non-zero.

const { scrape60fps } = require('./scrape60fps');

function extractTitleFromUrl(url) {
	if (!url) return 'Untitled Shot';
	const parts = url.split('/shots/');
	if (parts.length < 2) return 'Untitled Shot';
	return parts[1]
		.replace(/\?.*$/, '')
		.split('-')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function parseLimitArg() {
	const argIdx = process.argv.findIndex(a => a === '--limit');
	if (argIdx !== -1 && process.argv[argIdx + 1]) {
		const n = Number(process.argv[argIdx + 1]);
		if (Number.isFinite(n) && n > 0) return Math.floor(n);
	}
	const envLimit = Number(process.env.LIMIT);
	if (Number.isFinite(envLimit) && envLimit > 0) return Math.floor(envLimit);
	return null;
}

async function withSilencedLogs(fn) {
	const originalLog = console.log;
	const originalInfo = console.info;
	const originalWarn = console.warn;
	const originalError = console.error;
	try {
		console.log = () => {};
		console.info = () => {};
		console.warn = () => {};
		console.error = () => {};
		return await fn();
	} finally {
		console.log = originalLog;
		console.info = originalInfo;
		console.warn = originalWarn;
		console.error = originalError;
	}
}

(async () => {
	try {
		const limit = parseLimitArg();
		const shots = await withSilencedLogs(() => scrape60fps());
		const nowIso = new Date().toISOString();

		let rows = shots.map(s => ({
			title: (s.title || extractTitleFromUrl(s.url)).replace(/\s+\d+$/, '').trim(),
			url: s.url,
			preview_url: s.preview,
			source: '60fps.design',
			scraped_at: nowIso
		}));

		if (limit) rows = rows.slice(0, limit);

		// Output ONLY JSON on stdout
		process.stdout.write(JSON.stringify(rows));
	} catch (error) {
		// Send structured error to stderr and non-zero exit for n8n error handling
		console.error(JSON.stringify({
			success: false,
			error: error && error.message ? error.message : String(error)
		}));
		process.exit(1);
	}
})();


