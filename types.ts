export interface IpLocationData {
  query: string; // IP
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
}

export interface CountryData {
  name: {
    common: string;
    official: string;
  };
  capital: string[];
  region: string;
  population: number;
  currencies: Record<string, { name: string; symbol: string }>;
  flags: {
    png: string;
    svg: string;
    alt: string;
  };
  languages: Record<string, string>;
}

export interface CityData {
  name: string;
  population?: number;
  elevationMeters?: number;
  country: string;
  region: string;
}

// The final object sent to the backend
export interface AggregatedData {
  timestamp: string;
  clientIp: string;
  location: {
    city: string;
    country: string;
    coordinates: {
      lat: number;
      lon: number;
    };
  };
  demographics: {
    countryPopulation: number;
    cityPopulation?: number; 
    languages: string[];
    currency: string;
  };
  metadata: {
    source: string;
    userAgent: string;
  };
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  source: 'Client' | 'API' | 'Backend';
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}