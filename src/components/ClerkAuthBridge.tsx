import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/expo';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/endpoints';

const MAX_ATTEMPTS = 4;

/**
 * Bridges Clerk's session into this app's own backend JWT.
 *
 * Clerk owns sign-in/sign-up/credentials; the app's own protected routes still run on a
 * locally-issued JWT (see backend `/api/auth/clerk-exchange`). This is the single place
 * that performs that exchange, so the native/web auth screens never need to know about it.
 *
 * On repeated failure (e.g. backend unreachable, or Clerk not configured server-side) it
 * retries a few times — the production backend is on a cold-start-prone host — then signs
 * the user out of Clerk so they land back on a usable login screen instead of being stuck
 * on a spinner or in a re-exchange loop.
 */
export default function ClerkAuthBridge() {
    const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const setSessionFromExchange = useAuthStore(s => s.setSessionFromExchange);
    const inFlight = useRef(false);
    const failures = useRef(0);
    const [retryTick, setRetryTick] = useState(0);

    // Clerk's getToken/signOut can change identity on re-render. Reading them via refs
    // (updated every render, but NOT effect dependencies) means the retry effect below
    // only reruns when auth state actually changes, not on every unrelated re-render —
    // which matters because a re-render firing mid-retry previously left inFlight stuck
    // `true` forever (stale setTimeout closure bailing out without resetting it),
    // wedging the bridge on the "signing in" spinner with no further retries or errors.
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;
    const signOutRef = useRef(signOut);
    signOutRef.current = signOut;

    // Reset the failure counter whenever Clerk transitions to signed-out.
    useEffect(() => {
        if (!isSignedIn) failures.current = 0;
    }, [isSignedIn]);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || isAuthenticated || inFlight.current) return;

        inFlight.current = true;

        (async () => {
            try {
                const clerkToken = await getTokenRef.current();
                if (!clerkToken) throw new Error('No Clerk session token available');
                const { data } = await authApi.clerkExchange(clerkToken);
                await setSessionFromExchange(data.token, data.user);
                failures.current = 0;
                inFlight.current = false;
            } catch (e: any) {
                failures.current += 1;

                if (failures.current >= MAX_ATTEMPTS) {
                    Toast.show({
                        type: 'error',
                        text1: 'Sign-in failed',
                        text2: e?.response?.data?.error || e?.message || 'Could not complete sign-in. Please try again.',
                        position: 'bottom',
                        bottomOffset: 100,
                    });
                    // Break out of the signed-in-but-unauthenticated limbo so the user
                    // gets a usable login screen back rather than a stuck spinner.
                    inFlight.current = false;
                    await signOutRef.current().catch(() => {});
                    return;
                }

                // Transient (network blip / backend cold start) — back off and retry.
                const delay = 1500 * failures.current;
                setTimeout(() => {
                    inFlight.current = false;
                    setRetryTick(t => t + 1);
                }, delay);
            }
        })();
    }, [isLoaded, isSignedIn, isAuthenticated, retryTick, setSessionFromExchange]);

    return null;
}
