import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
    keychainService: 'musicshare.auth',
};

export async function getAuthToken(): Promise<string | null> {
    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY, secureStoreOptions);
    if (secureToken) return secureToken;

    // One-time migration path from legacy AsyncStorage token.
    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (!legacyToken) return null;

    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken, secureStoreOptions);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return legacyToken;
}

export async function setAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token, secureStoreOptions);
}

export async function clearAuthToken(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(TOKEN_KEY, secureStoreOptions),
        AsyncStorage.removeItem(TOKEN_KEY),
    ]);
}
