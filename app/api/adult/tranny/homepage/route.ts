import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { to as BASE_URL } from '@/app/url/baseurl';

export async function GET(req: NextRequest) {
  try {
    const page = req.nextUrl.searchParams.get('page') || '1';
    const targetUrl = `${BASE_URL}?from_videos=${page}`;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': BASE_URL,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch content', status: response.status }, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const items: Array<{
      title: string;
      url: string;
      thumbnail: string;
      preview?: string;
      duration: string;
    }> = [];

    $('.th').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('a.pp').first();
      const $img = $el.find('img');

      const url = $a.attr('href') || '';
      const title = $img.attr('alt')?.replace(/ Shemale Porn$/i, '').trim() || $el.find('.video-title span').text().trim();
      const thumbnail = $img.attr('data-src') || $img.attr('src') || '';
      const preview = $img.attr('data-preview') || '';
      const duration = $el.find('.btime').text().trim();

      if (url && title) {
        items.push({
          title,
          url: url.startsWith('http') ? url : BASE_URL.replace(/\/$/, '') + url,
          thumbnail,
          ...(preview && { preview }),
          duration,
        });
      }
    });

    return NextResponse.json({ success: true, page: parseInt(page), totalItems: items.length, items });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
