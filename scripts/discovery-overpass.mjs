const OVERPASS_ENDPOINTS = [
  process.env.CAP_OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
].filter(Boolean);

const defaultBboxes = (process.env.CAP_DISCOVERY_BBOXES || [
  '29.45,-96.05,30.25,-94.95',
  '32.45,-97.75,33.35,-96.30',
  '30.05,-98.10,30.65,-97.35',
  '29.15,-98.85,29.80,-98.20',
  '33.35,-84.75,34.15,-83.85',
  '33.15,-112.45,33.85,-111.65'
].join(';')).split(';').map((x) => x.trim()).filter(Boolean);

const partitions = (bbox) => {
  const [south, west, north, east] = bbox.split(',').map(Number);
  const rows = Number(process.env.CAP_OVERPASS_ROWS || 3);
  const cols = Number(process.env.CAP_OVERPASS_COLS || 3);
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out.push([
        south + (north - south) * r / rows,
        west + (east - west) * c / cols,
        south + (north - south) * (r + 1) / rows,
        west + (east - west) * (c + 1) / cols
      ].join(','));
    }
  }
  return out;
};

const text = (v) => v ? String(v).trim() : '';

async function fetchWithResilience(query) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'User-Agent': 'AureumCAP/1.0 (contact@cactusdigitalmedia.ng)',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Accept': 'application/json'
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(60000)
        });

        if (response.ok) return await response.json();

        const status = response.status;
        lastError = new Error(`overpass_http_${status}`);
        console.warn(`[Overpass] ${endpoint} returned ${status} on attempt ${attempt}/3`);
        if (status === 406 || status === 429 || status >= 500) break;
        throw lastError;
      } catch (error) {
        lastError = error;
        console.warn(`[Overpass] ${endpoint} failed on attempt ${attempt}/3: ${error.message}`);
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }
  throw lastError || new Error('all_overpass_endpoints_failed');
}

const buildQuery = (bbox) => `[out:json][timeout:45];(
  nwr["amenity"~"^(restaurant|bar|cafe|fast_food|car_wash)$"](${bbox});
  nwr["shop"~"^(car_repair|beauty|hairdresser)$"](${bbox});
  nwr["craft"~"^(plumber|roofer|carpenter)$"](${bbox});
  nwr["office"~"^(estate_agent|lawyer|consulting)$"](${bbox});
  nwr["leisure"="fitness_centre"](${bbox});
);out center tags qt;`;

export async function discoverOverpass({ bboxes = defaultBboxes, limit = 5000 } = {}) {
  const records = [];
  const seen = new Set();

  console.log(`[Discovery] Starting Overpass discovery across ${bboxes.length} metro areas; raw limit=${limit}`);

  for (const bbox of bboxes) {
    for (const part of partitions(bbox)) {
      if (records.length >= limit) break;
      try {
        const data = await fetchWithResilience(buildQuery(part));
        for (const element of data.elements || []) {
          if (records.length >= limit) break;
          const osmKey = `${element.type}:${element.id}`;
          if (seen.has(osmKey)) continue;
          seen.add(osmKey);

          const tags = element.tags || {};
          const center = element.center || element;
          const name = text(tags.name);
          if (!name) continue;

          const website = text(tags.website || tags['contact:website'] || tags.url);
          const phone = text(tags.phone || tags['contact:phone']);
          const address = [
            tags['addr:housenumber'],
            tags['addr:street'],
            tags['addr:city'],
            tags['adr:state'],
            tags['addr:postcode']
          ].filter(Boolean).join(', ');
          const category = text(tags.amenity || tags.shop || tags.craft || tags.office || tags.leisure || 'local_business');

          records.push({
            name,
            business: name,
            category,
            location: address || text(tags['addr:city'] || tags['addr:state'] || 'United States'),
            address,
            phone,
            website,
            social_url: text(tags['contact:facebook'] || tags['contact:instagram'] || tags['contact:twitter']),
            latitude: center.lat,
            longitude: center.lon,
            source: 'openstreetmap-overpass',
            source_evidence: {
              element_type: element.type,
              element_id: element.id,
              bbox: part,
              query: 'Overpass API'
            },
            discovered_at: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`[Discovery] Partition ${part} skipped: ${error.message}`);
      }
    }
    if (records.length >= limit) break;
  }

  console.log(`[Discovery] Completed with ${records.length} raw unique OSM records`);
  return records;
}
