export const runtime = 'edge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lamin = searchParams.get('lamin') || '-90';
  const lamax = searchParams.get('lamax') || '90';
  const lomin = searchParams.get('lomin') || '-180';
  const lomax = searchParams.get('lomax') || '180';

  const username = process.env.OPENSKY_USERNAME;
  const password = process.env.OPENSKY_PASSWORD;

  const base = username
    ? `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@opensky-network.org`
    : 'https://opensky-network.org';

  const url = `${base}/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SentinelOSINT/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `OpenSky returned ${res.status}`, states: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, states: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
