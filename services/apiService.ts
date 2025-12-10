import { API_CONFIG } from '../constants';
import { IpLocationData, CountryData, CityData, AggregatedData } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchIpLocation = async (): Promise<IpLocationData> => {
  // Strategy: Try Primary -> Try Backup -> Fallback to Mock
  
  // 1. Attempt Primary API
  try {
    const response = await fetch(API_CONFIG.IP_API_PRIMARY);
    if (response.ok) {
        const data = await response.json();
        if (data.error) throw new Error('API returned error');
        return {
            query: data.ip,
            city: data.city || 'Unknown',
            country: data.country_name || 'Unknown',
            countryCode: data.country_code, // e.g., 'US', 'LK'
            lat: data.latitude || 0,
            lon: data.longitude || 0,
            timezone: data.timezone || 'UTC',
            isp: data.org || 'Unknown',
        };
    }
  } catch (e) {
    console.warn("Primary IP API failed, trying backup...", e);
  }

  // 2. Attempt Backup API
  try {
    const response = await fetch(API_CONFIG.IP_API_BACKUP);
    if (response.ok) {
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        return {
            query: data.ip,
            city: data.city || 'Unknown',
            country: data.country || 'Unknown',
            countryCode: data.country_code,
            lat: data.latitude || 0,
            lon: data.longitude || 0,
            timezone: data.timezone.id || 'UTC',
            isp: data.connection?.isp || 'Unknown',
        };
    }
  } catch (e) {
     console.warn("Backup IP API failed, using fallback.", e);
  }

  // 3. Fallback Mock (Ensures app works even offline or if APIs are blocked)
  return {
    query: '127.0.0.1 (Simulation)',
    city: 'Colombo',
    country: 'Sri Lanka',
    countryCode: 'LK',
    lat: 6.9271,
    lon: 79.8612,
    timezone: 'Asia/Colombo',
    isp: 'Offline Simulation Mode'
  };
};

export const fetchCountryData = async (countryCode: string): Promise<CountryData> => {
  if (!countryCode || countryCode === 'Unknown') {
    throw new Error('Invalid Country Code');
  }
  
  const response = await fetch(`${API_CONFIG.REST_COUNTRIES_URL}/${countryCode}`);
  if (!response.ok) throw new Error('Failed to fetch country data');
  const data = await response.json();
  return data[0]; // RestCountries returns an array
};

export const fetchCityData = async (cityName: string): Promise<CityData | null> => {
  
  
  try {
     if (!cityName || cityName === 'Unknown') return null;
     
     
     await delay(600); // Simulate network latency
     
     // Return mock data based on the city name to prove logic flow
     return {
        name: cityName,
        population: Math.floor(Math.random() * 500000) + 50000, // Simulated
        country: "Unknown",
        region: "Simulated Region",
        elevationMeters: 15
     };

  } catch (error) {
    console.warn("GeoDB fetch failed, falling back", error);
    return null;
  }
};

export const aggregateDataPayload = (
  ipData: IpLocationData,
  countryData: CountryData,
  cityData: CityData | null
): AggregatedData => {
  
  const languages = countryData.languages 
    ? Object.values(countryData.languages) 
    : ['Unknown'];

  const currencyKey = countryData.currencies ? Object.keys(countryData.currencies)[0] : 'USD';
  const currency = countryData.currencies ? countryData.currencies[currencyKey].name : 'Unknown';

  return {
    timestamp: new Date().toISOString(),
    clientIp: ipData.query,
    location: {
      city: ipData.city,
      country: ipData.country,
      coordinates: {
        lat: ipData.lat,
        lon: ipData.lon
      }
    },
    demographics: {
      countryPopulation: countryData.population,
      cityPopulation: cityData?.population || 0,
      languages: languages,
      currency: currency
    },
    metadata: {
      source: "Global Location Insights Web Client",
      userAgent: navigator.userAgent
    }
  };
};