const USGS_EARTHQUAKE_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const NASA_EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30";
const NWS_ALERTS_URL = "https://api.weather.gov/alerts/active";
const WORLD_MONITOR_REVALIDATE_SECONDS = 60 * 15;

export type WorldClockCity = {
  city: string;
  id: string;
  label: string;
  marketClose?: number;
  marketOpen?: number;
  timezone: string;
};

export const WORLD_CLOCK_CITIES: WorldClockCity[] = [
  {
    id: "new-york",
    city: "New York",
    label: "NYSE",
    timezone: "America/New_York",
    marketOpen: 9,
    marketClose: 16,
  },
  {
    id: "london",
    city: "London",
    label: "LSE",
    timezone: "Europe/London",
    marketOpen: 8,
    marketClose: 16,
  },
  {
    id: "dubai",
    city: "Dubai",
    label: "DFM",
    timezone: "Asia/Dubai",
    marketOpen: 10,
    marketClose: 14,
  },
  {
    id: "mumbai",
    city: "Mumbai",
    label: "NSE",
    timezone: "Asia/Kolkata",
    marketOpen: 9,
    marketClose: 15,
  },
  {
    id: "singapore",
    city: "Singapore",
    label: "SGX",
    timezone: "Asia/Singapore",
    marketOpen: 9,
    marketClose: 17,
  },
  {
    id: "tokyo",
    city: "Tokyo",
    label: "TSE",
    timezone: "Asia/Tokyo",
    marketOpen: 9,
    marketClose: 15,
  },
  {
    id: "sydney",
    city: "Sydney",
    label: "ASX",
    timezone: "Australia/Sydney",
    marketOpen: 10,
    marketClose: 16,
  },
  {
    id: "sao-paulo",
    city: "Sao Paulo",
    label: "B3",
    timezone: "America/Sao_Paulo",
    marketOpen: 10,
    marketClose: 17,
  },
];

export type WorldMonitorEarthquake = {
  id: string;
  latitude: number;
  longitude: number;
  magnitude: number | null;
  place: string;
  significance: number;
  time: string;
  title: string;
  tsunami: boolean;
  url: string;
};

export type WorldMonitorNaturalEvent = {
  category: string;
  categoryId: string;
  date: string;
  id: string;
  latitude: number;
  longitude: number;
  magnitudeLabel: string | null;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
};

export type WorldMonitorWeatherAlert = {
  area: string;
  centroid: [number, number] | null;
  event: string;
  expires: string;
  headline: string;
  id: string;
  onset: string;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
};

export type WorldMonitorDashboardData = {
  earthquakes: WorldMonitorEarthquake[];
  errors: string[];
  naturalEvents: WorldMonitorNaturalEvent[];
  strongestEarthquake: WorldMonitorEarthquake | null;
  weatherAlerts: WorldMonitorWeatherAlert[];
  worldClocks: WorldClockCity[];
};

type UsgsEarthquakeResponse = {
  features: Array<{
    id: string;
    geometry?: {
      coordinates?: number[];
    };
    properties?: {
      mag?: number | null;
      place?: string | null;
      sig?: number | null;
      time?: number | null;
      title?: string | null;
      tsunami?: number | null;
      url?: string | null;
    };
  }>;
};

type EonetResponse = {
  events: Array<{
    categories?: Array<{
      id?: string;
      title?: string;
    }>;
    geometry?: Array<{
      coordinates?: number[];
      date?: string;
      magnitudeUnit?: string;
      magnitudeValue?: number;
    }>;
    id: string;
    sources?: Array<{
      id?: string;
      url?: string;
    }>;
    title: string;
  }>;
};

type NwsResponse = {
  features: Array<{
    geometry?: {
      coordinates?: number[][][] | number[][][][];
      type?: string;
    } | null;
    id: string;
    properties: {
      areaDesc?: string;
      event?: string;
      expires?: string;
      headline?: string;
      onset?: string;
      severity?: WorldMonitorWeatherAlert["severity"];
    };
  }>;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    next: {
      revalidate: WORLD_MONITOR_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function normalizeEarthquakes(response: UsgsEarthquakeResponse) {
  return response.features
    .map((feature) => {
      const coordinates = feature.geometry?.coordinates;
      const properties = feature.properties;

      if (!coordinates || coordinates.length < 2 || !properties) {
        return null;
      }

      return {
        id: feature.id,
        latitude: coordinates[1]!,
        longitude: coordinates[0]!,
        magnitude:
          typeof properties.mag === "number" ? properties.mag : null,
        place: properties.place ?? "Unknown location",
        significance: properties.sig ?? 0,
        time: properties.time
          ? new Date(properties.time).toISOString()
          : new Date().toISOString(),
        title: properties.title ?? properties.place ?? "Earthquake",
        tsunami: properties.tsunami === 1,
        url: properties.url ?? "https://earthquake.usgs.gov/",
      } satisfies WorldMonitorEarthquake;
    })
    .filter(
      (earthquake): earthquake is WorldMonitorEarthquake => earthquake !== null,
    )
    .sort((left, right) => {
      const leftMagnitude = left.magnitude ?? 0;
      const rightMagnitude = right.magnitude ?? 0;

      if (rightMagnitude !== leftMagnitude) {
        return rightMagnitude - leftMagnitude;
      }

      return right.significance - left.significance;
    })
    .slice(0, 36);
}

function buildMagnitudeLabel(
  magnitudeValue?: number,
  magnitudeUnit?: string,
) {
  if (typeof magnitudeValue !== "number") {
    return null;
  }

  if (magnitudeUnit) {
    return `${magnitudeValue.toFixed(1)} ${magnitudeUnit}`;
  }

  return magnitudeValue.toFixed(1);
}

function normalizeNaturalEvents(response: EonetResponse) {
  return response.events
    .map((event) => {
      const latestGeometry = event.geometry?.at(-1);
      const coordinates = latestGeometry?.coordinates;
      const primaryCategory = event.categories?.[0];
      const primarySource = event.sources?.[0];

      if (!coordinates || coordinates.length < 2) {
        return null;
      }

      return {
        category: primaryCategory?.title ?? "Natural event",
        categoryId: primaryCategory?.id ?? "manmade",
        date: latestGeometry?.date ?? new Date().toISOString(),
        id: event.id,
        latitude: coordinates[1]!,
        longitude: coordinates[0]!,
        magnitudeLabel: buildMagnitudeLabel(
          latestGeometry?.magnitudeValue,
          latestGeometry?.magnitudeUnit,
        ),
        sourceName: primarySource?.id ?? "NASA EONET",
        sourceUrl: primarySource?.url ?? null,
        title: event.title,
      } satisfies WorldMonitorNaturalEvent;
    })
    .filter(
      (event): event is WorldMonitorNaturalEvent => event !== null,
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 28);
}

function extractAlertCentroid(
  geometry?: NwsResponse["features"][number]["geometry"],
) {
  if (!geometry?.type || !geometry.coordinates) {
    return null;
  }

  try {
    if (geometry.type === "Polygon") {
      const ring = geometry.coordinates[0] as number[][];

      if (!Array.isArray(ring) || ring.length === 0) {
        return null;
      }

      const [longitude, latitude] = ring.reduce(
        (totals, coordinate) => [
          totals[0] + coordinate[0],
          totals[1] + coordinate[1],
        ],
        [0, 0],
      );

      return [latitude / ring.length, longitude / ring.length] as [number, number];
    }

    if (geometry.type === "MultiPolygon") {
      const polygon = geometry.coordinates[0]?.[0] as number[][] | undefined;

      if (!Array.isArray(polygon) || polygon.length === 0) {
        return null;
      }

      const [longitude, latitude] = polygon.reduce(
        (totals, coordinate) => [
          totals[0] + coordinate[0],
          totals[1] + coordinate[1],
        ],
        [0, 0],
      );

      return [
        latitude / polygon.length,
        longitude / polygon.length,
      ] as [number, number];
    }
  } catch {
    return null;
  }

  return null;
}

function severityRank(severity: WorldMonitorWeatherAlert["severity"]) {
  switch (severity) {
    case "Extreme":
      return 4;
    case "Severe":
      return 3;
    case "Moderate":
      return 2;
    case "Minor":
      return 1;
    default:
      return 0;
  }
}

function normalizeWeatherAlerts(response: NwsResponse) {
  return response.features
    .map((feature) => ({
      area: feature.properties.areaDesc ?? "Unknown area",
      centroid: extractAlertCentroid(feature.geometry ?? undefined),
      event: feature.properties.event ?? "Weather alert",
      expires: feature.properties.expires ?? new Date().toISOString(),
      headline: feature.properties.headline ?? "Weather alert",
      id: feature.id,
      onset: feature.properties.onset ?? new Date().toISOString(),
      severity: feature.properties.severity ?? "Unknown",
    }))
    .sort((left, right) => {
      const severityDifference =
        severityRank(right.severity) - severityRank(left.severity);

      if (severityDifference !== 0) {
        return severityDifference;
      }

      return left.expires.localeCompare(right.expires);
    })
    .slice(0, 24);
}

async function getEarthquakes() {
  const response = await fetchJson<UsgsEarthquakeResponse>(USGS_EARTHQUAKE_URL);
  return normalizeEarthquakes(response);
}

async function getNaturalEvents() {
  const response = await fetchJson<EonetResponse>(NASA_EONET_URL);
  return normalizeNaturalEvents(response);
}

async function getWeatherAlerts() {
  const response = await fetchJson<NwsResponse>(NWS_ALERTS_URL, {
    headers: {
      "User-Agent": "Airscope/1.0 world monitor dashboard",
    },
  });

  return normalizeWeatherAlerts(response);
}

export async function getWorldMonitorDashboardData() {
  const [earthquakes, naturalEvents, weatherAlerts] = await Promise.allSettled([
    getEarthquakes(),
    getNaturalEvents(),
    getWeatherAlerts(),
  ]);

  const errors: string[] = [];

  if (earthquakes.status === "rejected") {
    errors.push("Earthquake data is unavailable right now.");
  }

  if (naturalEvents.status === "rejected") {
    errors.push("Natural event data is unavailable right now.");
  }

  if (weatherAlerts.status === "rejected") {
    errors.push("Weather alerts are unavailable right now.");
  }

  const earthquakeItems =
    earthquakes.status === "fulfilled" ? earthquakes.value : [];

  return {
    earthquakes: earthquakeItems,
    errors,
    naturalEvents:
      naturalEvents.status === "fulfilled" ? naturalEvents.value : [],
    strongestEarthquake: earthquakeItems[0] ?? null,
    weatherAlerts:
      weatherAlerts.status === "fulfilled" ? weatherAlerts.value : [],
    worldClocks: WORLD_CLOCK_CITIES,
  } satisfies WorldMonitorDashboardData;
}
