import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast, { ToastConfig } from 'react-native-toast-message';
import { View, Text } from 'react-native';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useAuthStore } from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';
import ClerkAuthBridge from './src/components/ClerkAuthBridge';

import './global.css';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY — set it in .env.local, EAS build env vars, and Vercel.');
}

/* Fully custom toast — auto-height so long messages never get clipped */
const AppToast = ({ text1, text2, color }: { text1?: string; text2?: string; color: string }) => (
  <View
    style={{
      width: '90%',
      backgroundColor: '#1C1C1E',
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: color,
      paddingHorizontal: 15,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 6,
    }}
  >
    {!!text1 && (
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', flexShrink: 1 }}>
        {text1}
      </Text>
    )}
    {!!text2 && (
      <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: text1 ? 3 : 0, flexShrink: 1 }}>
        {text2}
      </Text>
    )}
  </View>
);

const toastConfig: ToastConfig = {
  success: (props: any) => <AppToast text1={props?.text1 ?? ''} text2={props?.text2 ?? ''} color="#34C759" />,
  error:   (props: any) => <AppToast text1={props?.text1 ?? ''} text2={props?.text2 ?? ''} color="#FF3B30" />,
  info:    (props: any) => <AppToast text1={props?.text1 ?? ''} text2={props?.text2 ?? ''} color="#0A84FF" />,
};

export default function App() {
  const loadStoredAuth = useAuthStore(s => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <ClerkAuthBridge />
            <AppNavigator />
            {/* Toast initialized here so it can overlay navigator */}
            <Toast config={toastConfig} />
          </SafeAreaProvider>
        </View>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
