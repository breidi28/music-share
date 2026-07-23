import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/endpoints';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/tokenStorage';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    setSessionFromExchange: (token: string, user: User) => Promise<void>;
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

    // Called by ClerkAuthBridge once Clerk reports a signed-in session and the
    // backend has exchanged it for this app's own JWT.
    setSessionFromExchange: async (token, user) => {
        await setAuthToken(token);
        set({ user, token, isAuthenticated: true });
    },

    logout: async () => {
        await clearAuthToken();
        set({ user: null, token: null, isAuthenticated: false });
    },

    updateUser: (user) => set({ user }),
}));
