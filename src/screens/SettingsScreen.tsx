/**
 * SettingsScreen Component
 *
 * Comprehensive settings page following Apple Human Interface Guidelines:
 * - Grouped list layout with proper spacing
 * - Clear visual hierarchy
 * - Uncluttered interface with adequate touch targets (44px minimum)
 * - iOS-style section headers and separators
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, Platform, ActivityIndicator, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { HIG } from '../theme/hig';
import { UtilityScreen } from '../theme/utilityScreen';
import { spotifyApi, youtubeApi, appleMusicApi, tidalApi, qobuzApi, deezerApi, usersApi, notificationsApi } from '../api/endpoints';
import api from '../api/client';
import { User } from '../types';

// New HIG-compliant UI components
import { ListGroup, ListItem, ListHeader, ListFooter, Toggle, Button } from '../components/ui';

WebBrowser.maybeCompleteAuthSession();

// ═══════════════════════════════════════════════════════════════════════════
// OAuth Configuration
// ═══════════════════════════════════════════════════════════════════════════

const SPOTIFY_CLIENT_ID = 'c2276ecc29b14734a7dc8c857a72bd80';
const GOOGLE_WEB_CLIENT_ID = '810258213827-0evata0ebfoj122j2hou1etjvcf5v84j.apps.googleusercontent.com';
const DEEZER_APP_ID = '';

const SPOTIFY_REDIRECT_URI = 'https://music-share-b4r8.onrender.com/api/integrations/spotify/callback';
const YOUTUBE_REDIRECT_URI = 'https://music-share-b4r8.onrender.com/api/integrations/youtube/callback';
const DEEZER_REDIRECT_URI = 'https://music-share-b4r8.onrender.com/api/integrations/deezer/callback';

export default function SettingsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuthStore();

    // Header styles that depend on insets
    const headerStyles = {
        paddingTop: insets.top,
    };

    const [profile, setProfile] = useState<User | null>(null);
    const [loadingServices, setLoadingServices] = useState(false);
    const [notifications, setNotifications] = useState({
        notify_new_post: true,
        notify_now_playing: false,
        notify_collection_add: false,
        notify_mentions: true,
        notify_replies: true,
    });
    const [privacy, setPrivacy] = useState({
        profilePublic: true,
        showListeningActivity: true,
        showCollection: true,
    });
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        if (Platform.OS !== 'web') {
            Alert.alert(title, message, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', style: 'destructive', onPress: onConfirm },
            ]);
        } else {
            setConfirmDialog({ title, message, onConfirm });
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // OAuth Handlers
    // ═══════════════════════════════════════════════════════════════════════

    const handleConnectSpotify = async () => {
        if (!user?.id) return;
        setLoadingServices(true);
        try {
            const scopes = [
                'user-read-email',
                'user-read-private',
                'user-top-read',
                'user-read-recently-played',
                'playlist-read-private',
                'playlist-read-collaborative',
                'user-read-currently-playing',
                'user-read-playback-state',
            ].join(' ');

            const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${user.id}`;

            const result = await WebBrowser.openAuthSessionAsync(authUrl, 'musicshare://');

            if (result.type === 'success') {
                const res = await usersApi.getUser(user.id);
                setProfile(res.data);
                Toast.show({ type: 'success', text1: 'Spotify Connected!' });
            }
        } catch (error) {
            console.error('Spotify connection failed:', error);
            Toast.show({ type: 'error', text1: 'Connection failed' });
        } finally {
            setLoadingServices(false);
        }
    };

    const handleConnectYouTube = async () => {
        if (!user?.id) return;
        setLoadingServices(true);
        try {
            const stateRes = await api.get('/auth/oauth-state');
            const signedState = stateRes.data.state;

            const scope = [
                'https://www.googleapis.com/auth/youtube',
                'https://www.googleapis.com/auth/youtube.readonly',
            ].join(' ');
            const authUrl = [
                'https://accounts.google.com/o/oauth2/v2/auth',
                `?client_id=${GOOGLE_WEB_CLIENT_ID}`,
                `&response_type=code`,
                `&redirect_uri=${encodeURIComponent(YOUTUBE_REDIRECT_URI)}`,
                `&scope=${encodeURIComponent(scope)}`,
                `&state=${encodeURIComponent(signedState)}`,
                `&access_type=offline`,
                `&prompt=consent`,
            ].join('');

            const result = await WebBrowser.openAuthSessionAsync(authUrl, 'musicshare://');

            if (result.type === 'success') {
                const res = await usersApi.getUser(user.id);
                setProfile(res.data);
                Toast.show({ type: 'success', text1: 'YouTube Music Connected!' });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Connection failed', text2: 'Could not connect to YouTube Music' });
        } finally {
            setLoadingServices(false);
        }
    };

    const handleConnectDeezer = async () => {
        if (!user?.id) return;
        setLoadingServices(true);
        try {
            const perms = 'basic_access,email,offline_access,manage_library,listening_history';
            const authUrl = `https://connect.deezer.com/oauth/auth.php?app_id=${DEEZER_APP_ID}&redirect_uri=${encodeURIComponent(DEEZER_REDIRECT_URI)}&perms=${encodeURIComponent(perms)}&state=${user.id}`;

            const result = await WebBrowser.openAuthSessionAsync(authUrl, 'musicshare://');

            if (result.type === 'success') {
                const res = await usersApi.getUser(user.id);
                setProfile(res.data);
                Toast.show({ type: 'success', text1: 'Deezer Connected!' });
            }
        } catch (error) {
            console.error('Deezer connection failed:', error);
        } finally {
            setLoadingServices(false);
        }
    };

    const handleConnectAppleMusic = () => {
        Toast.show({ type: 'info', text1: 'Apple Music', text2: 'Integration coming soon!' });
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Effects
    // ═══════════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════════
    // Disconnect Handlers
    // ═══════════════════════════════════════════════════════════════════════

    const handleDisconnectSpotify = () => {
        showConfirm('Disconnect Spotify', 'Remove Spotify link from your account?', async () => {
            try {
                const res = await spotifyApi.disconnect();
                setProfile(res.data.user);
                Toast.show({ type: 'success', text1: 'Success', text2: 'Spotify disconnected' });
            } catch { }
        });
    };

    const handleDisconnectYouTube = () => {
        showConfirm('Disconnect YouTube Music', 'Remove YouTube Music link from your account?', async () => {
            try {
                const res = await youtubeApi.disconnect();
                setProfile(res.data.user);
                Toast.show({ type: 'success', text1: 'Success', text2: 'YouTube Music disconnected' });
            } catch { }
        });
    };

    const handleDisconnectAppleMusic = () => {
        showConfirm('Disconnect Apple Music', 'Remove Apple Music link from your account?', async () => {
            try {
                const res = await appleMusicApi.disconnect();
                setProfile(res.data.user);
                Toast.show({ type: 'success', text1: 'Success', text2: 'Apple Music disconnected' });
            } catch { }
        });
    };

    const handleDisconnectTidal = () => {
        showConfirm('Disconnect Tidal', 'Remove Tidal link from your account?', async () => {
            try {
                const res = await tidalApi.disconnect();
                setProfile(res.data.user);
                Toast.show({ type: 'success', text1: 'Success', text2: 'Tidal disconnected' });
            } catch { }
        });
    };

    const handleDisconnectQobuz = () => {
        showConfirm('Disconnect Qobuz', 'Remove Qobuz link from your account?', async () => {
            try {
                const res = await qobuzApi.disconnect();
                setProfile(res.data.user);
                Toast.show({ type: 'success', text1: 'Success', text2: 'Qobuz disconnected' });
            } catch { }
        });
    };

    const handleDisconnectDeezer = () => {
        showConfirm('Disconnect Deezer', 'Remove Deezer link from your account?', async () => {
            try {
                const res = await deezerApi.disconnect();
                setProfile(res.data.user);
                Toast.show({ type: 'success', text1: 'Success', text2: 'Deezer disconnected' });
            } catch { }
        });
    };

    const handleLogout = () => {
        showConfirm('Logout', 'Are you sure you want to logout?', () => {
            logout();
        });
    };

    const handleDeleteAccount = () => {
        showConfirm('Delete Account', 'This action cannot be undone. All your data will be permanently deleted.', () => {
            Toast.show({ type: 'info', text1: 'Not Implemented', text2: 'Account deletion will be available soon' });
        });
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════════════════════════════════

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, headerStyles]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Account Section */}
                <ListHeader title="Account" />
                <ListGroup>
                    <ListItem
                        title="Edit Profile"
                        icon="person-outline"
                        iconColor={Colors.primary}
                        chevron
                        onPress={() => navigation.navigate('EditProfile')}
                    />
                    <ListItem
                        title="Username"
                        icon="at-outline"
                        iconColor={Colors.primary}
                        value={user?.username}
                    />
                </ListGroup>
                <ListFooter title="Manage your profile information and username" />

                {/* Music Services Section */}
                <ListHeader title="Music Services" />
                <ListGroup>
                    <MusicServiceRow
                        icon="spotify"
                        label="Spotify"
                        connected={!!profile?.has_spotify_linked}
                        onConnect={handleConnectSpotify}
                        onDisconnect={handleDisconnectSpotify}
                        color="#1DB954"
                        loading={loadingServices}
                        iconFamily="FontAwesome5"
                    />
                    <MusicServiceRow
                        icon="youtube"
                        label="YouTube Music"
                        connected={!!profile?.has_youtube_linked}
                        onConnect={handleConnectYouTube}
                        onDisconnect={handleDisconnectYouTube}
                        color="#FF0000"
                        loading={loadingServices}
                        iconFamily="FontAwesome5"
                    />
                    <MusicServiceRow
                        icon="logo-apple"
                        label="Apple Music"
                        connected={!!profile?.has_apple_music_linked}
                        onConnect={handleConnectAppleMusic}
                        onDisconnect={handleDisconnectAppleMusic}
                        color="#FC3A6E"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="musical-notes"
                        label="Tidal"
                        connected={!!profile?.has_tidal_linked}
                        onConnect={() => Toast.show({ type: 'info', text1: 'Tidal', text2: 'Backend API credentials needed.' })}
                        onDisconnect={handleDisconnectTidal}
                        color="#00B0FF"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="diamond-outline"
                        label="Qobuz"
                        connected={!!profile?.has_qobuz_linked}
                        onConnect={() => Toast.show({ type: 'info', text1: 'Qobuz', text2: 'Backend API credentials needed.' })}
                        onDisconnect={handleDisconnectQobuz}
                        color="#2196F3"
                        loading={loadingServices}
                    />
                    <MusicServiceRow
                        icon="musical-notes"
                        label="Deezer"
                        connected={!!profile?.has_deezer_linked}
                        onConnect={handleConnectDeezer}
                        onDisconnect={handleDisconnectDeezer}
                        color="#FF0092"
                        loading={loadingServices}
                    />
                </ListGroup>
                <ListFooter title="Connect your music streaming services" />

                {/* Notifications Section */}
                <ListHeader title="Notifications" />
                <ListGroup>
                    <ListItem
                        title="New Posts"
                        subtitle="When friends share new music"
                        icon="document-text-outline"
                        iconColor={HIG.systemColors.systemBlue}
                        rightElement={
                            <Toggle
                                value={notifications.notify_new_post}
                                onValueChange={(v) => updateNotificationPref('notify_new_post', v)}
                            />
                        }
                    />
                    <ListItem
                        title="Now Playing"
                        subtitle="When friends start playing music"
                        icon="musical-notes-outline"
                        iconColor={HIG.systemColors.systemPink}
                        rightElement={
                            <Toggle
                                value={notifications.notify_now_playing}
                                onValueChange={(v) => updateNotificationPref('notify_now_playing', v)}
                            />
                        }
                    />
                    <ListItem
                        title="Collection Adds"
                        subtitle="When items are added to collection"
                        icon="albums-outline"
                        iconColor={HIG.systemColors.systemPurple}
                        rightElement={
                            <Toggle
                                value={notifications.notify_collection_add}
                                onValueChange={(v) => updateNotificationPref('notify_collection_add', v)}
                            />
                        }
                    />
                    <ListItem
                        title="Mentions"
                        subtitle="When someone mentions you"
                        icon="at-outline"
                        iconColor={HIG.systemColors.systemOrange}
                        rightElement={
                            <Toggle
                                value={notifications.notify_mentions}
                                onValueChange={(v) => updateNotificationPref('notify_mentions', v)}
                            />
                        }
                    />
                    <ListItem
                        title="Replies"
                        subtitle="When someone replies to you"
                        icon="chatbubble-outline"
                        iconColor={HIG.systemColors.systemGreen}
                        rightElement={
                            <Toggle
                                value={notifications.notify_replies}
                                onValueChange={(v) => updateNotificationPref('notify_replies', v)}
                            />
                        }
                    />
                </ListGroup>
                <ListFooter title="Choose which notifications you want to receive" />

                {/* Privacy Section */}
                <ListHeader title="Privacy" />
                <ListGroup>
                    <ListItem
                        title="Public Profile"
                        subtitle="Allow non-followers to see your profile"
                        icon="eye-outline"
                        iconColor={HIG.systemColors.systemTeal}
                        rightElement={
                            <Toggle
                                value={privacy.profilePublic}
                                onValueChange={(v) => setPrivacy({ ...privacy, profilePublic: v })}
                            />
                        }
                    />
                    <ListItem
                        title="Show Listening Activity"
                        subtitle="Show real-time listening on your profile"
                        icon="headset-outline"
                        iconColor={HIG.systemColors.systemIndigo}
                        rightElement={
                            <Toggle
                                value={privacy.showListeningActivity}
                                onValueChange={(v) => setPrivacy({ ...privacy, showListeningActivity: v })}
                            />
                        }
                    />
                    <ListItem
                        title="Show Collection"
                        subtitle="Show your music collection to others"
                        icon="albums-outline"
                        iconColor={HIG.systemColors.systemBlue}
                        rightElement={
                            <Toggle
                                value={privacy.showCollection}
                                onValueChange={(v) => setPrivacy({ ...privacy, showCollection: v })}
                            />
                        }
                    />
                </ListGroup>
                <ListFooter title="Control what others can see on your profile" />

                {/* About Section */}
                <ListHeader title="About" />
                <ListGroup>
                    <ListItem
                        title="About music share"
                        subtitle="Version 1.0.0"
                        icon="information-circle-outline"
                        iconColor={HIG.systemColors.systemGray}
                        onPress={() => Toast.show({ type: 'info', text1: 'Music Share', text2: 'A social music sharing platform.' })}
                        chevron
                    />
                    <ListItem
                        title="Changelog"
                        icon="sparkles-outline"
                        iconColor={HIG.systemColors.systemYellow}
                        onPress={() => navigation.navigate('Changelog')}
                        chevron
                    />
                    <ListItem
                        title="Weekly Recap"
                        icon="stats-chart-outline"
                        iconColor={HIG.systemColors.systemGreen}
                        onPress={() => navigation.navigate('WeeklyRecap')}
                        chevron
                    />
                    <ListItem
                        title="Terms of Service"
                        icon="document-text-outline"
                        iconColor={HIG.systemColors.systemGray}
                        onPress={() => navigation.navigate('Terms')}
                        chevron
                    />
                    <ListItem
                        title="Privacy Policy"
                        icon="shield-checkmark-outline"
                        iconColor={HIG.systemColors.systemGreen}
                        onPress={() => navigation.navigate('PrivacyPolicy')}
                        chevron
                    />
                    <ListItem
                        title="Help & Support"
                        icon="help-circle-outline"
                        iconColor={HIG.systemColors.systemBlue}
                        onPress={() => navigation.navigate('HelpSupport')}
                        chevron
                    />
                </ListGroup>

                {/* Account Actions - Destructive */}
                <ListHeader title="Account Actions" />
                <ListGroup>
                    <ListItem
                        title="Logout"
                        icon="log-out-outline"
                        iconColor={HIG.systemColors.systemRed}
                        destructive
                        onPress={handleLogout}
                    />
                    <ListItem
                        title="Delete Account"
                        icon="trash-outline"
                        iconColor={HIG.systemColors.systemRed}
                        destructive
                        onPress={handleDeleteAccount}
                    />
                </ListGroup>
                <ListFooter title="Logging out will require you to sign in again. Deleting your account is permanent." />

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>music share • Version 1.0.0</Text>
                    <Text style={styles.footerSubtext}>Made with ❤️ for music lovers</Text>
                </View>
            </ScrollView>

            {/* Web-compatible confirmation dialog */}
            <Modal
                visible={!!confirmDialog}
                transparent
                animationType="fade"
                onRequestClose={() => setConfirmDialog(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{confirmDialog?.title}</Text>
                        <Text style={styles.modalMessage}>{confirmDialog?.message}</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setConfirmDialog(null)}
                                style={styles.modalButtonCancel}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    const action = confirmDialog?.onConfirm;
                                    setConfirmDialog(null);
                                    action?.();
                                }}
                                style={styles.modalButtonConfirm}
                            >
                                <Text style={styles.modalButtonText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MusicServiceRow Component
// ═══════════════════════════════════════════════════════════════════════════

function MusicServiceRow({
    icon,
    label,
    connected,
    onConnect,
    onDisconnect,
    color = '#9ca3af',
    loading = false,
    iconFamily = 'Ionicons',
}: {
    icon: string;
    label: string;
    connected: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    color: string;
    loading: boolean;
    iconFamily?: 'Ionicons' | 'FontAwesome5';
}) {
    return (
        <View style={styles.musicServiceRow}>
            <View
                style={[
                    styles.serviceIconContainer,
                    {
                        backgroundColor: connected ? `${color}1F` : 'rgba(255,255,255,0.06)',
                        borderColor: connected ? `${color}55` : 'rgba(255,255,255,0.08)',
                    },
                ]}
            >
                {iconFamily === 'FontAwesome5' ? (
                    <FontAwesome5 name={icon} size={16} color={connected ? color : '#9ca3af'} />
                ) : (
                    <Ionicons name={icon as any} size={20} color={connected ? color : '#9ca3af'} />
                )}
            </View>

            <View style={styles.serviceInfo}>
                <Text style={styles.serviceLabel}>{label}</Text>
                <Text style={[styles.serviceStatus, connected ? styles.connectedText : styles.disconnectedText]}>
                    {connected ? 'Connected' : 'Not connected'}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
                <Button
                    title={connected ? 'Disconnect' : 'Connect'}
                    onPress={connected ? onDisconnect : onConnect}
                    variant={connected ? 'destructive' : 'primary'}
                    size="small"
                />
            )}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        backgroundColor: '#000',
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backButton: {
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginLeft: -12,
    },
    headerTitle: {
        fontSize: 30,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.4,
        flex: 1,
    },
    scrollContent: {
        paddingTop: 16,
        paddingBottom: 60,
    },
    connectedText: {
        color: '#86efac',
        fontSize: 14,
    },
    disconnectedText: {
        color: '#6b7280',
        fontSize: 14,
    },
    musicServiceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: HIG.list.rowPadding,
        minHeight: HIG.list.rowHeight,
    },
    serviceIconContainer: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    serviceInfo: {
        marginLeft: 12,
        flex: 1,
    },
    serviceLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    serviceStatus: {
        fontSize: 12,
        marginTop: 2,
    },
    footer: {
        alignItems: 'center',
        marginTop: 32,
        paddingHorizontal: 32,
        paddingBottom: 20,
    },
    footerText: {
        color: '#4b5563',
        fontSize: 13,
        textAlign: 'center',
    },
    footerSubtext: {
        color: '#374151',
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    modalContent: {
        backgroundColor: HIG.systemColors.secondarySystemBackground,
        borderRadius: HIG.radii['2xl'],
        padding: 24,
        width: '100%',
        maxWidth: 340,
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: HIG.typeScale.title3.size,
        fontWeight: '600',
        marginBottom: 8,
    },
    modalMessage: {
        color: HIG.systemColors.secondaryLabel,
        fontSize: HIG.typeScale.body.size,
        lineHeight: 20,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButtonCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: HIG.radii.lg,
        backgroundColor: HIG.systemColors.systemGray5,
        alignItems: 'center',
    },
    modalButtonConfirm: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: HIG.radii.lg,
        backgroundColor: HIG.systemColors.systemRed,
        alignItems: 'center',
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 15,
    },
});

