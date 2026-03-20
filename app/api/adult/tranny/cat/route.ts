import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { to as BASE_URL } from '@/app/url/baseurl';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${BASE_URL}trannytube/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': BASE_URL,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch categories', status: response.status }, { status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const categories: Array<{ title: string; url: string; thumbnail: string }> = [];

    $('.th.cat').each((_, el) => {
      const $el = $(el);
      const $a = $el.find('a.pp').first();
      const $img = $el.find('img');

      const title = $a.attr('title') || $a.text().trim();
      const url = $a.attr('href') || '';
      const thumbnail = $img.attr('src') || '';

      if (title && url) {
        categories.push({ title, url, thumbnail });
      }
    });

    return NextResponse.json({ success: true, totalCategories: categories.length, categories });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
