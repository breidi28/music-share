import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Lets code outside the React tree (e.g. ClerkProvider's routerPush/routerReplace,
// which is instantiated in App.tsx above NavigationContainer) trigger navigation.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
