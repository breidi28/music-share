import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { useAuthStore } from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';

import './global.css';

/* Define custom toast templates that fit the app's dark Apple aesthetic */
const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#34C759', backgroundColor: '#1C1C1E', borderRadius: 12 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ color: 'white', fontSize: 16, fontWeight: '600' }}
      text2Style={{ color: '#8E8E93', fontSize: 14 }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#FF3B30', backgroundColor: '#1C1C1E', borderRadius: 12 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ color: 'white', fontSize: 16, fontWeight: '600' }}
      text2Style={{ color: '#8E8E93', fontSize: 14 }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#0A84FF', backgroundColor: '#1C1C1E', borderRadius: 12 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ color: 'white', fontSize: 16, fontWeight: '600' }}
      text2Style={{ color: '#8E8E93', fontSize: 14 }}
    />
  )
};

export default function App() {
  const loadStoredAuth = useAuthStore(s => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AppNavigator />
          {/* Toast initialized here so it can overlay navigator */}
          <Toast config={toastConfig} />
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}
