import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Modal, TextInput, Alert, ScrollView, Platform, StyleSheet, Text, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { collectionApi, musicApi } from '../api/endpoints';
import { CollectionItem, MediaType, MusicSearchResult } from '../types';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

// Try to import BarCodeScanner, but make it optional
let BarCodeScanner: any = null;
try {
  const barcodeModule = require('expo-barcode-scanner');
  BarCodeScanner = barcodeModule.BarCodeScanner;
} catch (e) {
  console.log('BarCodeScanner not available - feature will be disabled');
}

const MEDIA_TYPES: { key: MediaType; label: string; icon: string }[] = [
    { key: 'vinyl', label: 'Vinyl', icon: 'record-vinyl' },
    { key: 'cd', label: 'CD', icon: 'compact-disc' },
    { key: 'cassette', label: 'Cassette', icon: 'tape' },
    { key: 'digital', label: 'Digital', icon: 'music' },
];

const CONDITION_OPTIONS = [
    { key: 'mint', label: 'Mint', icon: 'star' },
    { key: 'near-mint', label: 'Near Mint', icon: 'star-half' },
    { key: 'good', label: 'Good', icon: 'thumbs-up' },
    { key: 'fair', label: 'Fair', icon: 'minus' },
    { key: 'poor', label: 'Poor', icon: 'thumbs-down' },
];

export default function CollectionScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { userId, username } = route?.params ?? {};
    const viewingUserId = userId ?? user?.id;
    const isMyCollection = viewingUserId === user?.id;
    
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
    const [releaseYear, setReleaseYear] = useState('');
    const [purchaseDate, setPurchaseDate] = useState('');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
    
    // Barcode scanner state
    const [scannerVisible, setScannerVisible] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await collectionApi.getCollection(
                viewingUserId,
                filterType === 'all' ? undefined : filterType
            );
            setItems(res.data.items);
        } catch (err) {
            console.error('Failed to load collection:', err);
        }
        setLoading(false);
        setRefreshing(false);
    }, [viewingUserId, filterType]);

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
        setCondition(item.condition || '');
        setNotes(item.notes || '');
        setReleaseYear(item.release_year?.toString() || '');
        setPurchaseDate(item.purchase_date || '');
        setEditModalVisible(true);
    };

    const handleUpdateItem = async () => {
        if (!editingItem) return;
        try {
            await collectionApi.updateItem(editingItem.id, {
                media_type: selectedMediaType,
                condition: condition.trim(),
                notes: notes.trim(),
                release_year: releaseYear ? parseInt(releaseYear) : undefined,
                purchase_date: purchaseDate.trim() || undefined,
            });
            Alert.alert('Updated!', 'Collection item updated successfully');
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

    const requestCameraPermission = async () => {
        if (!BarCodeScanner) return false;
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        return status === 'granted';
    };

    const handleOpenScanner = async () => {
        if (!BarCodeScanner) {
            Alert.alert(
                'Feature Not Available',
                'Barcode scanning requires a development build. Run "npx expo run:android" or "npx expo run:ios" to enable this feature.',
                [{ text: 'OK' }]
            );
            return;
        }
        const granted = await requestCameraPermission();
        if (granted) {
            setScannerVisible(true);
            setScanned(false);
        } else {
            Alert.alert('Permission Required', 'Camera permission is needed to scan barcodes');
        }
    };

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned) return;
        setScanned(true);
        setScannerVisible(false);
        
        // Show loading
        Alert.alert('Scanning...', 'Looking up album information');
        
        try {
            const res = await musicApi.searchByBarcode(data);
            const albumData = res.data;
            
            // Auto-fill and add to collection
            await collectionApi.addItem({
                media_type: selectedMediaType,
                album_title: albumData.album,
                artist: albumData.artist,
                album_art_url: albumData.album_art_url,
                notes: `Scanned barcode: ${data}`,
                condition: '',
            });
            
            Alert.alert('Added!', `${albumData.album} by ${albumData.artist} added to your collection`);
            load();
            
        } catch (err: any) {
            Alert.alert(
                'Not Found',
                'Could not find album information for this barcode. Try manual search instead.',
                [{ text: 'OK' }]
            );
        }
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
                    {!isMyCollection && (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={{ padding: 4, marginRight: 12 }}
                        >
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: isMyCollection ? 34 : 24, letterSpacing: -0.5 }}>
                            {isMyCollection ? 'Collection' : `${username}'s Collection`}
                        </Text>
                    </View>
                    {isMyCollection && (
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
                    )}
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
                        onPress={isMyCollection ? () => handleEditItem(item) : undefined}
                        onLongPress={isMyCollection ? () => handleRemove(item) : undefined}
                        activeOpacity={isMyCollection ? 0.2 : 1}
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
                            {item.purchase_date && (
                                <Text style={{ color: '#6b7280', fontSize: 10, marginTop: 4 }}>
                                    <Ionicons name="calendar-outline" size={10} color="#6b7280" /> {new Date(item.purchase_date).toLocaleDateString()}
                                </Text>
                            )}
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
                                {isMyCollection ? 'Your collection is empty' : 'This collection is empty'}
                            </Text>
                            {isMyCollection && (
                                <Text style={{ color: '#4b5563', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                                    Tap + to add your first album
                                </Text>
                            )}
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
                                onPress={handleOpenScanner}
                                style={{
                                    backgroundColor: 'rgba(147,51,234,0.15)',
                                    borderRadius: 14,
                                    paddingHorizontal: 18,
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: 'rgba(147,51,234,0.3)',
                                }}
                            >
                                <Ionicons name="barcode-outline" size={20} color="#a855f7" />
                            </TouchableOpacity>
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
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={{ flex: 1, backgroundColor: '#0A0A0F', paddingTop: Platform.OS === 'ios' ? 40 : 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 }}>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ padding: 4 }}>
                                <Text style={{ color: '#6b7280', fontSize: 16 }}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>Edit Item</Text>
                            <TouchableOpacity onPress={handleUpdateItem} style={{ padding: 4 }}>
                                <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 16 }}>Save</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                        {editingItem && (
                            <>
                                {/* Album Info Header */}
                                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                                    {editingItem.album_art_url ? (
                                        <Image source={{ uri: editingItem.album_art_url }} style={{ width: 140, height: 140, borderRadius: 12 }} />
                                    ) : (
                                        <View style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' }}>
                                            <FontAwesome5 name="music" size={40} color="#4b5563" />
                                        </View>
                                    )}
                                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 18, marginTop: 12, textAlign: 'center' }}>
                                        {editingItem.album_title}
                                    </Text>
                                    <Text style={{ color: Colors.primary, fontSize: 14, marginTop: 4 }}>
                                        {editingItem.artist}
                                    </Text>
                                </View>

                                {/* Media Type */}
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                                        Media Type
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {MEDIA_TYPES.map(type => (
                                            <TouchableOpacity
                                                key={type.key}
                                                onPress={() => setSelectedMediaType(type.key)}
                                                style={{
                                                    flex: 1,
                                                    paddingVertical: 14,
                                                    borderRadius: 10,
                                                    backgroundColor: selectedMediaType === type.key ? Colors.primary : 'rgba(255,255,255,0.05)',
                                                    borderWidth: 1,
                                                    borderColor: selectedMediaType === type.key ? Colors.primary : 'rgba(255,255,255,0.08)',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <FontAwesome5 name={type.icon} size={20} color={selectedMediaType === type.key ? 'white' : '#9ca3af'} />
                                                <Text style={{ color: selectedMediaType === type.key ? 'white' : '#9ca3af', fontSize: 11, fontWeight: '600', marginTop: 6 }}>
                                                    {type.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Condition */}
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                                        Condition
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                        {CONDITION_OPTIONS.map(cond => (
                                            <TouchableOpacity
                                                key={cond.key}
                                                onPress={() => setCondition(cond.key)}
                                                style={{
                                                    paddingHorizontal: 14,
                                                    paddingVertical: 10,
                                                    borderRadius: 8,
                                                    backgroundColor: condition === cond.key ? Colors.primary : 'rgba(255,255,255,0.05)',
                                                    borderWidth: 1,
                                                    borderColor: condition === cond.key ? Colors.primary : 'rgba(255,255,255,0.08)',
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                }}
                                            >
                                                <FontAwesome5 name={cond.icon} size={12} color={condition === cond.key ? 'white' : '#9ca3af'} />
                                                <Text style={{ color: condition === cond.key ? 'white' : '#9ca3af', fontSize: 13, fontWeight: '600' }}>
                                                    {cond.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Release Year */}
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                                        Release Year (Optional)
                                    </Text>
                                    <TextInput
                                        value={releaseYear}
                                        onChangeText={setReleaseYear}
                                        placeholder="e.g., 1985"
                                        placeholderTextColor="#4b5563"
                                        keyboardType="numeric"
                                        maxLength={4}
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.08)',
                                            borderRadius: 10,
                                            paddingHorizontal: 16,
                                            paddingVertical: 14,
                                            color: 'white',
                                            fontSize: 15,
                                        }}
                                    />
                                </View>

                                {/* Purchase Date */}
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                                        Purchase Date (Optional)
                                    </Text>
                                    <TextInput
                                        value={purchaseDate}
                                        onChangeText={setPurchaseDate}
                                        placeholder="YYYY-MM-DD (e.g., 2024-03-15)"
                                        placeholderTextColor="#4b5563"
                                        maxLength={10}
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.08)',
                                            borderRadius: 10,
                                            paddingHorizontal: 16,
                                            paddingVertical: 14,
                                            color: 'white',
                                            fontSize: 15,
                                        }}
                                    />
                                    <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 6 }}>
                                        Format: YYYY-MM-DD
                                    </Text>
                                </View>

                                {/* Notes */}
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                                        Personal Notes (Optional)
                                    </Text>
                                    <TextInput
                                        value={notes}
                                        onChangeText={setNotes}
                                        placeholder="Add notes about this item..."
                                        placeholderTextColor="#4b5563"
                                        multiline
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                        maxLength={500}
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.08)',
                                            borderRadius: 10,
                                            paddingHorizontal: 16,
                                            paddingVertical: 14,
                                            color: 'white',
                                            fontSize: 15,
                                            minHeight: 100,
                                        }}
                                    />
                                    <Text style={{ color: '#4b5563', fontSize: 11, marginTop: 6, textAlign: 'right' }}>
                                        {notes.length}/500
                                    </Text>
                                </View>
                            </>
                        )}
                    </ScrollView>
                </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Barcode Scanner Modal */}
            <Modal visible={scannerVisible} animationType="slide" presentationStyle="fullScreen">
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={{ paddingTop: insets.top, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 20 }}>Scan Barcode</Text>
                        <TouchableOpacity
                            onPress={() => setScannerVisible(false)}
                            style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 }}
                        >
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    {hasPermission === null ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                            <Text style={{ color: '#9ca3af', marginTop: 16 }}>Requesting camera permission...</Text>
                        </View>
                    ) : hasPermission === false ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                            <Ionicons name="camera-off" size={64} color="#4b5563" />
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
                                Camera Permission Required
                            </Text>
                            <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                                We need camera access to scan barcodes. Please enable it in your device settings.
                            </Text>
                            <TouchableOpacity
                                onPress={requestCameraPermission}
                                style={{
                                    marginTop: 24,
                                    backgroundColor: Colors.primary,
                                    paddingHorizontal: 24,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                }}
                            >
                                <Text style={{ color: 'white', fontWeight: '600' }}>Request Permission</Text>
                            </TouchableOpacity>
                        </View>
                    ) : BarCodeScanner ? (
                        <View style={{ flex: 1 }}>
                            <BarCodeScanner
                                onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                                style={StyleSheet.absoluteFillObject}
                                barCodeTypes={[
                                    'ean13',
                                    'ean8',
                                    'upc_a',
                                    'upc_e',
                                ]}
                            />
                            {/* Scanning overlay */}
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <View style={{
                                    width: 280,
                                    height: 280,
                                    borderWidth: 2,
                                    borderColor: Colors.primary,
                                    borderRadius: 20,
                                    backgroundColor: 'transparent',
                                }} />
                                <Text style={{
                                    color: 'white',
                                    fontSize: 16,
                                    fontWeight: '600',
                                    marginTop: 32,
                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                    paddingHorizontal: 20,
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                }}>
                                    Align barcode within the frame
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                            <Ionicons name="construct" size={64} color="#4b5563" />
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
                                Development Build Required
                            </Text>
                            <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                                Run "npx expo run:android" or "npx expo run:ios" to enable barcode scanning.
                            </Text>
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
}
