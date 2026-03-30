import React, { useState, useCallback } from 'react';
import { FlatList, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User } from '../types';
import { usersApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

export default function SearchScreen({ navigation }: any) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const { user: me } = useAuthStore();
    const insets = useSafeAreaInsets();

    const search = useCallback(async (q: string) => {
        setQuery(q);
        if (!q.trim()) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await usersApi.search(q.trim());
            setResults(res.data);
        } catch { }
        setLoading(false);
    }, []);

    const handleFollow = async (userId: number) => {
        try {
            const res = await usersApi.follow(userId);
            setResults(prev => prev.map(u => u.id === userId ? res.data.user : u));
        } catch { }
    };

    const renderUser = ({ item }: { item: User }) => {
        const isMe = item.id === me?.id;
        const BG_COLORS = ['#3B82F6', '#EC4899', '#10B981', '#6366F1', '#F59E0B'];
        const avatarBg = BG_COLORS[item.id % BG_COLORS.length];

        return (
            <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => navigation.navigate('Profile', { userId: item.id })}
                style={{
                    marginBottom: 12,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                ) : (
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: avatarBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>{item.display_name[0]?.toUpperCase()}</Text>
                    </View>
                )}

                <View style={{ flex: 1 }}>
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{item.display_name}</Text>
                    <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 1 }}>@{item.username}</Text>
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 12 }}>{item.followers_count} followers</Text>
                        <Text style={{ color: '#4b5563', fontSize: 12 }}>·</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12 }}>{item.posts_count} posts</Text>
                    </View>
                    {item.favorite_genres ? (
                        <Text style={{ color: Colors.primary, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
                            {item.favorite_genres.split(',').slice(0, 3).join('  ·  ')}
                        </Text>
                    ) : null}
                </View>

                {!isMe && (
                    <TouchableOpacity
                        onPress={() => handleFollow(item.id)}
                        style={{
                            borderRadius: 100,
                            height: 34,
                            paddingHorizontal: 16,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: item.is_following ? 'transparent' : Colors.primary,
                            borderWidth: 1,
                            borderColor: item.is_following ? 'rgba(255,255,255,0.15)' : Colors.primary,
                        }}
                    >
                        <Text style={{ color: item.is_following ? '#9ca3af' : 'white', fontWeight: '600', fontSize: 13 }}>
                            {item.is_following ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };


    const renderHeader = () => (
        <BlurView
            intensity={80}
            tint="dark"
            style={{ paddingTop: insets.top + 8, paddingBottom: 12, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
            className="flex-row items-center border-b border-white/10 px-4 gap-3"
        >
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-1">
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View className="flex-row flex-1 items-center rounded-full bg-white/10 border border-white/10 h-11">
                <View className="pl-3 justify-center items-center">
                    <Ionicons name="search" size={18} color={Colors.textSecondary} />
                </View>
                <TextInput
                    className="flex-1 text-white text-base pl-3 h-full"
                    placeholderTextColor="#6b7280"
                    placeholder="Search for friends..."
                    value={query}
                    onChangeText={search}
                    autoFocus
                    autoCapitalize="none"
                    keyboardAppearance="dark"
                />
                {query ? (
                    <TouchableOpacity className="pr-3 justify-center items-center p-2" onPress={() => { setQuery(''); setResults([]); }}>
                        <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                ) : null}
            </View>
        </BlurView>
    );

    return (
        <View className="flex-1 bg-black">
            {renderHeader()}

            {loading ? (
                <View className="flex-1 justify-center items-center pb-20">
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={u => String(u.id)}
                    renderItem={renderUser}
                    contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: 100, paddingHorizontal: 16 }}
                    ListEmptyComponent={
                        query ? (
                            <View className="flex-1 justify-center items-center mt-32 px-8">
                                <View className="w-24 h-24 rounded-full bg-blue-500/20 mb-6 justify-center items-center">
                                    <Ionicons name="search" size={40} color="#3B82F6" />
                                </View>
                                <Text className="text-white font-bold text-xl text-center mb-2">No results found</Text>
                                <Text className="text-gray-400 text-center text-sm">We couldn't find anyone matching "{query}". Try searching for a different name or username.</Text>
                            </View>
                        ) : (
                            <View className="flex-1 justify-center items-center mt-32 px-8">
                                <View className="w-24 h-24 rounded-full bg-pink-500/20 mb-6 justify-center items-center">
                                    <Ionicons name="people" size={40} color="#EC4899" />
                                </View>
                                <Text className="text-white font-bold text-xl text-center mb-2">Find Friends</Text>
                                <Text className="text-gray-400 text-center text-sm">Search for other music lovers by their username or real name to start following their crates.</Text>
                            </View>
                        )
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}
