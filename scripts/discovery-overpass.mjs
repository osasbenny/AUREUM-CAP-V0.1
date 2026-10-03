const OVERPASS_ENDPOINTS = [
  process.env.CAP_OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
].filter(Boolean);

const defaultBbox = process.env.CAP_DISCOVERY_BBOX || '29.50,-95.90,30.20,-95.00';
const categories = (process.env.CAP_DISCOVERY_CATEGORIES || 'restaurant,bar,cafe,car_wash,beauty,barber,plumber,roofing_contractor,real_estate_agency,lawyer,car_repair,fitness_centre,shop').split(',').map((x) => x.trim()).filter(Boolean);

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
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'User-Agent': 'AureumCAP/1.0 (contact@cactusdigitalmedia.ng)',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json,application/osm3s+json'
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(45000)
        });

        if (response.ok) {
          return await response.json();
        }

        const status = response.status;
        // Retry/fallback on 406, 429, and 5xx
        if ([406, 429].includes(status) || (status >= 500 && status < 600)) {
          console.warn(`[Overpass Warning] Endpoint ${endpoint} returned status ${status}. Attempt ${attempts}/${maxAttempts}. Retrying/rotating...`);
          await new Promise((resolve) => setTimeout(resolve, attempts * 2000));
          if (status === 406 || status === 429) {
            // Break inner retry loop to try next endpoint immediately on client-rejection/rate-limit
            break;
          }
          continue;
        } else {
          throw new Error(`overpass_http_${status}`);
        }
      } catch (error) {
        lastError = error;
        console.warn(`[Overpass Error] Endpoint ${endpoint} failed: ${error.message}. Attempt ${attempts}/${maxAttempts}`);
        await new Promise((resolve) => setTimeout(resolve, attempts * 1500));
      }
    }
  }
  throw lastError || new Error('All Overpass endpoints failed');
}

export async function discoverOverpass({ bbox = defaultBbox, limit = 1000 } = {}) {
  const records = [];
  const partList = partitions(bbox);

  console.log(`[Discovery] Starting resilient Overpass discovery across ${partList.length} geographic partitions...`);

  for (const part of partList) {
    if (records.length >= limit) break;

    const filter = categories.map((c) => `nwr["amenity"="${c}"](${part});nwr["shop"="${c}"](${part});nwr["craft"="${c}"](${part});`).join('');
    const query = `[out:json][timeout:30];(${filter});out center tags;`;

    try {
      const data = await fetchWithResilience(query);
      for (const element of data.elements || []) {
        const tags = element.tags || {};
        const center = element.center || element;
        const name = text(tags.name);
        if (!name) continue;

        const website = text(tags.website || tags['contact:website'] || tags.url);
        const phone = text(tags.phone || tags['contact:phone']);
        const address = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:state'], tags['addr:postcode']].filter(Boolean).join(', ');

        records.push({
          name,
          business: name,
          category: text(tags.amenity || tags.shop || tags.craft || 'local_business'),
          location: address || text(tags['addr:city'] || 'Houston, TX'),
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

        if (records.length >= limit) break;
      }
    } catch (partitionError) {
      // Continue through smaller geographic partitions rather than kill the entire daily run
      console.error(`[Partition Error] Partition ${part} skipped due to error: ${partitionError.message}. Continuing with remaining partitions.`);
    }
  }

  console.log(`[Discovery] Resilient Overpass discovery completed. Total unique records discovered: ${records.length}`);
  return records;
}
