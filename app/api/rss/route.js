export const runtime = 'edge';

const FEEDS = {
  reuters: 'https://feeds.reuters.com/reuters/worldNews',
  bbc: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  aljazeera: 'https://www.aljazeera.com/xml/rss/all.xml',
  ap: 'https://rsshub.app/apnews/topics/world-news',
  france24: 'https://www.france24.com/en/rss',
  dw: 'https://rss.dw.com/rdf/rss-en-world',
  euronews: 'https://www.euronews.com/rss?format=mrss&level=theme&name=news',
  sky: 'https://feeds.skynews.com/feeds/rss/world.xml',
};

function extractTag(xml, tag) {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`,
    'i'
  );
  const m = xml.match(re);
  return m ? m[1].replace(/<[^>]*>/g, '').trim() : '';
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

function parseRSS(xml, source) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < 12) {
    const block = m[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    if (title) {
      items.push({ title, link, description: description.slice(0, 200), pubDate, source });
    }
  }
  return items;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'all';

  const feedsToFetch = source === 'all' ? Object.entries(FEEDS) : [[source, FEEDS[source]]];

  if (!feedsToFetch[0][1]) {
    return new Response(JSON.stringify({ items: [], error: 'Unknown feed' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const results = await Promise.allSettled(
      feedsToFetch.map(async ([key, url]) => {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 SentinelOSINT/1.0 RSS Reader',
            Accept: 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return parseRSS(text, key);
      })
    );

    const items = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    return new Response(JSON.stringify({ items }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
