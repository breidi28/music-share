import React from 'react';
import { View, Platform, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { enableScreens } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable native screens for better performance and gestures
enableScreens();

import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import FeedScreen from '../screens/FeedScreen';
import ExploreScreen from '../screens/ExploreScreen';
import ShareScreen from '../screens/ShareScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CollectionScreen from '../screens/CollectionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsScreen from '../screens/TermsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import FollowersListScreen from '../screens/FollowersListScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
    const insets = useSafeAreaInsets();
    
    // Calculate tab bar height with safe area insets
    const tabBarHeight = Platform.OS === 'ios' ? 64 + insets.bottom : 58 + insets.bottom;
    
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: true,
                // Use native iOS tab bar styling
                tabBarStyle: Platform.OS === 'ios' ? {
                    backgroundColor: 'rgba(28, 28, 30, 0.72)', // iOS-style translucent dark
                    borderTopColor: 'rgba(255, 255, 255, 0.1)',
                    borderTopWidth: 0.5,
                    height: tabBarHeight,
                    paddingBottom: Math.max(insets.bottom, 8), // Use safe area bottom or minimum 8
                    paddingTop: 8,
                } : {
                    backgroundColor: '#1a1a1a',
                    borderTopColor: 'rgba(255, 255, 255, 0.1)',
                    borderTopWidth: 1,
                    height: tabBarHeight,
                    paddingBottom: Math.max(insets.bottom, 10), // Use safe area bottom or minimum 10
                    paddingTop: 8,
                },
                tabBarActiveTintColor: Colors.primary, // Apple Music Pink/Red active tint
                tabBarInactiveTintColor: '#9ca3af', // gray-400
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                    marginTop: -2,
                    marginBottom: Platform.OS === 'ios' ? 0 : 4,
                },
                tabBarIconStyle: {
                    marginTop: Platform.OS === 'ios' ? 4 : 0,
                },
                tabBarIcon: ({ color, focused, size }) => {
                    const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
                        Feed: { active: 'home', inactive: 'home-outline' },
                        Explore: { active: 'compass', inactive: 'compass-outline' },
                        Share: { active: 'add-circle', inactive: 'add-circle-outline' },
                        Collection: { active: 'albums', inactive: 'albums-outline' },
                        MyProfile: { active: 'person', inactive: 'person-outline' },
                    };
                    const icon = icons[route.name];
                    // Center FAB for Share button with iOS-style elevation
                    if (route.name === 'Share') {
                        return (
                            <View style={{
                                width: 52,
                                height: 52,
                                borderRadius: 26,
                                backgroundColor: Colors.primary,
                                alignItems: 'center',
                                justifyContent: 'center',
                                // iOS-style shadow
                                shadowColor: Colors.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8,
                                elevation: 6,
                            }}>
                                <Ionicons name="add" size={28} color="white" />
                            </View>
                        );
                    }
                    return <Ionicons name={focused ? icon?.active : icon?.inactive} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarLabel: 'Home' }} />
            <Tab.Screen name="Explore" component={ExploreScreen} />
            <Tab.Screen name="Share" component={ShareScreen} options={{ tabBarLabel: '' }} />
            <Tab.Screen name="Collection" component={CollectionScreen} />
            <Tab.Screen name="MyProfile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) return null;

    return (
        <NavigationContainer
            theme={{
                dark: true,
                colors: {
                    primary: Colors.primary,
                    background: '#000',
                    card: '#1c1c1e',
                    text: '#fff',
                    border: 'rgba(255,255,255,0.1)',
                    notification: Colors.primary,
                },
                fonts: {
                    regular: {
                        fontFamily: 'System',
                        fontWeight: '400',
                    },
                    medium: {
                        fontFamily: 'System',
                        fontWeight: '500',
                    },
                    bold: {
                        fontFamily: 'System',
                        fontWeight: '700',
                    },
                    heavy: {
                        fontFamily: 'System',
                        fontWeight: '900',
                    },
                },
            }}
        >
            <Stack.Navigator 
                screenOptions={{ 
                    headerShown: false,
                    // iOS-style gestures and animations
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                    animation: Platform.OS === 'ios' ? 'default' : 'fade',
                    customAnimationOnGesture: true,
                    fullScreenGestureEnabled: true,
                }}
            >
                {isAuthenticated ? (
                    <>
                        <Stack.Screen name="Main" component={TabNavigator} />
                        <Stack.Screen 
                            name="Profile" 
                            component={ProfileScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen 
                            name="Search" 
                            component={SearchScreen}
                            options={{
                                presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                                animation: Platform.OS === 'ios' ? 'slide_from_bottom' : 'fade',
                            }}
                        />
                        <Stack.Screen 
                            name="Notifications" 
                            component={NotificationsScreen}
                            options={{
                                presentation: Platform.OS === 'ios' ? 'modal' : 'card',
                                animation: Platform.OS === 'ios' ? 'slide_from_bottom' : 'fade',
                            }}
                        />
                        <Stack.Screen 
                            name="Settings" 
                            component={SettingsScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen 
                            name="Terms" 
                            component={TermsScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen 
                            name="PrivacyPolicy" 
                            component={PrivacyPolicyScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen 
                            name="HelpSupport" 
                            component={HelpSupportScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen 
                            name="FollowersList" 
                            component={FollowersListScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen 
                            name="Collection" 
                            component={CollectionScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                    </>
                ) : (
                    <>
                        <Stack.Screen 
                            name="Login" 
                            component={LoginScreen}
                            options={{
                                animation: 'fade',
                            }}
                        />
                        <Stack.Screen 
                            name="Register" 
                            component={RegisterScreen}
                            options={{
                                animation: 'slide_from_right',
                            }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
