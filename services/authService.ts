import { jwtDecode } from 'jwt-decode';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: 'google' | 'github';
  token: string;
  tokenExpiry?: number;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: (credentialResponse: any) => void;
  loginWithGitHub: () => void;
  logout: () => void;
  refreshToken: () => Promise<string | null>;
}

// Decode and validate Google OAuth token
export const decodeGoogleToken = (token: string): User | null => {
  try {
    const decoded: any = jwtDecode(token);
    
    if (!decoded.email) {
      throw new Error('Invalid token: missing email');
    }

    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name || 'User',
      picture: decoded.picture,
      provider: 'google',
      token: token,
      tokenExpiry: decoded.exp ? decoded.exp * 1000 : undefined
    };
  } catch (error) {
    console.error('Failed to decode Google token:', error);
    return null;
  }
};

// Handle GitHub OAuth callback
export const handleGitHubCallback = async (code: string): Promise<User | null> => {
  try {
    // Exchange code for access token (must be done server-side for security)
    const backendUrl = 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/auth/github/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorData.details || errorMsg;
      } catch (e) {
        // If response is not JSON, use the status text
        errorMsg = response.statusText || errorMsg;
      }
      console.error('[AuthService] GitHub callback error:', errorMsg);
      throw new Error(`GitHub authentication failed: ${errorMsg}`);
    }

    const data = await response.json();
    
    if (!data.access_token || !data.github_id) {
      console.error('[AuthService] Invalid GitHub response - missing token or ID');
      throw new Error('Invalid response from GitHub callback: missing token or user ID');
    }
    
    const user: User = {
      id: data.github_id,
      email: data.email || `user_${data.github_id}@github.com`,
      name: data.login,
      picture: data.avatar_url,
      provider: 'github',
      token: data.access_token,
      tokenExpiry: data.token_expiry
    };
    
    // Save user to storage for persistence
    saveUserToStorage(user);
    console.log('[AuthService] GitHub authentication successful:', user.email);
    return user;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AuthService] GitHub authentication error:', errorMessage);
    return null;
  }
};

// Check if token is still valid
export const isTokenValid = (user: User | null): boolean => {
  if (!user) return false;
  if (!user.tokenExpiry) return true; // No expiry set
  return user.tokenExpiry > Date.now();
};

// Store user in localStorage
export const saveUserToStorage = (user: User): void => {
  localStorage.setItem('user', JSON.stringify(user));
};

// Retrieve user from localStorage
export const getUserFromStorage = (): User | null => {
  const stored = localStorage.getItem('user');
  if (!stored) return null;
  
  try {
    const user = JSON.parse(stored);
    if (isTokenValid(user)) {
      return user;
    } else {
      localStorage.removeItem('user');
      return null;
    }
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

// Clear user from storage
export const clearUserFromStorage = (): void => {
  localStorage.removeItem('user');
};

// Get authorization header with token
export const getAuthHeader = (user: User | null): Record<string, string> => {
  if (!user) return {};
  return {
    'Authorization': `Bearer ${user.token}`,
    'X-User-Provider': user.provider,
    'X-User-Email': user.email
  };
};
