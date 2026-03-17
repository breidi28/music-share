import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import PostCard from '../components/PostCard';
import { activityApi, postsApi, listenLaterApi, collectionApi } from '../api/endpoints';
import { Post, ReactionType } from '../types';
import { Colors } from '../theme';
import CommentsModal from '../components/CommentsModal';

export default function ActivityScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [activities, setActivities] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [commentsVisible, setCommentsVisible] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await activityApi.getFeed(1);
            setActivities(res.data.posts);
        } catch (err) {
            console.error('Failed to load activity feed:', err);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleLike = async (postId: number) => {
        try {
            await postsApi.likePost(postId);
            // Update local state
            setActivities(prev => prev.map(post => 
                post.id === postId 
                    ? { 
                        ...post, 
                        is_liked: !post.is_liked,
                        likes_count: post.is_liked ? post.likes_count - 1 : post.likes_count + 1 
                    }
                    : post
            ));
        } catch (err) {
            console.error('Failed to like post:', err);
        }
    };

    const handleQuickReact = async (postId: number, reaction: ReactionType) => {
        const target = activities.find(p => p.id === postId);
        const hasReaction = target?.my_reactions?.includes(reaction);

        try {
            if (hasReaction) {
                await postsApi.removeReaction(postId, reaction);
            } else {
                await postsApi.addReaction(postId, reaction);
            }

            const res = await postsApi.getReactions(postId);
            setActivities(prev => prev.map(p =>
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
                notes: `Saved from activity: ${post.track_title}`,
            });
            Toast.show({ type: 'success', text1: 'Saved to Collection' });
        } catch { }
    };

    const handleComment = (post: Post) => {
        setSelectedPost(post);
        setCommentsVisible(true);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            {/* Header */}
            <View
                style={{
                    paddingTop: insets.top,
                    backgroundColor: '#000',
                    borderBottomWidth: 0.5,
                    borderBottomColor: 'rgba(255,255,255,0.1)',
                }}
            >
                <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 34, letterSpacing: -0.5 }}>
                        Activity
                    </Text>
                </View>
            </View>

            {/* Content */}
            <FlatList
                data={activities}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        onLike={handleLike}
                        onComment={handleComment}
                        onSaveToCollection={handleSaveToCollection}
                        onQuickReact={handleQuickReact}
                        onListenLater={handleListenLater}
                        onAuthorPress={(uid) => navigation.navigate('Profile', { userId: uid })}
                        isOwn={false}
                    />
                )}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load(true)}
                        tintColor={Colors.primary}
                    />
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : (
                        <View style={{ paddingVertical: 60, alignItems: 'center', paddingHorizontal: 40 }}>
                            <Ionicons name="musical-notes-outline" size={64} color="#374151" />
                            <Text style={{ color: '#6b7280', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                                No activity yet. Follow some users to see what they're listening to!
                            </Text>
                        </View>
                    )
                }
            />

            {/* Comments Modal */}
            {selectedPost && (
                <CommentsModal
                    visible={commentsVisible}
                    onClose={() => {
                        setCommentsVisible(false);
                        setSelectedPost(null);
                    }}
                    post={selectedPost}
                />
            )}
        </View>
    );
}
