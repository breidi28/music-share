import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
    keychainService: 'musicshare.auth',
};

export async function getAuthToken(): Promise<string | null> {
    try {
        const secureToken = await SecureStore.getItemAsync(TOKEN_KEY, secureStoreOptions);
        if (secureToken) return secureToken;
    } catch {
        // Fall back to AsyncStorage when SecureStore is unavailable.
    }

    // One-time migration path from legacy AsyncStorage token.
    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (!legacyToken) return null;

    try {
        await SecureStore.setItemAsync(TOKEN_KEY, legacyToken, secureStoreOptions);
    } catch {
        // If SecureStore write fails, keep using AsyncStorage value.
        return legacyToken;
    }
    await AsyncStorage.removeItem(TOKEN_KEY);
    return legacyToken;
}

export async function setAuthToken(token: string): Promise<void> {
    try {
        await SecureStore.setItemAsync(TOKEN_KEY, token, secureStoreOptions);
        await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
        await AsyncStorage.setItem(TOKEN_KEY, token);
    }
}

export async function clearAuthToken(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY, secureStoreOptions).catch(() => null),
        AsyncStorage.removeItem(TOKEN_KEY),
    ]);
}
