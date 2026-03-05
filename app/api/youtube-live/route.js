export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return new Response(JSON.stringify({ error: 'missing channelId' }), { status: 400 });
  }

  try {
    // Fetch YouTube channel RSS feed — no API key needed
    const rss = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
    );

    if (!rss.ok) throw new Error(`RSS ${rss.status}`);

    const xml = await rss.text();

    // Extract video IDs — the first entry is usually the live stream for 24/7 news channels
    const videoIds = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map((m) => m[1]);

    if (!videoIds.length) throw new Error('no videos found');

    return new Response(JSON.stringify({ videoId: videoIds[0], allIds: videoIds.slice(0, 5) }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
