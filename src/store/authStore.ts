import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { authApi } from '../api/endpoints';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (data: { username: string; email: string; password: string; display_name: string; bio?: string; favorite_genres?: string }) => Promise<void>;
    logout: () => void;
    loadStoredAuth: () => Promise<void>;
    updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,

    loadStoredAuth: async () => {
        try {
            const token = await AsyncStorage.getItem('auth_token');
            if (token) {
                const response = await authApi.getMe();
                set({ user: response.data, token, isAuthenticated: true, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch {
            await AsyncStorage.removeItem('auth_token');
            set({ isLoading: false });
        }
    },

    login: async (username, password) => {
        const response = await authApi.login(username, password);
        const { token, user } = response.data;
        await AsyncStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
    },

    register: async (data) => {
        const response = await authApi.register(data);
        const { token, user } = response.data;
        await AsyncStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
    },

    logout: async () => {
        await AsyncStorage.removeItem('auth_token');
        set({ user: null, token: null, isAuthenticated: false });
    },

    updateUser: (user) => set({ user }),
}));
