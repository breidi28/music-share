import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';

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

export const API_BASE_URL = PROD_API_BASE_URL;

const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
});

client.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
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
