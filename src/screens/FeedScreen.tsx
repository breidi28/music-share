import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, RefreshControl, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Post, ReactionType } from '../types';
import { postsApi, notificationsApi, listenLaterApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import PostCard from '../components/PostCard';
import CommentsModal from '../components/CommentsModal';

export default function FeedScreen({ navigation }: any) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const { user } = useAuthStore();
    const insets = useSafeAreaInsets();

    const fetchFeed = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await postsApi.getFeed(1);
            setPosts(res.data.posts);
            const notifRes = await notificationsApi.getAll();
            setUnreadCount(notifRes.data.unread_count);
        } catch { }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchFeed();
        }, [fetchFeed])
    );

    const handleLike = async (postId: number) => {
        try {
            const res = await postsApi.likePost(postId);
            setPosts(prev => prev.map(p =>
                p.id === postId
                    ? { ...p, is_liked: res.data.is_liked, likes_count: res.data.likes_count }
                    : p
            ));
        } catch { }
    };

    const handleComment = (post: Post) => {
        setSelectedPost(post);
        setCommentsVisible(true);
    };

    const handleDelete = async (postId: number) => {
        try {
            await postsApi.deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
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

    const renderHeader = () => (
        <View
            style={{
                paddingTop: insets.top,
                paddingBottom: 0,
                backgroundColor: '#000',
                borderBottomWidth: 0.5,
                borderBottomColor: 'rgba(255,255,255,0.1)',
            }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ fontSize: 34, fontWeight: '700', color: 'white', letterSpacing: -0.5 }}>tuneshare</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ padding: 4 }}>
                        <Ionicons name="search" size={24} color="#9ca3af" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ padding: 4, position: 'relative' }}>
                        <Ionicons name="notifications" size={24} color="#9ca3af" />
                        {unreadCount > 0 && (
                            <View style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, backgroundColor: Colors.primary, borderRadius: 4, borderWidth: 1.5, borderColor: '#000' }} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                {renderHeader()}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            {renderHeader()}
            <FlatList
                data={posts}
                keyExtractor={p => String(p.id)}
                ListHeaderComponent={
                    <View style={{ paddingTop: 12 }}>
                        {posts.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 }}>
                                <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>Friends</Text>
                            </View>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64 }}>
                        <View style={{ width: 96, height: 96, backgroundColor: Colors.primary, borderRadius: 48, marginBottom: 24, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="musical-notes" size={48} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>Your feed is empty</Text>
                        <Text style={{ color: '#6b7280', fontSize: 15, textAlign: 'center', marginBottom: 32 }}>Follow friends to see their music here!</Text>

                        <TouchableOpacity
                            style={{ backgroundColor: Colors.primary, borderRadius: 24, height: 48, paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => navigation.navigate('Search')}
                        >
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 17 }}>Find Friends</Text>
                        </TouchableOpacity>
                    </View>
                }
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        onLike={handleLike}
                        onComment={handleComment}
                        onQuickReact={handleQuickReact}
                        onListenLater={handleListenLater}
                        onAuthorPress={uid => navigation.navigate('Profile', { userId: uid })}
                        onDelete={handleDelete}
                        isOwn={item.user_id === user?.id}
                    />
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchFeed(true)}
                        tintColor={Colors.primary}
                    />
                }
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            />

            <CommentsModal
                post={selectedPost}
                visible={commentsVisible}
                onClose={() => setCommentsVisible(false)}
            />
        </View>
    );
}
