import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { to as BASE_URL } from '@/app/url/baseurl';

export async function GET(req: NextRequest) {
  try {
    const rawUrl = req.nextUrl.searchParams.get('url');
    if (!rawUrl) {
      return NextResponse.json({ error: 'Query parameter "url" is required' }, { status: 400 });
    }

    // normalize: strip slug after /view/{id}/ → https://www.tranny.one/view/1046678/
    const idMatch0 = rawUrl.match(/(https?:\/\/[^/]+\/view\/\d+\/)/);
    const url = idMatch0 ? idMatch0[1] : rawUrl;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': BASE_URL,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch video page', status: response.status }, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim() || $('title').text().replace(/ - Tranny\.one.*$/i, '').trim();
    const thumbnail = $('meta[property="og:image"]').attr('content') || '';

    // Extract streams from inline script — pattern: src="URL" ... res="quality" label="label"
    const streams: Array<{ quality: string; url: string }> = [];

    $('script').each((_, el) => {
      const src = $(el).html() || '';
      if (!src.includes('stream.tranny.one')) return;

      const sourceMatches = [...src.matchAll(/<source src="([^"]+)"[^>]*res="([^"]+)"/g)];
      for (const m of sourceMatches) {
        streams.push({ quality: m[2], url: m[1] });
      }

      // fallback: just grab all stream URLs if res attr not found
      if (streams.length === 0) {
        const urlMatches = [...src.matchAll(/src="(https:\/\/stream\.tranny\.one\/[^"]+)"/g)];
        for (const m of urlMatches) {
          if (!streams.find(s => s.url === m[1])) {
            streams.push({ quality: 'default', url: m[1] });
          }
        }
      }
    });

    // poster from inline script
    const posterMatch = html.match(/let poster\s*=\s*[^']*'([^']+)'/);
    const poster = posterMatch ? posterMatch[1] : thumbnail;

    // extract video ID from normalized URL e.g. https://www.tranny.one/view/1141780/
    const idMatch = url.match(/\/view\/(\d+)\//);
    const related: Array<{ title: string; url: string; thumbnail: string; duration: string }> = [];

    if (idMatch) {
      const videoId = idMatch[1];
      const ajaxUrl = `${BASE_URL}?area=ajaxRelatedMovieListViewer&id=${videoId}&_=${Date.now()}`;

      const relRes = await fetch(ajaxUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': url,
        },
      });

      if (relRes.ok) {
        const relJson = await relRes.json();
        if (relJson.result === 'success' && Array.isArray(relJson.list)) {
          for (const item of relJson.list) {
            related.push({
              title: item.name,
              url: `${BASE_URL}view/${item.id}/${item.name2Slug}/`,
              thumbnail: `https://cdn.tranny.one/thumbs/308x232/${item.thumb}`,
              duration: item.duration,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, title, thumbnail: poster, streams, related });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
