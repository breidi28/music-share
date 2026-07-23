import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/expo';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/endpoints';

/**
 * Bridges Clerk's session into this app's own backend JWT.
 *
 * Clerk owns sign-in/sign-up/credentials; the app's own protected routes still run on a
 * locally-issued JWT (see backend `/api/auth/clerk-exchange`). This is the single place
 * that performs that exchange, so the native/web auth screens never need to know about it.
 */
export default function ClerkAuthBridge() {
    const { isLoaded, isSignedIn, getToken } = useAuth();
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const setSessionFromExchange = useAuthStore(s => s.setSessionFromExchange);
    const exchangeInFlight = useRef(false);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || isAuthenticated || exchangeInFlight.current) return;

        exchangeInFlight.current = true;
        (async () => {
            try {
                const clerkToken = await getToken();
                if (!clerkToken) throw new Error('No Clerk session token available');
                const response = await authApi.clerkExchange(clerkToken);
                const { token, user } = response.data;
                await setSessionFromExchange(token, user);
            } catch (e: any) {
                Toast.show({
                    type: 'error',
                    text1: 'Sign-in failed',
                    text2: e?.response?.data?.error || e?.message || 'Could not complete sign-in. Please try again.',
                    position: 'bottom',
                    bottomOffset: 100,
                });
            } finally {
                exchangeInFlight.current = false;
            }
        })();
    }, [isLoaded, isSignedIn, isAuthenticated, getToken, setSessionFromExchange]);

    return null;
}
