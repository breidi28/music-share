import React from 'react';
import { View, Platform, TouchableOpacity, Text, StyleSheet, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { enableScreens } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable native screens for better performance and gestures
enableScreens();

import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { navigationRef } from './navigationRef';

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
import ListenLaterScreen from '../screens/ListenLaterScreen';
import ChangelogScreen from '../screens/ChangelogScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import CollaborativeListsScreen from '../screens/CollaborativeListsScreen';
import WeeklyRecapScreen from '../screens/WeeklyRecapScreen';
import ArtistProgressScreen from '../screens/ArtistProgressScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
    Feed:       { active: 'home',    inactive: 'home-outline',    label: 'Home' },
    Explore:    { active: 'compass', inactive: 'compass-outline', label: 'Explore' },
    Share:      { active: 'add-circle', inactive: 'add-circle-outline', label: '' },
    Collection: { active: 'albums',  inactive: 'albums-outline',  label: 'Collection' },
    MyProfile:  { active: 'person',  inactive: 'person-outline',  label: 'Profile' },
};

// Liquid glass floating dock tab bar
function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                bottom: Math.max(insets.bottom, 12) + 4,
                left: 8,
                right: 8,
            }}
        >
            {/* Outer pill */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                borderRadius: 40,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.45,
                shadowRadius: 24,
                elevation: 20,
            }}>
                {/* Blur layer */}
                <BlurView
                    tint="dark"
                    intensity={Platform.OS === 'ios' ? 80 : 100}
                    style={StyleSheet.absoluteFill}
                />
                {/* Glass fill + border container */}
                <View style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 40,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    // Specular top highlight — the "liquid glass" light edge
                    borderWidth: 1,
                    borderTopColor: 'rgba(255,255,255,0.35)',
                    borderLeftColor: 'rgba(255,255,255,0.12)',
                    borderRightColor: 'rgba(255,255,255,0.12)',
                    borderBottomColor: 'rgba(255,255,255,0.04)',
                }} />
                {/* Tab items */}
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', width: '100%', paddingHorizontal: 8, paddingVertical: 12 }}>
                    {state.routes.map((route, index) => {
                        const focused = state.index === index;
                        const icon = TAB_ICONS[route.name];
                        const isShare = route.name === 'Share';

                        return (
                            <Pressable
                                key={route.key}
                                onPress={() => {
                                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                                }}
                                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                                style={({ pressed }) => ({
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: isShare ? 8 : 4,
                                    paddingVertical: 4,
                                    opacity: pressed ? 0.7 : 1,
                                })}
                            >
                                {isShare ? (
                                    // FAB pill inside the dock
                                    <View style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 24,
                                        backgroundColor: Colors.primary,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        shadowColor: Colors.primary,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.5,
                                        shadowRadius: 10,
                                        elevation: 8,
                                        marginHorizontal: 4,
                                    }}>
                                        <Ionicons name="add" size={26} color="white" />
                                    </View>
                                ) : (
                                    <View style={{ alignItems: 'center', gap: 3 }}>
                                        {/* Active indicator pill behind icon */}
                                        {focused && (
                                            <View style={{
                                                position: 'absolute',
                                                top: -6,
                                                width: 36,
                                                height: 36,
                                                borderRadius: 18,
                                                backgroundColor: 'rgba(255,255,255,0.12)',
                                            }} />
                                        )}
                                        <Ionicons
                                            name={focused ? icon.active : icon.inactive}
                                            size={24}
                                            color={focused ? Colors.primary : 'rgba(255,255,255,0.45)'}
                                        />
                                        <Text style={{
                                            fontSize: 10,
                                            fontWeight: focused ? '700' : '500',
                                            color: focused ? Colors.primary : 'rgba(255,255,255,0.35)',
                                            letterSpacing: 0.2,
                                        }}>
                                            {icon.label}
                                        </Text>
                                    </View>
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

function TabNavigator() {
    return (
        <Tab.Navigator
            tabBar={(props) => <LiquidGlassTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen name="Feed" component={FeedScreen} />
            <Tab.Screen name="Explore" component={ExploreScreen} />
            <Tab.Screen name="Share" component={ShareScreen} />
            <Tab.Screen name="Collection" component={CollectionScreen} />
            <Tab.Screen name="MyProfile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}


export default function AppNavigator() {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) return null;

    return (
        <NavigationContainer
            ref={navigationRef}
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
                    fullScreenGestureEnabled: false,
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
                                fullScreenGestureEnabled: false,
                            }}
                        />
                        <Stack.Screen
                            name="EditProfile"
                            component={EditProfileScreen}
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
                        <Stack.Screen
                            name="ListenLater"
                            component={ListenLaterScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="Changelog"
                            component={ChangelogScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="CollaborativeLists"
                            component={CollaborativeListsScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="WeeklyRecap"
                            component={WeeklyRecapScreen}
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="ArtistProgress"
                            component={ArtistProgressScreen}
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
