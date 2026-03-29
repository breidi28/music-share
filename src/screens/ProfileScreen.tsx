import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FlatList, ScrollView, RefreshControl, Alert, View, Text, TouchableOpacity, ActivityIndicator, Image, Animated, Linking, TextInput, Modal, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { ResponseType } from 'expo-auth-session';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { User, Post, PostType, ReactionType } from '../types';
import { usersApi, postsApi, spotifyApi, youtubeApi, appleMusicApi, tidalApi, qobuzApi, deezerApi, listenLaterApi, collectionApi } from '../api/endpoints';
import { API_BASE_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Colors, getContrastColor } from '../theme';
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

const PROFILE_ACCENTS = ['#FA243C', '#10B981', '#3B82F6', '#F59E0B', '#A855F7', '#14B8A6'];

import KawarpBackground from '../components/KawarpBackground';

WebBrowser.maybeCompleteAuthSession();

// Music service OAuth configs
const SPOTIFY_CLIENT_ID = 'c2276ecc29b14734a7dc8c857a72bd80';
// Web client ID for Google OAuth - this works with expo-auth-session Google provider
const GOOGLE_WEB_CLIENT_ID = '810258213827-0evata0ebfoj122j2hou1etjvcf5v84j.apps.googleusercontent.com';

const spotifyDiscovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// For Spotify, use the app scheme
const SPOTIFY_REDIRECT_URI = AuthSession.makeRedirectUri({
    scheme: 'musicshare',
});

console.log('[Music Services OAuth] Spotify Redirect URI:', SPOTIFY_REDIRECT_URI);

export default function ProfileScreen({ navigation, route }: any) {
    const { userId } = route.params ?? {};
    const { openEdit } = route.params ?? {};
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
    const [selectedMusicService, setSelectedMusicService] = useState<'spotify' | 'youtube' | 'apple' | 'tidal' | 'qobuz' | 'deezer'>('spotify');
    const [spotifyTab, setSpotifyTab] = useState<'recent' | 'artists' | 'playlists'>('recent');
    const [youtubeTab, setYoutubeTab] = useState<'history' | 'liked' | 'playlists'>('history');
    const [tidalTab, setTidalTab] = useState<'playlists' | 'favorites'>('playlists');
    const [qobuzTab, setQobuzTab] = useState<'playlists' | 'favorites'>('playlists');
    const [deezerTab, setDeezerTab] = useState<'playlists' | 'favorites'>('playlists');
    
    // Spotify data
    const [spotifyRecent, setSpotifyRecent] = useState<any[]>([]);
    const [spotifyArtists, setSpotifyArtists] = useState<any[]>([]);
    const [spotifyPlaylists, setSpotifyPlaylists] = useState<any[]>([]);
    const [spotifyLoading, setSpotifyLoading] = useState(false);
    
    // YouTube Music data
    const [youtubeHistory, setYoutubeHistory] = useState<any[]>([]);
    const [youtubeLiked, setYoutubeLiked] = useState<any[]>([]);
    const [youtubePlaylists, setYoutubePlaylists] = useState<any[]>([]);
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    
    // Apple Music data
    const [applePlaylists, setApplePlaylists] = useState<any[]>([]);
    const [appleLoading, setAppleLoading] = useState(false);
    
    // Tidal data
    const [tidalPlaylists, setTidalPlaylists] = useState<any[]>([]);
    const [tidalFavorites, setTidalFavorites] = useState<any[]>([]);
    const [tidalLoading, setTidalLoading] = useState(false);
    
    // Qobuz data
    const [qobuzPlaylists, setQobuzPlaylists] = useState<any[]>([]);
    const [qobuzFavorites, setQobuzFavorites] = useState<any[]>([]);
    const [qobuzLoading, setQobuzLoading] = useState(false);
    const [qobuzLoginVisible, setQobuzLoginVisible] = useState(false);
    const [qobuzCredentials, setQobuzCredentials] = useState({ username: '', password: '' });

    // Deezer data
    const [deezerPlaylists, setDeezerPlaylists] = useState<any[]>([]);
    const [deezerFavorites, setDeezerFavorites] = useState<any[]>([]);
    const [deezerLoading, setDeezerLoading] = useState(false);
    const [accentColor, setAccentColor] = useState(Colors.primary);
    
    const [tasteMatch, setTasteMatch] = useState<number | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({ display_name: '', bio: '', favorite_genres: '', avatar_url: '', kawarp_config: '' });
    const insets = useSafeAreaInsets();

    // Google OAuth discovery for YouTube
    const googleDiscovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

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
            redirectUri: SPOTIFY_REDIRECT_URI,
        },
        spotifyDiscovery
    );

    // YouTube OAuth — redirect to backend callback which handles token exchange
    const YOUTUBE_REDIRECT_URI = 'https://music-share-b4r8.onrender.com/api/integrations/youtube/callback';
    const [youtubeRequest, youtubeResponse, youtubePromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: GOOGLE_WEB_CLIENT_ID,
            responseType: ResponseType.Code,
            scopes: ['https://www.googleapis.com/auth/youtube'],
            redirectUri: YOUTUBE_REDIRECT_URI,
            usePKCE: false, // Disable PKCE for compatibility
        },
        googleDiscovery
    );

    // Handle Spotify OAuth response
    useEffect(() => {
        if (spotifyResponse?.type === 'success') {
            const { code } = spotifyResponse.params;
            spotifyApi.callback(code, SPOTIFY_REDIRECT_URI)
                .then(res => {
                    setProfile(res.data.user);
                    Toast.show({ type: 'success', text1: 'Spotify Linked', text2: 'Successfully linked Spotify' });
                })
                .catch(e => Toast.show({ type: 'error', text1: 'Failed to link Spotify' }));
        }
    }, [spotifyResponse]);

    // Handle YouTube OAuth response - implicit grant returns access_token in params
    useEffect(() => {
        if (youtubeResponse?.type === 'success') {
            // Authorization code flow returns code in params
            const code = youtubeResponse.params?.code;
            if (code) {
                // Send code to backend to exchange for tokens
                youtubeApi.callback(code, YOUTUBE_REDIRECT_URI)
                    .then(res => {
                        setProfile(res.data.user);
                        Toast.show({ type: 'success', text1: 'YouTube Music Linked', text2: 'Successfully linked YouTube Music' });
                    })
                    .catch(e => {
                        console.error('[YouTube OAuth] Backend error:', e);
                        Toast.show({ type: 'error', text1: 'Failed to link YouTube Music' });
                    });
            } else {
                console.error('[YouTube OAuth] No authorization code in response params');
                Toast.show({ type: 'error', text1: 'No authorization code received' });
            }
        } else if (youtubeResponse?.type === 'error') {
            console.error('[YouTube OAuth] Error:', youtubeResponse.error, youtubeResponse.params);
            Toast.show({ type: 'error', text1: 'Authentication Error', text2: youtubeResponse.error?.message || 'Failed to authenticate with YouTube' });
        } else if (youtubeResponse?.type === 'dismiss') {
            console.log('[YouTube OAuth] User dismissed');
        }
        if (youtubeResponse) {
            console.log('[YouTube OAuth] Full response:', JSON.stringify(youtubeResponse, null, 2));
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
                
                setSpotifyRecent(Array.isArray(recent.data) ? recent.data : []);
                setSpotifyArtists(Array.isArray(artists.data) ? artists.data : []);
                setSpotifyPlaylists(Array.isArray(playlists.data) ? playlists.data : []);
            })
            .catch(err => {
                console.error('[Spotify] Error fetching data:', err);
                console.error('[Spotify] Error details:', err.response?.data);
                if (err.response?.data?.error) {
                    
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
        Promise.all([
            youtubeApi.getHistory(profile.id),
            youtubeApi.getLiked(profile.id),
            youtubeApi.getPlaylists(profile.id),
        ])
            .then(([history, liked, playlists]) => {
                console.log('[YouTube Music] History:', history.data?.length || 0);
                console.log('[YouTube Music] Liked:', liked.data?.length || 0);
                console.log('[YouTube Music] Playlists:', playlists.data?.length || 0);
                
                setYoutubeHistory(Array.isArray(history.data) ? history.data : []);
                setYoutubeLiked(Array.isArray(liked.data) ? liked.data : []);
                setYoutubePlaylists(Array.isArray(playlists.data) ? playlists.data : []);
            })
            .catch(err => {
                console.error('[YouTube Music] Error fetching data:', err);
                console.error('[YouTube Music] Error details:', err.response?.data);
                if (err.response?.data?.error) {
                    
                }
                setYoutubeHistory([]);
                setYoutubeLiked([]);
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
                    
                }
                setApplePlaylists([]);
            })
            .finally(() => setAppleLoading(false));
    }, [profile?.id, profile?.has_apple_music_linked]);

    // Fetch Tidal data when profile loads with Tidal linked
    useEffect(() => {
        if (!profile?.has_tidal_linked) return;
        setTidalLoading(true);
        Promise.all([
            tidalApi.getPlaylists(profile.id),
            tidalApi.getFavorites(profile.id),
        ])
            .then(([playlists, favorites]) => {
                setTidalPlaylists(Array.isArray(playlists.data) ? playlists.data : []);
                setTidalFavorites(Array.isArray(favorites.data) ? favorites.data : []);
            })
            .catch(() => { setTidalPlaylists([]); setTidalFavorites([]); })
            .finally(() => setTidalLoading(false));
    }, [profile?.id, profile?.has_tidal_linked]);

    // Fetch Qobuz data when profile loads with Qobuz linked
    useEffect(() => {
        if (!profile?.has_qobuz_linked) return;
        setQobuzLoading(true);
        Promise.all([
            qobuzApi.getPlaylists(profile.id),
            qobuzApi.getFavorites(profile.id),
        ])
            .then(([playlists, favorites]) => {
                setQobuzPlaylists(Array.isArray(playlists.data) ? playlists.data : []);
                setQobuzFavorites(Array.isArray(favorites.data) ? favorites.data : []);
            })
            .catch(() => { setQobuzPlaylists([]); setQobuzFavorites([]); })
            .finally(() => setQobuzLoading(false));
    }, [profile?.id, profile?.has_qobuz_linked]);

    // Fetch Deezer data when profile loads with Deezer linked
    useEffect(() => {
        if (!profile?.has_deezer_linked) return;
        setDeezerLoading(true);
        Promise.all([
            deezerApi.getPlaylists(profile.id),
            deezerApi.getFavorites(profile.id),
        ])
            .then(([playlists, favorites]) => {
                setDeezerPlaylists(Array.isArray(playlists.data) ? playlists.data : []);
                setDeezerFavorites(Array.isArray(favorites.data) ? favorites.data : []);
            })
            .catch(() => { setDeezerPlaylists([]); setDeezerFavorites([]); })
            .finally(() => setDeezerLoading(false));
    }, [profile?.id, profile?.has_deezer_linked]);

    // Auto-select the first connected service when profile loads
    useEffect(() => {
        if (!profile) return;
        const order: Array<typeof selectedMusicService> = ['spotify', 'youtube', 'apple', 'tidal', 'qobuz', 'deezer'];
        const flags: Record<typeof order[number], boolean> = {
            spotify: !!profile.has_spotify_linked,
            youtube: !!profile.has_youtube_linked,
            apple:   !!profile.has_apple_music_linked,
            tidal:   !!profile.has_tidal_linked,
            qobuz:   !!profile.has_qobuz_linked,
            deezer:  !!profile.has_deezer_linked,
        };
        const first = order.find(s => flags[s]);
        if (first) setSelectedMusicService(first);
    }, [profile?.id]);

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
                    } catch {}
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
                    } catch {}
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
                    } catch {}
                }
            }
        ]);
    };

    const handleDisconnectTidal = () => {
        Alert.alert('Disconnect Tidal', 'Remove Tidal link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await tidalApi.disconnect();
                        setProfile(res.data.user);
                        setTidalPlaylists([]);
                        setTidalFavorites([]);
                    } catch {}
                }
            }
        ]);
    };

    const handleDisconnectQobuz = () => {
        Alert.alert('Disconnect Qobuz', 'Remove Qobuz link from your account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect', style: 'destructive', onPress: async () => {
                    try {
                        const res = await qobuzApi.disconnect();
                        setProfile(res.data.user);
                        setQobuzPlaylists([]);
                        setQobuzFavorites([]);
                    } catch {}
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
                } else {
                    setLiveTrack(null);
                }
            } catch (err: any) {
                const isTimeout = err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
                if (isTimeout) {
                    // Keep last known live state on transient timeout to avoid UI flicker.
                    return;
                }
                console.error('[Spotify Live] Error:', err?.message || err);
                if (err?.response?.data) {
                    console.error('[Spotify Live] Details:', err.response.data);
                }
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
            Toast.show({ type: 'success', text1: 'Shared!', text2: 'Added to your feed as Now Playing.' });
            load();
        } catch {
            Toast.show({ type: 'error', text1: 'Could not share track' });
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
                    favorite_genres: profileRes.data.favorite_genres || '',
                    avatar_url: profileRes.data.avatar_url || '',
                    kawarp_config: profileRes.data.kawarp_config || ''
                });
            }
        } catch { }
        setLoading(false);
        setRefreshing(false);
    }, [targetId, filter]);

    useEffect(() => { setLoading(true); load(); }, [filter]);

    useEffect(() => {
        if (isMe && openEdit && profile) {
            setEditData({
                display_name: profile.display_name || '',
                bio: profile.bio || '',
                favorite_genres: profile.favorite_genres || '',
                avatar_url: profile.avatar_url || '',
                kawarp_config: profile.kawarp_config || '',
            });
            setEditMode(true);
            navigation.setParams({ openEdit: false });
        }
    }, [isMe, openEdit, profile]);

    useEffect(() => {
        const loadAccent = async () => {
            if (!isMe || !me?.id) return;
            try {
                const key = `profileAccent:${me.id}`;
                const stored = await AsyncStorage.getItem(key);
                if (stored) setAccentColor(stored);
            } catch {}
        };
        loadAccent();
    }, [isMe, me?.id]);

    useEffect(() => {
        const saveAccent = async () => {
            if (!isMe || !me?.id) return;
            try {
                const key = `profileAccent:${me.id}`;
                await AsyncStorage.setItem(key, accentColor);
            } catch {}
        };
        saveAccent();
    }, [accentColor, isMe, me?.id]);

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

    const handleQuickReact = async (postId: number, reaction: ReactionType) => {
        const target = posts.find(p => p.id === postId);
        const hasReaction = target?.my_reactions?.includes(reaction);

        try {
            if (hasReaction) {
                await postsApi.removeReaction(postId, reaction);
            } else {
                await postsApi.addReaction(postId, reaction);
            }

            const res = await postsApi.getReactions(postId);
            setPosts(prev => prev.map(p =>
                p.id === postId
                    ? { ...p, my_reactions: res.data.my_reactions, reaction_counts: res.data.counts }
                    : p
            ));
        } catch { }
    };

    const handleListenLater = async (post: Post) => {
        try {
            await listenLaterApi.add({
                track_title: post.track_title,
                artist: post.artist,
                album: post.album || '',
                album_art_url: post.album_art_url || '',
                source_service: 'spotify',
                source_url: post.spotify_url || '',
            });
            Toast.show({ type: 'success', text1: 'Saved to Listen Later' });
        } catch { }
    };

    const handleSaveToCollection = async (post: Post) => {
        try {
            await collectionApi.addItem({
                media_type: 'digital',
                album_title: post.album || post.track_title,
                artist: post.artist,
                album_art_url: post.album_art_url || '',
                notes: `Saved from profile: ${post.track_title}`,
            });
            Toast.show({ type: 'success', text1: 'Saved to Collection' });
        } catch { }
    };

    const pickAvatar = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (permissionResult.granted === false) {
            Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Permission to access camera roll is required!' });
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
        } catch {}
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
            intensity={90}
            tint="dark"
            style={{ 
                paddingTop: insets.top, 
                position: 'absolute', 
                top: 0, left: 0, right: 0, 
                zIndex: 10,
                borderBottomWidth: StyleSheet.hairlineWidth, 
                borderBottomColor: 'rgba(255,255,255,0.1)' 
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 }}>
                {!isMe ? (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, flexDirection: 'row', alignItems: 'center', marginLeft: -8 }}>
                        <Ionicons name="chevron-back" size={28} color={Colors.primary} />
                        <Text style={{ color: Colors.primary, fontSize: 17, marginLeft: -4 }}>Back</Text>
                    </TouchableOpacity>
                ) : <View style={{ width: 60 }} />}

                <Text style={{ color: 'white', fontWeight: '600', fontSize: 17, letterSpacing: -0.4 }}>
                    {profile?.username || 'Profile'}
                </Text>

                {isMe ? (
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('Settings')} 
                        style={{ padding: 4, width: 60 }}
                    >
                        <Ionicons name="settings-outline" size={24} color={accentColor} style={{ alignSelf: 'flex-end' }} />
                    </TouchableOpacity>
                ) : <View style={{ width: 60 }} />}
            </View>
        </BlurView>
    );

    const renderHeader = () => (
        <View style={{ paddingTop: insets.top + 60, zIndex: 10, paddingBottom: 10 }}>
            {/* ── Identity ───────────────────────────────────────────── */}
            <View style={{ alignItems: 'center', paddingHorizontal: 24, zIndex: 1 }}>

                {profile?.avatar_url ? (
                    <Image
                        source={{ uri: getAvatarUrl(profile.avatar_url) }}
                        style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#2C2C2E', marginBottom: 16 }}
                    />
                ) : (
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Text style={{ color: 'white', fontSize: 36, fontWeight: '600' }}>{profile?.display_name?.[0]?.toUpperCase()}</Text>
                    </View>
                )}

                <Text style={{ color: 'white', fontWeight: '700', fontSize: 28, letterSpacing: 0.35 }}>{profile?.display_name}</Text>
                <Text style={{ color: '#8E8E93', fontSize: 15, marginTop: 4, fontWeight: '400' }}>@{profile?.username}</Text>

                {profile?.bio ? (
                    <Text style={{ color: '#EBEBF5', textAlign: 'center', fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 300 }}>{profile.bio}</Text>
                ) : null}

                {isMe && (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('WeeklyRecap')}
                        style={{
                            marginTop: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            alignSelf: 'center',
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.12)',
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            minHeight: 36,
                        }}
                    >
                        <Ionicons name="stats-chart" size={14} color={accentColor} />
                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>Weekly Recap</Text>
                        <Ionicons name="chevron-forward" size={14} color="#8E8E93" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                )}

                {/* Genre pills - more subtle for Apple design */}
                {profile?.favorite_genres ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                        {profile.favorite_genres.split(',').filter(Boolean).map(g => (
                            <View key={g} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: `${accentColor}40` }}>
                                <Text style={{ color: '#EBEBF5', fontSize: 13, fontWeight: '500' }}>{g.trim()}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* Actions Row */}
                {!isMe && (
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%', paddingHorizontal: 4 }}>
                        <>
                            <TouchableOpacity
                                onPress={handleFollow}
                                style={{ 
                                    flex: 1, 
                                    borderRadius: 14, 
                                    paddingVertical: 12, 
                                    justifyContent: 'center', 
                                    alignItems: 'center', 
                                    backgroundColor: profile?.is_following ? 'rgba(255,255,255,0.15)' : accentColor,
                                    borderWidth: profile?.is_following ? 1 : 0,
                                    borderColor: 'rgba(255,255,255,0.2)'
                                }}
                            >
                                <Text style={{ color: profile?.is_following ? 'white' : getContrastColor(accentColor), fontWeight: '700', fontSize: 15 }}>{profile?.is_following ? 'Following' : 'Follow'}</Text>
                            </TouchableOpacity>
                            {tasteMatch !== null && (
                                <View style={{ 
                                    backgroundColor: 'rgba(191,90,242,0.15)', 
                                    borderRadius: 14, 
                                    paddingHorizontal: 20, 
                                    justifyContent: 'center', 
                                    alignItems: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(191,90,242,0.3)'
                                }}>
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ color: '#BF5AF2', fontWeight: '800', fontSize: 16 }}>{tasteMatch}%</Text>
                                        <Text style={{ color: '#BF5AF2', fontSize: 9, fontWeight: '700', marginTop: -2, letterSpacing: 0.5 }}>MATCH</Text>
                                    </View>
                                </View>
                            )}
                        </>
                    </View>
                ) /* Actions Row End */}
            </View>

            {/* ── Stats card (Inset Grouped Style) ────────────────────── */}
            <View style={{ marginHorizontal: 16, marginTop: 24, flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 14, overflow: 'hidden' }}>
                {[
                    { label: 'Posts', val: profile?.posts_count ?? 0, onPress: null }, 
                    { label: 'Followers', val: profile?.followers_count ?? 0, onPress: () => navigation.navigate('FollowersList', { userId: targetId, listType: 'followers', username: profile?.username }) }, 
                    { label: 'Following', val: profile?.following_count ?? 0, onPress: () => navigation.navigate('FollowersList', { userId: targetId, listType: 'following', username: profile?.username }) },
                    { label: 'Collection', val: profile?.collection_count ?? 0, onPress: () => navigation.navigate('Collection', { userId: targetId, username: profile?.username }) }
                ].map((s, i, arr) => {
                    const Wrapper = s.onPress ? TouchableOpacity : View;
                    return (
                        <Wrapper key={s.label} onPress={s.onPress || undefined} style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRightWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderRightColor: '#38383A' }}>
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>{s.val}</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 4, fontWeight: '500' }}>{s.label}</Text>
                        </Wrapper>
                    );
                })}
            </View>

            {/* ── Live Now Playing ───────────────────────────────────── */}
            {liveTrack && (
                <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: '#1C1C1E', borderRadius: 14, padding: 16, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <Ionicons name="musical-notes" size={14} color="#34C759" />
                        <Text style={{ color: '#34C759', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', flex: 1 }}>Live on Spotify</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                        {liveTrack.album_art_url ? (
                            <Image source={{ uri: liveTrack.album_art_url }} style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#2C2C2E' }} />
                        ) : (
                            <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' }}>
                                <FontAwesome5 name="music" size={24} color="black" />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }} numberOfLines={1}>{liveTrack.track_title}</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 2 }} numberOfLines={1}>{liveTrack.artist}</Text>
                            {liveTrack.duration_ms > 0 && (
                                <View style={{ marginTop: 10, height: 4, backgroundColor: '#38383A', borderRadius: 2, overflow: 'hidden' }}>
                                    <View style={{ height: 4, backgroundColor: '#34C759', width: `${Math.round((liveTrack.progress_ms / liveTrack.duration_ms) * 100)}%` }} />
                                </View>
                            )}
                        </View>
                    </View>

                    {isMe && (
                        <TouchableOpacity
                            onPress={handleShareLive}
                            disabled={sharingLive}
                            style={{ marginTop: 16, backgroundColor: '#2C2C2E', borderRadius: 10, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                        >
                            {sharingLive
                                ? <ActivityIndicator color="white" size="small" />
                                : <><Ionicons name="share-outline" size={18} color="white" /><Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Share to Feed</Text></>}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* ── Music Service Stats ────────────────────────────────── */}
            {(profile?.has_spotify_linked || profile?.has_youtube_linked || profile?.has_apple_music_linked || profile?.has_tidal_linked || profile?.has_qobuz_linked || profile?.has_deezer_linked) && (
                <View style={{ marginHorizontal: 20, marginTop: 20 }}>

                    {/* Service selector — only shows connected services */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                        {([
                            { key: 'spotify', label: 'Spotify',  color: '#1DB954', flag: profile?.has_spotify_linked },
                            { key: 'youtube', label: 'YouTube',  color: '#FF3B30', flag: profile?.has_youtube_linked },
                            { key: 'apple',   label: 'Apple',    color: '#FF2D55', flag: profile?.has_apple_music_linked },
                            { key: 'tidal',   label: 'Tidal',    color: '#00FFFF', flag: profile?.has_tidal_linked },
                            { key: 'qobuz',   label: 'Qobuz',    color: '#00B4D8', flag: profile?.has_qobuz_linked },
                            { key: 'deezer',  label: 'Deezer',   color: '#A238FF', flag: profile?.has_deezer_linked },
                        ] as const).filter(s => s.flag).map(s => {
                            const active = selectedMusicService === s.key;
                            return (
                                <TouchableOpacity
                                    key={s.key}
                                    onPress={() => setSelectedMusicService(s.key)}
                                    style={{ 
                                        paddingHorizontal: 16, 
                                        paddingVertical: 8, 
                                        borderRadius: 20, 
                                        backgroundColor: active ? s.color : 'rgba(255,255,255,0.12)', 
                                        shadowColor: active ? s.color : 'transparent',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 8,
                                        elevation: 4
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: active ? getContrastColor(s.color) : 'rgba(255,255,255,0.7)' }}>{s.label}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Sub-tabs for the active service */}
                    {selectedMusicService === 'spotify' && profile?.has_spotify_linked && (
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                            {(['recent', 'artists', 'playlists'] as const).map(tab => (
                                <TouchableOpacity key={tab} onPress={() => setSpotifyTab(tab)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: spotifyTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent', borderWidth: 1, borderColor: spotifyTab === tab ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: spotifyTab === tab ? 'white' : '#9ca3af' }}>
                                        {tab === 'recent' ? 'Recent' : tab === 'artists' ? 'Top Artists' : 'Playlists'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {selectedMusicService === 'youtube' && profile?.has_youtube_linked && (
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                            {(['history', 'liked', 'playlists'] as const).map(tab => (
                                <TouchableOpacity key={tab} onPress={() => setYoutubeTab(tab)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: youtubeTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent', borderWidth: 1, borderColor: youtubeTab === tab ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: youtubeTab === tab ? 'white' : '#9ca3af' }}>
                                        {tab === 'history' ? 'History' : tab === 'liked' ? 'Liked' : 'Playlists'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {(selectedMusicService === 'tidal' && profile?.has_tidal_linked) && (
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                            {(['playlists', 'favorites'] as const).map(tab => (
                                <TouchableOpacity key={tab} onPress={() => setTidalTab(tab)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: tidalTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent', borderWidth: 1, borderColor: tidalTab === tab ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: tidalTab === tab ? 'white' : '#9ca3af' }}>
                                        {tab === 'playlists' ? 'Playlists' : 'Favorites'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {(selectedMusicService === 'qobuz' && profile?.has_qobuz_linked) && (
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                            {(['playlists', 'favorites'] as const).map(tab => (
                                <TouchableOpacity key={tab} onPress={() => setQobuzTab(tab)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: qobuzTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent', borderWidth: 1, borderColor: qobuzTab === tab ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: qobuzTab === tab ? 'white' : '#9ca3af' }}>
                                        {tab === 'playlists' ? 'Playlists' : 'Favorites'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                    {(selectedMusicService === 'deezer' && profile?.has_deezer_linked) && (
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                            {(['playlists', 'favorites'] as const).map(tab => (
                                <TouchableOpacity key={tab} onPress={() => setDeezerTab(tab)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: deezerTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent', borderWidth: 1, borderColor: deezerTab === tab ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: deezerTab === tab ? 'white' : '#9ca3af' }}>
                                        {tab === 'playlists' ? 'Playlists' : 'Favorites'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* ── Spotify ── */}
                    {selectedMusicService === 'spotify' && profile?.has_spotify_linked && (
                        spotifyLoading ? <ActivityIndicator color="#1DB954" /> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {spotifyTab === 'recent' && spotifyRecent.map((t, i) => (
                                    <TouchableOpacity key={i} onPress={() => t.spotify_url && Linking.openURL(t.spotify_url)} style={{ width: 120 }}>
                                        {t.album_art_url ? <Image source={{ uri: t.album_art_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E' }} />}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{t.track_title}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </TouchableOpacity>
                                ))}
                                {spotifyTab === 'artists' && spotifyArtists.map((a, i) => (
                                    <TouchableOpacity key={i} onPress={() => a.spotify_url && Linking.openURL(a.spotify_url)} style={{ width: 100, alignItems: 'center' }}>
                                        {a.image_url ? <Image source={{ uri: a.image_url }} style={{ width: 100, height: 100, borderRadius: 50 }} /> : <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#2C2C2E' }} />}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' }} numberOfLines={1}>{a.name}</Text>
                                        {a.genres?.[0] && <Text style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', marginTop: 2 }} numberOfLines={1}>{a.genres[0]}</Text>}
                                    </TouchableOpacity>
                                ))}
                                {spotifyTab === 'playlists' && spotifyPlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.spotify_url && Linking.openURL(p.spotify_url)} style={{ width: 120 }}>
                                        {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="list-ul" size={24} color="#8E8E93" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {((spotifyTab === 'recent' && spotifyRecent.length === 0) || (spotifyTab === 'artists' && spotifyArtists.length === 0) || (spotifyTab === 'playlists' && spotifyPlaylists.length === 0)) && (
                                    <Text style={{ color: '#8E8E93', fontSize: 14, paddingVertical: 12 }}>Nothing here yet</Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* ── YouTube Music ── */}
                    {selectedMusicService === 'youtube' && profile?.has_youtube_linked && (
                        youtubeLoading ? <ActivityIndicator color="#FF3B30" /> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {youtubeTab === 'history' && youtubeHistory.map((t, i) => (
                                    <View key={i} style={{ width: 120 }}>
                                        {t.image_url ? <Image source={{ uri: t.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="youtube" size={24} color="#FF3B30" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{t.title}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </View>
                                ))}
                                {youtubeTab === 'liked' && youtubeLiked.map((t, i) => (
                                    <View key={i} style={{ width: 120 }}>
                                        {t.image_url ? <Image source={{ uri: t.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="thumbs-up" size={24} color="#FF3B30" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{t.title}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </View>
                                ))}
                                {youtubeTab === 'playlists' && youtubePlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.youtube_url && Linking.openURL(p.youtube_url)} style={{ width: 120 }}>
                                        {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="youtube" size={24} color="#FF3B30" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{p.track_count} videos</Text>
                                    </TouchableOpacity>
                                ))}
                                {((youtubeTab === 'history' && youtubeHistory.length === 0) || (youtubeTab === 'liked' && youtubeLiked.length === 0) || (youtubeTab === 'playlists' && youtubePlaylists.length === 0)) && (
                                    <Text style={{ color: '#8E8E93', fontSize: 14, paddingVertical: 12 }}>Nothing here yet</Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* ── Apple Music ── */}
                    {selectedMusicService === 'apple' && profile?.has_apple_music_linked && (
                        appleLoading ? <ActivityIndicator color="#FF2D55" /> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {applePlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.apple_url && Linking.openURL(p.apple_url)} style={{ width: 120 }}>
                                        {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="apple" size={24} color="#FF2D55" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {applePlaylists.length === 0 && <Text style={{ color: '#8E8E93', fontSize: 14, paddingVertical: 12 }}>Nothing here yet</Text>}
                            </ScrollView>
                        )
                    )}

                    {/* ── Tidal ── */}
                    {selectedMusicService === 'tidal' && profile?.has_tidal_linked && (
                        tidalLoading ? <ActivityIndicator color="#00FFFF" /> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {tidalTab === 'playlists' && tidalPlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.tidal_url && Linking.openURL(p.tidal_url)} style={{ width: 120 }}>
                                        {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="list-ul" size={24} color="#00FFFF" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {tidalTab === 'favorites' && tidalFavorites.map((t, i) => (
                                    <View key={i} style={{ width: 120 }}>
                                        {t.image_url ? <Image source={{ uri: t.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E' }} />}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{t.title}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </View>
                                ))}
                                {((tidalTab === 'playlists' && tidalPlaylists.length === 0) || (tidalTab === 'favorites' && tidalFavorites.length === 0)) && (
                                    <Text style={{ color: '#8E8E93', fontSize: 14, paddingVertical: 12 }}>Nothing here yet</Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* ── Qobuz ── */}
                    {selectedMusicService === 'qobuz' && profile?.has_qobuz_linked && (
                        qobuzLoading ? <ActivityIndicator color="#00B4D8" /> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {qobuzTab === 'playlists' && qobuzPlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.qobuz_url && Linking.openURL(p.qobuz_url)} style={{ width: 120 }}>
                                        {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="list-ul" size={24} color="#00B4D8" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {qobuzTab === 'favorites' && qobuzFavorites.map((t, i) => (
                                    <View key={i} style={{ width: 120 }}>
                                        {t.image_url ? <Image source={{ uri: t.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E' }} />}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{t.title}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </View>
                                ))}
                                {((qobuzTab === 'playlists' && qobuzPlaylists.length === 0) || (qobuzTab === 'favorites' && qobuzFavorites.length === 0)) && (
                                    <Text style={{ color: '#8E8E93', fontSize: 14, paddingVertical: 12 }}>Nothing here yet</Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* ── Deezer ── */}
                    {selectedMusicService === 'deezer' && profile?.has_deezer_linked && (
                        deezerLoading ? <ActivityIndicator color="#A238FF" /> : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {deezerTab === 'playlists' && deezerPlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.deezer_url && Linking.openURL(p.deezer_url)} style={{ width: 120 }}>
                                        {p.image_url ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}><FontAwesome5 name="list-ul" size={24} color="#A238FF" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {deezerTab === 'favorites' && deezerFavorites.map((t, i) => (
                                    <View key={i} style={{ width: 120 }}>
                                        {t.image_url ? <Image source={{ uri: t.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} /> : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E' }} />}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{t.title}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </View>
                                ))}
                                {((deezerTab === 'playlists' && deezerPlaylists.length === 0) || (deezerTab === 'favorites' && deezerFavorites.length === 0)) && (
                                    <Text style={{ color: '#8E8E93', fontSize: 14, paddingVertical: 12 }}>Nothing here yet</Text>
                                )}
                            </ScrollView>
                        )
                    )}
                </View>
            )}

            {/* ── Filter tabs ────────────────────────────────────────── */}
            <View style={{ marginTop: 24, paddingBottom: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                    {FILTER_TABS.map(tab => {
                        const active = filter === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setFilter(tab.key)}
                                style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    gap: 6, 
                                    paddingHorizontal: 20, 
                                    paddingVertical: 10, 
                                    borderRadius: 14, 
                                    backgroundColor: active ? accentColor : 'rgba(255,255,255,0.08)',
                                    borderWidth: 1,
                                    borderColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'
                                }}
                            >
                                <Ionicons name={tab.icon} size={15} color={active ? getContrastColor(accentColor) : '#8E8E93'} />
                                <Text style={{ fontSize: 15, fontWeight: '700', color: active ? getContrastColor(accentColor) : '#8E8E93' }}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
    const kawarpImage = liveTrack?.album_art_url || posts.find(p => p.album_art_url)?.album_art_url || profile?.avatar_url;
    const parsedOptions = React.useMemo(() => {
        try {
            return profile?.kawarp_config ? JSON.parse(profile.kawarp_config) : undefined;
        } catch { return undefined; }
    }, [profile?.kawarp_config]);

    const editOptions = React.useMemo(() => {
        const defaults = { warpIntensity: 1.0, blurPasses: 8, animationSpeed: 1.0, transitionDuration: 1000, saturation: 1.5, tintIntensity: 0.15, dithering: 0.008, scale: 1.0 };
        try { return editData.kawarp_config ? { ...defaults, ...JSON.parse(editData.kawarp_config) } : defaults; } catch { return defaults; }
    }, [editData.kawarp_config]);

    const handleOptionChange = (key: string, val: number) => {
        setEditData(prev => ({ ...prev, kawarp_config: JSON.stringify({ ...editOptions, [key]: val }) }));
    };

    const SimpleSlider = ({ label, value, min, max, step, onChange }: any) => (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
                <Text style={{ color: 'white', fontSize: 11 }}>{value.toFixed(2)}</Text>
            </View>
            <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))}><Ionicons name="remove-circle-outline" size={24} color="#8E8E93" /></TouchableOpacity>
                <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${((value - min) / (max - min)) * 100}%`, height: '100%', backgroundColor: Colors.primary }} />
                </View>
                <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))}><Ionicons name="add-circle-outline" size={24} color="#8E8E93" /></TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-black">
            <KawarpBackground accent={accentColor} avatarUrl={kawarpImage} options={parsedOptions} />
            {renderTopNav()}
            <FlatList
                data={posts}
                keyExtractor={p => String(p.id)}
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        onLike={handleLike}
                        onComment={post => { setSelectedPost(post); setCommentsVisible(true); }}
                        onSaveToCollection={handleSaveToCollection}
                        onQuickReact={handleQuickReact}
                        onListenLater={handleListenLater}
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

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
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

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Profile Accent</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                        {PROFILE_ACCENTS.map(color => (
                            <TouchableOpacity
                                key={color}
                                onPress={() => setAccentColor(color)}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: color,
                                    borderWidth: accentColor === color ? 2 : 0,
                                    borderColor: 'white',
                                }}
                            />
                        ))}
                    </View>

                    <Text style={{ color: 'white', fontSize: 15, fontWeight: '700', marginBottom: 12, marginTop: 8 }}>Dynamic Background</Text>
                    <View style={{ width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                        <KawarpBackground accent={accentColor} avatarUrl={editData.avatar_url || kawarpImage} options={editOptions} />
                    </View>

                    <SimpleSlider label="Warp Intensity" value={editOptions.warpIntensity} min={0} max={1} step={0.1} onChange={(v: number) => handleOptionChange('warpIntensity', v)} />
                    <SimpleSlider label="Blur Passes" value={editOptions.blurPasses} min={1} max={40} step={2} onChange={(v: number) => handleOptionChange('blurPasses', v)} />
                    <SimpleSlider label="Animation Speed" value={editOptions.animationSpeed} min={0} max={5} step={0.2} onChange={(v: number) => handleOptionChange('animationSpeed', v)} />
                    <SimpleSlider label="Scale" value={editOptions.scale} min={0.01} max={4} step={0.25} onChange={(v: number) => handleOptionChange('scale', v)} />
                    <SimpleSlider label="Color Saturation" value={editOptions.saturation} min={0} max={3} step={0.25} onChange={(v: number) => handleOptionChange('saturation', v)} />
                    <SimpleSliderLabelOnly label="Tint Intensity & Dithering updates dynamically" />

                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const SimpleSliderLabelOnly = ({ label }: any) => <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: -4, marginBottom: 16 }}>{label}</Text>;
