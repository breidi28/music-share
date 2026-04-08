import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Post, ReactionType } from '../types';
import { postsApi, notificationsApi, listenLaterApi, collectionApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { HIG } from '../theme/hig';
import PostCard from '../components/PostCard';
import CommentsModal from '../components/CommentsModal';
import { MenuModal } from '../components/ui/MenuModal';
import { SkeletonPostCard } from '../components/ui/SkeletonPostCard';

export default function FeedScreen({ navigation }: any) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [friendActivityExpanded, setFriendActivityExpanded] = useState(false);
    const { user } = useAuthStore();
    const insets = useSafeAreaInsets();

    const activityHighlights = useMemo(() => {
        if (!posts.length) return null;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = today.getMonth();
        const dd = today.getDate();

        const countsByAuthor: Record<string, { name: string; count: number }> = {};
        let newestPost: Post | null = null;

        for (const p of posts) {
            const created = new Date(p.created_at);
            if (!newestPost || new Date(p.created_at).getTime() > new Date(newestPost.created_at).getTime()) {
                newestPost = p;
            }

            if (
                created.getFullYear() === yyyy &&
                created.getMonth() === mm &&
                created.getDate() === dd
            ) {
                const key = String(p.author.id);
                if (!countsByAuthor[key]) {
                    countsByAuthor[key] = { name: p.author.display_name, count: 0 };
                }
                countsByAuthor[key].count += 1;
            }
        }

        const mostActive = Object.values(countsByAuthor).sort((a, b) => b.count - a.count)[0] || null;

        return {
            mostActive,
            newestPost,
        };
    }, [posts]);

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

    const handleSaveToCollection = async (post: Post) => {
        try {
            await collectionApi.addItem({
                media_type: 'digital',
                album_title: post.album || post.track_title,
                artist: post.artist,
                album_art_url: post.album_art_url || '',
                notes: `Saved from feed: ${post.track_title}`,
            });
            Toast.show({ type: 'success', text1: 'Saved to Collection' });
        } catch { }
    };

    const openHeaderMenu = () => {
        setMenuVisible(true);
    };

    const renderHeader = () => (
        <View
            style={{
                paddingTop: insets.top,
                backgroundColor: '#000',
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: 'rgba(255,255,255,0.1)',
            }}
        >
            {/* Header bar with clean HIG-compliant layout */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
                {/* App title */}
                <Text style={styles.headerTitle}>tuneshare</Text>

                {/* Action buttons - spaced with proper touch targets */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={openHeaderMenu}
                        style={styles.headerButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="menu" size={24} color="#9ca3af" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Notifications')}
                        style={styles.headerButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="notifications" size={24} color="#9ca3af" />
                        {unreadCount > 0 && (
                            <View style={styles.notificationBadge} />
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
                <View style={{ flex: 1 }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonPostCard key={i} />
                    ))}
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
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
                removeClippedSubviews={true}
                ListHeaderComponent={
                    <View style={{ paddingTop: 12 }}>
                        {activityHighlights && (activityHighlights.mostActive || activityHighlights.newestPost) ? (
                            <View
                                style={{
                                    marginHorizontal: 16,
                                    marginBottom: 10,
                                    backgroundColor: '#141417',
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                }}
                            >
                                <TouchableOpacity
                                    onPress={() => setFriendActivityExpanded(prev => !prev)}
                                    style={{
                                        minHeight: 44,
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="people-outline" size={15} color="#9ca3af" />
                                        <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 6 }}>
                                            Friend Activity
                                        </Text>
                                    </View>
                                    <Ionicons name={friendActivityExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                                </TouchableOpacity>

                                {friendActivityExpanded && (
                                    <View style={{ paddingHorizontal: 12, paddingBottom: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                                        {activityHighlights.mostActive && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9, marginBottom: activityHighlights.newestPost ? 8 : 2 }}>
                                                <Ionicons name="flame-outline" size={14} color={Colors.primary} />
                                                <Text style={{ color: '#d1d5db', fontSize: 13, marginLeft: 6 }} numberOfLines={1}>
                                                    Most active today: {activityHighlights.mostActive.name} ({activityHighlights.mostActive.count})
                                                </Text>
                                            </View>
                                        )}

                                        {activityHighlights.newestPost && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="sparkles-outline" size={14} color="#9ca3af" />
                                                <Text style={{ color: '#d1d5db', fontSize: 13, marginLeft: 6 }} numberOfLines={1}>
                                                    New from people you follow: {activityHighlights.newestPost.author.display_name} shared {activityHighlights.newestPost.track_title}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        ) : null}

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
                        onSaveToCollection={handleSaveToCollection}
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
            
            <MenuModal
                visible={menuVisible}
                title="Feed Menu"
                onClose={() => setMenuVisible(false)}
                options={[
                    { text: 'Search', icon: 'search-outline', onPress: () => navigation.navigate('Search') },
                    { text: 'Collaborative Lists', icon: 'list-outline', onPress: () => navigation.navigate('CollaborativeLists') },
                    { text: 'Listen Later', icon: 'bookmark-outline', onPress: () => navigation.navigate('ListenLater') },
                    { text: 'Cancel', style: 'cancel' },
                ]}
            />
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    // Header
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.5,
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerButton: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        backgroundColor: Colors.primary,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#000',
    },
});
