import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wi-Fi LAN IP of the dev machine – phone must be on the same network
export const API_BASE_URL = 'http://192.168.100.49:5000/api';

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
