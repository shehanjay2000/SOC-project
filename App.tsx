import React, { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { fetchIpLocation, fetchCountryData, fetchCityData, aggregateDataPayload } from './services/apiService';
import { submitDataToBackend } from './services/backendMockService';
import { createLog } from './services/loggerService';
import { LogConsole } from './components/LogConsole';
import { DataCard } from './components/DataCard';
import { LoginModal } from './components/LoginModal';
import { useAuth, AuthProvider } from './context/AuthContext';
import { handleGitHubCallback } from './services/authService';
import { API_CONFIG } from './constants';
import { IpLocationData, CountryData, CityData, LogEntry, AggregatedData } from './types';

function AppContent() {
  const { user, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ipData, setIpData] = useState<IpLocationData | null>(null);
  const [countryData, setCountryData] = useState<CountryData | null>(null);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0: Init, 1: Fetched, 2: Sending, 3: Success
  const [backendResponse, setBackendResponse] = useState<any>(null);

  // Helper to append logs
  const addLog = useCallback((source: LogEntry['source'], message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, createLog(source, message, type)]);
  }, []);

  // Handle GitHub OAuth callback
  useEffect(() => {
    const handleGitHubCallbackFlow = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      
      if (error) {
        addLog('Client', `GitHub OAuth error: ${error}`, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      if (code) {
        try {
          addLog('Client', 'Processing GitHub OAuth callback...', 'info');
          const gitHubUser = await handleGitHubCallback(code);
          
          if (gitHubUser) {
            addLog('Client', `✓ GitHub authentication successful: ${gitHubUser.email}`, 'success');
            // Clear the code from URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            // handleGitHubCallback already logs the detailed error
            addLog('Client', 'GitHub authentication failed - check browser console for details', 'error');
          }
        } catch (error: any) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          addLog('Client', `GitHub callback error: ${errorMsg}`, 'error');
        }
      }
    };

    handleGitHubCallbackFlow();
  }, [addLog]);

  // Main Workflow
  const startWorkflow = async () => {
    setLoading(true);
    setStep(0);
    setLogs([]); // Clear logs on restart
    setBackendResponse(null);
    setIpData(null);
    setCountryData(null);
    setCityData(null);

    try {
      // Step 1: IP Geolocation
      addLog('Client', 'Initializing IP Geolocation detection...', 'info');
      const ipResult = await fetchIpLocation();
      setIpData(ipResult);

      if (ipResult.query.includes('Simulation')) {
         addLog('API', `Public IP Check failed. Switched to Offline/Simulation mode.`, 'warning');
      }

      addLog('API', `IP Detected: ${ipResult.query} (${ipResult.city}, ${ipResult.countryCode})`, 'success');
      
      // Step 2: Country Data
      addLog('Client', `Fetching details for country: ${ipResult.countryCode}...`, 'info');
      const countryResult = await fetchCountryData(ipResult.countryCode);
      setCountryData(countryResult);
      addLog('API', `Country Metadata received for ${countryResult.name.common}`, 'success');

      // Step 3: City Data (Simulated/RapidAPI)
      addLog('Client', `Querying GeoDB for city details: ${ipResult.city}...`, 'info');
      const cityResult = await fetchCityData(ipResult.city);
      setCityData(cityResult || { name: ipResult.city, country: ipResult.country, region: 'Unknown' }); // Fallback if API fails
      if(cityResult) {
        addLog('API', 'GeoDB Cities data received', 'success');
      } else {
        addLog('API', 'GeoDB details unavailable (using fallback)', 'warning');
      }

      setStep(1); // Ready to submit
      addLog('Client', 'Data Aggregation Complete. Ready to send to backend.', 'success');

    } catch (error: any) {
      console.error(error);
      addLog('Client', `Workflow Failed: ${error.message}. Check internet connection or API availability.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToBackend = async () => {
    if (!ipData || !countryData) return;

    // Check authentication
    if (!user) {
      addLog('Client', 'Authentication required. Opening login modal...', 'warning');
      setShowLoginModal(true);
      return;
    }

    setStep(2);
    const payload = aggregateDataPayload(ipData, countryData, cityData);

    addLog('Client', 'Initiating secure AJAX request to Backend...', 'info');
    addLog('Client', `Authenticated as: ${user.email} (${user.provider})`, 'success');
    addLog('Client', `Attaching OAuth Token: ${user.token.substring(0, 20)}...`, 'warning');
    addLog('Client', `Attaching x-api-key: ${API_CONFIG.API_KEY?.substring(0, 5)}...`, 'warning');

    try {
      const result = await submitDataToBackend(
        payload, 
        user.token, 
        API_CONFIG.API_KEY, 
        true,
        user.provider,
        user.email
      );
      setBackendResponse(result);
      addLog('Backend', `Response: ${result.message}`, 'success');
      addLog('Backend', `Record ID: ${result.recordId || result.id}`, 'success');
      setStep(3);
    } catch (error: any) {
      addLog('Backend', `Submission Failed: ${error.message}`, 'error');
      setStep(1); // Allow retry
    }
  };

  // Initial load
  useEffect(() => {
    startWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Global Location Insights</h1>
              <p className="text-blue-100 text-sm mt-1">Service-Oriented Computing Group 17</p>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
                  {user.picture && (
                    <img 
                      src={user.picture} 
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-blue-100 text-xs">{user.provider}</p>
                  </div>
                  <button 
                    onClick={logout}
                    className="ml-2 text-white hover:text-blue-100 transition text-xs"
                  >
                    ✕ Sign Out
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="bg-white/20 hover:bg-white/30 transition text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm"
                >
                  Sign In with OAuth
                </button>
              )}
              <button 
                onClick={startWorkflow}
                className="bg-white/20 hover:bg-white/30 transition text-white px-4 py-2 rounded-lg text-sm font-medium backdrop-blur-sm"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Data Display */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Status Banner */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">System Status</h2>
              <p className="text-gray-500 text-sm">
                {loading ? 'Gathering intelligence...' : 
                 step === 3 ? 'Data successfully archived.' : 
                 'Data aggregated. Waiting for user action.'}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-bold ${step === 3 ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
               {step === 3 ? 'COMPLETED' : 'ACTIVE'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IP Card */}
            <DataCard title="Client Identification" loading={loading} icon={
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
            }>
              {ipData ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">IP Address:</span> <span className="font-mono font-medium">{ipData.query}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ISP:</span> <span className="font-medium text-right">{ipData.isp}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Timezone:</span> <span className="font-medium">{ipData.timezone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Coordinates:</span> <span className="font-mono">{ipData.lat.toFixed(4)}, {ipData.lon.toFixed(4)}</span></div>
                </div>
              ) : <div className="text-gray-400 text-sm">No data available</div>}
            </DataCard>

            {/* City Card */}
            <DataCard title="Geographic Details" loading={loading} icon={
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            }>
              {ipData ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">City:</span> <span className="font-bold text-gray-800">{ipData.city}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Region:</span> <span className="font-medium">{cityData?.region || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Est. Population:</span> <span className="font-medium">{cityData?.population?.toLocaleString() || 'Unknown'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Elevation:</span> <span className="font-medium">{cityData?.elevationMeters ? `${cityData.elevationMeters}m` : 'N/A'}</span></div>
                </div>
              ) : <div className="text-gray-400 text-sm">No data available</div>}
            </DataCard>
          </div>

          {/* Country Card */}
          <DataCard title="National Metadata" loading={loading} icon={
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          }>
             {countryData ? (
                <div className="flex gap-6 items-start">
                   <img src={countryData.flags.png} alt={countryData.flags.alt} className="w-24 h-16 object-cover rounded shadow-sm" />
                   <div className="space-y-1 text-sm flex-1">
                      <h4 className="font-bold text-lg text-gray-800">{countryData.name.common}</h4>
                      <p className="text-gray-500">{countryData.name.official}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div><span className="text-gray-500 text-xs uppercase">Capital</span><br/>{countryData.capital?.join(', ')}</div>
                        <div><span className="text-gray-500 text-xs uppercase">Population</span><br/>{countryData.population.toLocaleString()}</div>
                        <div><span className="text-gray-500 text-xs uppercase">Currency</span><br/>{(Object.values(countryData.currencies)[0] as any)?.name} ({(Object.values(countryData.currencies)[0] as any)?.symbol})</div>
                        <div><span className="text-gray-500 text-xs uppercase">Language</span><br/>{Object.values(countryData.languages)[0]}</div>
                      </div>
                   </div>
                </div>
              ) : <div className="text-gray-400 text-sm">No data available</div>}
          </DataCard>

          {/* Aggregated Payload Preview */}
          {step >= 1 && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Aggregated JSON Payload</h3>
               <pre className="text-xs text-slate-600 bg-slate-100 p-3 rounded overflow-x-auto">
                 {JSON.stringify(aggregateDataPayload(ipData!, countryData!, cityData), null, 2)}
               </pre>
            </div>
          )}

        </div>

        {/* Right Column: Console & Actions */}
        <div className="space-y-6">
          
          <LogConsole logs={logs} />

          {/* Action Panel */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Backend Synchronization</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                <div className="text-xs text-yellow-800">
                  <span className="font-bold">OAuth 2.0 & API Key</span> required for submission. Tokens will be auto-attached.
                </div>
              </div>

              <button
                onClick={handleSubmitToBackend}
                disabled={loading || step === 0 || step === 2}
                className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-md transition-all
                  ${loading || step === 0 ? 'bg-gray-400 cursor-not-allowed' : 
                    step === 3 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'}`}
              >
                {step === 2 ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Transmitting...
                  </span>
                ) : step === 3 ? 'Data Stored Successfully' : 'Secure Submit to Backend'}
              </button>

              {backendResponse && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                  <strong>Server Response:</strong> {backendResponse.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}

// Root component with AuthProvider
function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;