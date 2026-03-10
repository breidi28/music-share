import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FlatList, ScrollView, RefreshControl, Alert, View, Text, TouchableOpacity, ActivityIndicator, Image, Animated, Linking, TextInput, Modal, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as ImagePicker from 'expo-image-picker';
import { User, Post, PostType } from '../types';
import { usersApi, postsApi, spotifyApi, youtubeApi, appleMusicApi } from '../api/endpoints';
import { API_BASE_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import PostCard from '../components/PostCard';
import CommentsModal from '../components/CommentsModal';

// Helper to get full avatar URL
const getAvatarUrl = (url: string | null | undefined): string => {
    if (!url) return 'https://via.placeholder.com/120';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // Convert relative URL to absolute URL
    return API_BASE_URL.replace('/api', '') + url;
};

const FILTER_TABS: { key: PostType | 'all'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'all', label: 'All', icon: 'grid-outline' },
    { key: 'now_playing', label: 'Playing', icon: 'musical-notes' },
    { key: 'loved', label: 'Loved', icon: 'heart-outline' },
    { key: 'history', label: 'History', icon: 'time-outline' },
];

WebBrowser.maybeCompleteAuthSession();

// Music service OAuth configs
const SPOTIFY_CLIENT_ID = 'c2276ecc29b14734a7dc8c857a72bd80';
const YOUTUBE_CLIENT_ID = '810258213827-0evata0ebfoj122j2hou1etjvcf5v84j.apps.googleusercontent.com';
const spotifyDiscovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};
const youtubeDiscovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

// Compute once at module level so it's stable and loggable
const REDIRECT_URI = AuthSession.makeRedirectUri({
    scheme: 'musicshare',
    projectNameForProxy: '@breidi282/music-share'
});
console.log('[Music Services OAuth] Redirect URI:', REDIRECT_URI);

export default function ProfileScreen({ navigation, route }: any) {
    const { userId } = route.params ?? {};
    const { user: me, logout } = useAuthStore();
    const targetId = userId ?? me?.id;
    const isMe = targetId === me?.id;

    const [profile, setProfile] = useState<User | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [filter, setFilter] = useState<PostType | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [liveTrack, setLiveTrack] = useState<any>(null);
    const [sharingLive, setSharingLive] = useState(false);
    
    // Music service selection
    const [selectedMusicService, setSelectedMusicService] = useState<'spotify' | 'youtube' | 'apple'>('spotify');
    const [spotifyTab, setSpotifyTab] = useState<'recent' | 'artists' | 'playlists'>('recent');
    
    // Spotify data
    const [spotifyRecent, setSpotifyRecent] = useState<any[]>([]);
    const [spotifyArtists, setSpotifyArtists] = useState<any[]>([]);
    const [spotifyPlaylists, setSpotifyPlaylists] = useState<any[]>([]);
    const [spotifyLoading, setSpotifyLoading] = useState(false);
    
    // YouTube Music data
    const [youtubePlaylists, setYoutubePlaylists] = useState<any[]>([]);
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    
    // Apple Music data
    const [applePlaylists, setApplePlaylists] = useState<any[]>([]);
    const [appleLoading, setAppleLoading] = useState(false);
    
    const [tasteMatch, setTasteMatch] = useState<number | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({ display_name: '', bio: '', favorite_genres: '', avatar_url: '' });
    const insets = useSafeAreaInsets();

    // Auth Sessions for Music Services
    const [spotifyRequest, spotifyResponse, spotifyPromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: SPOTIFY_CLIENT_ID,
            scopes: [
                'user-read-currently-playing',
                'user-read-playback-state',
                'user-read-recently-played',
                'user-top-read',
                'playlist-read-private',
                'playlist-read-collaborative',
            ],
            usePKCE: false,
            redirectUri: REDIRECT_URI,
        },
        spotifyDiscovery
    );

    const [youtubeRequest, youtubeResponse, youtubePromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: YOUTUBE_CLIENT_ID || 'placeholder',
            scopes: [
                'https://www.googleapis.com/auth/youtube.readonly',
            ],
            usePKCE: false,
            redirectUri: REDIRECT_URI,
        },
        youtubeDiscovery
    );

    // Handle Spotify OAuth response
    useEffect(() => {
        if (spotifyResponse?.type === 'success') {
            const { code } = spotifyResponse.params;
            spotifyApi.callback(code, REDIRECT_URI)
                .then(res => {
                    setProfile(res.data.user);
                    Alert.alert('Success', 'Spotify linked successfully!');
                })
                .catch(e => Alert.alert('Error', 'Failed to link Spotify'));
        }
    }, [spotifyResponse]);

    // Handle YouTube OAuth response
    useEffect(() => {
        if (youtubeResponse?.type === 'success') {
            const { code } = youtubeResponse.params;
            youtubeApi.callback(code, REDIRECT_URI)
                .then(res => {
                    setProfile(res.data.user);
                    Alert.alert('Success', 'YouTube Music linked successfully!');
                })
                .catch(e => Alert.alert('Error', 'Failed to link YouTube Music'));
        }
    }, [youtubeResponse]);

    // Fetch Spotify stats when profile loads with Spotify linked
    useEffect(() => {
        if (!profile?.has_spotify_linked) return;
        setSpotifyLoading(true);
        Promise.all([
            spotifyApi.getRecent(profile.id),
            spotifyApi.getTopArtists(profile.id),
            spotifyApi.getPlaylists(profile.id),
        ])
            .then(([recent, artists, playlists]) => {
                console.log('[Spotify] Recent tracks:', recent.data?.length || 0, recent.data);
                console.log('[Spotify] Top artists:', artists.data?.length || 0, artists.data);
                console.log('[Spotify] Playlists:', playlists.data?.length || 0, playlists.data);
                
                setSpotifyRecent(Array.isArray(recent.data) ? recent.data : []);
                setSpotifyArtists(Array.isArray(artists.data) ? artists.data : []);
                setSpotifyPlaylists(Array.isArray(playlists.data) ? playlists.data : []);
            })
            .catch(err => {
                console.error('[Spotify] Error fetching data:', err);
                console.error('[Spotify] Error details:', err.response?.data);
                if (err.response?.data?.error) {
                    Alert.alert('Spotify Error', err.response.data.error);
                }
                // Set empty arrays on error
                setSpotifyRecent([]);
                setSpotifyArtists([]);
                setSpotifyPlaylists([]);
            })
            .finally(() => setSpotifyLoading(false));
    }, [profile?.id, profile?.has_spotify_linked]);

    // Fetch YouTube Music data when profile loads with YouTube linked
    useEffect(() => {
        if (!profile?.has_youtube_linked) return;
        setYoutubeLoading(true);
        youtubeApi.getPlaylists(profile.id)
            .then(res => {
                console.log('[YouTube] Playlists:', res.data?.length || 0, res.data);
                setYoutubePlaylists(Array.isArray(res.data) ? res.data : []);
            })
            .catch(err => {
                console.error('[YouTube] Error fetching data:', err);
                console.error('[YouTube] Error details:', err.response?.data);
                if (err.response?.data?.error) {
                    Alert.alert('YouTube Error', err.response.data.error);
                }
                setYoutubePlaylists([]);
            })
            .finally(() => setYoutubeLoading(false));
    }, [profile?.id, profile?.has_youtube_linked]);

    // Fetch Apple Music data when profile loads with Apple Music linked
    useEffect(() => {
        if (!profile?.has_apple_music_linked) return;
        setAppleLoading(true);
        appleMusicApi.getPlaylists(profile.id)
            .then(res => {
                console.log('[Apple Music] Playlists:', res.data?.length || 0, res.data);
                setApplePlaylists(Array.isArray(res.data) ? res.data : []);
            })
            .catch(err => {
                console.error('[Apple Music] Error fetching data:', err);
                console.error('[Apple Music] Error details:', err.response?.data);
                if (err.response?.data?.error) {
                    Alert.alert('Apple Music Error', err.response.data.error);
                }
                setApplePlaylists([]);
            })
            .finally(() => setAppleLoading(false));
    }, [profile?.id, profile?.has_apple_music_linked]);

    const handleDisconnectSpotify = () => {
        Alert.alert('Disconnect Spotify', 'Remove Spotify link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await spotifyApi.disconnect();
                        setProfile(res.data.user);
                        setLiveTrack(null);
                        setSpotifyRecent([]); setSpotifyArtists([]); setSpotifyPlaylists([]);
                    } catch { Alert.alert('Error', 'Could not disconnect Spotify'); }
                }
            }
        ]);
    };

    const handleDisconnectYouTube = () => {
        Alert.alert('Disconnect YouTube Music', 'Remove YouTube Music link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await youtubeApi.disconnect();
                        setProfile(res.data.user);
                        setYoutubePlaylists([]);
                    } catch { Alert.alert('Error', 'Could not disconnect YouTube Music'); }
                }
            }
        ]);
    };

    const handleDisconnectAppleMusic = () => {
        Alert.alert('Disconnect Apple Music', 'Remove Apple Music link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await appleMusicApi.disconnect();
                        setProfile(res.data.user);
                        setApplePlaylists([]);
                    } catch { Alert.alert('Error', 'Could not disconnect Apple Music'); }
                }
            }
        ]);
    };

    // Track the previously-seen Spotify song to detect changes
    const prevTrackRef = useRef<string | null>(null);
    // Becomes true once the current track crosses the scrobble threshold
    const scrobbleEligibleRef = useRef<boolean>(false);
    // Snapshot of the track to save when the scrobble fires
    const pendingScrobbleRef = useRef<any>(null);

    // Poll Spotify every 15 seconds for currently playing track
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;

        const fetchLive = async () => {
            if (!profile) return;
            try {
                const res = await spotifyApi.getLive(profile.id);
                const data = res.data;

                if (data?.is_playing) {
                    setLiveTrack(data);

                    const trackKey = `${data.track_title}||${data.artist}`;
                    const isNewTrack = prevTrackRef.current !== trackKey;

                    if (isNewTrack) {
                        // ── New song detected ──────────────────────────────
                        // If the PREVIOUS song was scrobble-eligible, save it now
                        if (isMe && scrobbleEligibleRef.current && pendingScrobbleRef.current) {
                            postsApi.create({
                                ...pendingScrobbleRef.current,
                                post_type: 'history',
                                caption: '',
                            }).catch(() => { });
                        }

                        // Reset eligibility for the new song
                        prevTrackRef.current = trackKey;
                        scrobbleEligibleRef.current = false;
                        pendingScrobbleRef.current = {
                            track_title: data.track_title,
                            artist: data.artist,
                            album: data.album,
                            album_art_url: data.album_art_url,
                            preview_url: data.preview_url,
                        };
                    } else if (isMe && !scrobbleEligibleRef.current && data.duration_ms > 0) {
                        // ── Same song — check scrobble threshold ───────────
                        // Last.fm rule: 50% listened OR 4 minutes (240 000 ms)
                        const FOUR_MINUTES_MS = 240_000;
                        const listenedPercent = data.progress_ms / data.duration_ms;
                        const listenedMs = data.progress_ms;

                        if (listenedPercent >= 0.5 || listenedMs >= FOUR_MINUTES_MS) {
                            scrobbleEligibleRef.current = true;
                            // Update snapshot in case metadata drifted
                            pendingScrobbleRef.current = {
                                track_title: data.track_title,
                                artist: data.artist,
                                album: data.album,
                                album_art_url: data.album_art_url,
                                preview_url: data.preview_url,
                            };
                        }
                    }
                } else {
                    setLiveTrack(null);
                    // Don't reset refs on pause — keeps memory across pauses
                }
            } catch (err: any) {
                console.error('[Spotify Live] Error:', err);
                console.error('[Spotify Live] Details:', err.response?.data);
                setLiveTrack(null);
            }
        };

        if (profile?.has_spotify_linked) {
            fetchLive();
            intervalId = setInterval(fetchLive, 15000);
        }

        return () => clearInterval(intervalId);
    }, [profile?.id, profile?.has_spotify_linked, isMe]);


    const handleShareLive = async () => {
        if (!liveTrack) return;
        setSharingLive(true);
        try {
            await postsApi.create({
                track_title: liveTrack.track_title,
                artist: liveTrack.artist,
                album: liveTrack.album,
                album_art_url: liveTrack.album_art_url,
                preview_url: liveTrack.preview_url,
                post_type: 'now_playing',
                caption: '🎵 Currently listening on Spotify',
            });
            Alert.alert('Shared!', 'Added to your feed as Now Playing.');
            load();
        } catch {
            Alert.alert('Error', 'Could not share track.');
        }
        setSharingLive(false);
    };

    const load = useCallback(async (isRefresh = false) => {
        if (!targetId) return;
        if (isRefresh) setRefreshing(true);
        try {
            const reqs: any[] = [
                usersApi.getUser(targetId),
                usersApi.getUserPosts(targetId, filter === 'all' ? undefined : filter),
            ];
            if (!isMe) reqs.push(usersApi.getTasteMatch(targetId));

            const [profileRes, postsRes, matchRes] = await Promise.all(reqs as any[]);
            setProfile(profileRes.data);
            setPosts(postsRes.data.posts);
            if (matchRes) setTasteMatch(matchRes.data.match);

            if (isMe) {
                setEditData({
                    display_name: profileRes.data.display_name || '',
                    bio: profileRes.data.bio || '',
                    favorite_genres: profileRes.data.favorite_genres || ''
                });
            }
        } catch { }
        setLoading(false);
        setRefreshing(false);
    }, [targetId, filter]);

    useEffect(() => { setLoading(true); load(); }, [filter]);

    const handleFollow = async () => {
        if (!profile) return;
        try {
            const res = await usersApi.follow(profile.id);
            setProfile(res.data.user);
        } catch { }
    };

    const handleLike = async (postId: number) => {
        try {
            const res = await postsApi.likePost(postId);
            setPosts(prev => prev.map(p =>
                p.id === postId ? { ...p, is_liked: res.data.is_liked, likes_count: res.data.likes_count } : p
            ));
        } catch { }
    };

    const pickAvatar = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
            Alert.alert('Permission Required', 'Permission to access camera roll is required!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            // Store base64 data for upload
            const base64Image = `data:image/jpeg;base64,${asset.base64}`;
            setEditData(prev => ({ ...prev, avatar_url: base64Image }));
        }
    };

    const handleSaveProfile = async () => {
        try {
            const res = await usersApi.updateProfile(editData);
            setProfile(res.data);
            setEditMode(false);
        } catch { Alert.alert('Error', 'Failed to update profile'); }
    };

    const handleDelete = async (postId: number) => {
        Alert.alert('Delete Post', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await postsApi.deletePost(postId);
                        setPosts(prev => prev.filter(p => p.id !== postId));
                    } catch { }
                }
            }
        ]);
    };

    const renderTopNav = () => (
        <BlurView
            intensity={80}
            tint="dark"
            style={{ paddingTop: insets.top, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
                {!isMe ? (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                ) : <View style={{ width: 36 }} />}

                <Text style={{ color: '#9ca3af', fontWeight: '500', fontSize: 13 }}>
                    {profile?.username ? `@${profile.username}` : ''}
                </Text>

                {isMe ? (
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('Settings')} 
                        style={{ padding: 6 }}
                    >
                        <Ionicons name="settings-outline" size={24} color="white" />
                    </TouchableOpacity>
                ) : <View style={{ width: 36 }} />}
            </View>
        </BlurView>
    );

    const renderHeader = () => (
        <View style={{ paddingTop: insets.top + 52, zIndex: 10, paddingBottom: 10, overflow: 'visible' }}>
            {/* ── Background & Avatar Hero ────────────────────────── */}
            <View style={{ position: 'relative', zIndex: 10 }}>
                {/* ── Gradient hero band ─────────────────────────────────── */}
                <LinearGradient
                    colors={['rgba(250,36,60,0.30)', 'transparent']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={{ height: 130 }}
                />

                {/* Avatar — centred, overlapping gradient */}
                <View style={{ position: 'absolute', bottom: -45, left: 0, right: 0, alignItems: 'center', zIndex: 11, elevation: 11 }}>
                    {profile?.avatar_url ? (
                        <View style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                            <Image
                                source={{ uri: getAvatarUrl(profile.avatar_url) }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />
                        </View>
                    ) : (
                        <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.12)' }}>
                            <Text style={{ color: 'white', fontSize: 34, fontWeight: 'bold' }}>{profile?.display_name?.[0]?.toUpperCase()}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* ── Identity ───────────────────────────────────────────── */}
            <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 8, zIndex: 1, marginTop: 45 }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 24, letterSpacing: -0.5 }}>{profile?.display_name}</Text>
                <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>@{profile?.username}</Text>

                {profile?.bio ? (
                    <Text style={{ color: '#9ca3af', textAlign: 'center', fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 280 }}>{profile.bio}</Text>
                ) : null}

                {/* Genre pills */}
                {profile?.favorite_genres ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                        {profile.favorite_genres.split(',').filter(Boolean).map(g => (
                            <View key={g} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(250,36,60,0.3)', backgroundColor: 'rgba(250,36,60,0.1)' }}>
                                <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.trim()}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {isMe && (
                    <TouchableOpacity
                        onPress={() => {
                            setEditData({
                                display_name: profile?.display_name || '',
                                bio: profile?.bio || '',
                                favorite_genres: profile?.favorite_genres || '',
                                avatar_url: profile?.avatar_url || ''
                            });
                            setEditMode(true);
                        }}
                        style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Edit Profile</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Listening Streak Badge ─────────────────────────────── */}
            {profile && profile.current_streak > 0 && (
                <View style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: 'rgba(250,36,60,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(250,36,60,0.2)', padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ fontSize: 28 }}>🔥</Text>
                            <View>
                                <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 18 }}>{profile.current_streak} day streak!</Text>
                                <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 1 }}>Longest: {profile.longest_streak} days</Text>
                            </View>
                        </View>
                        <View style={{ backgroundColor: 'rgba(250,36,60,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                            <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Keep it up!</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* ── Stats card ─────────────────────────────────────────── */}
            <View style={{ marginHorizontal: 20, marginTop: 16, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                {[
                    { label: 'Posts', val: profile?.posts_count ?? 0 }, 
                    { label: 'Followers', val: profile?.followers_count ?? 0 }, 
                    { label: 'Following', val: profile?.following_count ?? 0 },
                    { label: 'Collection', val: profile?.collection_count ?? 0 }
                ].map((s, i, arr) => (
                    <View key={s.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: 'rgba(255,255,255,0.07)' }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 20 }}>{s.val}</Text>
                        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '500' }}>{s.label}</Text>
                    </View>
                ))}
            </View>

            {/* ── Action buttons ─────────────────────────────────────── */}
            <View style={{ marginHorizontal: 20, marginTop: 14 }}>
                {isMe ? (
                    <View>
                        {/* Music Service Selector */}
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                            <TouchableOpacity 
                                onPress={() => profile?.has_spotify_linked ? setSelectedMusicService('spotify') : spotifyPromptAsync()} 
                                disabled={!spotifyRequest}
                                style={{ 
                                    flex: 1, 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    gap: 6, 
                                    backgroundColor: profile?.has_spotify_linked ? (selectedMusicService === 'spotify' ? 'rgba(29,185,84,0.15)' : 'rgba(29,185,84,0.08)') : 'rgba(255,255,255,0.05)', 
                                    borderRadius: 100, 
                                    paddingVertical: 10,
                                    borderWidth: 1, 
                                    borderColor: profile?.has_spotify_linked ? (selectedMusicService === 'spotify' ? 'rgba(29,185,84,0.4)' : 'rgba(29,185,84,0.2)') : 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <FontAwesome5 name="spotify" size={12} color={profile?.has_spotify_linked ? "#1DB954" : "#888"} />
                                <Text style={{ color: profile?.has_spotify_linked ? '#1DB954' : '#888', fontWeight: '600', fontSize: 12 }}>
                                    {profile?.has_spotify_linked ? 'Spotify' : 'Connect'}
                                </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                onPress={() => {
                                    if (profile?.has_youtube_linked) {
                                        setSelectedMusicService('youtube');
                                    } else {
                                        if (YOUTUBE_CLIENT_ID) {
                                            youtubePromptAsync();
                                        } else {
                                            Alert.alert('Not Configured', 'YouTube Music integration requires setup in the backend');
                                        }
                                    }
                                }}
                                disabled={false}
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6, 
                                    backgroundColor: profile?.has_youtube_linked ? (selectedMusicService === 'youtube' ? 'rgba(255,0,0,0.15)' : 'rgba(255,0,0,0.08)') : 'rgba(255,255,255,0.05)', 
                                    borderRadius: 100, 
                                    paddingVertical: 10,
                                    borderWidth: 1, 
                                    borderColor: profile?.has_youtube_linked ? (selectedMusicService === 'youtube' ? 'rgba(255,0,0,0.4)' : 'rgba(255,0,0,0.2)') : 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <FontAwesome5 name="youtube" size={12} color={profile?.has_youtube_linked ? "#FF0000" : "#888"} />
                                <Text style={{ color: profile?.has_youtube_linked ? '#FF0000' : '#888', fontWeight: '600', fontSize: 12 }}>
                                    {profile?.has_youtube_linked ? 'YouTube' : 'Connect'}
                                </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                onPress={() => {
                                    if (profile?.has_apple_music_linked) {
                                        setSelectedMusicService('apple');
                                    } else {
                                        Alert.alert('Apple Music', 'Apple Music integration requires MusicKit setup. This feature is coming soon!');
                                    }
                                }}
                                style={{ 
                                    flex: 1, 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    gap: 6, 
                                    backgroundColor: profile?.has_apple_music_linked ? (selectedMusicService === 'apple' ? 'rgba(252,58,110,0.15)' : 'rgba(252,58,110,0.08)') : 'rgba(255,255,255,0.05)', 
                                    borderRadius: 100, 
                                    paddingVertical: 10,
                                    borderWidth: 1, 
                                    borderColor: profile?.has_apple_music_linked ? (selectedMusicService === 'apple' ? 'rgba(252,58,110,0.4)' : 'rgba(252,58,110,0.2)') : 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <FontAwesome5 name="apple" size={12} color={profile?.has_apple_music_linked ? "#FC3A6E" : "#888"} />
                                <Text style={{ color: profile?.has_apple_music_linked ? '#FC3A6E' : '#888', fontWeight: '600', fontSize: 12 }}>
                                    {profile?.has_apple_music_linked ? 'Apple' : 'Connect'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        
                        {/* Disconnect button for selected service */}
                        {selectedMusicService === 'spotify' && profile?.has_spotify_linked && (
                            <TouchableOpacity onPress={handleDisconnectSpotify} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                                <Ionicons name="unlink-outline" size={14} color="#f87171" />
                                <Text style={{ color: '#f87171', fontWeight: '600', fontSize: 12 }}>Disconnect Spotify</Text>
                            </TouchableOpacity>
                        )}
                        {selectedMusicService === 'youtube' && profile?.has_youtube_linked && (
                            <TouchableOpacity onPress={handleDisconnectYouTube} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                                <Ionicons name="unlink-outline" size={14} color="#f87171" />
                                <Text style={{ color: '#f87171', fontWeight: '600', fontSize: 12 }}>Disconnect YouTube Music</Text>
                            </TouchableOpacity>
                        )}
                        {selectedMusicService === 'apple' && profile?.has_apple_music_linked && (
                            <TouchableOpacity onPress={handleDisconnectAppleMusic} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' }}>
                                <Ionicons name="unlink-outline" size={14} color="#f87171" />
                                <Text style={{ color: '#f87171', fontWeight: '600', fontSize: 12 }}>Disconnect Apple Music</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                            onPress={handleFollow}
                            style={{ flex: 1, borderRadius: 100, paddingVertical: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: profile?.is_following ? 'rgba(255,255,255,0.08)' : Colors.primary, borderWidth: 1, borderColor: profile?.is_following ? 'rgba(255,255,255,0.12)' : Colors.primary }}
                        >
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{profile?.is_following ? 'Following' : 'Follow'}</Text>
                        </TouchableOpacity>
                        {tasteMatch !== null && (
                            <View style={{ backgroundColor: 'rgba(168,85,247,0.1)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)', borderRadius: 100, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#c084fc', fontWeight: '700', fontSize: 16 }}>{tasteMatch}%</Text>
                                <Text style={{ color: 'rgba(192,132,252,0.7)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Match</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* ── Live Now Playing ───────────────────────────────────── */}
            {liveTrack && (
                <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: 'rgba(29,185,84,0.07)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(29,185,84,0.2)', padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <FontAwesome5 name="spotify" size={11} color="#1DB954" />
                        <Text style={{ color: '#1DB954', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>Live on Spotify</Text>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#1DB954' }} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        {liveTrack.album_art_url ? (
                            <Image source={{ uri: liveTrack.album_art_url }} style={{ width: 56, height: 56, borderRadius: 10 }} />
                        ) : (
                            <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center' }}>
                                <FontAwesome5 name="music" size={20} color="black" />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{liveTrack.track_title}</Text>
                            <Text style={{ color: Colors.primary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{liveTrack.artist}</Text>
                            {liveTrack.duration_ms > 0 && (
                                <View style={{ marginTop: 8, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                    <View style={{ height: 3, backgroundColor: '#1DB954', width: `${Math.round((liveTrack.progress_ms / liveTrack.duration_ms) * 100)}%` }} />
                                </View>
                            )}
                        </View>
                    </View>
                    {isMe && (
                        <TouchableOpacity
                            onPress={handleShareLive}
                            disabled={sharingLive}
                            style={{ marginTop: 12, backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                        >
                            {sharingLive
                                ? <ActivityIndicator color="white" size="small" />
                                : <><Ionicons name="share-social" size={16} color="white" /><Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Share to Feed</Text></>}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* ── Music Service Stats ────────────────────────────────── */}
            {(profile?.has_spotify_linked || profile?.has_youtube_linked || profile?.has_apple_music_linked) && (
                <View style={{ marginHorizontal: 20, marginTop: 20 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                        {selectedMusicService === 'spotify' && 'Spotify Stats'}
                        {selectedMusicService === 'youtube' && 'YouTube Music'}
                        {selectedMusicService === 'apple' && 'Apple Music'}
                    </Text>

                    {/* Spotify tabs */}
                    {selectedMusicService === 'spotify' && profile?.has_spotify_linked && (
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                            {(['recent', 'artists', 'playlists'] as const).map(tab => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setSpotifyTab(tab)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1, backgroundColor: spotifyTab === tab ? Colors.primary : 'rgba(255,255,255,0.05)', borderColor: spotifyTab === tab ? Colors.primary : 'rgba(255,255,255,0.1)' }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: spotifyTab === tab ? 'white' : '#9ca3af' }}>
                                        {tab === 'recent' ? 'Recent' : tab === 'artists' ? 'Top Artists' : 'Playlists'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Spotify Data */}
                    {selectedMusicService === 'spotify' && profile?.has_spotify_linked && (
                        spotifyLoading ? (
                            <ActivityIndicator color="#1DB954" />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                                {spotifyTab === 'recent' && spotifyRecent.map((t, i) => (
                                    <TouchableOpacity key={i} onPress={() => t.spotify_url && Linking.openURL(t.spotify_url)} style={{ width: 110 }}>
                                        {t.album_art_url
                                            ? <Image source={{ uri: t.album_art_url }} style={{ width: 110, height: 110, borderRadius: 14 }} />
                                            : <View style={{ width: 110, height: 110, borderRadius: 14, backgroundColor: Colors.primary }} />}
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', marginTop: 7 }} numberOfLines={1}>{t.track_title}</Text>
                                        <Text style={{ color: Colors.primary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </TouchableOpacity>
                                ))}
                                {spotifyTab === 'artists' && spotifyArtists.map((a, i) => (
                                    <TouchableOpacity key={i} onPress={() => a.spotify_url && Linking.openURL(a.spotify_url)} style={{ width: 90, alignItems: 'center' }}>
                                        {a.image_url
                                            ? <Image source={{ uri: a.image_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                                            : <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#374151' }} />}
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', marginTop: 7, textAlign: 'center' }} numberOfLines={1}>{a.name}</Text>
                                        {a.genres?.[0] && <Text style={{ color: '#6b7280', fontSize: 10, textAlign: 'center', marginTop: 1 }} numberOfLines={1}>{a.genres[0]}</Text>}
                                    </TouchableOpacity>
                                ))}
                                {spotifyTab === 'playlists' && spotifyPlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.spotify_url && Linking.openURL(p.spotify_url)} style={{ width: 110 }}>
                                        {p.image_url
                                            ? <Image source={{ uri: p.image_url }} style={{ width: 110, height: 110, borderRadius: 14 }} />
                                            : <View style={{ width: 110, height: 110, borderRadius: 14, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }}>
                                                <FontAwesome5 name="list-ul" size={22} color="#9ca3af" /></View>}
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', marginTop: 7 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {((spotifyTab === 'recent' && spotifyRecent.length === 0) ||
                                    (spotifyTab === 'artists' && spotifyArtists.length === 0) ||
                                    (spotifyTab === 'playlists' && spotifyPlaylists.length === 0)) && (
                                    <Text style={{ color: '#4b5563', fontSize: 13, paddingVertical: 12 }}>
                                        {spotifyTab === 'recent' ? 'No recent tracks' : spotifyTab === 'artists' ? 'No top artists yet' : 'No playlists found'}
                                    </Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* YouTube Music Data */}
                    {selectedMusicService === 'youtube' && profile?.has_youtube_linked && (
                        youtubeLoading ? (
                            <ActivityIndicator color="#FF0000" />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                                {youtubePlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.youtube_url && Linking.openURL(p.youtube_url)} style={{ width: 110 }}>
                                        {p.image_url
                                            ? <Image source={{ uri: p.image_url }} style={{ width: 110, height: 110, borderRadius: 14 }} />
                                            : <View style={{ width: 110, height: 110, borderRadius: 14, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }}>
                                                <FontAwesome5 name="youtube" size={22} color="#FF0000" /></View>}
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', marginTop: 7 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{p.track_count} videos</Text>
                                    </TouchableOpacity>
                                ))}
                                {youtubePlaylists.length === 0 && (
                                    <Text style={{ color: '#4b5563', fontSize: 13, paddingVertical: 12 }}>No playlists found</Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* Apple Music Data */}
                    {selectedMusicService === 'apple' && profile?.has_apple_music_linked && (
                        appleLoading ? (
                            <ActivityIndicator color="#FC3A6E" />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                                {applePlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.apple_url && Linking.openURL(p.apple_url)} style={{ width: 110 }}>
                                        {p.image_url
                                            ? <Image source={{ uri: p.image_url }} style={{ width: 110, height: 110, borderRadius: 14 }} />
                                            : <View style={{ width: 110, height: 110, borderRadius: 14, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' }}>
                                                <FontAwesome5 name="apple" size={22} color="#FC3A6E" /></View>}
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600', marginTop: 7 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {applePlaylists.length === 0 && (
                                    <Text style={{ color: '#4b5563', fontSize: 13, paddingVertical: 12 }}>No playlists found</Text>
                                )}
                            </ScrollView>
                        )
                    )}
                </View>
            )}

            {/* ── Filter tabs ────────────────────────────────────────── */}
            <View style={{ marginTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                    {FILTER_TABS.map(tab => {
                        const active = filter === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setFilter(tab.key)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: active ? Colors.primary : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: active ? Colors.primary : 'rgba(255,255,255,0.08)' }}
                            >
                                <Ionicons name={tab.icon} size={13} color={active ? 'white' : '#6b7280'} />
                                <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? 'white' : '#6b7280' }}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-black">
            {renderTopNav()}
            <FlatList
                data={posts}
                keyExtractor={p => String(p.id)}
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        onLike={handleLike}
                        onComment={post => { setSelectedPost(post); setCommentsVisible(true); }}
                        onAuthorPress={uid => navigation.navigate('Profile', { userId: uid })}
                        onDelete={handleDelete}
                        isOwn={item.user_id === me?.id}
                    />
                )}
                ListHeaderComponent={
                    <View style={{ zIndex: 10 }}>
                        {renderHeader()}
                    </View>
                }
                ListHeaderComponentStyle={{ zIndex: 10 }}
                ListEmptyComponent={
                    !loading ? (
                        <View className="justify-center items-center p-16 gap-4 opacity-50 mt-10">
                            <Ionicons name="musical-notes-outline" size={48} color={Colors.textSecondary} />
                            <Text className="text-gray-500 text-lg">No posts yet.</Text>
                        </View>
                    ) : (
                        <View className="justify-center items-center p-16">
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    )
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
                }
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            />

            <CommentsModal post={selectedPost} visible={commentsVisible} onClose={() => setCommentsVisible(false)} />

            <Modal visible={editMode} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: '#0A0A0F', paddingTop: Platform.OS === 'ios' ? 40 : 20, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                        <TouchableOpacity onPress={() => setEditMode(false)} style={{ padding: 4 }}>
                            <Text style={{ color: '#6b7280', fontSize: 16 }}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Edit Profile</Text>
                        <TouchableOpacity onPress={handleSaveProfile} style={{ padding: 4 }}>
                            <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 16 }}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ alignItems: 'center', marginBottom: 28 }}>
                        <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
                            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <Image
                                    source={{ uri: editData.avatar_url || getAvatarUrl(profile?.avatar_url) }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                            </View>
                            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#0A0A0F' }}>
                                <Ionicons name="camera" size={18} color="white" />
                            </View>
                        </TouchableOpacity>
                        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 10 }}>Tap to change avatar</Text>
                    </View>

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Display Name</Text>
                    <TextInput
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 18, fontWeight: '600', fontSize: 16 }}
                        value={editData.display_name}
                        onChangeText={t => setEditData(prev => ({ ...prev, display_name: t }))}
                        placeholder="Your display name"
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Bio</Text>
                    <TextInput
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 18, textAlignVertical: 'top', minHeight: 80 }}
                        value={editData.bio}
                        onChangeText={t => setEditData(prev => ({ ...prev, bio: t }))}
                        multiline
                        numberOfLines={3}
                        placeholder="Tell the world about yourself..."
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Favorite Genres</Text>
                    <TextInput
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 18 }}
                        value={editData.favorite_genres}
                        onChangeText={t => setEditData(prev => ({ ...prev, favorite_genres: t }))}
                        placeholder="e.g. Rock, Indie, Synthpop"
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />
                </View>
            </Modal>
        </View>
    );
}
