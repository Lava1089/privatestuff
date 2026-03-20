import { NextRequest, NextResponse } from "next/server";

type StreamMap = {
	hls4?: string;
	hls3?: string;
	hls2?: string;
	primary?: string;
	fallback1?: string;
	fallback2?: string;
};

const USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const DEFAULT_HEADERS: HeadersInit = {
	"user-agent": USER_AGENT,
	accept:
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"accept-language": "en-US,en;q=0.9",
	referer: "https://vibuxer.com/",
};

function buildEmbedUrl(url?: string | null, code?: string | null): string | null {
	if (url && /^https?:\/\//i.test(url)) {
		return url;
	}

	if (code && code.trim()) {
		return `https://vibuxer.com/e/${code.trim()}`;
	}

	return null;
}

function decodePackerPayload(payload: string, base: number, count: number, dict: string[]): string {
	let output = payload;

	for (let i = count - 1; i >= 0; i--) {
		const token = dict[i];
		if (!token) continue;

		const word = i.toString(base);
		const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		output = output.replace(new RegExp(`\\b${escaped}\\b`, "g"), token);
	}

	return output;
}

function unpackInlineScript(html: string): string | null {
	const packerMatch = html.match(
		/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('(.*?)',\s*(\d+),\s*(\d+),\s*'(.*?)'\.split\('\|'\)\)\)/
	);

	if (!packerMatch) return null;

	const payload = packerMatch[1];
	const base = Number(packerMatch[2]);
	const count = Number(packerMatch[3]);
	const dict = packerMatch[4].split("|");

	if (!Number.isFinite(base) || !Number.isFinite(count)) {
		return null;
	}

	return decodePackerPayload(payload, base, count, dict);
}

function safeParseObjectLiteral(script: string, variableNames: string[]): Record<string, unknown> | null {
	for (const variableName of variableNames) {
		const re = new RegExp(`var\\s+${variableName}\\s*=\\s*(\\{[\\s\\S]*?\\});`);
		const match = script.match(re);
		if (!match) continue;

		try {
			return JSON.parse(match[1]) as Record<string, unknown>;
		} catch {
			continue;
		}
	}

	return null;
}

function resolveMaybeRelative(url: string | undefined, baseUrl: string): string | undefined {
	if (!url) return undefined;

	try {
		return new URL(url, baseUrl).toString();
	} catch {
		return undefined;
	}
}

function extractStreams(script: string, embedUrl: string): StreamMap {
	const linksObj = safeParseObjectLiteral(script, ["links", "o"]);

	if (!linksObj) {
		return {};
	}

	const hls4 = resolveMaybeRelative(
		(linksObj.hls4 as string | undefined) ?? (linksObj["1f"] as string | undefined),
		embedUrl
	);
	const hls3 = resolveMaybeRelative(
		(linksObj.hls3 as string | undefined) ?? (linksObj["1c"] as string | undefined),
		embedUrl
	);
	const hls2 = resolveMaybeRelative(
		(linksObj.hls2 as string | undefined) ?? (linksObj["1m"] as string | undefined),
		embedUrl
	);

	return {
		hls4,
		hls3,
		hls2,
		primary: hls4 ?? hls3 ?? hls2,
		fallback1: hls3 ?? hls2,
		fallback2: hls2,
	};
}

async function isReachable(url?: string): Promise<boolean> {
	if (!url) return false;

	try {
		const head = await fetch(url, {
			method: "HEAD",
			headers: {
				"user-agent": USER_AGENT,
			},
			redirect: "follow",
			cache: "no-store",
		});

		if (head.ok) return true;
	} catch {
		// fall through to GET probe
	}

	try {
		const get = await fetch(url, {
			method: "GET",
			headers: {
				"user-agent": USER_AGENT,
				range: "bytes=0-1",
			},
			redirect: "follow",
			cache: "no-store",
		});

		return get.ok;
	} catch {
		return false;
	}
}

async function pickBestStream(streams: StreamMap, checkAlive: boolean): Promise<string | null> {
	const candidates = [streams.hls4, streams.hls3, streams.hls2].filter(
		(value): value is string => Boolean(value)
	);

	if (!candidates.length) return null;
	if (!checkAlive) return candidates[0];

	for (const candidate of candidates) {
		if (await isReachable(candidate)) {
			return candidate;
		}
	}

	return candidates[0];
}

export async function GET(request: NextRequest) {
	try {
		const url = request.nextUrl.searchParams.get("url");
		const code = request.nextUrl.searchParams.get("code");
		const check = request.nextUrl.searchParams.get("check") ?? "1";
		const checkAlive = check !== "0" && check.toLowerCase() !== "false";

		const embedUrl = buildEmbedUrl(url, code);

		if (!embedUrl) {
			return NextResponse.json(
				{
					success: false,
					error: "Pass either ?url=<embed_url> or ?code=<embed_code>",
				},
				{ status: 400 }
			);
		}

		const response = await fetch(embedUrl, {
			method: "GET",
			headers: DEFAULT_HEADERS,
			redirect: "follow",
			cache: "no-store",
		});

		if (!response.ok) {
			return NextResponse.json(
				{
					success: false,
					error: `Failed to fetch embed page: ${response.status}`,
				},
				{ status: 502 }
			);
		}

		const html = await response.text();
		const unpackedScript = unpackInlineScript(html);

		if (!unpackedScript) {
			return NextResponse.json(
				{
					success: false,
					error: "Packed player script not found",
				},
				{ status: 422 }
			);
		}

		const streams = extractStreams(unpackedScript, embedUrl);
		const streamUrl = await pickBestStream(streams, checkAlive);

		if (!streamUrl) {
			return NextResponse.json(
				{
					success: false,
					error: "No stream URLs found in player script",
				},
				{ status: 422 }
			);
		}

		return NextResponse.json({
			success: true,
			embedUrl,
			streamUrl,
			streams,
			checkAlive,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: "Failed to extract stream URL",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
