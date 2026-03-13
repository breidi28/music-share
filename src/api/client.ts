import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Railway Production URL
export const API_BASE_URL = 'https://web-production-5c4f2.up.railway.app/api';

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
