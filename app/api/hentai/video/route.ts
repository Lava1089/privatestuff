import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface RelatedVideo {
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
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    // Validate URL
    if (!url.includes("hentaicity.com")) {
      return NextResponse.json(
        { error: "Invalid URL. Must be a hentaicity.com URL" },
        { status: 400 }
      );
    }

    // Fetch the video page
    const pageResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

    // Extract video title
    const videoTitle = $("h1").first().text().trim();

    // Extract video ID from URL
    // URL format: /video/title-with-dashes-VIDEO_ID.html
    // Extract the part between the last dash and .html
    const videoIdMatch = url.match(/-([^-]+)\.html$/);
    const shortId = videoIdMatch ? videoIdMatch[1] : "";
    
    const relatedVideos: RelatedVideo[] = [];

    // Fetch related videos from AJAX endpoint
    if (shortId) {
      try {
        const timestamp = Date.now();
        const ajaxUrl = "https://www.hentaicity.com/stp/ajax.php";
        
        // Build form data matching the browser's actual request
        const formData = new URLSearchParams();
        formData.append("xjxfun", "related_videos");
        formData.append("xjxr", timestamp.toString());
        formData.append("xjxargs[]", `S${shortId}`);
        formData.append("xjxargs[]", "N1");
        formData.append("xjxargs[]", "N12");
        
        console.log("=== AJAX REQUEST DEBUG ===");
        console.log("Video ID extracted:", shortId);
        console.log("AJAX URL:", ajaxUrl);
        console.log("Form Data:", formData.toString());
        console.log("Full payload:", {
          xjxfun: "related_videos",
          xjxr: timestamp.toString(),
          "xjxargs[]": [`S${shortId}`, "N1", "N12"]
        });
        
        const ajaxResponse = await fetch(ajaxUrl, {
          method: "POST",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": "PHPSESSID=6ntg7ft05igrgv9j6vea63tea6; LBSERVERID=ded3128",
            "Origin": "https://www.hentaicity.com",
            "Referer": url,
            "If-Modified-Since": "Sat, 1 Jan 2000 00:00:00 GMT",
            "Priority": "u=1, i",
            "Accept": "*/*",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: formData.toString(),
        });

        console.log("AJAX Response Status:", ajaxResponse.status, ajaxResponse.statusText);
        console.log("AJAX Response Headers:", Object.fromEntries(ajaxResponse.headers.entries()));

        if (ajaxResponse.ok) {
          const xmlText = await ajaxResponse.text();
          console.log("AJAX Response (first 500 chars):", xmlText.substring(0, 500));
          console.log("AJAX Response length:", xmlText.length);
          
          // Extract HTML content from XML CDATA section
          const cdataMatch = xmlText.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
          console.log("CDATA match found:", !!cdataMatch);
          
          if (cdataMatch && cdataMatch[1]) {
            const relatedHtml = cdataMatch[1];
            console.log("Related HTML (first 500 chars):", relatedHtml.substring(0, 500));
            console.log("Related HTML length:", relatedHtml.length);
            
            const $related = cheerio.load(relatedHtml);
            
            const outerItems = $related(".outer-item");
            console.log("Found .outer-item elements:", outerItems.length);
            
            // Parse each video item
            $related(".outer-item").each((index, element) => {
              const $item = $related(element);
              
              console.log(`\nProcessing item ${index + 1}:`);
              
              // Skip ads
              if ($item.find("iframe").length > 0 || $item.hasClass("ads")) {
                console.log("  - Skipping (ad detected)");
                return;
              }
              
              const $videoLink = $item.find("a.video-title");
              const title = $videoLink.attr("title") || $videoLink.text().trim();
              const videoUrl = $videoLink.attr("href") || "";
              
              console.log("  - Title:", title);
              console.log("  - URL:", videoUrl);
              
              const $thumbImg = $item.find("img.thumbtrailer__image");
              const thumbnail = $thumbImg.attr("src") || "";
              
              const duration = $item.find("span.time").text().trim();
              const isHD = $item.find("span.flag-hd").length > 0;
              
              console.log("  - Thumbnail:", thumbnail.substring(0, 50));
              console.log("  - Duration:", duration, "| HD:", isHD);
              
              // Extract rating and views from info section
              const $infoSpans = $item.find(".info span");
              let rating = "";
              let views = "";
              
              if ($infoSpans.length >= 2) {
                // Rating is in the first span (e.g., "67%")
                rating = $infoSpans.eq(0).text().trim().replace(/[^0-9]/g, "");
                
                // Views are in the second span
                views = $infoSpans.eq(1).text().trim().replace(/[^0-9]/g, "");
              }
              
              console.log("  - Rating:", rating, "| Views:", views);
              
              if (title && videoUrl) {
                console.log("  - Added to results!");
                relatedVideos.push({
                  title,
                  url: videoUrl.startsWith("http") ? videoUrl : `https://www.hentaicity.com${videoUrl}`,
                  thumbnail: thumbnail.startsWith("http") ? thumbnail : `https://www.hentaicity.com${thumbnail}`,
                  duration,
                  isHD,
                  rating,
                  views,
                });
              } else {
                console.log("  - Skipped (missing title or URL)");
              }
            });
          }
        }
      } catch (error) {
        console.error("Error fetching related videos:", error);
      }
    } else {
      console.log("No video ID found in URL!");
    }

    console.log("\n=== EXTRACTION SUMMARY ===");
    console.log("Total related videos extracted:", relatedVideos.length);

    // Extract video details
    const videoDetails = {
      title: videoTitle,
      url: url,
    };

    return NextResponse.json({
      success: true,
      video: videoDetails,
      relatedVideos,
      relatedCount: relatedVideos.length,
    });
  } catch (error) {
    console.error("Error in hentai video API:", error);
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
