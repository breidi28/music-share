import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collectionApi } from '../api/endpoints';
import { ArtistDiscographyProgressDetail, ArtistDiscographyProgressSummary } from '../types';
import { Colors } from '../theme';
import { musicApi } from '../api/endpoints';

export default function ArtistProgressScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { userId, username } = route?.params ?? {};

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [artists, setArtists] = useState<ArtistDiscographyProgressSummary[]>([]);
    const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
    const [detailsByArtist, setDetailsByArtist] = useState<Record<string, ArtistDiscographyProgressDetail>>({});
    const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
    const [fallbackMode, setFallbackMode] = useState(false);

    const normalizeTitle = (title: string) =>
        (title || '')
            .toLowerCase()
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\b(deluxe|expanded|remaster(ed)?|anniversary|edition|version)\b/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();

    const getArtistCatalog = useCallback(async (artist: string) => {
        const res = await musicApi.searchAlbums(artist, true);
        const items = Array.isArray(res.data) ? res.data : [];
        const artistLc = artist.toLowerCase().trim();
        const seen = new Set<string>();

        return items.filter(album => {
            const key = normalizeTitle(album.album);
            const byArtist = (album.artist || '').toLowerCase().trim() === artistLc;
            if (!byArtist || !key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, []);

    const buildFallbackSummary = useCallback(async (): Promise<ArtistDiscographyProgressSummary[]> => {
        const collRes = await collectionApi.getCollection(userId);
        const items = Array.isArray(collRes.data?.items) ? collRes.data.items : [];

        const byArtist = new Map<string, typeof items>();
        items.forEach(item => {
            const artist = (item.artist || '').trim();
            if (!artist) return;
            if (!byArtist.has(artist)) byArtist.set(artist, []);
            byArtist.get(artist)!.push(item);
        });

        const candidates = Array.from(byArtist.entries())
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 24);

        const summaries = await Promise.all(
            candidates.map(async ([artist, artistItems]) => {
                const ownedKeys = new Set(
                    artistItems
                        .map(i => normalizeTitle(i.album_title))
                        .filter(Boolean)
                );

                const catalog = await getArtistCatalog(artist);
                const catalogKeys = new Set(catalog.map(a => normalizeTitle(a.album)).filter(Boolean));

                const totalKnown = catalogKeys.size || ownedKeys.size;
                const ownedCount = catalogKeys.size
                    ? Array.from(ownedKeys).filter(k => catalogKeys.has(k)).length
                    : ownedKeys.size;

                const missingPreview = catalog
                    .filter(a => !ownedKeys.has(normalizeTitle(a.album)))
                    .slice(0, 3)
                    .map(a => a.album);

                const completionPct = totalKnown > 0 ? Math.round((ownedCount / totalKnown) * 100) : 0;

                return {
                    artist,
                    owned_count: ownedCount,
                    total_known: totalKnown,
                    missing_count: Math.max(totalKnown - ownedCount, 0),
                    completion_pct: completionPct,
                    missing_preview: missingPreview,
                };
            })
        );

        return summaries.sort((a, b) => {
            if (a.completion_pct !== b.completion_pct) return a.completion_pct - b.completion_pct;
            return b.total_known - a.total_known;
        });
    }, [getArtistCatalog, userId]);

    const title = useMemo(() => {
        if (username) return `${username}'s Artists`;
        return 'Artists';
    }, [username]);

    const loadSummary = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await collectionApi.getArtistProgress(userId, 24);
            setArtists(Array.isArray(res.data) ? res.data : []);
            setFallbackMode(false);
        } catch (error) {
            const status = (error as any)?.response?.status;
            if (status === 404) {
                try {
                    const fallbackSummary = await buildFallbackSummary();
                    setArtists(fallbackSummary);
                    setFallbackMode(true);
                } catch (fallbackError) {
                    console.error('Fallback artist progress failed:', fallbackError);
                }
            } else {
                console.error('Failed loading artist progress:', error);
            }
        }

        setLoading(false);
        setRefreshing(false);
    }, [userId]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    const loadDetails = useCallback(async (artist: string) => {
        if (detailsByArtist[artist] || detailsLoading[artist]) return;

        setDetailsLoading(prev => ({ ...prev, [artist]: true }));
        try {
            const res = await collectionApi.getArtistProgressDetails(artist, userId);
            setDetailsByArtist(prev => ({ ...prev, [artist]: res.data }));
        } catch (error) {
            const status = (error as any)?.response?.status;
            if (status === 404 || fallbackMode) {
                try {
                    const collRes = await collectionApi.getCollection(userId);
                    const items = Array.isArray(collRes.data?.items) ? collRes.data.items : [];
                    const artistItems = items.filter(
                        i => (i.artist || '').toLowerCase().trim() === artist.toLowerCase().trim()
                    );

                    const ownedKeys = new Set(
                        artistItems
                            .map(i => normalizeTitle(i.album_title))
                            .filter(Boolean)
                    );

                    const catalog = await getArtistCatalog(artist);
                    const catalogKeys = new Set(catalog.map(a => normalizeTitle(a.album)).filter(Boolean));

                    const totalKnown = catalogKeys.size || ownedKeys.size;
                    const ownedCount = catalogKeys.size
                        ? Array.from(ownedKeys).filter(k => catalogKeys.has(k)).length
                        : ownedKeys.size;

                    const detail: ArtistDiscographyProgressDetail = {
                        artist,
                        owned_count: ownedCount,
                        total_known: totalKnown,
                        completion_pct: totalKnown > 0 ? Math.round((ownedCount / totalKnown) * 100) : 0,
                        owned_albums: artistItems.map(i => i.album_title).filter(Boolean),
                        missing_albums: catalog.filter(a => !ownedKeys.has(normalizeTitle(a.album))),
                    };

                    setDetailsByArtist(prev => ({ ...prev, [artist]: detail }));
                } catch (fallbackError) {
                    console.error('Fallback artist details failed:', fallbackError);
                }
            } else {
                console.error('Failed loading artist details:', error);
            }
        } finally {
            setDetailsLoading(prev => ({ ...prev, [artist]: false }));
        }
    }, [detailsByArtist, detailsLoading, fallbackMode, getArtistCatalog, userId]);

    const onToggleArtist = async (artist: string) => {
        if (expandedArtist === artist) {
            setExpandedArtist(null);
            return;
        }
        setExpandedArtist(artist);
        await loadDetails(artist);
    };

    const renderArtistCard = ({ item }: { item: ArtistDiscographyProgressSummary }) => {
        const isExpanded = expandedArtist === item.artist;
        const details = detailsByArtist[item.artist];
        const isDetailsLoading = detailsLoading[item.artist];
        const progress = Math.max(0, Math.min(100, item.completion_pct));

        return (
            <View style={{ marginBottom: 10, backgroundColor: '#121216', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => onToggleArtist(item.artist)}
                    style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text style={{ color: 'white', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                                {item.artist}
                            </Text>
                            <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                                {item.owned_count}/{item.total_known} albums • Missing {item.missing_count}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 14 }}>{progress}%</Text>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
                        </View>
                    </View>

                    <View style={{ marginTop: 10, height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                        <View style={{ width: `${progress}%`, backgroundColor: Colors.primary, height: '100%' }} />
                    </View>

                    {!isExpanded && item.missing_preview.length > 0 && (
                        <Text style={{ color: '#7d8596', fontSize: 12, marginTop: 8 }} numberOfLines={1}>
                            Missing: {item.missing_preview.join(' • ')}
                        </Text>
                    )}
                </TouchableOpacity>

                {isExpanded && (
                    <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14, paddingVertical: 12 }}>
                        {isDetailsLoading && (
                            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                                <ActivityIndicator color={Colors.primary} size="small" />
                            </View>
                        )}

                        {!isDetailsLoading && details && (
                            <>
                                {details.missing_albums.length === 0 ? (
                                    <Text style={{ color: '#6EE7B7', fontSize: 13, fontWeight: '600' }}>
                                        Discography complete.
                                    </Text>
                                ) : (
                                    <>
                                        <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>
                                            Missing Albums ({details.missing_albums.length})
                                        </Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                            {details.missing_albums.map((album, idx) => (
                                                <View key={`${album.track_id}-${idx}`} style={{ width: 132 }}>
                                                    <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                                        {album.album_art_url ? (
                                                            <Image source={{ uri: album.album_art_url }} style={{ width: '100%', aspectRatio: 1 }} />
                                                        ) : (
                                                            <View style={{ width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937' }}>
                                                                <Ionicons name="disc" size={22} color="#6b7280" />
                                                            </View>
                                                        )}
                                                        <View style={{ padding: 8 }}>
                                                            <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }} numberOfLines={2}>
                                                                {album.album}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    </>
                                )}
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <View
                style={{
                    paddingTop: insets.top,
                    paddingHorizontal: 16,
                    paddingBottom: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: 'rgba(255,255,255,0.1)',
                    backgroundColor: '#000',
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6, marginRight: 8 }}>
                        <Ionicons name="arrow-back" size={22} color="white" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: 'white', fontSize: 28, fontWeight: '700', letterSpacing: -0.4 }} numberOfLines={1}>
                            {title}
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
                            Discography progress and missing albums
                        </Text>
                        {fallbackMode && (
                            <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
                                Compatibility mode: computed locally
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            <FlatList
                data={artists}
                keyExtractor={(item) => item.artist}
                renderItem={renderArtistCard}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadSummary(true)}
                        tintColor={Colors.primary}
                    />
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={{ paddingTop: 80, alignItems: 'center' }}>
                            <ActivityIndicator color={Colors.primary} size="large" />
                        </View>
                    ) : (
                        <View style={{ paddingTop: 80, alignItems: 'center', paddingHorizontal: 30 }}>
                            <Ionicons name="albums-outline" size={44} color="#6b7280" />
                            <Text style={{ color: '#9ca3af', marginTop: 12, textAlign: 'center' }}>
                                Add more albums to see artist discography progress.
                            </Text>
                        </View>
                    )
                }
            />
        </View>
    );
}
