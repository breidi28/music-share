import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';

// TODO: replace this with your actual Render service URL once deployed
// Format: https://<your-service-name>.onrender.com/api
const PROD_API_BASE_URL = 'https://music-share-b4r8.onrender.com/api';
const WEB_LOCAL_API_BASE_URL = 'http://127.0.0.1:5000/api';

const getNativeDevApiBaseUrl = () => {
    const hostUri = Constants.expoConfig?.hostUri || '';
    const host = hostUri.split(':')[0];

    if (host) {
        return `http://${host}:5000/api`;
    }

    // Android emulator fallback
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:5000/api';
    }

    return 'http://127.0.0.1:5000/api';
};

const LOCAL_API_BASE_URL = Platform.OS === 'web' ? WEB_LOCAL_API_BASE_URL : getNativeDevApiBaseUrl();

// Force production logic
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
            AsyncStorage.removeItem('auth_token');
        }

        // Global Error Toaster
        const errorMessage = error.response?.data?.error || error.message || 'An unexpected error occurred';
        
        // Suppress toasts for the initial auth/me check when simply not logged in
        const isAuthMe = error.config?.url?.includes('/auth/me');
        const isSpotifyLivePoll = error.config?.url?.includes('/integrations/spotify/live');
        if (!isAuthMe && !isSpotifyLivePoll) {
            Toast.show({
                type: 'error',
                text1: 'Oops!',
                text2: errorMessage.length > 50 ? errorMessage.substring(0, 50) + '...' : errorMessage,
                position: 'bottom', 
                bottomOffset: 100, 
            });
        }

        return Promise.reject(error);
    }
);

export default client;
