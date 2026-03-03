import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface VideoResult {
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  isHD: boolean;
  rating: string;
  views: string;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    // Step 1: Get the redirect URL
    const redirectApiUrl = `https://ssbackend-2r7z.onrender.com/api/redirect?url=https://www.hentaicity.com/search/video/${encodeURIComponent(query)}`;
    
    const redirectResponse = await fetch(redirectApiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!redirectResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch redirect: ${redirectResponse.statusText}` },
        { status: redirectResponse.status }
      );
    }

    const redirectData = await redirectResponse.json();
    const finalUrl = redirectData.finalUrl;

    if (!finalUrl) {
      return NextResponse.json(
        { error: "No final URL received from redirect API" },
        { status: 500 }
      );
    }

    // Step 2: Fetch the final URL with cookies
    const pageResponse = await fetch(finalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cookie": "PHPSESSID=6ntg7ft05igrgv9j6vea63tea6; LBSERVERID=ded3128",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Referer": "https://www.hentaicity.com/",
      },
    });

    if (!pageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${pageResponse.statusText}` },
        { status: pageResponse.status }
      );
    }

    const html = await pageResponse.text();
    const $ = cheerio.load(html);

    const results: VideoResult[] = [];

    // Parse video results
    $(".thumb-list .outer-item").each((_, element) => {
      const $item = $(element);
      
      // Skip advertisement items
      if ($item.find(".ads").length > 0) {
        return;
      }

      const $videoLink = $item.find("a.video-title");
      const title = $videoLink.attr("title") || $videoLink.text().trim();
      const url = $videoLink.attr("href") || "";
      
      const thumbnail = $item.find("img.thumbtrailer__image").attr("src") || "";
      const duration = $item.find("span.time").text().trim();
      const isHD = $item.find("span.flag-hd").length > 0;
      
      // Extract rating (percentage)
      const ratingText = $item.find(".info span").first().text().trim();
      const rating = ratingText.replace("%", "").trim();
      
      // Extract views
      const viewsText = $item.find(".info span").last().text().trim();
      const views = viewsText;

      if (title && url) {
        results.push({
          title,
          url: url.startsWith("http") ? url : `https://www.hentaicity.com${url}`,
          thumbnail: thumbnail.startsWith("http") ? thumbnail : `https://www.hentaicity.com${thumbnail}`,
          duration,
          isHD,
          rating,
          views,
        });
      }
    });

    // Extract pagination info
    const totalFiles = $(".total_files").text().replace(/[()]/g, "").trim();
    const currentPage = $("#pagenumberinput").attr("value") || "1";
    const maxPage = $("#maxpage").text().trim();

    return NextResponse.json({
      success: true,
      query,
      finalUrl,
      results,
      count: results.length,
      pagination: {
        currentPage: parseInt(currentPage),
        totalPages: maxPage ? parseInt(maxPage) : 1,
        totalFiles: totalFiles || "0",
      },
    });
  } catch (error) {
    console.error("Error in hentai API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
