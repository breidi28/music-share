/**
 * SettingsScreen Component
 * 
 * Comprehensive settings page for the music sharing app that manages:
 * - Account information and profile navigation
 * - Music service integrations (Spotify, YouTube Music, Apple Music, Tidal, Qobuz)
 * - Notification preferences
 * - Privacy settings
 * - App information and support
 * - Account actions (logout, delete)
 * 
 * Features:
 * - OAuth integration for Spotify and YouTube Music
 * - Real-time connection status for all music services
 * - Disconnect functionality for all services
 * - Settings persistence (notifications, privacy)
 * - Safe account deletion and logout
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch, Platform, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { ResponseType } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { HIG } from '../theme/hig';
import { UtilityScreen } from '../theme/utilityScreen';
import { spotifyApi, youtubeApi, appleMusicApi, tidalApi, qobuzApi, deezerApi, usersApi, notificationsApi } from '../api/endpoints';
import { User } from '../types';

// Complete auth session when returning from OAuth browser
WebBrowser.maybeCompleteAuthSession();

// ═══════════════════════════════════════════════════════════════════════════
// OAuth Configuration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Spotify OAuth Client ID
 * Obtained from Spotify Developer Dashboard
 */
const SPOTIFY_CLIENT_ID = 'c2276ecc29b14734a7dc8c857a72bd80';

/**
 * Google OAuth Web Client ID
 * Used for YouTube Music authentication via Google OAuth
 * Obtained from Google Cloud Console
 */
const GOOGLE_WEB_CLIENT_ID = '810258213827-0evata0ebfoj122j2hou1etjvcf5v84j.apps.googleusercontent.com';

/**
 * Deezer OAuth App ID
 * Obtained from Deezer Developers portal
 */
const DEEZER_APP_ID = '';  // Add your Deezer App ID here

/**
 * Spotify OAuth endpoints
 */
const spotifyDiscovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

/**
 * Redirect URI for Spotify OAuth
 * Uses custom scheme for deep linking back to the app
 */
const SPOTIFY_REDIRECT_URI = 'https://music-share-b4r8.onrender.com/api/integrations/spotify/callback';

/**
 * Redirect URI for YouTube Music OAuth
 * Uses Expo's auth proxy for handling OAuth redirects
 */
const YOUTUBE_REDIRECT_URI = 'https://music-share-b4r8.onrender.com/api/integrations/youtube/callback';

/**
 * Redirect URI for Deezer OAuth
 * Uses Expo's auth proxy for handling OAuth redirects
 */
const DEEZER_REDIRECT_URI = 'https://auth.expo.io/@breidi282/music-share';

/**
 * Deezer OAuth endpoints
 */
const deezerDiscovery = {
    authorizationEndpoint: 'https://connect.deezer.com/oauth/auth.php',
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function SettingsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuthStore();

    // ───────────────────────────────────────────────────────────────────────
    // State Management
    // ───────────────────────────────────────────────────────────────────────

    /**
     * User profile with music service connection status
     * Fetched from backend to show real-time connection state
     */
    const [profile, setProfile] = useState<User | null>(null);

    /**
     * Loading state for music service operations
     * Shows spinner during OAuth flow and disconnect operations
     */
    const [loadingServices, setLoadingServices] = useState(false);

    /**
     * Notification preferences synced with backend
     */
    const [notifications, setNotifications] = useState({
        notify_new_post: true,
        notify_now_playing: false,
        notify_collection_add: false,
        notify_mentions: true,
        notify_replies: true,
    });

    /**
     * Privacy settings (local state)
     * TODO: Persist to backend when API endpoint is available
     */
    const [privacy, setPrivacy] = useState({
        profilePublic: true,          // Allow non-followers to see profile
        showListeningActivity: true,  // Show real-time listening on profile
        showCollection: true,         // Show music collection to others
    });

    // ───────────────────────────────────────────────────────────────────────
    // OAuth Configuration Hooks
    // ───────────────────────────────────────────────────────────────────────

    /**
     * Spotify OAuth hook
     * Handles authorization code flow with required scopes
     */
    const [spotifyRequest, spotifyResponse, spotifyPromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: SPOTIFY_CLIENT_ID,
            scopes: [
                'user-read-email',              // Read user email
                'user-read-private',            // Read user profile data
                'user-top-read',                // Read top artists and tracks
                'user-read-recently-played',    // Read listening history
                'playlist-read-private',        // Read private playlists
                'playlist-read-collaborative',  // Read collaborative playlists
                'user-read-currently-playing',  // Read currently playing track
                'user-read-playback-state',     // Read playback state
            ],
            redirectUri: SPOTIFY_REDIRECT_URI,
            extraParams: { state: user?.id?.toString() || '' },
        },
        spotifyDiscovery
    );

    /**
     * YouTube Music OAuth hook
     * Uses Google OAuth with authorization code flow (no PKCE)
     */
    const [youtubeRequest, youtubeResponse, youtubePromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: GOOGLE_WEB_CLIENT_ID,
            redirectUri: YOUTUBE_REDIRECT_URI,
            responseType: ResponseType.Code,
            scopes: [
                'https://www.googleapis.com/auth/youtube.readonly',  // Read YouTube library
            ],
            usePKCE: false,  // Google web client doesn't support PKCE
            extraParams: { state: user?.id?.toString() || '' },
        },
        {
            authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        }
    );

    /**
     * Deezer OAuth hook
     * Uses Deezer OAuth with authorization code flow
     */
    const [deezerRequest, deezerResponse, deezerPromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: DEEZER_APP_ID,
            redirectUri: DEEZER_REDIRECT_URI,
            responseType: ResponseType.Code,
            scopes: [
                'basic_access',           // Basic access to user data
                'email',                  // Access to user email
                'offline_access',         // Access user data any time
                'manage_library',         // Manage user's library
                'listening_history',      // Access listening history
            ],
            extraParams: {
                perms: 'basic_access,email,offline_access,manage_library,listening_history',
            },
        },
        deezerDiscovery
    );

    // ───────────────────────────────────────────────────────────────────────
    // Effects
    // ───────────────────────────────────────────────────────────────────────

    /**
     * Fetch user profile on mount and when user ID changes
     * Ensures we have latest connection status for all music services
     */
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.id) return;
            try {
                const res = await usersApi.getUser(user.id);
                setProfile(res.data);
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            }
        };
        fetchProfile();
    }, [user?.id]);

    /**
     * Handle Spotify OAuth response
     * Triggers when user returns from Spotify authorization
     */
    useEffect(() => {
        if (spotifyResponse?.type === 'success') {
            const { code } = spotifyResponse.params;
            handleSpotifyCallback(code);
        }
    }, [spotifyResponse]);

    /**
     * Handle YouTube Music OAuth response
     * Triggers when user returns from Google authorization
     */
    useEffect(() => {
        if (youtubeResponse?.type === 'success') {
            const { code } = youtubeResponse.params;
            handleYouTubeCallback(code);
        }
    }, [youtubeResponse]);

    /**
     * Handle Deezer OAuth response
     * Triggers when user returns from Deezer authorization
     */
    useEffect(() => {
        if (deezerResponse?.type === 'success') {
            const { code } = deezerResponse.params;
            handleDeezerCallback(code);
        }
    }, [deezerResponse]);

    /**
     * Load notification settings from backend
     */
    useEffect(() => {
        const loadNotifications = async () => {
            try {
                const res = await notificationsApi.getPreferences();
                setNotifications(res.data);
            } catch (error) {
                console.error('Failed to load notification settings from backend:', error);
            }
        };
        loadNotifications();
    }, []);

    const updateNotificationPref = async (key: keyof typeof notifications, value: boolean) => {
        const previous = notifications;
        const next = { ...notifications, [key]: value };
        setNotifications(next);

        try {
            await notificationsApi.updatePreferences({ [key]: value });
        } catch (error) {
            setNotifications(previous);
            Toast.show({ type: 'error', text1: 'Failed to update notifications' });
        }
    };

    /**
     * Load privacy settings from AsyncStorage
     * Ensures settings persist across app sessions
     */
    useEffect(() => {
        const loadPrivacy = async () => {
            try {
                const stored = await AsyncStorage.getItem('privacySettings');
                if (stored) {
                    setPrivacy(JSON.parse(stored));
                }
            } catch (error) {
                console.error('Failed to load privacy settings:', error);
            }
        };
        loadPrivacy();
    }, []);

    /**
     * Save privacy settings to AsyncStorage whenever they change
     */
    useEffect(() => {
        const savePrivacy = async () => {
            try {
                await AsyncStorage.setItem('privacySettings', JSON.stringify(privacy));
            } catch (error) {
                console.error('Failed to save privacy settings:', error);
            }
        };
        savePrivacy();
    }, [privacy]);

    // ───────────────────────────────────────────────────────────────────────
    // Music Service Handlers
    // ───────────────────────────────────────────────────────────────────────

    /**
     * Handle Spotify OAuth callback
     * Exchanges authorization code for access token via backend
     * @param code - Authorization code from Spotify
     */
    const handleSpotifyCallback = async (code: string) => {
        setLoadingServices(true);
        try {
            const res = await spotifyApi.callback(code, SPOTIFY_REDIRECT_URI);
            setProfile(res.data.user);
            Toast.show({ type: 'success', text1: 'Spotify Connected!' });
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.error || 'Failed to connect Spotify' });
        } finally {
            setLoadingServices(false);
        }
    };

    /**
     * Handle YouTube Music OAuth callback
     * Exchanges authorization code for access token via backend
     * @param code - Authorization code from Google
     */
    const handleYouTubeCallback = async (code: string) => {
        setLoadingServices(true);
        try {
            const res = await youtubeApi.callback(code, YOUTUBE_REDIRECT_URI);
            setProfile(res.data.user);
            Toast.show({ type: 'success', text1: 'YouTube Music Connected!' });
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.error || 'Failed to connect YouTube Music' });
        } finally {
            setLoadingServices(false);
        }
    };

    /**
     * Handle Deezer OAuth callback
     * Exchanges authorization code for access token via backend
     * @param code - Authorization code from Deezer
     */
    const handleDeezerCallback = async (code: string) => {
        setLoadingServices(true);
        try {
            const res = await deezerApi.callback(code);
            setProfile(res.data.user);
            Toast.show({ type: 'success', text1: 'Deezer Connected!' });
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.error || 'Failed to connect Deezer' });
        } finally {
            setLoadingServices(false);
        }
    };

    /**
     * Disconnect Spotify account
     * Shows confirmation dialog and removes Spotify access from backend
     */
    const handleDisconnectSpotify = () => {
        Alert.alert('Disconnect Spotify', 'Remove Spotify link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await spotifyApi.disconnect();
                        setProfile(res.data.user);
                        Toast.show({ type: 'success', text1: 'Success', text2: 'Spotify disconnected' });
                    } catch { }
                }
            }
        ]);
    };

    /**
     * Disconnect YouTube Music account
     * Shows confirmation dialog and removes YouTube access from backend
     */
    const handleDisconnectYouTube = () => {
        Alert.alert('Disconnect YouTube Music', 'Remove YouTube Music link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await youtubeApi.disconnect();
                        setProfile(res.data.user);
                        Toast.show({ type: 'success', text1: 'Success', text2: 'YouTube Music disconnected' });
                    } catch { }
                }
            }
        ]);
    };

    /**
     * Disconnect Apple Music account
     * Shows confirmation dialog and removes Apple Music access from backend
     */
    const handleDisconnectAppleMusic = () => {
        Alert.alert('Disconnect Apple Music', 'Remove Apple Music link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await appleMusicApi.disconnect();
                        setProfile(res.data.user);
                        Toast.show({ type: 'success', text1: 'Success', text2: 'Apple Music disconnected' });
                    } catch { }
                }
            }
        ]);
    };

    /**
     * Disconnect Tidal account
     * Shows confirmation dialog and removes Tidal access from backend
     */
    const handleDisconnectTidal = () => {
        Alert.alert('Disconnect Tidal', 'Remove Tidal link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await tidalApi.disconnect();
                        setProfile(res.data.user);
                        Toast.show({ type: 'success', text1: 'Success', text2: 'Tidal disconnected' });
                    } catch { }
                }
            }
        ]);
    };

    /**
     * Disconnect Qobuz account
     * Shows confirmation dialog and removes Qobuz access from backend
     */
    const handleDisconnectQobuz = () => {
        Alert.alert('Disconnect Qobuz', 'Remove Qobuz link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await qobuzApi.disconnect();
                        setProfile(res.data.user);
                        Toast.show({ type: 'success', text1: 'Success', text2: 'Qobuz disconnected' });
                    } catch { }
                }
            }
        ]);
    };

    /**
     * Disconnect Deezer account
     * Shows confirmation dialog and removes Deezer access from backend
     */
    const handleDisconnectDeezer = () => {
        Alert.alert('Disconnect Deezer', 'Remove Deezer link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await deezerApi.disconnect();
                        setProfile(res.data.user);
                        Toast.show({ type: 'success', text1: 'Success', text2: 'Deezer disconnected' });
                    } catch { }
                }
            }
        ]);
    };

    // ───────────────────────────────────────────────────────────────────────
    // Account Action Handlers
    // ───────────────────────────────────────────────────────────────────────

    /**
     * Handle user logout
     * Shows confirmation dialog, clears auth state, and navigates to login
     */
    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => {
                        logout();
                    },
                },
            ]
        );
    };


    /**
     * Handle account deletion
     * Shows warning dialog about permanent data loss
     * TODO: Implement backend API call for account deletion
     */
    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Implement account deletion API call
                        Toast.show({ type: 'info', text1: 'Not Implemented', text2: 'Account deletion will be available soon' });
                    },
                },
            ]
        );
    };

    // ───────────────────────────────────────────────────────────────────────
    // UI Components
    // ───────────────────────────────────────────────────────────────────────

    /**
     * SettingSection Component
     * Reusable section container with title and grouped settings
     * @param title - Section title displayed above the container
     * @param children - Setting rows to display in the section
     */
    const SettingSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <View style={{ marginBottom: 32 }}>
            <Text style={{
                color: HIG.secondaryText,
                fontSize: 13,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: 12,
                paddingHorizontal: 16,
            }}>
                {title}
            </Text>
            <View style={{ backgroundColor: HIG.groupedCard, borderRadius: HIG.sectionCornerRadius, marginHorizontal: 16 }}>
                {children}
            </View>
        </View>
    );

    /**
     * SettingRow Component
     * Reusable row component for individual settings
     * Supports different types: navigation, switch, display-only
     * 
     * @param icon - Ionicon name to display
     * @param label - Setting label text
     * @param value - Optional value to display (for display-only rows)
     * @param onPress - Optional press handler (for navigation rows)
     * @param showArrow - Whether to show forward arrow (default: true)
     * @param isSwitch - Whether this is a toggle switch row
     * @param switchValue - Current switch value (for switch rows)
     * @param onSwitchChange - Switch change handler (for switch rows)
     * @param isLast - Whether this is the last row (removes bottom border)
     * @param destructive - Whether to use destructive styling (red text)
     */
    const SettingRow = ({
        icon,
        label,
        value,
        onPress,
        showArrow = true,
        isSwitch = false,
        switchValue,
        onSwitchChange,
        isLast = false,
        destructive = false,
    }: any) => {
        const rowStyle = {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingVertical: 14,
            paddingHorizontal: 16,
            minHeight: HIG.rowMinHeight,
            borderBottomWidth: isLast ? 0 : HIG.separatorThickness,
            borderBottomColor: HIG.separator,
        };

        const content = (
            <>
                <Ionicons name={icon} size={22} color={destructive ? Colors.primary : '#9ca3af'} />
                <Text style={{
                    color: destructive ? Colors.primary : 'white',
                    fontSize: 16,
                    marginLeft: 12,
                    flex: 1,
                }}>
                    {label}
                </Text>
                {isSwitch && (
                    <Switch
                        value={switchValue}
                        onValueChange={onSwitchChange}
                        trackColor={{ false: '#374151', true: Colors.primary }}
                        thumbColor={Platform.OS === 'ios' ? '#fff' : switchValue ? '#fff' : '#d1d5db'}
                    />
                )}
                {!isSwitch && value && (
                    <Text style={{ color: '#6b7280', fontSize: 15, marginRight: 8 }}>{value}</Text>
                )}
                {!isSwitch && showArrow && (
                    <Ionicons name="chevron-forward" size={20} color="#4b5563" />
                )}
            </>
        );

        // Use View for switch rows, TouchableOpacity for clickable rows
        if (isSwitch) {
            return <View style={rowStyle}>{content}</View>;
        }

        return (
            <TouchableOpacity onPress={onPress} style={rowStyle} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                {content}
            </TouchableOpacity>
        );
    };

    /**
     * MusicServiceRow Component
     * Specialized row component for music service connections
     * Shows connection status and connect/disconnect buttons
     * 
     * @param icon - FontAwesome5 icon name for the service
     * @param label - Service name (e.g., "Spotify", "YouTube Music")
     * @param connected - Whether service is currently connected
     * @param onConnect - Handler for connect button press
     * @param onDisconnect - Handler for disconnect button press
     * @param isLast - Whether this is the last row (removes bottom border)
     * @param color - Brand color for the service
     * @param loading - Whether OAuth flow is in progress
     */
    const MusicServiceRow = ({
        icon,
        label,
        connected,
        onConnect,
        onDisconnect,
        isLast = false,
        color = '#9ca3af',
        loading = false,
    }: any) => (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                minHeight: HIG.rowMinHeight,
                borderBottomWidth: isLast ? 0 : HIG.separatorThickness,
                borderBottomColor: HIG.separator,
            }}
        >
            <View
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: connected ? `${color}1F` : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: connected ? `${color}55` : 'rgba(255,255,255,0.08)',
                }}
            >
                <FontAwesome5 name={icon} size={16} color={connected ? color : '#9ca3af'} />
            </View>

            <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                    {label}
                </Text>
                <Text style={{ color: connected ? '#86efac' : '#6b7280', fontSize: 12, marginTop: 2 }}>
                    {connected ? 'Connected' : 'Not connected'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
            ) : connected ? (
                <TouchableOpacity
                    onPress={onDisconnect}
                    style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.12)',
                        minHeight: HIG.touchTargetMin,
                        minWidth: 108,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ color: '#fca5a5', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 }}>Disconnect</Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    onPress={onConnect}
                    style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.12)',
                        minHeight: HIG.touchTargetMin,
                        minWidth: 108,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 }}>Connect</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    // ───────────────────────────────────────────────────────────────────────
    // Render
    // ───────────────────────────────────────────────────────────────────────

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            {/* ═══════════════════════════════════════════════════════════
                Header - Back button and page title
                ═══════════════════════════════════════════════════════════ */}
            <View
                style={{
                    paddingTop: insets.top,
                    backgroundColor: UtilityScreen.header.backgroundColor,
                    borderBottomWidth: UtilityScreen.header.borderBottomWidth,
                    borderBottomColor: UtilityScreen.header.borderBottomColor,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: UtilityScreen.header.horizontalPadding, paddingVertical: UtilityScreen.header.verticalPadding }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: UtilityScreen.header.backButtonMarginRight, minWidth: HIG.touchTargetMin, minHeight: HIG.touchTargetMin, justifyContent: 'center' }}>
                        <Ionicons name="chevron-back" size={UtilityScreen.header.backIconSize} color="white" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: UtilityScreen.header.titleSize, fontWeight: UtilityScreen.header.titleWeight, color: 'white', letterSpacing: UtilityScreen.header.titleLetterSpacing, flex: 1 }}>
                        Settings
                    </Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{
                    paddingTop: UtilityScreen.content.topPadding,
                    paddingBottom: UtilityScreen.content.bottomPadding,
                }}
            >
                {/* ═══════════════════════════════════════════════════════════
                    Account Section - Profile and user info
                    ═══════════════════════════════════════════════════════════ */}
                <SettingSection title="Account">
                    <SettingRow
                        icon="person-outline"
                        label="Edit Profile"
                        onPress={() => navigation.navigate('EditProfile')}
                    />
                    <SettingRow
                        icon="at-outline"
                        label="Username"
                        value={user?.username}
                        showArrow={false}
                        isLast
                    />
                </SettingSection>

                {/* ═══════════════════════════════════════════════════════════
                    Music Services Section - Connect/disconnect streaming services
                    
                    Supported Services:
                    - Spotify: Full OAuth integration
                    - YouTube Music: Google OAuth integration
                    - Apple Music: Planned (requires MusicKit)
                    - Tidal: Backend ready (needs API credentials)
                    - Qobuz: Backend ready (needs API credentials)
                    ═══════════════════════════════════════════════════════════ */}
                <SettingSection title="Music Services">
                    <MusicServiceRow
                        icon="spotify"
                        label="Spotify"
                        connected={profile?.has_spotify_linked}
                        onConnect={() => spotifyRequest && spotifyPromptAsync()}
                        onDisconnect={handleDisconnectSpotify}
                        color="#1DB954"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="youtube"
                        label="YouTube Music"
                        connected={profile?.has_youtube_linked}
                        onConnect={() => youtubeRequest && youtubePromptAsync()}
                        onDisconnect={handleDisconnectYouTube}
                        color="#FF0000"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="apple"
                        label="Apple Music"
                        connected={profile?.has_apple_music_linked}
                        onConnect={() => Toast.show({ type: 'info', text1: 'Apple Music', text2: 'Integration coming soon!' })}
                        onDisconnect={handleDisconnectAppleMusic}
                        color="#FC3A6E"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="music"
                        label="Tidal"
                        connected={profile?.has_tidal_linked}
                        onConnect={() => Toast.show({ type: 'info', text1: 'Tidal', text2: 'Backend API credentials needed.' })}
                        onDisconnect={handleDisconnectTidal}
                        color="#00B0FF"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="compact-disc"
                        label="Qobuz"
                        connected={profile?.has_qobuz_linked}
                        onConnect={() => Toast.show({ type: 'info', text1: 'Qobuz', text2: 'Backend API credentials needed.' })}
                        onDisconnect={handleDisconnectQobuz}
                        color="#f87171"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="music"
                        label="Deezer"
                        connected={profile?.has_deezer_linked}
                        onConnect={() => {
                            if (!DEEZER_APP_ID) {
                                Toast.show({ type: 'info', text1: 'Deezer', text2: 'Credentials configuration needed.' });
                            } else {
                                deezerPromptAsync();
                            }
                        }}
                        onDisconnect={handleDisconnectDeezer}
                        color="#FF0092"
                        loading={loadingServices}
                        isLast
                    />
                </SettingSection>

                {/* ═══════════════════════════════════════════════════════════
                    Notifications Section - Manage push notification preferences
                    Synced with backend notification preference settings
                    ═══════════════════════════════════════════════════════════ */}
                <SettingSection title="Notifications">
                    <SettingRow
                        icon="document-text-outline"
                        label="New Posts"
                        isSwitch
                        switchValue={notifications.notify_new_post}
                        onSwitchChange={(v: boolean) => updateNotificationPref('notify_new_post', v)}
                    />
                    <SettingRow
                        icon="musical-notes-outline"
                        label="Now Playing"
                        isSwitch
                        switchValue={notifications.notify_now_playing}
                        onSwitchChange={(v: boolean) => updateNotificationPref('notify_now_playing', v)}
                    />
                    <SettingRow
                        icon="albums-outline"
                        label="Collection Adds"
                        isSwitch
                        switchValue={notifications.notify_collection_add}
                        onSwitchChange={(v: boolean) => updateNotificationPref('notify_collection_add', v)}
                    />
                    <SettingRow
                        icon="at-outline"
                        label="Mentions"
                        isSwitch
                        switchValue={notifications.notify_mentions}
                        onSwitchChange={(v: boolean) => updateNotificationPref('notify_mentions', v)}
                    />
                    <SettingRow
                        icon="chatbubble-outline"
                        label="Replies"
                        isSwitch
                        switchValue={notifications.notify_replies}
                        onSwitchChange={(v: boolean) => updateNotificationPref('notify_replies', v)}
                        isLast
                    />
                </SettingSection>

                {/* ═══════════════════════════════════════════════════════════
                    Privacy Section - Control visibility and data sharing
                    Note: Settings are currently local only (not persisted to backend)
                    ═══════════════════════════════════════════════════════════ */}
                <SettingSection title="Privacy">
                    <SettingRow
                        icon="eye-outline"
                        label="Public Profile"
                        isSwitch
                        switchValue={privacy.profilePublic}
                        onSwitchChange={(v: boolean) => setPrivacy({ ...privacy, profilePublic: v })}
                    />
                    <SettingRow
                        icon="headset-outline"
                        label="Show Listening Activity"
                        isSwitch
                        switchValue={privacy.showListeningActivity}
                        onSwitchChange={(v: boolean) => setPrivacy({ ...privacy, showListeningActivity: v })}
                    />
                    <SettingRow
                        icon="albums-outline"
                        label="Show Collection"
                        isSwitch
                        switchValue={privacy.showCollection}
                        onSwitchChange={(v: boolean) => setPrivacy({ ...privacy, showCollection: v })}
                        isLast
                    />
                </SettingSection>

                {/* ═══════════════════════════════════════════════════════════
                    About Section - App information and legal
                    ═══════════════════════════════════════════════════════════ */}
                <SettingSection title="About">
                    <SettingRow
                        icon="information-circle-outline"
                        label="About music share"
                        onPress={() => Toast.show({ type: 'info', text1: 'Music Share', text2: 'Version 1.0.0 - A social music sharing platform.' })}
                    />
                    <SettingRow
                        icon="sparkles-outline"
                        label="Changelog"
                        onPress={() => navigation.navigate('Changelog')}
                    />
                    <SettingRow
                        icon="stats-chart-outline"
                        label="Weekly Recap"
                        onPress={() => navigation.navigate('WeeklyRecap')}
                    />
                    <SettingRow
                        icon="document-text-outline"
                        label="Terms of Service"
                        onPress={() => navigation.navigate('Terms')}
                    />
                    <SettingRow
                        icon="shield-checkmark-outline"
                        label="Privacy Policy"
                        onPress={() => navigation.navigate('PrivacyPolicy')}
                    />
                    <SettingRow
                        icon="help-circle-outline"
                        label="Help & Support"
                        onPress={() => navigation.navigate('HelpSupport')}
                        isLast
                    />
                </SettingSection>

                {/* ═══════════════════════════════════════════════════════════
                    Account Actions - Destructive operations (logout, delete)
                    ═══════════════════════════════════════════════════════════ */}
                <SettingSection title="Account Actions">
                    <SettingRow
                        icon="log-out-outline"
                        label="Logout"
                        onPress={handleLogout}
                        showArrow={false}
                        destructive
                    />
                    <SettingRow
                        icon="trash-outline"
                        label="Delete Account"
                        onPress={handleDeleteAccount}
                        showArrow={false}
                        destructive
                        isLast
                    />
                </SettingSection>

                {/* Footer */}
                <View style={{ alignItems: 'center', marginTop: 24, paddingHorizontal: 32 }}>
                    <Text style={{ color: '#4b5563', fontSize: 13, textAlign: 'center' }}>
                        music share • Version 1.0.0
                    </Text>
                    <Text style={{ color: '#374151', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                        Made with ❤️ for music lovers
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
