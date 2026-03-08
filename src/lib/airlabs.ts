import type { Airline, Airport, Flight } from "@/lib/types";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

type AirLabsResponse<T> = {
  response: T;
};

type AirLabsCache = {
  flights: Map<string, CacheEntry<Flight[]>>;
  airports: Map<string, CacheEntry<Airport | null>>;
  airlines: Map<string, CacheEntry<Airline | null>>;
};

const AIRLABS_BASE_URL = "https://airlabs.co/api/v9";
const FLIGHT_CACHE_TTL_MS = 20_000;
const METADATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const DEFAULT_FLIGHT_FIELDS = [
  "hex",
  "lat",
  "lng",
  "dir",
  "alt",
  "speed",
  "flight_iata",
  "flight_number",
  "airline_iata",
  "dep_iata",
  "arr_iata",
  "status",
  "updated",
  "aircraft_icao",
  "flag",
].join(",");

export const DEFAULT_BBOX = "-85,-180,85,180";

const globalForAirLabs = globalThis as typeof globalThis & {
  airLabsCache?: AirLabsCache;
};

const airLabsCache =
  globalForAirLabs.airLabsCache ??
  ({
    flights: new Map(),
    airports: new Map(),
    airlines: new Map(),
  } satisfies AirLabsCache);

globalForAirLabs.airLabsCache = airLabsCache;

function getApiKey() {
  const apiKey = process.env.AIRLABS_API_KEY;

  if (!apiKey) {
    throw new Error("AIRLABS_API_KEY is missing. Add it to .env.local.");
  }

  return apiKey;
}

function getCachedValue<T>(store: Map<string, CacheEntry<T>>, key: string) {
  const entry = store.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.data;
}

function setCachedValue<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  data: T,
  ttlMs: number,
) {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

async function airLabsFetch<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
) {
  const url = new URL(`${AIRLABS_BASE_URL}/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("api_key", getApiKey());

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AirLabs request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as AirLabsResponse<T>;
  return payload.response;
}

function normalizeFlight(rawFlight: Flight) {
  return {
    ...rawFlight,
    hex: rawFlight.hex?.toUpperCase() ?? `${rawFlight.lat}-${rawFlight.lng}`,
    dep_iata: rawFlight.dep_iata?.toUpperCase(),
    arr_iata: rawFlight.arr_iata?.toUpperCase(),
    airline_iata: rawFlight.airline_iata?.toUpperCase(),
    flight_iata: rawFlight.flight_iata?.toUpperCase(),
    aircraft_icao: rawFlight.aircraft_icao?.toUpperCase(),
  } satisfies Flight;
}

export async function getFlights(bbox = DEFAULT_BBOX, zoom = 2) {
  const cacheKey = `${bbox}:${zoom}`;
  const cached = getCachedValue(airLabsCache.flights, cacheKey);

  if (cached) {
    return cached;
  }

  const flights = await airLabsFetch<Flight[]>("flights", {
    bbox,
    zoom,
    _fields: DEFAULT_FLIGHT_FIELDS,
  });

  const normalizedFlights = flights
    .filter(
      (flight) =>
        Number.isFinite(flight.lat) &&
        Number.isFinite(flight.lng) &&
        typeof flight.hex === "string",
    )
    .map(normalizeFlight);

  setCachedValue(
    airLabsCache.flights,
    cacheKey,
    normalizedFlights,
    FLIGHT_CACHE_TTL_MS,
  );

  return normalizedFlights;
}

async function getAirport(code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const cached = getCachedValue(airLabsCache.airports, normalizedCode);

  if (cached !== null) {
    return cached;
  }

  const airports = await airLabsFetch<Airport[]>("airports", {
    iata_code: normalizedCode,
    _fields: "name,iata_code,icao_code,lat,lng,city,country_code",
  });

  const airport = airports[0]
    ? {
        ...airports[0],
        iata_code: airports[0].iata_code.toUpperCase(),
      }
    : null;

  setCachedValue(
    airLabsCache.airports,
    normalizedCode,
    airport,
    METADATA_CACHE_TTL_MS,
  );

  return airport;
}

export async function getAirports(codes: string[]) {
  const normalizedCodes = [...new Set(codes)]
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code));

  const airports = await Promise.all(normalizedCodes.map((code) => getAirport(code)));
  return airports.filter((airport): airport is Airport => airport !== null);
}

export async function getAirline(code: string) {
  const normalizedCode = code.trim().toUpperCase();

  if (!/^[A-Z0-9*]{2,3}$/.test(normalizedCode)) {
    return null;
  }

  const cached = getCachedValue(airLabsCache.airlines, normalizedCode);

  if (cached !== null) {
    return cached;
  }

  const airlines = await airLabsFetch<Airline[]>("airlines", {
    iata_code: normalizedCode,
    _fields: "name,iata_code,icao_code,country_code",
  });

  const airline = airlines[0]
    ? {
        ...airlines[0],
        iata_code: airlines[0].iata_code.toUpperCase(),
      }
    : null;

  setCachedValue(
    airLabsCache.airlines,
    normalizedCode,
    airline,
    METADATA_CACHE_TTL_MS,
  );

  return airline;
}
