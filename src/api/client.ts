import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROD_API_BASE_URL = 'https://music-share-production.up.railway.app/api';
const LOCAL_API_BASE_URL = 'http://127.0.0.1:5000/api';

// Use EXPO_PUBLIC_API_URL when provided; otherwise default to local backend in dev.
export const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? LOCAL_API_BASE_URL : PROD_API_BASE_URL);

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
        return Promise.reject(error);
    }
);

export default client;
