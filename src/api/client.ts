import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import { getAuthToken } from '../utils/tokenStorage';
import Constants from 'expo-constants';

// Allow suppressToast to be set per-request on Axios config
declare module 'axios' {
    interface AxiosRequestConfig {
        suppressToast?: boolean;
    }
    interface InternalAxiosRequestConfig {
        suppressToast?: boolean;
    }
}

// Format: https://<your-service-name>.onrender.com/api
const PROD_API_BASE_URL = 'https://music-share-b4r8.onrender.com/api';
// Local fallback for emulators running on the same machine.
const LOCAL_API_BASE_URL = 'http://localhost:5000/api';

function resolveExpoHostIp(): string | null {
    const candidates = [
        (Constants as any)?.expoConfig?.hostUri,
        (Constants as any)?.manifest2?.extra?.expoClient?.hostUri,
        (Constants as any)?.manifest?.debuggerHost,
    ];

    for (const value of candidates) {
        if (!value || typeof value !== 'string') continue;
        const host = value.split(':')[0];
        if (host) return host;
    }
    return null;
}

function resolveApiBaseUrl(): string {
    const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    
    // If explicitly set to a specific URL, use it directly
    if (envUrl && envUrl !== 'LOCAL') return envUrl;

    // If explicitly set to 'LOCAL', construct the URL using the PC's local IP.
    // This allows physical devices on the same Wi-Fi to connect to the local backend.
    if (envUrl === 'LOCAL') {
        const host = resolveExpoHostIp();
        if (host) {
            // Note: If using Expo Tunnel (ngrok), this host will be an ngrok URL.
            // Connecting to port 5000 on the ngrok URL will fail since only port 8081 is tunneled.
            if (host.includes('ngrok')) {
                console.warn('[API] Warning: Using local API via Expo Tunnel. The backend port (5000) is not tunneled, so requests will likely fail.');
            }
            return `http://${host}:5000/api`;
        }
        return LOCAL_API_BASE_URL;
    }

    // Default to the production Render backend for both local dev and production
    return PROD_API_BASE_URL;
}

// Toggle between LOCAL and PROD here
// NOTE: Use local URL if you are running 'python app.py' locally.
export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
    console.log('[API] Using base URL:', API_BASE_URL);
}

if (!__DEV__ && API_BASE_URL.startsWith('http://')) {
    throw new Error('Insecure API_BASE_URL in production: HTTPS is required.');
}

const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 20000, 
});

client.interceptors.request.use(async (config) => {
    const token = await getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Clear storage AND reset the Zustand store so the app
            // doesn't keep showing as logged-in after token expiry.
            useAuthStore.getState().logout();
        }

        // Global Error Toaster
        const errorMessage = error.response?.data?.error || error.message || 'An unexpected error occurred';

        // Suppress toasts for the initial auth/me check when simply not logged in
        const isAuthMe = error.config?.url?.includes('/auth/me');
        const isSpotifyLivePoll = error.config?.url?.includes('/integrations/spotify/live');
        if (!isAuthMe && !isSpotifyLivePoll && !error.config?.suppressToast) {
            Toast.show({
                type: 'error',
                text1: 'Oops!',
                text2: errorMessage,
                position: 'bottom', 
                bottomOffset: 100, 
            });
        }

        return Promise.reject(error);
    }
);

export default client;
