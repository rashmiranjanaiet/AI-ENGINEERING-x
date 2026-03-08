export type Flight = {
  hex: string;
  lat: number;
  lng: number;
  dir?: number;
  alt?: number;
  speed?: number;
  flight_iata?: string;
  flight_number?: string;
  airline_iata?: string;
  dep_iata?: string;
  arr_iata?: string;
  status?: string;
  updated?: number;
  aircraft_icao?: string;
  flag?: string;
};

export type Airport = {
  name?: string;
  iata_code: string;
  icao_code?: string;
  lat: number;
  lng: number;
  city?: string;
  country_code?: string;
};

export type Airline = {
  name: string;
  iata_code: string;
  icao_code?: string;
  country_code?: string;
};

export type FlightContext = {
  airports: Airport[];
  airline: Airline | null;
};

export type MapViewport = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};
