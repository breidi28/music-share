import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Modal, TextInput, Alert, ScrollView, Platform, StyleSheet, Text, KeyboardAvoidingView } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { collectionApi, musicApi, postsApi } from '../api/endpoints';
import { CollectionItem, MediaType, MusicSearchResult, CollectionStats } from '../types';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

import { CameraView, useCameraPermissions } from 'expo-camera';
import { InteractiveCDView } from '../components/InteractiveCDView';
import { InteractiveVinylView } from '../components/InteractiveVinylView';

export const MEDIA_TYPES: { key: MediaType; label: string; icon: string }[] = [
    { key: 'vinyl', label: 'Vinyl', icon: 'record-vinyl' },
    { key: 'cd', label: 'CD', icon: 'compact-disc' },
    { key: 'cassette', label: 'Cassette', icon: 'tape' },
    { key: 'digital', label: 'Digital', icon: 'music' },
];

export const CONDITION_OPTIONS = [
    { key: 'mint', label: 'Mint', icon: 'star' },
    { key: 'near-mint', label: 'Near Mint', icon: 'star-half' },
    { key: 'good', label: 'Good', icon: 'thumbs-up' },
    { key: 'fair', label: 'Fair', icon: 'minus' },
    { key: 'poor', label: 'Poor', icon: 'thumbs-down' },
];

// Memoized components for better performance
const VinylMedia = React.memo(({ art }: { art?: string }) => (
    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2f2f2f', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 74, height: 74, borderRadius: 37, borderWidth: 1, borderColor: '#202020', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 58, height: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' }}>
                    {art ? (
                        <Image source={{ uri: art }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                        <FontAwesome5 name="record-vinyl" size={20} color="#4b5563" />
                    )}
                </View>
            </View>
            <View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#e5e7eb' }} />
        </View>
    </View>
));

const CDMedia = React.memo(({ art }: { art?: string }) => (
    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ 
            width: 94, 
            height: 84, 
            borderRadius: 4, 
            backgroundColor: 'rgba(255,255,255,0.05)', 
            borderWidth: 1.5, 
            borderColor: 'rgba(255,255,255,0.1)', 
            padding: 2,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 4, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
        }}>
            <View style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 10 }} />
            <View style={{ flex: 1, backgroundColor: '#0f0f0f', borderRadius: 2, padding: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: 36, 
                    backgroundColor: '#1a1a1a', 
                    borderWidth: 0.5, 
                    borderColor: '#333',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    overflow: 'hidden'
                }}>
                    {/* Iridescent Reflection Layer (Bottom) */}
                    <View style={{ 
                        position: 'absolute', 
                        width: '200%', 
                        height: '200%', 
                        backgroundColor: 'rgba(139, 92, 246, 0.08)', 
                        transform: [{ rotate: '45deg' }],
                        top: '-50%',
                        left: '-50%',
                        zIndex: 1
                    }} />
                    
                    {/* Full-disc Album Art */}
                    <View style={{ 
                        width: 72, 
                        height: 72, 
                        borderRadius: 36, 
                        overflow: 'hidden',
                        zIndex: 2
                    }}>
                        {art ? (
                            <Image source={{ uri: art }} style={{ width: '100%', height: '100%', opacity: 0.95 }} />
                        ) : (
                            <View style={{ flex: 1, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' }}>
                                <FontAwesome5 name="compact-disc" size={24} color="#4b5563" />
                            </View>
                        )}
                    </View>

                    {/* Center Hole (Top) */}
                    <View style={{ 
                        position: 'absolute',
                        width: 14, 
                        height: 14, 
                        borderRadius: 7, 
                        backgroundColor: '#000',
                        borderWidth: 1.5,
                        borderColor: '#374151',
                        zIndex: 3
                    }} />

                    {/* Outer Glossy Ring (Top) */}
                    <View style={{ 
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        borderWidth: 6,
                        borderColor: 'rgba(255,255,255,0.06)',
                        borderRadius: 36,
                        zIndex: 4
                    }} />
                </View>
            </View>
            <View style={{ position: 'absolute', top: 0, left: 20, right: 0, height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <View style={{ position: 'absolute', top: 10, right: 4, width: 2, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1 }} />
        </View>
    </View>
));

const CassetteMedia = React.memo(({ art }: { art?: string }) => (
    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 92, height: 70, borderRadius: 8, backgroundColor: '#2a2a2f', borderWidth: 1, borderColor: '#4b5563', padding: 8 }}>
            <View style={{ flex: 1, borderRadius: 6, backgroundColor: '#111827', paddingHorizontal: 8, paddingVertical: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#6b7280', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#111827' }} />
                    </View>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#6b7280', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#111827' }} />
                    </View>
                </View>
            </View>
            <View style={{ position: 'absolute', left: 10, right: 10, top: 8, height: 12, borderRadius: 4, overflow: 'hidden', backgroundColor: '#374151' }}>
                {art ? (
                    <Image source={{ uri: art }} style={{ width: '100%', height: '100%', opacity: 0.65 }} />
                ) : null}
            </View>
        </View>
    </View>
));

const DigitalMedia = React.memo(({ art }: { art?: string }) => (
    <View style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {art ? (
            <Image source={{ uri: art }} style={{ width: '100%', height: '100%' }} />
        ) : (
            <Ionicons name="musical-notes" size={24} color="#6b7280" />
        )}
        <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ color: '#d1d5db', fontSize: 9, fontWeight: '700' }}>DIGI</Text>
        </View>
    </View>
));

const CollectionItemRow = React.memo(({ 
    item, viewMode, isMyCollection, onEdit, onRemove, onSpin 
}: { 
    item: CollectionItem, 
    viewMode: 'grid' | 'list' | 'shelf', 
    isMyCollection: boolean,
    onEdit: (item: CollectionItem) => void,
    onRemove: (item: CollectionItem) => void,
    onSpin: (item: CollectionItem) => void
}) => {
    const isGrid = viewMode === 'grid';
    const isList = viewMode === 'list';
    const isShelf = viewMode === 'shelf';

    const renderMedia = () => {
        const art = item.album_art_url;
        if (!isShelf) {
            if (art) {
                return (
                    <Image
                        source={{ uri: art }}
                        style={{
                            width: isGrid ? '100%' : 80,
                            aspectRatio: 1,
                            borderRadius: isGrid ? 0 : 8,
                        }}
                    />
                );
            }
            return (
                <View
                    style={{
                        width: isGrid ? '100%' : 80,
                        aspectRatio: 1,
                        backgroundColor: '#1f2937',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: isGrid ? 0 : 8,
                    }}
                >
                    <FontAwesome5
                        name={MEDIA_TYPES.find(t => t.key === item.media_type)?.icon || 'music'}
                        size={isGrid ? 40 : 24}
                        color="#4b5563"
                    />
                </View>
            );
        }

        switch (item.media_type) {
            case 'vinyl': return <VinylMedia art={art} />;
            case 'cd': return <CDMedia art={art} />;
            case 'cassette': return <CassetteMedia art={art} />;
            default: return <DigitalMedia art={art} />;
        }
    };

    return (
        <TouchableOpacity
            onPress={isMyCollection ? () => onEdit(item) : undefined}
            activeOpacity={isMyCollection ? 0.2 : 1}
            style={{
                flex: isGrid || isShelf ? 1 : undefined,
                margin: isGrid ? 6 : (isShelf ? 0 : 6),
                backgroundColor: isShelf ? 'transparent' : '#1c1c1e',
                borderRadius: isShelf ? 0 : 12,
                overflow: isShelf ? 'visible' : 'hidden',
                flexDirection: isGrid || isShelf ? 'column' : 'row',
                padding: isGrid ? 0 : (isShelf ? 12 : 8),
                paddingBottom: isShelf ? 24 : (isGrid ? 0 : 8),
                alignItems: isGrid ? 'stretch' : 'center',
                minHeight: isShelf ? 170 : undefined,
            }}
        >
            {isShelf ? (
                <View style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.6,
                    shadowRadius: 8,
                    elevation: 10,
                    marginBottom: 12,
                    marginTop: 4,
                }}>
                    {renderMedia()}
                </View>
            ) : renderMedia()}

            <View style={{ padding: isShelf ? 2 : 12, flex: 1, justifyContent: isShelf ? 'flex-start' : 'center', alignItems: isShelf ? 'center' : 'stretch', marginTop: isShelf ? 4 : 0 }}>
                <Text style={{ color: isShelf ? '#d1d5db' : 'white', fontWeight: '600', fontSize: isShelf ? 10 : 13, textAlign: isShelf ? 'center' : 'left' }} numberOfLines={1}>
                    {item.album_title}
                </Text>
                {!isShelf && (
                    <Text style={{ color: Colors.primary, fontSize: 11, marginTop: 2, textAlign: 'left' }} numberOfLines={1}>
                        {item.artist}
                    </Text>
                )}
                {!isShelf && (
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
                )}
                {isList && item.purchase_date && (
                    <Text style={{ color: '#6b7280', fontSize: 10, marginTop: 4 }}>
                        <Ionicons name="calendar-outline" size={10} color="#6b7280" /> {new Date(item.purchase_date).toLocaleDateString()}
                    </Text>
                )}
                {isList && item.notes && (
                    <Text style={{ color: '#9ca3af', fontSize: 10, marginTop: 4, fontStyle: 'italic' }} numberOfLines={2}>
                        {item.notes}
                    </Text>
                )}
            </View>

            {isMyCollection && !isGrid && !isShelf && (
                <TouchableOpacity onPress={() => onSpin(item)} style={{ padding: 16 }}>
                    <FontAwesome5 name="compact-disc" size={24} color="#10B981" />
                </TouchableOpacity>
            )}

            {isShelf && (
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 16,
                        backgroundColor: '#3d2b1f',
                        borderTopWidth: 2,
                        borderTopColor: '#5c4033',
                    }}
                >
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                    <View style={{ height: 2, backgroundColor: 'rgba(0,0,0,0.2)' }} />
                </View>
            )}
        </TouchableOpacity>
    );
});

export default function CollectionScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const { userId, username } = route?.params ?? {};
    const viewingUserId = userId ?? user?.id;
    const isMyCollection = viewingUserId === user?.id;
    
    const [items, setItems] = useState<CollectionItem[]>([]);
    const [stats, setStats] = useState<CollectionStats | null>(null);
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
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    
    // View state
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'shelf'>('grid');
    const [smartShelf, setSmartShelf] = useState<'all' | 'recent' | 'top-artist' | 'mint' | 'needs-notes'>('all');
    const [discographyLoading, setDiscographyLoading] = useState(false);
    const [discographyProgress, setDiscographyProgress] = useState<{
        artist: string;
        totalKnown: number;
        ownedCount: number;
        missingAlbums: MusicSearchResult[];
    } | null>(null);
    const [inspectModalVisible, setInspectModalVisible] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const res = await collectionApi.getCollection(
                viewingUserId,
                filterType === 'all' ? undefined : filterType
            );
            setItems(res.data.items);
            if (res.data.stats) {
                setStats(res.data.stats);
            }
        } catch (err) {
            console.error('Failed to load collection:', err);
        }
        setLoading(false);
        setRefreshing(false);
    }, [viewingUserId, filterType]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim().length > 0) {
                handleSearch();
            } else if (searchQuery.trim().length === 0) {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const topArtistName = useMemo(() => {
        if (stats?.top_artist) return stats.top_artist;
        if (!items.length) return null;
        const artistCounts = items.reduce<Record<string, number>>((acc, item) => {
            const key = (item.artist || '').trim();
            if (!key) return acc;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const top = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0];
        return top?.[0] ?? null;
    }, [items, stats?.top_artist]);

    const normalizeAlbumTitle = (title: string) =>
        (title || '')
            .toLowerCase()
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\b(deluxe|expanded|remaster(ed)?|anniversary|edition|version)\b/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();

    const isLikelySingleOrEP = (albumTitle: string) => {
        const name = (albumTitle || '').toLowerCase().trim();
        return name.includes('single') || /\bep\b/.test(name);
    };

    const loadDiscographyProgress = useCallback(async () => {
        if (!topArtistName || !items.length) {
            setDiscographyProgress(null);
            return;
        }

        setDiscographyLoading(true);
        try {
            const res = await musicApi.searchAlbums(topArtistName, true);
            const results = (Array.isArray(res.data) ? res.data : []).filter(r => !isLikelySingleOrEP(r.album));

            const artistOwned = items.filter(
                i => (i.artist || '').toLowerCase().trim() === topArtistName.toLowerCase().trim()
            );

            const ownedAlbumKeys = new Set(
                artistOwned
                    .map(i => normalizeAlbumTitle(i.album_title))
                    .filter(Boolean)
            );

            const seen = new Set<string>();
            const catalog = results.filter(r => {
                const key = normalizeAlbumTitle(r.album);
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            const missingAlbums = catalog.filter(r => !ownedAlbumKeys.has(normalizeAlbumTitle(r.album))).slice(0, 8);
            const ownedKnown = catalog.reduce((count, album) => {
                const key = normalizeAlbumTitle(album.album);
                return count + (ownedAlbumKeys.has(key) ? 1 : 0);
            }, 0);

            setDiscographyProgress({
                artist: topArtistName,
                totalKnown: catalog.length,
                ownedCount: ownedKnown,
                missingAlbums,
            });
        } catch (err) {
            console.error('Failed to load discography progress:', err);
            setDiscographyProgress(null);
        } finally {
            setDiscographyLoading(false);
        }
    }, [items, topArtistName]);

    useEffect(() => {
        loadDiscographyProgress();
    }, [loadDiscographyProgress]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await musicApi.searchAlbums(searchQuery);
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
                // Keep modal open, don't clear search so user can add variations
                setNotes('');
                setCondition('');
                Toast.show({ type: 'success', text1: 'Added!', text2: `${album.album} added.` });
            } else {
                Toast.show({ type: 'success', text1: 'Added!', text2: `${album.album} added to your collection` });
                setAddModalVisible(false);
                // Clear state when closing modal
                setSearchQuery('');
                setSearchResults([]);
                setNotes('');
                setCondition('');
            }
            load();
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add to collection' });
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
            Toast.show({ type: 'success', text1: 'Updated!', text2: 'Collection item updated successfully' });
            setEditModalVisible(false);
            setEditingItem(null);
            load();
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update item' });
        }
    };

    const handleSpin = async (item: CollectionItem) => {
        try {
            await postsApi.create({
                track_title: item.album_title,
                artist: item.artist,
                album: item.album_title,
                album_art_url: item.album_art_url,
                post_type: 'spin',
                caption: `Spinning from my collection (${item.media_type})`,
            });
            Toast.show({ type: 'success', text1: 'Spun!', text2: 'Added to your activity feed' });
            setEditModalVisible(false);
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to spin item' });
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
                        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to remove item' });
                    }
                },
            },
        ]);
    };

    const handleOpenScanner = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Camera permission is needed to scan barcodes' });
                return;
            }
        }
        setScannerVisible(true);
        setScanned(false);
    };

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned) return;
        setScanned(true);
        setScannerVisible(false);
        
        // Show loading
        Toast.show({ type: 'info', text1: 'Scanning...', text2: 'Looking up album information' });
        
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
            
            Toast.show({ type: 'success', text1: 'Added!', text2: `${albumData.album} by ${albumData.artist} added to your collection` });
            load();
            
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Not Found', text2: 'Could not find album information for this barcode.' });
        }
    };

    const mediaFilteredItems = filterType === 'all' ? items : items.filter(i => i.media_type === filterType);

    const smartFilteredItems = useMemo(() => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        if (smartShelf === 'recent') {
            return mediaFilteredItems.filter(item => {
                const created = new Date(item.created_at);
                return !Number.isNaN(created.getTime()) && created >= thirtyDaysAgo;
            });
        }

        if (smartShelf === 'top-artist' && topArtistName) {
            const target = topArtistName.toLowerCase().trim();
            return mediaFilteredItems.filter(item => (item.artist || '').toLowerCase().trim() === target);
        }

        if (smartShelf === 'mint') {
            return mediaFilteredItems.filter(item => {
                const c = (item.condition || '').toLowerCase();
                return c.includes('mint');
            });
        }

        if (smartShelf === 'needs-notes') {
            return mediaFilteredItems.filter(item => !(item.notes || '').trim());
        }

        return mediaFilteredItems;
    }, [mediaFilteredItems, smartShelf, topArtistName]);

    const renderCollectionItem = useCallback(({ item }: { item: CollectionItem }) => (
        <CollectionItemRow 
            item={item} 
            viewMode={viewMode} 
            isMyCollection={isMyCollection} 
            onEdit={handleEditItem}
            onRemove={handleRemove}
            onSpin={handleSpin}
        />
    ), [viewMode, isMyCollection, handleEditItem, handleRemove, handleSpin]);

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
                <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {!isMyCollection && (
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={{ padding: 4, marginRight: 12 }}
                        >
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: isMyCollection ? 30 : 22, letterSpacing: -0.4 }}>
                            {isMyCollection ? 'Collection' : `${username}'s Collection`}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate('ArtistProgress', {
                                    userId: viewingUserId,
                                    username: isMyCollection ? user?.username : username,
                                })
                            }
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                borderRadius: 20,
                                paddingHorizontal: 11,
                                paddingVertical: 8,
                            }}
                        >
                            <Ionicons name="stats-chart" size={16} color="white" />
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 3 }}>
                            <TouchableOpacity
                                onPress={() => setViewMode('grid')}
                                style={{
                                    paddingHorizontal: 9,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                    backgroundColor: viewMode === 'grid' ? 'rgba(255,255,255,0.22)' : 'transparent',
                                }}
                            >
                                <Ionicons name="grid" size={16} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setViewMode('list')}
                                style={{
                                    paddingHorizontal: 9,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                    backgroundColor: viewMode === 'list' ? 'rgba(255,255,255,0.22)' : 'transparent',
                                }}
                            >
                                <Ionicons name="list" size={16} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setViewMode('shelf')}
                                style={{
                                    paddingHorizontal: 9,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                    backgroundColor: viewMode === 'shelf' ? 'rgba(255,255,255,0.22)' : 'transparent',
                                }}
                            >
                                <Ionicons name="albums" size={16} color="white" />
                            </TouchableOpacity>
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
                </View>

            </View>

                        {/* Collection Grid */}
            <FlatList
                key={viewMode}
                data={smartFilteredItems}
                numColumns={viewMode === 'grid' ? 2 : viewMode === 'shelf' ? 3 : 1}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderCollectionItem}
                contentContainerStyle={{ 
                    paddingBottom: 100, 
                    paddingHorizontal: viewMode === 'shelf' ? 0 : 6,
                    backgroundColor: viewMode === 'shelf' ? '#120d0b' : 'transparent'
                }}
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => load(true)}
                        tintColor={Colors.primary}
                    />
                }
                ListHeaderComponent={
                    <>
                        {/* Collection Stats */}
                        {stats && stats.total > 0 && (
                            <View style={{ paddingHorizontal: 10, paddingBottom: 12, paddingTop: 10 }}>
                                <View style={{ flexDirection: 'row', backgroundColor: '#111', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#222' }}>
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>Total</Text>
                                        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>{stats.total}</Text>
                                    </View>
                                    <View style={{ width: 1, backgroundColor: '#333', marginHorizontal: 8 }} />
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>Vinyls</Text>
                                        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>{stats.vinyl_count}</Text>
                                    </View>
                                    <View style={{ width: 1, backgroundColor: '#333', marginHorizontal: 8 }} />
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>CDs</Text>
                                        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>{stats.cd_count}</Text>
                                    </View>
                                </View>
                                {stats.top_artist && (
                                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                                        Top Artist: <Text style={{ color: Colors.primary, fontWeight: '600' }}>{stats.top_artist}</Text>
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Filter tabs */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 0 }} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 12, gap: 8 }}>
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

                        {/* Smart Shelves */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 12, gap: 8 }}>
                            {[
                                { key: 'all', label: `All (${mediaFilteredItems.length})` },
                                { key: 'recent', label: 'Recent Finds' },
                                { key: 'top-artist', label: topArtistName ? `Top Artist: ${topArtistName}` : 'Top Artist' },
                                { key: 'mint', label: 'Mint/Near Mint' },
                                { key: 'needs-notes', label: 'Needs Notes' },
                            ].map(shelf => (
                                <TouchableOpacity
                                    key={shelf.key}
                                    onPress={() => setSmartShelf(shelf.key as 'all' | 'recent' | 'top-artist' | 'mint' | 'needs-notes')}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 7,
                                        borderRadius: 18,
                                        backgroundColor: smartShelf === shelf.key ? '#fff' : 'rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: smartShelf === shelf.key ? '#111' : '#fff' }}>
                                        {shelf.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Complete This Artist Discography */}
                        {!!discographyProgress && (
                            <View style={{ paddingHorizontal: 10, paddingBottom: 14 }}>
                                <View style={{ backgroundColor: '#101014', borderRadius: 14, borderWidth: 1, borderColor: '#23232a', padding: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flex: 1, paddingRight: 12 }}>
                                            <Text style={{ color: '#d1d5db', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                                Complete This Artist
                                            </Text>
                                            <Text style={{ color: 'white', fontSize: 17, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
                                                {discographyProgress.artist}
                                            </Text>
                                            <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                                                {discographyProgress.ownedCount}/{discographyProgress.totalKnown} albums in your collection
                                            </Text>
                                        </View>
                                        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(250,36,60,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: Colors.primary, fontWeight: '800', fontSize: 16 }}>
                                                {discographyProgress.totalKnown > 0
                                                    ? `${Math.round((discographyProgress.ownedCount / discographyProgress.totalKnown) * 100)}%`
                                                    : '0%'}
                                            </Text>
                                        </View>
                                    </View>

                                    {!!discographyProgress.missingAlbums.length && (
                                        <>
                                            <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 12, marginBottom: 8 }}>
                                                Missing picks
                                            </Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                                {discographyProgress.missingAlbums.map((album, idx) => (
                                                    <View key={`${album.track_id}-${idx}`} style={{ width: 126 }}>
                                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                                                            {album.album_art_url ? (
                                                                <Image source={{ uri: album.album_art_url }} style={{ width: '100%', aspectRatio: 1 }} />
                                                            ) : (
                                                                <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <FontAwesome5 name="music" size={20} color="#4b5563" />
                                                                </View>
                                                            )}
                                                            <View style={{ padding: 8 }}>
                                                                <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }} numberOfLines={2}>
                                                                    {album.album}
                                                                </Text>
                                                                {isMyCollection && (
                                                                    <TouchableOpacity
                                                                        onPress={() => handleAddToCollection(album, true)}
                                                                        style={{ marginTop: 8, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 6, alignItems: 'center' }}
                                                                    >
                                                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>Add</Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))}
                                            </ScrollView>
                                        </>
                                    )}

                                    {discographyLoading && (
                                        <View style={{ marginTop: 10, alignItems: 'center' }}>
                                            <ActivityIndicator color={Colors.primary} size="small" />
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </>
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={{ paddingVertical: 60, alignItems: "center" }}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : (
                        <View style={{ paddingVertical: 60, alignItems: "center", paddingHorizontal: 40 }}>
                            <FontAwesome5 name="record-vinyl" size={64} color="#374151" />
                            <Text style={{ color: "#6b7280", fontSize: 16, marginTop: 16, textAlign: "center" }}>
                                {isMyCollection ? "No matches in this shelf yet" : "This collection is empty"}
                            </Text>
                            {isMyCollection && (
                                <Text style={{ color: "#4b5563", fontSize: 13, marginTop: 8, textAlign: "center" }}>
                                    {items.length ? "Try another smart shelf or media filter" : "Tap + to add your first album"}
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
                                            <Text style={{ color: Colors.primary, fontSize: 9, fontWeight: '600', marginTop: 2 }}>Add</Text>
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
                                    
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                                        <TouchableOpacity 
                                            onPress={() => handleSpin(editingItem)}
                                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }}
                                        >
                                            <Ionicons name="disc" size={20} color="white" style={{ marginRight: 8 }} />
                                            <Text style={{ color: 'white', fontWeight: '600' }}>Spin to Feed</Text>
                                        </TouchableOpacity>
                                        
                                        {(editingItem.media_type === 'cd' || editingItem.media_type === 'vinyl') && (
                                            <TouchableOpacity 
                                                onPress={() => setInspectModalVisible(true)}
                                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                                            >
                                                <Ionicons name="eye-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                                <Text style={{ color: 'white', fontWeight: '600' }}>
                                                    {editingItem.media_type === 'cd' ? 'View Disc' : 'View Record'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
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

                                {/* Delete Button */}
                                <TouchableOpacity
                                    onPress={() => {
                                        setEditModalVisible(false);
                                        handleRemove(editingItem);
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingVertical: 14,
                                        marginTop: 8,
                                        marginBottom: 32,
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        borderWidth: 1,
                                        borderColor: 'rgba(239, 68, 68, 0.2)',
                                        borderRadius: 12,
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 16 }}>
                                        Remove from Collection
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </ScrollView>

                    {/* Interactive CD Viewer Modal (Nested inside Edit Modal for correct layering) */}
                    <Modal 
                        visible={inspectModalVisible} 
                        animationType="fade" 
                        transparent={true}
                        statusBarTranslucent={true}
                        onRequestClose={() => setInspectModalVisible(false)}
                    >
                        {editingItem && (
                            editingItem.media_type === 'cd' ? (
                                <InteractiveCDView 
                                    albumArt={editingItem.album_art_url}
                                    albumTitle={editingItem.album_title}
                                    artist={editingItem.artist}
                                    onClose={() => setInspectModalVisible(false)}
                                />
                            ) : (
                                <InteractiveVinylView 
                                    albumArt={editingItem.album_art_url}
                                    albumTitle={editingItem.album_title}
                                    artist={editingItem.artist}
                                    onClose={() => setInspectModalVisible(false)}
                                />
                            )
                        )}
                    </Modal>

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

                    {!permission?.granted ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                            <Ionicons name="camera" size={64} color="#4b5563" />
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
                                Camera Permission Required
                            </Text>
                            <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                                We need camera access to scan barcodes. Please enable it.
                            </Text>
                            <TouchableOpacity
                                onPress={requestPermission}
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
                    ) : (
                        <View style={{ flex: 1 }}>
                            <CameraView
                                onBarcodeScanned={scanned ? undefined : ({ data }) => handleBarCodeScanned({ type: 'barcode', data })}
                                style={StyleSheet.absoluteFillObject}
                                barcodeScannerSettings={{
                                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                                }}
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
                    )}
                </View>
            </Modal>
        </View>
    );
}

