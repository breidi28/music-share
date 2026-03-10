import React, { useState, useEffect } from 'react';
import { FlatList, RefreshControl, ScrollView, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Post } from '../types';
import { exploreApi, postsApi } from '../api/endpoints';
import PostCard from '../components/PostCard';
import CommentsModal from '../components/CommentsModal';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

const GENRES = ['All', 'Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical', 'R&B', 'Indie', 'Metal', 'Folk'];

export default function ExploreScreen({ navigation }: any) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedGenre, setSelectedGenre] = useState('All');
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

    useEffect(() => { fetchPosts(); }, []);

    const selectGenre = (g: string) => {
        setSelectedGenre(g);
        fetchPosts(g);
    };

    const handleLike = async (postId: number) => {
        try {
            const res = await postsApi.likePost(postId);
            setPosts(prev => prev.map(p =>
                p.id === postId ? { ...p, is_liked: res.data.is_liked, likes_count: res.data.likes_count } : p
            ));
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
                    data={posts}
                    keyExtractor={p => String(p.id)}
                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
                    renderItem={({ item }) => (
                        <PostCard
                            post={item}
                            onLike={handleLike}
                            onComment={post => { setSelectedPost(post); setCommentsVisible(true); }}
                            onAuthorPress={uid => navigation.navigate('Profile', { userId: uid })}
                            isOwn={item.user_id === user?.id}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={{ padding: 32, marginTop: 40, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="musical-notes-outline" size={64} color="#4b5563" />
                            <Text style={{ color: '#6b7280', fontSize: 16, marginTop: 16, textAlign: 'center' }}>No posts in this genre yet.</Text>
                        </View>
                    }
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts(selectedGenre, true)} tintColor={Colors.primary} />
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
