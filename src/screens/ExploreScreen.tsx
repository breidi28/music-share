import React, { useState, useEffect } from 'react';
import { FlatList, RefreshControl, ScrollView, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Post, ReactionType } from '../types';
import { exploreApi, postsApi, listenLaterApi, collectionApi } from '../api/endpoints';
import PostCard from '../components/PostCard';
import CommentsModal from '../components/CommentsModal';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

const GENRES = ['All', 'Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical', 'R&B', 'Indie', 'Metal', 'Folk'];

export default function ExploreScreen({ navigation }: any) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [recommendations, setRecommendations] = useState<{
        because_you_liked: Array<{ reason: string; post: Post }>;
        genre_chips: string[];
        artist_chips: string[];
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const { user } = useAuthStore();
    const insets = useSafeAreaInsets();

    const fetchPosts = async (genre = selectedGenre, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await exploreApi.getPosts(1, genre === 'All' ? undefined : genre);
            setPosts(res.data.posts);
        } catch { }
        setLoading(false);
        setRefreshing(false);
    };

    const fetchRecommendations = async () => {
        try {
            const res = await exploreApi.getRecommendations();
            setRecommendations(res.data);
        } catch {
            setRecommendations(null);
        }
    };

    useEffect(() => {
        fetchPosts();
        fetchRecommendations();
    }, []);

    const selectGenre = (g: string) => {
        setSelectedArtist(null);
        setSelectedGenre(g);
        fetchPosts(g);
    };

    const visiblePosts = selectedArtist
        ? posts.filter(p => (p.artist || '').toLowerCase().includes(selectedArtist.toLowerCase()))
        : posts;

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
                notes: `Saved from explore: ${post.track_title}`,
            });
            Toast.show({ type: 'success', text1: 'Saved to Collection' });
        } catch { }
    };

    const renderHeader = () => (
        <View
            style={{
                paddingTop: insets.top,
                backgroundColor: '#000',
                borderBottomWidth: 0.5,
                borderBottomColor: 'rgba(255,255,255,0.1)',
            }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ fontSize: 34, fontWeight: '700', color: 'white', letterSpacing: -0.5 }}>Explore</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ padding: 4 }}>
                    <Ionicons name="search" size={24} color="#9ca3af" />
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
            >
                {GENRES.map(g => {
                    const active = selectedGenre === g;
                    return (
                        <TouchableOpacity
                            key={g}
                            onPress={() => selectGenre(g)}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 7,
                                borderRadius: 18,
                                backgroundColor: active ? Colors.primary : 'rgba(255,255,255,0.1)',
                            }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: 'white' }}>{g}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {recommendations && (recommendations.genre_chips.length > 0 || recommendations.artist_chips.length > 0) && (
                <View style={{ paddingBottom: 12 }}>
                    <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 8 }}>
                        Discover
                    </Text>

                    {recommendations.genre_chips.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
                            {recommendations.genre_chips.slice(0, 8).map((g) => (
                                <TouchableOpacity
                                    key={`rec-genre-${g}`}
                                    onPress={() => selectGenre(g)}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.12)',
                                        backgroundColor: 'rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <Text style={{ color: '#d1d5db', fontSize: 12, fontWeight: '600' }}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {recommendations.artist_chips.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                            {recommendations.artist_chips.slice(0, 8).map((a) => (
                                <TouchableOpacity
                                    key={`rec-artist-${a}`}
                                    onPress={() => {
                                        setSelectedGenre('All');
                                        setSelectedArtist(a);
                                    }}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: 'rgba(250,36,60,0.35)',
                                        backgroundColor: 'rgba(250,36,60,0.12)',
                                    }}
                                >
                                    <Text style={{ color: '#ffd3d8', fontSize: 12, fontWeight: '600' }}>{a}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}

            {recommendations?.because_you_liked?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
                    {recommendations.because_you_liked.slice(0, 5).map((entry, idx) => (
                        <TouchableOpacity
                            key={`because-${idx}-${entry.post?.id}`}
                            onPress={() => navigation.navigate('Profile', { userId: entry.post.author.id })}
                            style={{
                                width: 260,
                                backgroundColor: '#141417',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                                padding: 12,
                            }}
                        >
                            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }} numberOfLines={1}>{entry.reason}</Text>
                            <Text style={{ color: 'white', fontSize: 14, fontWeight: '700', marginTop: 6 }} numberOfLines={1}>{entry.post.track_title}</Text>
                            <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{entry.post.artist}</Text>
                            <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 6 }} numberOfLines={1}>by {entry.post.author.display_name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            ) : null}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            {renderHeader()}

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={visiblePosts}
                    keyExtractor={p => String(p.id)}
                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <PostCard
                            post={item}
                            onLike={handleLike}
                            onComment={post => { setSelectedPost(post); setCommentsVisible(true); }}
                            onSaveToCollection={handleSaveToCollection}
                            onQuickReact={handleQuickReact}
                            onListenLater={handleListenLater}
                            onAuthorPress={uid => navigation.navigate('Profile', { userId: uid })}
                            isOwn={item.user_id === user?.id}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={{ padding: 32, marginTop: 40, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="musical-notes-outline" size={64} color="#4b5563" />
                            <Text style={{ color: '#6b7280', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                                {selectedArtist ? `No posts for ${selectedArtist} yet.` : 'No posts in this genre yet.'}
                            </Text>
                        </View>
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                fetchPosts(selectedGenre, true);
                                fetchRecommendations();
                            }}
                            tintColor={Colors.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}

            <CommentsModal
                post={selectedPost}
                visible={commentsVisible}
                onClose={() => setCommentsVisible(false)}
            />
        </View>
    );
}
