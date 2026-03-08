const NASA_API_BASE_URL = "https://api.nasa.gov";
const NASA_IMAGES_BASE_URL = "https://images-api.nasa.gov";
const NASA_REVALIDATE_SECONDS = 60 * 30;

type NasaApodResponse = {
  copyright?: string;
  date: string;
  explanation: string;
  hdurl?: string;
  media_type: "image" | "video";
  title: string;
  url: string;
};

type NasaNeoResponse = {
  element_count: number;
  near_earth_objects: Record<string, NasaNeoObject[]>;
};

type NasaNeoObject = {
  id: string;
  name: string;
  nasa_jpl_url: string;
  estimated_diameter: {
    kilometers: {
      estimated_diameter_min: number;
      estimated_diameter_max: number;
    };
  };
  is_potentially_hazardous_asteroid: boolean;
  close_approach_data: Array<{
    close_approach_date: string;
    close_approach_date_full?: string;
    relative_velocity: {
      kilometers_per_hour: string;
    };
    miss_distance: {
      kilometers: string;
      lunar: string;
    };
    orbiting_body: string;
  }>;
};

type NasaImageSearchResponse = {
  collection: {
    items: NasaImageSearchItem[];
  };
};

type NasaImageSearchItem = {
  href: string;
  data?: Array<{
    center?: string;
    date_created?: string;
    description?: string;
    keywords?: string[];
    nasa_id: string;
    title: string;
  }>;
  links?: Array<{
    href: string;
    rel?: string;
    render?: string;
  }>;
};

export type NasaApod = {
  copyright?: string;
  date: string;
  explanation: string;
  imageUrl: string;
  mediaType: "image" | "video";
  title: string;
};

export type NasaNeoApproach = {
  id: string;
  name: string;
  diameterKmMax: number;
  hazardous: boolean;
  jplUrl: string;
  missDistanceKm: number;
  missDistanceLunar: number;
  orbitingBody: string;
  relativeVelocityKph: number;
};

export type NasaNeoSummary = {
  approaches: NasaNeoApproach[];
  closest: NasaNeoApproach | null;
  date: string;
  fastest: NasaNeoApproach | null;
  hazardousCount: number;
  total: number;
};

export type NasaImageSpotlight = {
  center?: string;
  dateCreated?: string;
  description: string;
  imageUrl: string;
  nasaId: string;
  title: string;
};

export type NasaDashboardData = {
  apod: NasaApod | null;
  artemisSpotlight: NasaImageSpotlight | null;
  earthSpotlight: NasaImageSpotlight | null;
  errors: string[];
  marsSpotlight: NasaImageSpotlight | null;
  neoSummary: NasaNeoSummary | null;
};

function getNasaApiKey() {
  const apiKey = process.env.NASA_API_KEY;

  if (!apiKey) {
    throw new Error("NASA_API_KEY is missing. Add it to .env.local.");
  }

  return apiKey;
}

async function nasaApiFetch<T>(
  pathname: string,
  params: Record<string, string | undefined> = {},
) {
  const url = new URL(pathname, NASA_API_BASE_URL);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("api_key", getNasaApiKey());

  const response = await fetch(url, {
    next: {
      revalidate: NASA_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new Error(`NASA request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function nasaImageSearch(query: string) {
  const url = new URL("/search", NASA_IMAGES_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("media_type", "image");

  const response = await fetch(url, {
    next: {
      revalidate: NASA_REVALIDATE_SECONDS,
    },
  });

  if (!response.ok) {
    throw new Error(`NASA image archive request failed with status ${response.status}.`);
  }

  return (await response.json()) as NasaImageSearchResponse;
}

async function getApod() {
  const response = await nasaApiFetch<NasaApodResponse>("/planetary/apod");

  return {
    copyright: response.copyright,
    date: response.date,
    explanation: response.explanation,
    imageUrl: response.hdurl ?? response.url,
    mediaType: response.media_type,
    title: response.title,
  } satisfies NasaApod;
}

function summarizeNeoFeed(response: NasaNeoResponse, date: string) {
  const objects = response.near_earth_objects[date] ?? [];
  const approaches = objects
    .map((object) => {
      const approach = object.close_approach_data[0];

      if (!approach) {
        return null;
      }

      return {
        id: object.id,
        name: object.name,
        diameterKmMax:
          object.estimated_diameter.kilometers.estimated_diameter_max,
        hazardous: object.is_potentially_hazardous_asteroid,
        jplUrl: object.nasa_jpl_url,
        missDistanceKm: Number(approach.miss_distance.kilometers),
        missDistanceLunar: Number(approach.miss_distance.lunar),
        orbitingBody: approach.orbiting_body,
        relativeVelocityKph: Number(approach.relative_velocity.kilometers_per_hour),
      } satisfies NasaNeoApproach;
    })
    .filter((approach): approach is NasaNeoApproach => approach !== null)
    .sort((left, right) => left.missDistanceKm - right.missDistanceKm);

  const hazardousCount = approaches.filter((approach) => approach.hazardous).length;
  const closest = approaches[0] ?? null;
  const fastest = [...approaches].sort(
    (left, right) => right.relativeVelocityKph - left.relativeVelocityKph,
  )[0] ?? null;

  return {
    approaches: approaches.slice(0, 4),
    closest,
    date,
    fastest,
    hazardousCount,
    total: objects.length || response.element_count,
  } satisfies NasaNeoSummary;
}

async function getNeoSummary(date: string) {
  const response = await nasaApiFetch<NasaNeoResponse>("/neo/rest/v1/feed", {
    end_date: date,
    start_date: date,
  });

  return summarizeNeoFeed(response, date);
}

function pickSpotlightImage(item: NasaImageSearchItem) {
  return (
    item.links?.find((link) => link.rel === "preview")?.href ??
    item.links?.find((link) => link.render === "image")?.href ??
    null
  );
}

async function getImageSpotlight(query: string) {
  const response = await nasaImageSearch(query);
  const item = response.collection.items.find(
    (candidate) => candidate.data?.[0] && pickSpotlightImage(candidate),
  );

  if (!item || !item.data?.[0]) {
    throw new Error(`No NASA image archive results were returned for "${query}".`);
  }

  const metadata = item.data[0];
  const imageUrl = pickSpotlightImage(item);

  if (!imageUrl) {
    throw new Error(`No preview image was available for "${query}".`);
  }

  return {
    center: metadata.center,
    dateCreated: metadata.date_created,
    description: metadata.description ?? "NASA archive item.",
    imageUrl,
    nasaId: metadata.nasa_id,
    title: metadata.title,
  } satisfies NasaImageSpotlight;
}

export async function getNasaDashboardData() {
  const today = new Date().toISOString().slice(0, 10);
  const [apod, neoSummary, earthSpotlight, marsSpotlight, artemisSpotlight] =
    await Promise.allSettled([
      getApod(),
      getNeoSummary(today),
      getImageSpotlight("blue marble earth"),
      getImageSpotlight("mars rover"),
      getImageSpotlight("artemis launch"),
    ]);

  const errors: string[] = [];

  if (apod.status === "rejected") {
    errors.push("Astronomy Picture of the Day is unavailable right now.");
  }

  if (neoSummary.status === "rejected") {
    errors.push("Near-Earth Object activity is unavailable right now.");
  }

  if (earthSpotlight.status === "rejected") {
    errors.push("Earth archive spotlight is unavailable right now.");
  }

  if (marsSpotlight.status === "rejected") {
    errors.push("Mars archive spotlight is unavailable right now.");
  }

  if (artemisSpotlight.status === "rejected") {
    errors.push("Artemis archive spotlight is unavailable right now.");
  }

  return {
    apod: apod.status === "fulfilled" ? apod.value : null,
    artemisSpotlight:
      artemisSpotlight.status === "fulfilled" ? artemisSpotlight.value : null,
    earthSpotlight:
      earthSpotlight.status === "fulfilled" ? earthSpotlight.value : null,
    errors,
    marsSpotlight:
      marsSpotlight.status === "fulfilled" ? marsSpotlight.value : null,
    neoSummary: neoSummary.status === "fulfilled" ? neoSummary.value : null,
  } satisfies NasaDashboardData;
}
