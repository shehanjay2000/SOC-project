import { AggregatedData } from '../types';
import { API_CONFIG } from '../constants';

/**
 * Submit aggregated location data to backend with OAuth authentication
 * Attaches OAuth token and user info to request headers for server-side validation
 */
export const submitDataToBackend = async (
  data: AggregatedData, 
  oauthToken: string, 
  apiKey: string,
  _useRealBackend: boolean = true,
  userProvider?: string,
  userEmail?: string
) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Prefer OAuth authentication; fallback to API key if needed
  if (oauthToken && userProvider && userEmail) {
    headers['Authorization'] = `Bearer ${oauthToken}`;
    headers['X-User-Provider'] = userProvider;
    headers['X-User-Email'] = userEmail;
  } else if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const response = await fetch(API_CONFIG.BACKEND_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Backend request failed:', error);
    throw error;
  }
};
