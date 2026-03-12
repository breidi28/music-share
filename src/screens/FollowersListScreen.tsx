import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Image, ActivityIndicator, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { User } from '../types';
import { usersApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { API_BASE_URL } from '../api/client';

// Helper to get full avatar URL
const getAvatarUrl = (url: string | null | undefined): string => {
    if (!url) return 'https://via.placeholder.com/80';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return API_BASE_URL.replace('/api', '') + url;
};

export default function FollowersListScreen({ navigation, route }: any) {
    const { userId, listType, username } = route.params; // listType: 'followers' | 'following'
    const insets = useSafeAreaInsets();
    const { user: me } = useAuthStore();
    
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadUsers();
    }, [userId, listType]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = listType === 'followers' 
                ? await usersApi.getFollowers(userId)
                : await usersApi.getFollowing(userId);
            
            setUsers(res.data);
            
            // Track which users the current user is following
            const following = new Set<number>();
            res.data.forEach((u: User) => {
                if (u.is_following) {
                    following.add(u.id);
                }
            });
            setFollowingIds(following);
        } catch (err) {
            console.error('Failed to load users:', err);
        }
        setLoading(false);
    };

    const handleFollow = async (user: User) => {
        try {
            await usersApi.follow(user.id);
            
            // Update local state
            if (followingIds.has(user.id)) {
                setFollowingIds(prev => {
                    const next = new Set(prev);
                    next.delete(user.id);
                    return next;
                });
            } else {
                setFollowingIds(prev => new Set(prev).add(user.id));
            }
            
            // Update user in list
            setUsers(prev => prev.map(u => 
                u.id === user.id ? { ...u, is_following: !u.is_following } : u
            ));
        } catch (err) {
            console.error('Failed to follow/unfollow:', err);
        }
    };

    const renderUser = ({ item }: { item: User }) => {
        const isMe = item.id === me?.id;
        const isFollowing = followingIds.has(item.id);

        return (
            <TouchableOpacity
                onPress={() => navigation.push('Profile', { userId: item.id })}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.05)',
                }}
            >
                <Image
                    source={{ uri: getAvatarUrl(item.avatar_url) }}
                    style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#374151' }}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>
                        {item.display_name || item.username}
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 2 }}>
                        @{item.username}
                    </Text>
                    {item.bio && (
                        <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                            {item.bio}
                        </Text>
                    )}
                </View>
                
                {!isMe && (
                    <TouchableOpacity
                        onPress={() => handleFollow(item)}
                        style={{
                            paddingHorizontal: 18,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: isFollowing ? 'transparent' : Colors.primary,
                            borderWidth: 1,
                            borderColor: isFollowing ? 'rgba(255,255,255,0.15)' : Colors.primary,
                        }}
                    >
                        <Text style={{
                            color: isFollowing ? '#9ca3af' : 'white',
                            fontWeight: '600',
                            fontSize: 13,
                        }}>
                            {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.1)',
            }}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ padding: 4, marginRight: 12 }}
                >
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>
                        {listType === 'followers' ? 'Followers' : 'Following'}
                    </Text>
                    <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 1 }}>
                        @{username}
                    </Text>
                </View>
            </View>

            {/* List */}
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            ) : users.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                    <Ionicons name="people-outline" size={64} color="#374151" />
                    <Text style={{ color: '#9ca3af', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                        {listType === 'followers' 
                            ? 'No followers yet' 
                            : 'Not following anyone yet'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderUser}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingBottom: insets.bottom }}
                />
            )}
        </View>
    );
}
