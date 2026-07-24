import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast, { ToastConfig } from 'react-native-toast-message';
import { View, Text, Platform, ActivityIndicator } from 'react-native';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useAuthStore } from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';
import ClerkAuthBridge from './src/components/ClerkAuthBridge';
import { navigationRef } from './src/navigation/navigationRef';
import { Colors } from './src/theme';

import './global.css';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Web-only navigation handler for Clerk's <SignIn/>/<SignUp/> components.
//
// Clerk drives its OWN multi-step flows (OAuth sso-callback, the "continue" step for
// required fields like username, factor-one/two, reset-password) through this router,
// so it must handle THREE cases correctly — getting any of them wrong breaks a flow:
//
//   1. The "Sign up"/"Sign in" CROSS-LINKS between our two auth screens -> react-navigation.
//      Only when there's no in-flow step hash: "/sign-up" is a cross-link, but
//      "/sign-up#/continue" is a step and must fall through to (3).
//   2. The bare post-auth redirect to "/" -> NO-OP. App state (ClerkAuthBridge flipping
//      authStore.isAuthenticated) drives this; a real navigation here reloads the SPA and
//      the reloaded, already-signed-in <SignIn/> re-fires it -> blank-page reload loop.
//   3. Everything else (sso-callback, continue, factor-one, ...) -> REAL navigation, so
//      Clerk's flow proceeds. Critical for social sign-in, which routes through an
//      sso-callback (and, for a new Google/Apple user, a username "continue" step).
function clerkRouter(to: string, metadata?: { windowNavigate?: (to: string | URL) => void }) {
  let pathname = to;
  let hash = '';
  try {
    const u = new URL(to, window.location.origin);
    pathname = u.pathname.replace(/\/+$/, '');
    hash = u.hash;
  } catch {
    // Relative step path like "factor-one" — leave as-is; treated as a step below.
  }

  if (!hash) {
    if (pathname.endsWith('/sign-up')) {
      if (navigationRef.isReady()) navigationRef.navigate('Register');
      return;
    }
    if (pathname.endsWith('/sign-in')) {
      if (navigationRef.isReady()) navigationRef.navigate('Login');
      return;
    }
    if (pathname === '' || pathname === '/') {
      return; // bare post-auth redirect — state-driven, no-op to avoid the reload loop
    }
  }

  // A real Clerk in-flow step — let the flow continue.
  if (metadata?.windowNavigate) metadata.windowNavigate(to);
  else if (typeof window !== 'undefined') window.location.assign(to);
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

function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text style={{ color: '#FF3B30', fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
        Configuration error
      </Text>
      <Text style={{ color: '#8E8E93', fontSize: 14, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

function LoadingScreen({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {!!label && <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 16 }}>{label}</Text>}
    </View>
  );
}

// Rendered inside ClerkProvider so it can read Clerk's session state.
function AppInner() {
  const { isLoaded, isSignedIn } = useAuth();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isLoading = useAuthStore(s => s.isLoading);

  // ClerkAuthBridge must stay mounted across all states so the token exchange
  // runs regardless of which gate branch is showing.
  const bridge = <ClerkAuthBridge />;

  let content: React.ReactNode;
  if (!isLoaded || isLoading) {
    // Clerk still initializing, or we're still restoring a stored app session.
    content = <LoadingScreen />;
  } else if (isSignedIn && !isAuthenticated) {
    // Signed into Clerk but the backend exchange hasn't produced an app session
    // yet. Show a spinner instead of the (blank, already-signed-in) SignIn screen.
    content = <LoadingScreen label="Signing you in…" />;
  } else {
    content = <AppNavigator />;
  }

  return (
    <>
      {bridge}
      {content}
    </>
  );
}

export default function App() {
  const loadStoredAuth = useAuthStore(s => s.loadStoredAuth);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Rendered instead of crashing the whole bundle so a missing env var shows a
  // readable message rather than a silent white screen.
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <ConfigErrorScreen message="Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in this environment's build config (.env.local locally, EAS build env vars, or the Vercel project's environment variables) and redeploy." />
    );
  }

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
      {...(Platform.OS === 'web' ? { routerPush: clerkRouter, routerReplace: clerkRouter } : {})}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <AppInner />
            {/* Toast initialized here so it can overlay navigator */}
            <Toast config={toastConfig} />
          </SafeAreaProvider>
        </View>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
