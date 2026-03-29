import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { listenLaterApi } from '../api/endpoints';
import { ListenLaterItem } from '../types';
import { Colors } from '../theme';

export default function ListenLaterScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [items, setItems] = useState<ListenLaterItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await listenLaterApi.getAll();
            setItems(res.data || []);
        } catch { }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const removeItem = (item: ListenLaterItem) => {
        Alert.alert('Remove track', `Remove "${item.track_title}" from Listen Later?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await listenLaterApi.remove(item.id);
                        setItems(prev => prev.filter(i => i.id !== item.id));
                    } catch { }
                },
            },
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <View
                style={{
                    paddingTop: insets.top,
                    backgroundColor: '#000',
                    borderBottomWidth: 0.5,
                    borderBottomColor: 'rgba(255,255,255,0.1)',
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 10 }}>
                        <Ionicons name="chevron-back" size={26} color={Colors.primary} />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 }}>Listen Later</Text>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={{ paddingBottom: 90, paddingTop: 8 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => load(true)}
                            tintColor={Colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={{ paddingVertical: 80, alignItems: 'center', paddingHorizontal: 28 }}>
                            <Ionicons name="bookmark-outline" size={56} color="#4b5563" />
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginTop: 14 }}>
                                Nothing saved yet
                            </Text>
                            <Text style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                                Save tracks from posts using the bookmark icon and they will show up here.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View
                            style={{
                                backgroundColor: '#141417',
                                marginHorizontal: 12,
                                marginVertical: 6,
                                borderRadius: 14,
                                padding: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.05)',
                            }}
                        >
                            {item.album_art_url ? (
                                <Image
                                    source={{ uri: item.album_art_url }}
                                    style={{ width: 56, height: 56, borderRadius: 10, marginRight: 12 }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 10,
                                        marginRight: 12,
                                        backgroundColor: '#1f2937',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Ionicons name="musical-notes" size={22} color="#9ca3af" />
                                </View>
                            )}

                            <View style={{ flex: 1 }}>
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                                    {item.track_title}
                                </Text>
                                <Text style={{ color: '#9ca3af', marginTop: 2, fontSize: 13 }} numberOfLines={1}>
                                    {item.artist}{item.album ? ` • ${item.album}` : ''}
                                </Text>
                                <Text style={{ color: '#6b7280', marginTop: 4, fontSize: 12 }}>
                                    Saved {formatDistanceToNow(new Date(item.added_at), { addSuffix: true })}
                                </Text>
                            </View>

                            <TouchableOpacity onPress={() => removeItem(item)} style={{ padding: 8 }}>
                                <Ionicons name="trash-outline" size={20} color="#9ca3af" />
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </View>
    );
}
