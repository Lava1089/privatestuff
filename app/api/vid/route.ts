import { NextRequest, NextResponse } from 'next/server';

const HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
	Connection: 'keep-alive',
};

const API = 'https://enc-dec.app/api';
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'd131017ccc6e5462a81c9304d21476de';
const TMDB_BASE_URL = 'https://twilight-cake-defb.hunternisha55.workers.dev/3';

interface ServerConfig {
	url: string;
	language: string;
	params?: Record<string, string>;
	moviesOnly?: boolean;
}

interface TMDBMovieData {
	id: number;
	title: string;
	release_date?: string;
	external_ids?: {
		imdb_id?: string;
	};
	overview: string;
	poster_path?: string;
	backdrop_path?: string;
}

interface TMDBTvData {
	id: number;
	name: string;
	first_air_date?: string;
	external_ids?: {
		imdb_id?: string;
	};
	overview: string;
	poster_path?: string;
	backdrop_path?: string;
	number_of_seasons: number;
	number_of_episodes: number;
}

interface MediaDetails {
	id: number;
	title: string;
	year: string;
	imdbId: string;
	mediaType: 'movie' | 'tv';
	overview: string;
	poster: string;
	backdrop: string;
	numberOfSeasons?: number;
	numberOfEpisodes?: number;
}

interface VideoSource {
	url: string;
	quality?: string;
	language?: string;
}

interface DecryptedData {
	sources?: VideoSource[];
}

interface Stream {
	name: string;
	title: string;
	url: string;
	quality: string;
	size: string;
	headers: Record<string, string>;
	provider: string;
}

const SERVERS: Record<string, ServerConfig> = {
	Neon: {
		url: 'https://api.videasy.net/myflixerzupcloud/sources-with-title',
		language: 'Original',
	},
	Sage: {
		url: 'https://api.videasy.net/1movies/sources-with-title',
		language: 'Original',
	},
	Cypher: {
		url: 'https://api.videasy.net/moviebox/sources-with-title',
		language: 'Original',
	},
	Yoru: {
		url: 'https://api.videasy.net/cdn/sources-with-title',
		language: 'Original',
		moviesOnly: true,
	},
	Reyna: {
		url: 'https://api2.videasy.net/primewire/sources-with-title',
		language: 'Original',
	},
	Omen: {
		url: 'https://api.videasy.net/onionplay/sources-with-title',
		language: 'Original',
	},
	Breach: {
		url: 'https://api.videasy.net/m4uhd/sources-with-title',
		language: 'Original',
	},
	Vyse: {
		url: 'https://api.videasy.net/hdmovie/sources-with-title',
		language: 'Original',
	},
	Killjoy: {
		url: 'https://api.videasy.net/meine/sources-with-title',
		language: 'German',
		params: { language: 'german' },
	},
	Harbor: {
		url: 'https://api.videasy.net/meine/sources-with-title',
		language: 'Italian',
		params: { language: 'italian' },
	},
	Chamber: {
		url: 'https://api.videasy.net/meine/sources-with-title',
		language: 'French',
		params: { language: 'french' },
		moviesOnly: true,
	},
	Fade: {
		url: 'https://api.videasy.net/hdmovie/sources-with-title',
		language: 'Hindi',
	},
	Gekko: {
		url: 'https://api2.videasy.net/cuevana-latino/sources-with-title',
		language: 'Latin',
	},
	Kayo: {
		url: 'https://api2.videasy.net/cuevana-spanish/sources-with-title',
		language: 'Spanish',
	},
	Raze: {
		url: 'https://api.videasy.net/superflix/sources-with-title',
		language: 'Portuguese',
	},
	Phoenix: {
		url: 'https://api2.videasy.net/overflix/sources-with-title',
		language: 'Portuguese',
	},
	Astra: {
		url: 'https://api.videasy.net/visioncine/sources-with-title',
		language: 'Portuguese',
	},
};

async function getText(url: string): Promise<string> {
	const response = await fetch(url, {
		method: 'GET',
		headers: HEADERS,
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.text();
}

async function getJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		method: 'GET',
		headers: HEADERS,
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.json();
}

async function postJson<T>(url: string, jsonBody: unknown, extraHeaders?: Record<string, string>): Promise<T> {
	const headers = {
		...HEADERS,
		'Content-Type': 'application/json',
		...extraHeaders,
	};

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(jsonBody),
		cache: 'no-store',
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.json();
}

async function decryptVideoEasy(encryptedText: string, tmdbId: string): Promise<DecryptedData> {
	const response = await postJson<{ result: DecryptedData }>(`${API}/dec-videasy`, {
		text: encryptedText,
		id: tmdbId,
	});
	return response.result;
}

async function fetchMovieDetails(tmdbId: string): Promise<MediaDetails> {
	const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
	const data = await getJson<TMDBMovieData>(url);

	return {
		id: data.id,
		title: data.title,
		year: data.release_date ? data.release_date.split('-')[0] : '',
		imdbId: data.external_ids?.imdb_id || '',
		mediaType: 'movie',
		overview: data.overview,
		poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
		backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : '',
	};
}

async function fetchTvDetails(tmdbId: string): Promise<MediaDetails> {
	const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
	const data = await getJson<TMDBTvData>(url);

	return {
		id: data.id,
		title: data.name,
		year: data.first_air_date ? data.first_air_date.split('-')[0] : '',
		imdbId: data.external_ids?.imdb_id || '',
		mediaType: 'tv',
		overview: data.overview,
		poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
		backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : '',
		numberOfSeasons: data.number_of_seasons,
		numberOfEpisodes: data.number_of_episodes,
	};
}

async function fetchMediaDetails(tmdbId: string, mediaType?: string | null): Promise<MediaDetails> {
	if (mediaType === 'movie') {
		return fetchMovieDetails(tmdbId);
	}
	if (mediaType === 'tv') {
		return fetchTvDetails(tmdbId);
	}

	try {
		return await fetchMovieDetails(tmdbId);
	} catch {
		return fetchTvDetails(tmdbId);
	}
}

function buildVideoEasyUrl(
	serverConfig: ServerConfig,
	mediaType: string,
	title: string,
	year: string,
	tmdbId: string,
	imdbId: string,
	seasonId: number | null,
	episodeId: number | null
): string {
	const params: Record<string, string> = {
		title,
		mediaType,
		year,
		tmdbId,
		imdbId,
	};

	if (serverConfig.params) {
		Object.assign(params, serverConfig.params);
	}

	if (mediaType === 'tv' && seasonId !== null && episodeId !== null) {
		params.seasonId = seasonId.toString();
		params.episodeId = episodeId.toString();
	}

	const queryString = Object.keys(params)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
		.join('&');

	return `${serverConfig.url}?${queryString}`;
}

function normalizeLanguageName(language: string): string {
	if (!language || typeof language !== 'string') {
		return '';
	}

	const languageMap: Record<string, string> = {
		en: 'English', eng: 'English', english: 'English',
		hi: 'Hindi', hin: 'Hindi', hindi: 'Hindi',
		de: 'German', ger: 'German', german: 'German',
		it: 'Italian', ita: 'Italian', italian: 'Italian',
		fr: 'French', fre: 'French', french: 'French',
		es: 'Spanish', spa: 'Spanish', spanish: 'Spanish',
		pt: 'Portuguese', por: 'Portuguese', portuguese: 'Portuguese',
		ar: 'Arabic', ara: 'Arabic', arabic: 'Arabic',
		zh: 'Chinese', chi: 'Chinese', chinese: 'Chinese',
		ja: 'Japanese', jpn: 'Japanese', japanese: 'Japanese',
		ko: 'Korean', kor: 'Korean', korean: 'Korean',
		bn: 'Bengali', ben: 'Bengali', bengali: 'Bengali',
		ta: 'Tamil', tam: 'Tamil', tamil: 'Tamil',
		te: 'Telugu', tel: 'Telugu', telugu: 'Telugu',
		ml: 'Malayalam', mal: 'Malayalam', malayalam: 'Malayalam',
		kn: 'Kannada', kan: 'Kannada', kannada: 'Kannada',
		mr: 'Marathi', mar: 'Marathi', marathi: 'Marathi',
		gu: 'Gujarati', guj: 'Gujarati', gujarati: 'Gujarati',
		pa: 'Punjabi', pan: 'Punjabi', punjabi: 'Punjabi',
		ur: 'Urdu', urd: 'Urdu', urdu: 'Urdu',
		fa: 'Persian', per: 'Persian', persian: 'Persian',
		tr: 'Turkish', tur: 'Turkish', turkish: 'Turkish',
		vi: 'Vietnamese', vie: 'Vietnamese', vietnamese: 'Vietnamese',
		th: 'Thai', tha: 'Thai', thai: 'Thai',
		id: 'Indonesian', ind: 'Indonesian', indonesian: 'Indonesian',
	};

	const normalized = language.toLowerCase().trim();
	return languageMap[normalized] || language;
}

function extractQualityFromUrl(url: string): string {
	const qualityPatterns = [
		/(\d{3,4})p/i,
		/(\d{3,4})k/i,
		/quality[_-]?(\d{3,4})/i,
		/res[_-]?(\d{3,4})/i,
		/(\d{3,4})x\d{3,4}/i,
		/\/MTA4MA==\//i,
		/\/NzIw\//i,
		/\/MzYw\//i,
		/\/NDgw\//i,
		/\/MTkyMA==\//i,
		/\/MTI4MA==\//i,
	];

	for (const pattern of qualityPatterns) {
		const match = url.match(pattern);
		if (!match) continue;

		if (pattern.source.includes('MTA4MA==')) return '1080p';
		if (pattern.source.includes('NzIw')) return '720p';
		if (pattern.source.includes('MzYw')) return '360p';
		if (pattern.source.includes('NDgw')) return '480p';
		if (pattern.source.includes('MTkyMA==')) return '1080p';
		if (pattern.source.includes('MTI4MA==')) return '720p';

		const qualityNum = parseInt(match[1], 10);
		if (qualityNum >= 240 && qualityNum <= 4320) {
			return `${qualityNum}p`;
		}
	}

	if (url.includes('1080') || url.includes('1920')) return '1080p';
	if (url.includes('720') || url.includes('1280')) return '720p';
	if (url.includes('480') || url.includes('854')) return '480p';
	if (url.includes('360') || url.includes('640')) return '360p';
	if (url.includes('240') || url.includes('426')) return '240p';

	return 'unknown';
}

async function parseHlsPlaylist(url: string): Promise<string> {
	try {
		const content = await getText(url);
		const resolutions: number[] = [];
		const bandwidths: number[] = [];

		const resolutionMatches = content.match(/RESOLUTION=(\d+x\d+)/g) || [];
		resolutionMatches.forEach((res) => {
			const parts = res.split('x');
			const height = parseInt(parts[1], 10);
			if (!Number.isNaN(height)) resolutions.push(height);
		});

		const bandwidthMatches = content.match(/BANDWIDTH=(\d+)/g) || [];
		bandwidthMatches.forEach((bw) => {
			const bandwidth = parseInt(bw.replace('BANDWIDTH=', ''), 10);
			if (!Number.isNaN(bandwidth)) bandwidths.push(bandwidth);
		});

		if (resolutions.length > 0) {
			const maxResolution = Math.max(...resolutions);
			if (maxResolution >= 1080) return '1080p';
			if (maxResolution >= 720) return '720p';
			if (maxResolution >= 480) return '480p';
			if (maxResolution >= 360) return '360p';
			return '240p';
		}

		if (bandwidths.length > 0) {
			const maxBandwidth = Math.max(...bandwidths);
			if (maxBandwidth >= 5000000) return '1080p';
			if (maxBandwidth >= 3000000) return '720p';
			if (maxBandwidth >= 1500000) return '480p';
			if (maxBandwidth >= 800000) return '360p';
			return '240p';
		}

		if (content.includes('#EXT-X-STREAM-INF')) return 'adaptive';
		return 'unknown';
	} catch {
		return 'unknown';
	}
}

async function formatStreamsForNuvio(
	mediaData: DecryptedData,
	serverName: string,
	serverConfig: ServerConfig,
	mediaDetails: MediaDetails
): Promise<Stream[]> {
	if (!mediaData || typeof mediaData !== 'object' || !mediaData.sources) {
		return [];
	}

	const streams: Stream[] = [];
	const providerNames = ['streamwish', 'voesx', 'filemoon', 'fileions', 'filelions', 'streamtape', 'streamlare', 'doodstream', 'upstream', 'mixdrop'];
	const languageNames = ['english', 'hindi', 'german', 'italian', 'spanish', 'portuguese', 'french', 'arabic', 'chinese', 'japanese', 'korean', 'bengali', 'tamil', 'telugu', 'malayalam', 'kannada', 'marathi', 'gujarati', 'punjabi', 'urdu', 'persian', 'turkish', 'vietnamese', 'thai', 'indonesian'];

	for (const source of mediaData.sources) {
		if (!source.url) continue;

		let quality = source.quality || extractQualityFromUrl(source.url);
		let detectedLanguage = '';

		if (quality === 'unknown' && source.url.includes('.m3u8')) {
			quality = await parseHlsPlaylist(source.url);
			if (quality === 'adaptive') quality = 'Adaptive';
		}

		if (quality && typeof quality === 'string') {
			const isProviderName = providerNames.some((provider) => quality.toLowerCase().includes(provider.toLowerCase()));
			if (isProviderName) {
				quality = extractQualityFromUrl(source.url);
				if (quality === 'unknown') quality = 'Adaptive';
			}

			if (quality.includes('GB') || quality.includes('MB') || quality.includes('|')) {
				quality = extractQualityFromUrl(source.url);
				if (quality === 'unknown') quality = 'Adaptive';
			}

			const isLanguageName = languageNames.some((lang) => quality.toLowerCase().includes(lang.toLowerCase()));
			if (isLanguageName) {
				detectedLanguage = normalizeLanguageName(quality);
				quality = extractQualityFromUrl(source.url);
				if (quality === 'unknown') quality = 'Adaptive';
			}

			if (quality.toLowerCase() === 'hd' || quality.toLowerCase() === 'high') {
				const urlQuality = extractQualityFromUrl(source.url);
				quality = urlQuality !== 'unknown' ? urlQuality : '720p';
			}

			if (quality.toLowerCase() === 'sd' || quality.toLowerCase() === 'standard') {
				quality = '480p';
			}

			if (quality.toLowerCase() === 'auto') quality = 'Auto';
			if (quality.toLowerCase() === 'adaptive') quality = 'Adaptive';
		}

		let headers: Record<string, string> = { ...HEADERS };
		if (source.url.includes('.m3u8')) {
			headers = {
				...HEADERS,
				Accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*',
				Referer: 'https://videasy.net/',
			};
		} else if (source.url.includes('.mp4') || source.url.includes('.mkv')) {
			headers = {
				...HEADERS,
				Accept: 'video/mp4,video/x-matroska,*/*',
				Range: 'bytes=0-',
			};
		}

		const title = `${mediaDetails.title} (${mediaDetails.year})`;
		let languageInfo = '';
		if (source.language) {
			const normalizedLanguage = normalizeLanguageName(source.language);
			if (normalizedLanguage) languageInfo = ` [${normalizedLanguage}]`;
		} else if (detectedLanguage) {
			languageInfo = ` [${detectedLanguage}]`;
		}

		streams.push({
			name: `VIDEASY ${serverName} (${serverConfig.language})${languageInfo} - ${quality}`,
			title,
			url: source.url,
			quality,
			size: 'Unknown',
			headers,
			provider: 'videasy',
		});
	}

	return streams;
}

async function fetchFromServer(
	serverName: string,
	serverConfig: ServerConfig,
	mediaType: string,
	title: string,
	year: string,
	tmdbId: string,
	imdbId: string,
	seasonId: number | null,
	episodeId: number | null,
	mediaDetails: MediaDetails
): Promise<Stream[]> {
	if (mediaType === 'tv' && serverConfig.moviesOnly) {
		return [];
	}

	try {
		const url = buildVideoEasyUrl(serverConfig, mediaType, title, year, tmdbId, imdbId, seasonId, episodeId);
		const encryptedData = await getText(url);
		if (!encryptedData || encryptedData.trim() === '') {
			throw new Error('No encrypted data received');
		}

		const decryptedData = await decryptVideoEasy(encryptedData, tmdbId);
		return formatStreamsForNuvio(decryptedData, serverName, serverConfig, mediaDetails);
	} catch {
		return [];
	}
}

async function getStreams(
	tmdbId: string,
	mediaType: 'movie' | 'tv',
	seasonNum: number | null,
	episodeNum: number | null
): Promise<Stream[]> {
	const mediaDetails = await fetchMediaDetails(tmdbId, mediaType);

	const serverPromises = Object.keys(SERVERS).map((serverName) => {
		const serverConfig = SERVERS[serverName];
		return fetchFromServer(
			serverName,
			serverConfig,
			mediaDetails.mediaType,
			mediaDetails.title,
			mediaDetails.year,
			tmdbId,
			mediaDetails.imdbId,
			seasonNum,
			episodeNum,
			mediaDetails
		);
	});

	const results = await Promise.all(serverPromises);
	const allStreams = results.flat();

	const uniqueStreams: Stream[] = [];
	const seenUrls = new Set<string>();
	for (const stream of allStreams) {
		if (!seenUrls.has(stream.url)) {
			seenUrls.add(stream.url);
			uniqueStreams.push(stream);
		}
	}

	const getQualityValue = (quality: string): number => {
		const q = quality.toLowerCase().replace(/p$/, '');
		if (q === '4k' || q === '2160') return 2160;
		if (q === '1440') return 1440;
		if (q === '1080') return 1080;
		if (q === '720') return 720;
		if (q === '480') return 480;
		if (q === '360') return 360;
		if (q === '240') return 240;
		if (q === 'adaptive' || q === 'auto') return 4000;
		if (q === 'unknown') return 0;

		const numQuality = parseInt(q, 10);
		return Number.isNaN(numQuality) ? 1 : numQuality;
	};

	uniqueStreams.sort((a, b) => getQualityValue(b.quality) - getQualityValue(a.quality));
	return uniqueStreams;
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const tmdbId = searchParams.get('tmdb');
	const season = searchParams.get('s');
	const episode = searchParams.get('e');

	if (!tmdbId) {
		return NextResponse.json({ error: 'Missing tmdb parameter' }, { status: 400 });
	}

	const mediaType: 'movie' | 'tv' = season && episode ? 'tv' : 'movie';
	const seasonNum = season ? parseInt(season, 10) : null;
	const episodeNum = episode ? parseInt(episode, 10) : null;

	if (
		mediaType === 'tv' &&
		(seasonNum === null || episodeNum === null || Number.isNaN(seasonNum) || Number.isNaN(episodeNum))
	) {
		return NextResponse.json({ error: 'Invalid season or episode parameters for TV show' }, { status: 400 });
	}

	try {
		const streams = await getStreams(tmdbId, mediaType, seasonNum, episodeNum);

		return NextResponse.json({
			success: true,
			tmdbId,
			mediaType,
			...(mediaType === 'tv' ? { season: seasonNum, episode: episodeNum } : {}),
			streams,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
				streams: [],
			},
			{ status: 500 }
		);
	}
}
