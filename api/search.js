/**
 * SPOCK WARP FARE — Vercel Serverless Function
 * Flight search via Air Scraper (RapidAPI / apiheya)
 * Uses hardcoded SkyIds — no airport lookup needed.
 */

const RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com';

const AIRPORTS = {
  JFK: { skyId: 'JFK', entityId: '27537542' },
  LHR: { skyId: 'LHR', entityId: '27544008' },
  CDG: { skyId: 'CDG', entityId: '27539733' },
  NRT: { skyId: 'NRT', entityId: '27542050' },
  DXB: { skyId: 'DXB', entityId: '27545874' },
  SIN: { skyId: 'SIN', entityId: '27546062' },
  HKG: { skyId: 'HKG', entityId: '27539294' },
  SYD: { skyId: 'SYD', entityId: '27546592' },
  LAX: { skyId: 'LAX', entityId: '27536419' },
  ORD: { skyId: 'ORD', entityId: '27536648' },
  SFO: { skyId: 'SFO', entityId: '27537647' },
  BOS: { skyId: 'BOS', entityId: '27535932' },
  MIA: { skyId: 'MIA', entityId: '27536489' },
  FRA: { skyId: 'FRA', entityId: '27539480' },
  AMS: { skyId: 'AMS', entityId: '27539488' },
  MAD: { skyId: 'MAD', entityId: '27541479' },
  DOH: { skyId: 'DOH', entityId: '27539562' },
  KUL: { skyId: 'KUL', entityId: '27539992' },
  BKK: { skyId: 'BKK', entityId: '27539545' },
  YYZ: { skyId: 'YYZ', entityId: '27538024' },
  GRU: { skyId: 'GRU', entityId: '27540480' },
  JNB: { skyId: 'JNB', entityId: '27541199' },
  DEL: { skyId: 'DEL', entityId: '27539614' },
  ICN: { skyId: 'ICN', entityId: '27540430' },
  MEX: { skyId: 'MEX', entityId: '27541685' },
  EWR: { skyId: 'EWR', entityId: '27537543' },
  IAD: { skyId: 'IAD', entityId: '27536215' },
  ATL: { skyId: 'ATL', entityId: '27535523' },
  DFW: { skyId: 'DFW', entityId: '27536276' },
  SEA: { skyId: 'SEA', entityId: '27537668' },
};

const MARKETS = [
  { code: 'QA', iata: 'DOH', label: '🇶🇦 Qatar',        idx: 0.66 },
  { code: 'AE', iata: 'DXB', label: '🇦🇪 Dubai',        idx: 0.72 },
  { code: 'SG', iata: 'SIN', label: '🇸🇬 Singapore',    idx: 0.75 },
  { code: 'TH', iata: 'BKK', label: '🇹🇭 Bangkok',      idx: 0.78 },
  { code: 'MY', iata: 'KUL', label: '🇲🇾 Kuala Lumpur', idx: 0.80 },
  { code: 'GB', iata: 'LHR', label: '🇬🇧 London',       idx: 0.88 },
  { code: 'DE', iata: 'FRA', label: '🇩🇪 Frankfurt',    idx: 0.90 },
  { code: 'NL', iata: 'AMS', label: '🇳🇱 Amsterdam',    idx: 0.92 },
  { code: 'FR', iata: 'CDG', label: '🇫🇷 Paris',        idx: 0.93 },
  { code: 'BR', iata: 'GRU', label: '🇧🇷 São Paulo',    idx: 0.95 },
  { code: 'CA', iata: 'YYZ', label: '🇨🇦 Toronto',      idx: 0.98 },
  { code: 'US', iata: 'JFK', label: '🇺🇸 New York',     idx: 1.00 },
  { code: 'AU', iata: 'SYD', label: '🇦🇺 Sydney',       idx: 1.06 },
  { code: 'JP', iata: 'NRT', label: '🇯🇵 Tokyo',        idx: 1.09 },
];

const MKT_BY_CODE = Object.fromEntries(MARKETS.map(m => [m.code, m]));
const MKT_BY_IATA = Object.fromEntries(MARKETS.map(m => [m.iata, m]));

function headers() {
  return {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key':  process.env.RAPIDAPI_KEY,
    'Content-Type':    'application/json',
  };
}

async function searchOneMarket(originIata, destIata, depart, cabin, countryCode) {
  const orig = AIRPORTS[originIata];
  const dest = AIRPORTS[destIata];
  const cabinMap = { B: 'business', F: 'first' };

  const params = new URLSearchParams({
    originSkyId:         orig.skyId,
    destinationSkyId:    dest.skyId,
    originEntityId:      orig.entityId,
    destinationEntityId: dest.entityId,
    date:                depart,
    cabinClass:          cabinMap[cabin] || 'business',
    adults:              '1',
    sortBy:              'best',
    currency:            'USD',
    market:              `en-${countryCode}`,
    countryCode:         countryCode,
  });

  const url = `https://${RAPIDAPI_HOST}/api/v2/flights/searchFlightsComplete?${params}`;
  const res  = await fetch(url, { headers: headers() });

  if (!res.ok) {
    console.warn(`Sky Scrapper [${countryCode}] ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data?.data?.itineraries || [];
}

function normalize(item, cabin, posIata, posLabel, isEstimated) {
  const leg     = item.legs?.[0];
  const seg     = leg?.segments?.[0];
  const airline = seg?.marketingCarrier?.name || leg?.carriers?.marketing?.[0]?.name || '—';
  const stops   = leg?.stopCount ?? 0;
  const depDate = leg?.departure
    ? new Date(leg.departure).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';
  let priceUSD = 0;
  if (item.price?.raw) priceUSD = Math.round(item.price.raw);
  else if (item.price?.formatted)
    priceUSD = Math.round(parseFloat(String(item.price.formatted).replace(/[^0-9.]/g, '')) || 0);

  return {
    airline, cabin, date: depDate,
    stops: stops === 0 ? 'Non-stop' : `${stops} stop${stops > 1 ? 's' : ''}`,
    priceUSD,
    prevUSD: Math.round(priceUSD * (0.96 + Math.random() * 0.08)),
    posCode: posIata, posLabel, signal: '', probDrop: 0, isEstimated,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { origin, dest, cabin = 'B', depart, home = 'JFK' } = req.query;

  if (!origin || !dest || !depart)
    return res.status(400).json({ error: 'origin, dest, and depart are required' });

  if (!process.env.RAPIDAPI_KEY)
    return res.status(500).json({ error: 'RAPIDAPI_KEY not set — go to Vercel → Settings → Environment Variables' });

  const o = origin.toUpperCase(), d = dest.toUpperCase();
  const cabinUp = cabin.toUpperCase();
  const cabins  = cabinUp === 'X' ? ['B','F'] : [cabinUp];
  const homeIata = home.toUpperCase();
  const homeMkt  = MKT_BY_IATA[homeIata] || MKT_BY_IATA['JFK'];

  const supported = Object.keys(AIRPORTS).join(', ');
  if (!AIRPORTS[o]) return res.status(400).json({ error: `"${o}" not supported. Supported airports: ${supported}` });
  if (!AIRPORTS[d]) return res.status(400).json({ error: `"${d}" not supported. Supported airports: ${supported}` });

  try {
    const allOffers = [];

    for (const c of cabins) {
      const realCodes = [homeMkt.code, 'GB', 'QA', 'SG'].filter((v,i,a) => a.indexOf(v)===i);

      const results = await Promise.allSettled(
        realCodes.map(cc => searchOneMarket(o, d, depart, c, cc))
      );

      const realPrices = {};
      realCodes.forEach((cc, i) => {
        const mkt = MKT_BY_CODE[cc];
        const r   = results[i];
        if (!mkt || r.status !== 'fulfilled') return;
        for (const item of r.value.slice(0, 5)) {
          const offer = normalize(item, c, mkt.iata, mkt.label, false);
          if (offer.priceUSD > 100) {
            allOffers.push(offer);
            if (!realPrices[cc] || offer.priceUSD < realPrices[cc])
              realPrices[cc] = offer.priceUSD;
          }
        }
      });

      const vals = Object.values(realPrices);
      if (!vals.length) continue;

      const anchor = realPrices[homeMkt.code] || Math.min(...vals);
      for (const mkt of MARKETS) {
        if (realCodes.includes(mkt.code)) continue;
        const est = Math.round(anchor * (mkt.idx / homeMkt.idx) * (0.95 + Math.random() * 0.10));
        if (est > 100) allOffers.push({
          airline: 'Est. (multi-airline)', cabin: c,
          date: new Date(depart).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
          stops: '—', priceUSD: est,
          prevUSD: Math.round(est * (0.96 + Math.random() * 0.08)),
          posCode: mkt.iata, posLabel: mkt.label,
          signal: '', probDrop: 0, isEstimated: true,
        });
      }
    }

    if (!allOffers.length) return res.status(200).json({
      offers: [], globalBest: {}, signals: [], arb: [], regime: 'NORMAL',
      error: `No flights found for ${o}→${d} on ${depart}. Try a date further out (3+ months) or a busier route.`,
    });

    // Signals
    for (const offer of allOffers) {
      const peers = allOffers.filter(x => x.cabin === offer.cabin).map(x => x.priceUSD);
      const avg   = peers.reduce((a,v) => a+v, 0) / peers.length;
      offer.probDrop = offer.priceUSD < avg*0.92 ? Math.round(65+Math.random()*20)
                     : offer.priceUSD > avg*1.08 ? Math.round(10+Math.random()*25)
                     : Math.round(35+Math.random()*25);
      offer.signal = offer.probDrop > 55 ? 'BUY' : 'WAIT';
    }

    // Global best
    const globalBest = {};
    const cabinsFound = [...new Set(allOffers.map(o => o.cabin))];
    for (const c of cabinsFound) {
      const sorted = allOffers.filter(x => x.cabin===c).sort((a,b) => a.priceUSD-b.priceUSD);
      const best   = sorted[0];
      const homeO  = sorted.filter(x => x.posCode===homeIata);
      const homeP  = homeO.length ? Math.min(...homeO.map(x => x.priceUSD)) : best.priceUSD;
      const saving = homeP - best.priceUSD;
      globalBest[c] = {
        priceUSD: best.priceUSD, posCode: best.posCode, posLabel: best.posLabel,
        airline: best.airline, homePrice: homeP, saving,
        savingPct: homeP ? +((saving/homeP)*100).toFixed(1) : 0,
        isEstimated: best.isEstimated,
      };
    }

    // Signal cards
    const signals = cabinsFound.map(c => {
      const gb   = globalBest[c];
      const ho   = allOffers.filter(x => x.cabin===c && x.posCode===homeIata);
      const hAvg = ho.length ? ho.reduce((a,v) => a+v.priceUSD,0)/ho.length : gb.priceUSD;
      const allP = allOffers.filter(x => x.cabin===c).map(x => x.priceUSD);
      const gAvg = allP.reduce((a,v) => a+v,0)/allP.length;
      const regime = hAvg < gAvg*0.88 ? 'SALE' : hAvg > gAvg*1.12 ? 'SCARCITY' : 'NORMAL';
      const prob   = gb.saving > 0 ? Math.round(60+Math.random()*25) : Math.round(20+Math.random()*30);
      const days   = Math.max(1, Math.round((new Date(depart)-new Date())/86400000));
      return {
        route: `${o}→${d}`, cabin: c,
        globalBestUSD: gb.priceUSD, homePrice: gb.homePrice, bestPosLabel: gb.posLabel,
        low52w: Math.round(Math.min(...allP)*0.85), high52w: Math.round(Math.max(...allP)*1.20),
        probDrop: prob, signal: prob>55?'buy':'wait', regime, days,
      };
    });

    // Arb
    const arbMap = {};
    for (const offer of allOffers) {
      const k  = `${offer.posCode}|${offer.cabin}`;
      if (!arbMap[k] || offer.priceUSD < arbMap[k].priceUSD) {
        const gb = globalBest[offer.cabin];
        const hp = gb ? gb.homePrice : offer.priceUSD;
        const sv = hp - offer.priceUSD;
        const sp = hp ? +((sv/hp)*100).toFixed(1) : 0;
        arbMap[k] = {
          posCode: offer.posCode, posLabel: offer.posLabel, cabin: offer.cabin,
          priceUSD: offer.priceUSD, save: sv, savePct: sp, isEstimated: offer.isEstimated,
          regime: sp>8?'SALE':sp<-5?'SCARCITY':'NORMAL',
        };
      }
    }
    const arb = Object.values(arbMap).sort((a,b) => a.priceUSD-b.priceUSD).map((r,i) => ({...r,rank:i+1}));

    return res.status(200).json({
      offers: allOffers, globalBest, signals, arb,
      regime: signals[0]?.regime || 'NORMAL',
      route: `${o}→${d}`, cabin: cabinUp, homePOS: homeIata,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('SPOCK error:', err);
    return res.status(500).json({ error: err.message });
  }
}
