import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/endpoints';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/tokenStorage';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (data: { username: string; email: string; password: string; display_name: string; bio?: string; favorite_genres?: string }) => Promise<void>;
    logout: () => Promise<void>;
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
            const token = await getAuthToken();
            if (token) {
                const response = await authApi.getMe();
                set({ user: response.data, token, isAuthenticated: true, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch {
            await clearAuthToken();
            set({ isLoading: false });
        }
    },

    login: async (username, password) => {
        const response = await authApi.login(username, password);
        const { token, user } = response.data;
        await setAuthToken(token);
        set({ user, token, isAuthenticated: true });
    },

    register: async (data) => {
        const response = await authApi.register(data);
        const { token, user } = response.data;
        await setAuthToken(token);
        set({ user, token, isAuthenticated: true });
    },

    logout: async () => {
        await clearAuthToken();
        set({ user: null, token: null, isAuthenticated: false });
    },

    updateUser: (user) => set({ user }),
}));
