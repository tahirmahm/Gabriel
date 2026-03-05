// ─── Client-side Threat Classification Engine ────────────────────────────────
// No server. All scoring runs in the browser.

export const THREAT_LEVEL = {
  0: { label: 'NOMINAL', color: '#00ff41', bg: '#001100' },
  1: { label: 'GUARDED', color: '#39ff14', bg: '#001a00' },
  2: { label: 'ELEVATED', color: '#ffff00', bg: '#1a1a00' },
  3: { label: 'HIGH', color: '#ff9500', bg: '#1a0a00' },
  4: { label: 'SEVERE', color: '#ff4400', bg: '#1a0500' },
  5: { label: 'CRITICAL', color: '#ff0000', bg: '#1a0000' },
};

export const EMERGENCY_SQUAWKS = {
  '7500': { label: 'HIJACK', level: 5, color: '#ff0000' },
  '7600': { label: 'RADIO FAIL', level: 3, color: '#ff9500' },
  '7700': { label: 'EMERGENCY', level: 4, color: '#ff4400' },
  '7777': { label: 'MIL INTERCEPT', level: 4, color: '#ff4400' },
  '0000': { label: 'MIL OPS', level: 2, color: '#ffff00' },
  '7400': { label: 'UA/LINK LOST', level: 3, color: '#ff9500' },
};

export const MILITARY_CALLSIGN_PREFIXES = [
  'RCH','REACH','PAT','EVAC','JAKE','EVIL','DOOM','VIPER','COBRA',
  'FALCON','VENUS','SWORD','SHELL','DISCO','GHOST','WOLF','BONE',
  'DUKE','FURY','HAWK','IRON','RAVEN','SABER','TIGER','VALOR',
  'ZEUS','MAGMA','TOPAZ','HERKY','SPAR','EXEC','ARMY','NAVY',
  'USAF','USMC','CFC','FORGE','SLAM','CHAOS','HAVOC','BLADE',
  'GRIM','SPEAR','RECON','INTEL','EAGLE','HUNTER','PREDATOR',
  'DRACO','ANGEL','CONVOY','TROJAN','RANGER','SPARTAN',
];

export const HIGH_THREAT_KEYWORDS = [
  'explosion','blast','attack','strike','missile','rocket','bomb',
  'nuclear','chemical','biological','radiological','assassination',
  'coup','invasion','airstrike','shootdown','hijack','terror',
  'warhead','detonation','casualt','killed','dead','mass shooting',
  'dirty bomb','bioweapon','nerve agent','sarin','novichok',
];

export const MEDIUM_THREAT_KEYWORDS = [
  'conflict','military','troops','bombing','war','invaded','offensive',
  'artillery','shelling','siege','blockade','embargo','sanctions',
  'hostage','kidnap','riot','uprising','insurrection','rebel',
  'armed','weapon','gunfire','protest','confrontation','standoff',
  'submarine','carrier','battlegroup','deployment','mobiliz',
];

export const LOW_THREAT_KEYWORDS = [
  'tension','dispute','warning','alert','concern','threaten',
  'escalat','crisis','emergency','incident','accident','disaster',
  'earthquake','tsunami','hurricane','flood','wildfire','evacuate',
  'pandemic','outbreak','epidemic','contamination',
];

export const GEOGRAPHIC_HOTSPOTS = [
  { name: 'Ukraine', lat: 49.0, lon: 31.0, radius: 8, baseScore: 20 },
  { name: 'Gaza', lat: 31.5, lon: 34.5, radius: 2, baseScore: 25 },
  { name: 'Taiwan Strait', lat: 24.0, lon: 120.0, radius: 5, baseScore: 20 },
  { name: 'South China Sea', lat: 12.0, lon: 114.0, radius: 10, baseScore: 15 },
  { name: 'Iran', lat: 32.0, lon: 53.0, radius: 8, baseScore: 15 },
  { name: 'Korean Peninsula', lat: 37.5, lon: 127.5, radius: 5, baseScore: 15 },
  { name: 'Syria', lat: 35.0, lon: 38.0, radius: 6, baseScore: 18 },
  { name: 'Yemen', lat: 15.5, lon: 48.0, radius: 7, baseScore: 18 },
  { name: 'Sudan', lat: 15.0, lon: 30.0, radius: 8, baseScore: 15 },
  { name: 'Sahel', lat: 15.0, lon: 2.0, radius: 12, baseScore: 12 },
];

function distanceDeg(lat1, lon1, lat2, lon2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2);
}

// ─── Flight Scoring ───────────────────────────────────────────────────────────
export function classifyFlight(flight) {
  let score = 0;
  const alerts = [];
  const tags = [];

  const callsign = (flight.callsign || '').trim().toUpperCase();
  const squawk = String(flight.squawk || '');
  const alt = flight.geo_altitude ?? flight.baro_altitude ?? null;
  const spd = flight.velocity ?? null;
  const lat = flight.latitude ?? null;
  const lon = flight.longitude ?? null;

  // Emergency squawk codes
  if (squawk && EMERGENCY_SQUAWKS[squawk]) {
    const sq = EMERGENCY_SQUAWKS[squawk];
    score += sq.level * 20;
    alerts.push({ type: 'SQUAWK', msg: `SQ ${squawk} — ${sq.label}`, level: sq.level, color: sq.color });
    tags.push(sq.label);
  }

  // Military callsign
  const isMilitary = MILITARY_CALLSIGN_PREFIXES.some((p) => callsign.startsWith(p));
  if (isMilitary) {
    score += 15;
    tags.push('MILITARY');
    alerts.push({ type: 'MIL', msg: `Military callsign: ${callsign}`, level: 2, color: '#ffff00' });
  }

  // Unusually low / high altitude (non-zero)
  if (alt !== null && alt > 0) {
    if (alt < 500) { score += 15; tags.push('LOW ALT'); }
    if (alt > 16000) { score += 10; tags.push('HIGH ALT'); }
  }

  // Very high speed
  if (spd !== null && spd > 350) { score += 10; tags.push('HIGH SPD'); }

  // Geographic hotspot
  if (lat !== null && lon !== null) {
    for (const hs of GEOGRAPHIC_HOTSPOTS) {
      if (distanceDeg(lat, lon, hs.lat, hs.lon) < hs.radius) {
        score += hs.baseScore;
        tags.push(hs.name.toUpperCase());
        alerts.push({ type: 'GEO', msg: `In hotspot: ${hs.name}`, level: 2, color: '#ff9500' });
        break;
      }
    }
  }

  const level = Math.min(5, Math.floor(score / 20));
  return { score, level, alerts, tags, isMilitary };
}

// ─── News Scoring ─────────────────────────────────────────────────────────────
export function classifyNewsItem(item) {
  let score = 0;
  const alerts = [];
  const tags = [];

  const text = `${item.title} ${item.description || ''}`.toLowerCase();

  for (const kw of HIGH_THREAT_KEYWORDS) {
    if (text.includes(kw)) {
      score += 30;
      tags.push(kw.toUpperCase());
      alerts.push({ type: 'NEWS_HIGH', msg: `"${kw}" detected`, level: 4 });
    }
  }
  for (const kw of MEDIUM_THREAT_KEYWORDS) {
    if (text.includes(kw)) {
      score += 12;
      if (!tags.length) tags.push(kw.toUpperCase());
    }
  }
  for (const kw of LOW_THREAT_KEYWORDS) {
    if (text.includes(kw)) {
      score += 5;
    }
  }

  const level = Math.min(5, Math.floor(score / 20));
  return { score, level, alerts, tags };
}

// ─── Convergence Engine ───────────────────────────────────────────────────────
// If multiple high-threat events cluster in the same region → escalate global score
export function convergenceScore(classifiedFlights, classifiedNews) {
  let globalScore = 0;
  const convergenceAlerts = [];

  // Count high-severity flights per hotspot
  for (const hs of GEOGRAPHIC_HOTSPOTS) {
    const hsFlights = classifiedFlights.filter(
      (f) =>
        f.raw.latitude != null &&
        distanceDeg(f.raw.latitude, f.raw.longitude, hs.lat, hs.lon) < hs.radius &&
        f.result.level >= 2
    );

    const hsNews = classifiedNews.filter(
      (n) =>
        n.result.level >= 2 &&
        `${n.raw.title} ${n.raw.description || ''}`.toLowerCase().includes(hs.name.toLowerCase())
    );

    if (hsFlights.length > 0 && hsNews.length > 0) {
      const boost = (hsFlights.length + hsNews.length) * 10;
      globalScore += boost;
      convergenceAlerts.push({
        region: hs.name,
        flights: hsFlights.length,
        news: hsNews.length,
        boost,
        level: Math.min(5, Math.floor(boost / 15)),
        msg: `CONVERGENCE: ${hs.name} — ${hsFlights.length} flight(s) + ${hsNews.length} news event(s)`,
      });
    }
  }

  // Emergency squawks always elevate
  const emergencyFlights = classifiedFlights.filter((f) => f.result.level >= 4);
  globalScore += emergencyFlights.length * 25;

  // Critical news events
  const criticalNews = classifiedNews.filter((n) => n.result.level >= 4);
  globalScore += criticalNews.length * 20;

  const overallLevel = Math.min(5, Math.floor(globalScore / 30));
  return { globalScore, overallLevel, convergenceAlerts };
}

// ─── ICAO Hex to Country ──────────────────────────────────────────────────────
export function icaoCountry(icao) {
  const hex = parseInt(icao, 16);
  if (hex >= 0xA00000 && hex <= 0xAFFFFF) return 'USA';
  if (hex >= 0x400000 && hex <= 0x43FFFF) return 'GBR';
  if (hex >= 0x380000 && hex <= 0x3BFFFF) return 'FRA';
  if (hex >= 0x3C0000 && hex <= 0x3FFFFF) return 'DEU';
  if (hex >= 0x300000 && hex <= 0x37FFFF) return 'RUS';
  if (hex >= 0x780000 && hex <= 0x7BFFFF) return 'CHN';
  if (hex >= 0x700000 && hex <= 0x77FFFF) return 'IRN';
  if (hex >= 0x896000 && hex <= 0x8963FF) return 'ISR';
  if (hex >= 0x738000 && hex <= 0x73FFFF) return 'PRK';
  return '???';
}
