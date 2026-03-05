export const runtime = 'edge';

// ADS-B Exchange proxy – returns military / interesting / emergency flights
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'mil'; // mil | ladd | pia | squawks

  const apiKey = process.env.ADSB_RAPIDAPI_KEY;

  if (!apiKey) {
    // Fallback: use ADS-B Exchange public endpoint (no key, limited data)
    try {
      const fallbackUrl = 'https://opensky-network.org/api/states/all?lamin=20&lamax=70&lomin=-130&lomax=50';
      const res = await fetch(fallbackUrl, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Filter for possible military patterns from callsigns
      const militaryPrefixes = [
        'RCH', 'REACH', 'PAT', 'EVAC', 'JAKE', 'EVIL', 'DOOM', 'VIPER',
        'COBRA', 'FALCON', 'VENUS', 'SWORD', 'SHELL', 'DISCO', 'GHOST',
        'WOLF', 'BONE', 'DUKE', 'FURY', 'HAWK', 'IRON', 'RAVEN', 'SABER',
        'TIGER', 'VALOR', 'ZEUS', 'ARMY', 'NAVY', 'USAF', 'USMC', 'CFC',
        'MAGMA', 'TOPAZ', 'HERKY', 'SPAR', 'EXEC', 'SAM', 'AIR FORCE',
      ];
      const states = (data.states || []).filter((s) => {
        const cs = (s[1] || '').trim().toUpperCase();
        return militaryPrefixes.some((p) => cs.startsWith(p));
      });
      return new Response(JSON.stringify({ ac: states.map(stateToAC) }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ac: [], error: 'No ADS-B key configured' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // With RapidAPI key – use official ADS-B Exchange v2 API
  const endpointMap = {
    mil: 'https://adsbexchange-com1.p.rapidapi.com/v2/mil/',
    ladd: 'https://adsbexchange-com1.p.rapidapi.com/v2/ladd/',
    pia: 'https://adsbexchange-com1.p.rapidapi.com/v2/pia/',
    squawks: 'https://adsbexchange-com1.p.rapidapi.com/v2/squawk/7700/',
  };
  const url = endpointMap[type] || endpointMap['mil'];

  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'adsbexchange-com1.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ac: [], error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function stateToAC(s) {
  return {
    icao24: s[0],
    callsign: (s[1] || '').trim(),
    origin_country: s[2],
    longitude: s[5],
    latitude: s[6],
    geo_altitude: s[13],
    velocity: s[9],
    true_track: s[10],
    squawk: s[14],
    on_ground: s[8],
  };
}
