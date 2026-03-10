import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Modal, TextInput, Alert, ScrollView, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { collectionApi, musicApi } from '../api/endpoints';
import { CollectionItem, MediaType, MusicSearchResult } from '../types';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

const MEDIA_TYPES: { key: MediaType; label: string; icon: string }[] = [
    { key: 'vinyl', label: 'Vinyl', icon: 'record-vinyl' },
    { key: 'cd', label: 'CD', icon: 'compact-disc' },
    { key: 'cassette', label: 'Cassette', icon: 'tape' },
    { key: 'digital', label: 'Digital', icon: 'music' },
];

export default function CollectionScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const [items, setItems] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterType, setFilterType] = useState<MediaType | 'all'>('all');
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MusicSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedMediaType, setSelectedMediaType] = useState<MediaType>('vinyl');
    const [notes, setNotes] = useState('');
    const [condition, setCondition] = useState('');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await collectionApi.getCollection(
                user?.id,
                filterType === 'all' ? undefined : filterType
            );
            setItems(res.data.items);
        } catch (err) {
            console.error('Failed to load collection:', err);
        }
        setLoading(false);
        setRefreshing(false);
    }, [user?.id, filterType]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await musicApi.search(searchQuery);
            setSearchResults(res.data);
        } catch (err) {
            console.error('Search failed:', err);
        }
        setSearching(false);
    };

    const handleAddToCollection = async (album: MusicSearchResult, addAnother = false) => {
        try {
            await collectionApi.addItem({
                media_type: selectedMediaType,
                album_title: album.album,
                artist: album.artist,
                album_art_url: album.album_art_url,
                notes,
                condition,
            });
            if (addAnother) {
                // Keep modal open, just clear search for next item
                setSearchQuery('');
                setSearchResults([]);
                setNotes('');
                setCondition('');
                Alert.alert('Added!', `${album.album} added. Add another?`);
            } else {
                Alert.alert('Added!', `${album.album} added to your collection`);
                setAddModalVisible(false);
                setSearchQuery('');
                setSearchResults([]);
                setNotes('');
                setCondition('');
            }
            load();
        } catch (err) {
            Alert.alert('Error', 'Failed to add to collection');
        }
    };

    const handleEditItem = (item: CollectionItem) => {
        setEditingItem(item);
        setSelectedMediaType(item.media_type);
        setEditModalVisible(true);
    };

    const handleUpdateItem = async () => {
        if (!editingItem) return;
        try {
            await collectionApi.updateItem(editingItem.id, {
                media_type: selectedMediaType,
            });
            Alert.alert('Updated!', 'Media type updated successfully');
            setEditModalVisible(false);
            setEditingItem(null);
            load();
        } catch (err) {
            Alert.alert('Error', 'Failed to update item');
        }
    };

    const handleRemove = (item: CollectionItem) => {
        Alert.alert('Remove Item', `Remove "${item.album_title}" from your collection?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await collectionApi.removeItem(item.id);
                        load();
                    } catch (err) {
                        Alert.alert('Error', 'Failed to remove item');
                    }
                },
            },
        ]);
    };

    const filteredItems = filterType === 'all' ? items : items.filter(i => i.media_type === filterType);

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
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 34, letterSpacing: -0.5 }}>
                        Collection
                    </Text>
                    <TouchableOpacity
                        onPress={() => setAddModalVisible(true)}
                        style={{
                            backgroundColor: Colors.primary,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                        }}
                    >
                        <Ionicons name="add" size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Filter tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
                    <TouchableOpacity
                        onPress={() => setFilterType('all')}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 18,
                            backgroundColor: filterType === 'all' ? Colors.primary : 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: 'white' }}>
                            All ({items.length})
                        </Text>
                    </TouchableOpacity>
                    {MEDIA_TYPES.map(type => {
                        const count = items.filter(i => i.media_type === type.key).length;
                        return (
                            <TouchableOpacity
                                key={type.key}
                                onPress={() => setFilterType(type.key)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 18,
                                    backgroundColor: filterType === type.key ? Colors.primary : 'rgba(255,255,255,0.1)',
                                }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: 'white' }}>
                                    {type.label} ({count})
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Collection Grid */}
            <FlatList
                data={filteredItems}
                numColumns={2}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => handleEditItem(item)}
                        onLongPress={() => handleRemove(item)}
                        style={{
                            flex: 1,
                            margin: 6,
                            backgroundColor: '#1c1c1e',
                            borderRadius: 12,
                            overflow: 'hidden',
                        }}
                    >
                        {item.album_art_url ? (
                            <Image source={{ uri: item.album_art_url }} style={{ width: '100%', aspectRatio: 1 }} />
                        ) : (
                            <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' }}>
                                <FontAwesome5 name={MEDIA_TYPES.find(t => t.key === item.media_type)?.icon || 'music'} size={40} color="#4b5563" />
                            </View>
                        )}
                        <View style={{ padding: 12 }}>
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                                {item.album_title}
                            </Text>
                            <Text style={{ color: Colors.primary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                                {item.artist}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                <View style={{ backgroundColor: 'rgba(250,36,60,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                    <Text style={{ color: Colors.primary, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        {MEDIA_TYPES.find(t => t.key === item.media_type)?.label}
                                    </Text>
                                </View>
                                {item.condition && (
                                    <Text style={{ color: '#6b7280', fontSize: 10 }}>{item.condition}</Text>
                                )}
                            </View>
                            {item.notes && (
                                <Text style={{ color: '#9ca3af', fontSize: 10, marginTop: 4, fontStyle: 'italic' }} numberOfLines={2}>
                                    {item.notes}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 100, paddingHorizontal: 6 }}
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
                            <FontAwesome5 name="record-vinyl" size={64} color="#374151" />
                            <Text style={{ color: '#6b7280', fontSize: 16, marginTop: 16, textAlign: 'center' }}>
                                Your collection is empty
                            </Text>
                            <Text style={{ color: '#4b5563', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                                Tap + to add your first album
                            </Text>
                        </View>
                    )
                }
            />

            {/* Add to Collection Modal */}
            <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: '#0A0A0F', paddingTop: Platform.OS === 'ios' ? 40 : 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 20 }}>Add to Collection</Text>
                        <TouchableOpacity onPress={() => setAddModalVisible(false)} style={{ padding: 4 }}>
                            <Ionicons name="close" size={28} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Media Type Selector */}
                    <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                            Media Type
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {MEDIA_TYPES.map(type => (
                                <TouchableOpacity
                                    key={type.key}
                                    onPress={() => setSelectedMediaType(type.key)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 12,
                                        borderRadius: 12,
                                        backgroundColor: selectedMediaType === type.key ? Colors.primary : 'rgba(255,255,255,0.05)',
                                        borderWidth: 1,
                                        borderColor: selectedMediaType === type.key ? Colors.primary : 'rgba(255,255,255,0.08)',
                                        alignItems: 'center',
                                    }}
                                >
                                    <FontAwesome5 name={type.icon} size={18} color={selectedMediaType === type.key ? 'white' : '#9ca3af'} />
                                    <Text style={{ color: selectedMediaType === type.key ? 'white' : '#9ca3af', fontSize: 11, fontWeight: '600', marginTop: 4 }}>
                                        {type.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Search */}
                    <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput
                                style={{
                                    flex: 1,
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.08)',
                                }}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search for album..."
                                placeholderTextColor="#4b5563"
                                onSubmitEditing={handleSearch}
                                keyboardAppearance="dark"
                            />
                            <TouchableOpacity
                                onPress={handleSearch}
                                disabled={searching}
                                style={{
                                    backgroundColor: Colors.primary,
                                    borderRadius: 14,
                                    paddingHorizontal: 20,
                                    justifyContent: 'center',
                                }}
                            >
                                {searching ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <Ionicons name="search" size={20} color="white" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Optional fields */}
                    <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                        <TextInput
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                                marginBottom: 12,
                            }}
                            value={condition}
                            onChangeText={setCondition}
                            placeholder="Condition (e.g., Mint, Near Mint)"
                            placeholderTextColor="#4b5563"
                            keyboardAppearance="dark"
                        />
                        <TextInput
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                color: 'white',
                                paddingHorizontal: 16,
                                paddingVertical: 12,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                                textAlignVertical: 'top',
                            }}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Notes (optional)"
                            placeholderTextColor="#4b5563"
                            multiline
                            numberOfLines={3}
                            keyboardAppearance="dark"
                        />
                    </View>

                    {/* Search Results */}
                    <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
                        {searchResults.map((result, idx) => (
                            <View key={idx} style={{ marginBottom: 12 }}>
                                <TouchableOpacity
                                    onPress={() => handleAddToCollection(result, false)}
                                    style={{
                                        flexDirection: 'row',
                                        gap: 12,
                                        padding: 12,
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.08)',
                                    }}
                                >
                                    {result.album_art_url ? (
                                        <Image source={{ uri: result.album_art_url }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                                    ) : (
                                        <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' }}>
                                            <FontAwesome5 name="music" size={20} color="#4b5563" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1, justifyContent: 'center' }}>
                                        <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                                            {result.album}
                                        </Text>
                                        <Text style={{ color: Colors.primary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                                            {result.artist}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleAddToCollection(result, true)}
                                        style={{ justifyContent: 'center', paddingHorizontal: 8 }}
                                    >
                                        <View style={{ alignItems: 'center' }}>
                                            <Ionicons name="add-circle" size={32} color={Colors.primary} />
                                            <Text style={{ color: Colors.primary, fontSize: 9, fontWeight: '600', marginTop: 2 }}>Add Another</Text>
                                        </View>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </Modal>

            {/* Edit Item Modal */}
            <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: '#0A0A0F', paddingTop: Platform.OS === 'ios' ? 40 : 20, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                        <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ padding: 4 }}>
                            <Text style={{ color: '#6b7280', fontSize: 16 }}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Edit Item</Text>
                        <TouchableOpacity onPress={handleUpdateItem} style={{ padding: 4 }}>
                            <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 16 }}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    {editingItem && (
                        <>
                            <View style={{ alignItems: 'center', marginBottom: 28 }}>
                                {editingItem.album_art_url ? (
                                    <Image source={{ uri: editingItem.album_art_url }} style={{ width: 160, height: 160, borderRadius: 12 }} />
                                ) : (
                                    <View style={{ width: 160, height: 160, borderRadius: 12, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' }}>
                                        <FontAwesome5 name="music" size={48} color="#4b5563" />
                                    </View>
                                )}
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, marginTop: 12, textAlign: 'center' }}>
                                    {editingItem.album_title}
                                </Text>
                                <Text style={{ color: Colors.primary, fontSize: 14, marginTop: 4 }}>
                                    {editingItem.artist}
                                </Text>
                            </View>

                            <View>
                                <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                                    Change Media Type
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {MEDIA_TYPES.map(type => (
                                        <TouchableOpacity
                                            key={type.key}
                                            onPress={() => setSelectedMediaType(type.key)}
                                            style={{
                                                flex: 1,
                                                paddingVertical: 16,
                                                borderRadius: 12,
                                                backgroundColor: selectedMediaType === type.key ? Colors.primary : 'rgba(255,255,255,0.05)',
                                                borderWidth: 1,
                                                borderColor: selectedMediaType === type.key ? Colors.primary : 'rgba(255,255,255,0.08)',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <FontAwesome5 name={type.icon} size={24} color={selectedMediaType === type.key ? 'white' : '#9ca3af'} />
                                            <Text style={{ color: selectedMediaType === type.key ? 'white' : '#9ca3af', fontSize: 12, fontWeight: '600', marginTop: 8 }}>
                                                {type.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </>
                    )}
                </View>
            </Modal>
        </View>
    );
}
