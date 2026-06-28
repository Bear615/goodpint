import type { OsmPub } from '../types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildAddress(tags: Record<string, string>): string {
  if (tags['addr:full']) return tags['addr:full'];
  const parts: string[] = [];
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.join(', ');
}

export async function fetchNearbyPubs(lat: number, lon: number, userLat: number, userLon: number): Promise<OsmPub[]> {
  const searchRadii = [1500, 3000, 5000, 10000];

  for (const radius of searchRadii) {
    const query =
      `[out:json][timeout:25];` +
      `(node["amenity"~"pub|bar|biergarten|brewery"](around:${radius},${lat},${lon});` +
      `way["amenity"~"pub|bar|biergarten|brewery"](around:${radius},${lat},${lon}););` +
      `out center tags;`;

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'GoodPint/1.0 (https://goodpint.app)',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) throw new Error(`Overpass error ${res.status}`);
    const json = await res.json() as { elements: OsmElement[] };
    console.log('[osm] radius', radius, '→', json.elements?.length ?? 0, 'results');

    const results = json.elements
      .filter((el) => el.tags?.name && (el.lat != null || el.center != null))
      .map((el) => {
        const elLat = el.lat ?? el.center!.lat;
        const elLon = el.lon ?? el.center!.lon;
        return {
          id: `osm-${el.type}-${el.id}`,
          name: el.tags!.name!,
          lat: elLat,
          lon: elLon,
          address: buildAddress(el.tags!),
          distanceMiles: distanceMiles(userLat, userLon, elLat, elLon),
        };
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    if (results.length >= 3) return results;
  }

  return [];
}
