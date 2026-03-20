import { NextRequest, NextResponse } from "next/server";
import CryptoJS from "crypto-js";

const NX_BASE = "https://web.nxsha.app";
const XOR_KEY = "Nx$hA2026!CustomHardMix@99";
const AES_KEY = "Nx$SuperSecretAesKey2026!!^^";

type NxApiPayload = {
	_hash?: string;
	[key: string]: unknown;
};

type NxServer = {
	id?: number;
	name?: string;
	scraper?: string;
	web_support?: boolean;
	[key: string]: unknown;
};

type DecodedData = {
	sources?: unknown;
	servers?: NxServer[];
	error?: string;
	[key: string]: unknown;
};

function binaryBase64Decode(value: string): string {
	return Buffer.from(value, "base64").toString("binary");
}

function xorDecode(value: string, key: string): string {
	let output = "";

	for (let i = 0; i < value.length; i++) {
		const left = value.charCodeAt(i);
		const right = key.charCodeAt(i % key.length);
		output += String.fromCharCode(left ^ right);
	}

	return output;
}

function decodeNxHash(hash?: string): DecodedData | null {
	if (!hash) return null;

	try {
		const reversed = hash.split("").reverse().join("");
		const firstBase64 = binaryBase64Decode(reversed);
		const xorResult = xorDecode(firstBase64, XOR_KEY);
		const secondBase64Binary = binaryBase64Decode(xorResult);
		const utf8CipherText = Buffer.from(secondBase64Binary, "binary").toString("utf8");

		const plainText = CryptoJS.AES.decrypt(utf8CipherText, AES_KEY).toString(CryptoJS.enc.Utf8);
		if (!plainText) return null;

		return JSON.parse(plainText) as DecodedData;
	} catch {
		return null;
	}
}

async function fetchAndDecode(endpoint: string): Promise<{
	responseOk: boolean;
	status: number;
	rawHash: string | null;
	decoded: DecodedData | null;
}> {
	const response = await fetch(endpoint, {
		headers: {
			"user-agent":
				"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
			accept: "application/json, text/plain, */*",
		},
		cache: "no-store",
	});

	if (!response.ok) {
		return {
			responseOk: false,
			status: response.status,
			rawHash: null,
			decoded: null,
		};
	}

	const raw = (await response.json()) as NxApiPayload;

	return {
		responseOk: true,
		status: response.status,
		rawHash: raw._hash || null,
		decoded: decodeNxHash(raw._hash),
	};
}

async function resolveAllSources(
	tmdbId: string,
	type: string,
	season: string,
	episode: string
): Promise<{
	serversEndpoint: string;
	serversRawHash: string | null;
	serversDecoded: DecodedData | null;
	providerResults: Array<{
		provider: string;
		name: string;
		status: number;
		ok: boolean;
		error: string | null;
		sourceCount: number;
		sources: unknown[];
		endpoint: string;
	}>;
	sources: unknown[];
}> {
	const serversEndpoint = buildEndpoint("servers", tmdbId, type, season, episode);
	const serversRes = await fetchAndDecode(serversEndpoint);
	const servers = (serversRes.decoded?.servers || []).filter(
		(server): server is NxServer => Boolean(server?.scraper)
	);

	const providerResults = await Promise.all(
		servers.map(async (server) => {
			const provider = String(server.scraper);
			const endpoint = buildEndpoint("sources", tmdbId, type, season, episode, provider);
			const candidate = await fetchAndDecode(endpoint);
			const decodedError =
				typeof candidate.decoded?.error === "string" ? candidate.decoded.error : null;
			const sources = Array.isArray(candidate.decoded?.sources) ? candidate.decoded.sources : [];

			return {
				provider,
				name: String(server.name || provider),
				status: candidate.status,
				ok: sources.length > 0,
				error: decodedError,
				sourceCount: sources.length,
				sources,
				endpoint,
			};
		})
	);

	const sources = providerResults.flatMap((entry) => entry.sources);

	return {
		serversEndpoint,
		serversRawHash: serversRes.rawHash,
		serversDecoded: serversRes.decoded,
		providerResults,
		sources,
	};
}

function buildEndpoint(
	kind: "sources" | "servers",
	tmdbId: string,
	type: string,
	season: string,
	episode: string,
	provider?: string
): string {
	const url = new URL(`${NX_BASE}/api/${kind}`);
	url.searchParams.set("tmdbId", tmdbId);
	url.searchParams.set("type", type);
	url.searchParams.set("season", season);
	url.searchParams.set("episode", episode);

	if (kind === "sources") {
		url.searchParams.set("provider", provider || "ridomovies");
	}

	return url.toString();
}

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;

		const kind = (searchParams.get("kind") || "sources") as "sources" | "servers";
		const provider = searchParams.get("provider") || "ridomovies";
		const tmdbId = searchParams.get("tmdbId") || "687163";
		const type = searchParams.get("type") || "movie";
		const season = searchParams.get("season") || "1";
		const episode = searchParams.get("episode") || "1";

		if (kind !== "sources" && kind !== "servers") {
			return NextResponse.json(
				{
					success: false,
					error: "kind must be 'sources' or 'servers'",
				},
				{ status: 400 }
			);
		}

		if (kind === "sources") {
			const resolved = await resolveAllSources(tmdbId, type, season, episode);
			const workingProviders = resolved.providerResults
				.filter((entry) => entry.ok)
				.map((entry) => entry.provider);

			return NextResponse.json({
				success: true,
				endpoint: resolved.serversEndpoint,
				kind,
				provider,
				mode: "all-providers",
				rawHash: resolved.serversRawHash,
				decoded: resolved.serversDecoded,
				totalProviders: resolved.providerResults.length,
				workingProviders,
				totalSources: resolved.sources.length,
				sources: resolved.sources,
				servers: Array.isArray(resolved.serversDecoded?.servers)
					? resolved.serversDecoded.servers
					: [],
				providerResults: resolved.providerResults,
			});
		}

		const endpoint = buildEndpoint(kind, tmdbId, type, season, episode, provider);
		const result = await fetchAndDecode(endpoint);

		if (!result.responseOk) {
			return NextResponse.json(
				{
					success: false,
					error: `Upstream request failed with status ${result.status}`,
					endpoint,
				},
				{ status: 502 }
			);
		}

		return NextResponse.json({
			success: true,
			endpoint,
			kind,
			provider: null,
			rawHash: result.rawHash,
			decoded: result.decoded,
			sources: Array.isArray(result.decoded?.sources) ? result.decoded.sources : [],
			servers: Array.isArray(result.decoded?.servers) ? result.decoded.servers : [],
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: "Failed to fetch/decode nx data",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
