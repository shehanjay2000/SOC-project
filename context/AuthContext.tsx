import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  AuthContextType,
  decodeGoogleToken,
  handleGitHubCallback,
  saveUserToStorage,
  getUserFromStorage,
  clearUserFromStorage,
  isTokenValid
} from '../services/authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing user on mount
  useEffect(() => {
    const storedUser = getUserFromStorage();
    if (storedUser && isTokenValid(storedUser)) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const loginWithGoogle = (credentialResponse: any) => {
    try {
      setLoading(true);
      setError(null);

      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }

      const decodedUser = decodeGoogleToken(credentialResponse.credential);
      
      if (decodedUser) {
        saveUserToStorage(decodedUser);
        setUser(decodedUser);
        console.log('✓ Logged in with Google:', decodedUser.email);
      } else {
        throw new Error('Failed to decode Google token');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Google login failed';
      setError(errorMsg);
      console.error('Google login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGitHub = () => {
    try {
      setLoading(true);
      setError(null);

      // OAuth 2.0 Authorization Code Flow
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
      // Use exact callback path that matches GitHub OAuth app configuration
      const redirectUri = `${window.location.origin}/auth/github/callback`;
      const scope = 'user:email';
      
      if (!clientId) {
        throw new Error('GitHub Client ID not configured');
      }

      console.log('Redirecting to GitHub OAuth with URI:', redirectUri);
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
      window.location.href = githubAuthUrl;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'GitHub login failed';
      setError(errorMsg);
      setLoading(false);
      console.error('GitHub login error:', err);
    }
  };

  const logout = () => {
    setUser(null);
    clearUserFromStorage();
    setError(null);
    console.log('✓ Logged out');
  };

  const refreshToken = async (): Promise<string | null> => {
    if (!user) return null;
    
    try {
      
      return user.token;
    } catch (err) {
      console.error('Token refresh failed:', err);
      return null;
    }
  };

  // Helper function for GitHub callback to set user
  const setUserFromGitHub = (gitHubUser: User) => {
    if (gitHubUser) {
      saveUserToStorage(gitHubUser);
      setUser(gitHubUser);
      console.log('✓ Logged in with GitHub:', gitHubUser.email);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    loginWithGoogle,
    loginWithGitHub,
    logout,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Export for external use in GitHub callback handler
export const setUserFromGitHub = (gitHubUser: User) => {
  const stored = localStorage.getItem('authContextUser');
  if (stored) {
    const parsed = JSON.parse(stored);
    parsed(gitHubUser);
  }
};
