import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Share, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../api/client';
import Toast from 'react-native-toast-message';
import { recapApi, postsApi } from '../api/endpoints';
import { WeeklyRecap } from '../types';
import { Colors } from '../theme';
import { Layout, Surface } from '../theme/layout';
import { UtilityScreen } from '../theme/utilityScreen';
import { AppCard } from '../components/ui/Primitives';

type StoryShareMode = 'full' | 'artists' | 'tracks' | 'albums';

const getArtUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return API_BASE_URL.replace('/api', '') + url;
};

export default function WeeklyRecapScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const sharePosterRef = useRef<View>(null);
    const [latest, setLatest] = useState<WeeklyRecap | null>(null);
    const [history, setHistory] = useState<WeeklyRecap[]>([]);
    const [selectedRecapId, setSelectedRecapId] = useState<number | null>(null);
    const [sharePickerVisible, setSharePickerVisible] = useState(false);
    const [storyShareMode, setStoryShareMode] = useState<StoryShareMode>('full');
    const [isExporting, setIsExporting] = useState(false);
    const [loading, setLoading] = useState(true);

    const storyModeLabel: Record<StoryShareMode, string> = {
        full: 'Full Recap',
        artists: 'Top Artists',
        tracks: 'Top Tracks',
        albums: 'Top Albums',
    };

    const load = async () => {
        setLoading(true);
        try {
            const [latestRes, historyRes] = await Promise.all([
                recapApi.getLatest(),
                recapApi.getHistory(),
            ]);
            setLatest(latestRes.data);
            setHistory(historyRes.data || []);
        } catch {
            setLatest(null);
            setHistory([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const formatWeekLabel = (weekStart?: string | null) => {
        if (!weekStart) return 'Unknown week';
        try {
            return format(parseISO(weekStart), 'MMM d, yyyy');
        } catch {
            return weekStart;
        }
    };

    const allRecaps = useMemo(() => {
        const recaps = [latest, ...history].filter(Boolean) as WeeklyRecap[];
        const seen = new Set<number>();
        return recaps.filter((recap) => {
            if (seen.has(recap.id)) return false;
            seen.add(recap.id);
            return true;
        });
    }, [latest, history]);

    useEffect(() => {
        if (!allRecaps.length) {
            if (selectedRecapId !== null) setSelectedRecapId(null);
            return;
        }

        const hasSelected = selectedRecapId !== null && allRecaps.some((recap) => recap.id === selectedRecapId);
        if (!hasSelected) {
            setSelectedRecapId(allRecaps[0].id);
        }
    }, [allRecaps, selectedRecapId]);

    const selectedRecap = useMemo(() => {
        if (!allRecaps.length) return null;
        return allRecaps.find((recap) => recap.id === selectedRecapId) || allRecaps[0];
    }, [allRecaps, selectedRecapId]);

    const selectedWeekLabel = useMemo(
        () => formatWeekLabel(selectedRecap?.week_start),
        [selectedRecap?.week_start]
    );

    const selectedSummary = selectedRecap?.summary;
    const showArtistsInStory = storyShareMode === 'full' || storyShareMode === 'artists';
    const showTracksInStory = storyShareMode === 'full' || storyShareMode === 'tracks';
    const showAlbumsInStory = storyShareMode === 'full' || storyShareMode === 'albums';
    const posterArtworks = useMemo(
        () => (selectedSummary?.top_tracks || []).map((t) => getArtUrl(t.album_art_url)).filter(Boolean).slice(0, 4),
        [selectedSummary?.top_tracks]
    );

    const buildRecapShareText = (recap: WeeklyRecap, weekLabel: string, mode: StoryShareMode = 'full') => {
        const s = recap.summary;
        const topTracks = (s.top_tracks || []).slice(0, 3);
        const topArtists = (s.top_artists || []).slice(0, 3);
        const topAlbums = (s.top_albums || []).slice(0, 3);
        const includeArtists = mode === 'full' || mode === 'artists';
        const includeTracks = mode === 'full' || mode === 'tracks';
        const includeAlbums = mode === 'full' || mode === 'albums';
        const title = mode === 'full' ? `My Weekly Recap (${weekLabel})` : `My Weekly Recap (${weekLabel}) - ${storyModeLabel[mode]}`;

        return [
            title,
            `Scrobbles: ${s.total_scrobbles ?? s.posts_shared}`,
            `Top Artist: ${s.top_artist || '—'}`,
            `Top Genre: ${s.top_genre || '—'}`,
            `Unique Artists: ${s.unique_artists ?? 0}`,
            `Unique Tracks: ${s.unique_tracks ?? 0}`,
            `Unique Albums: ${s.unique_albums ?? 0}`,
            `Active Days: ${s.active_days ?? 0}${s.busiest_day ? ` (Busiest: ${s.busiest_day})` : ''}`,
            '',
            ...(includeArtists
                ? [
                    'Top Artists:',
                    ...(topArtists.length ? topArtists.map((artist, idx) => `${idx + 1}. ${artist.name} (${artist.plays})`) : ['No artist data']),
                    '',
                ]
                : []),
            ...(includeTracks
                ? [
                    'Top Tracks:',
                    ...(topTracks.length ? topTracks.map((track, idx) => `${idx + 1}. ${track.title} - ${track.artist} (${track.plays})`) : ['No track data']),
                    '',
                ]
                : []),
            ...(includeAlbums
                ? [
                    'Top Albums:',
                    ...(topAlbums.length ? topAlbums.map((album, idx) => `${idx + 1}. ${album.name} - ${album.artist} (${album.plays})`) : ['No album data']),
                ]
                : []),
            `#musicshare #weeklyrecap`,
        ].join('\n');
    };

    const handlePostRecapToFeed = async () => {
        if (!selectedRecap) return;
        try {
            const shareText = buildRecapShareText(selectedRecap, selectedWeekLabel);
            await postsApi.create({
                track_title: `Weekly Recap • ${selectedWeekLabel}`,
                artist: 'music share recap',
                album: 'Weekly Listening Report',
                caption: shareText,
                post_type: 'history',
                genre: selectedRecap.summary.top_genre || '',
            });
            Toast.show({ type: 'success', text1: 'Recap posted', text2: 'Your weekly recap was shared to feed.' });
        } catch {
            Toast.show({ type: 'error', text1: 'Could not post recap' });
        }
    };

    const exportRecapStory = async (mode: StoryShareMode) => {
        if (!selectedRecap || isExporting) return;
        setStoryShareMode(mode);
        setSharePickerVisible(false);
        setIsExporting(true);

        try {
            // Ensure the hidden poster is rendered and the Modal closing animation has finished.
            await new Promise<void>((resolve) => setTimeout(resolve, 800));

            if (sharePosterRef.current) {
                const imageUri = await captureRef(sharePosterRef, {
                    format: 'png',
                    quality: 1,
                    result: 'tmpfile',
                });

                const isNativeShareAvailable = await Sharing.isAvailableAsync();
                if (isNativeShareAvailable) {
                    await Sharing.shareAsync(imageUri, {
                        dialogTitle: 'Share your Weekly Recap',
                        mimeType: 'image/png',
                    });
                    return;
                }
            }

            // Last fallback when native sharing is unavailable.
            const shareText = buildRecapShareText(selectedRecap, selectedWeekLabel, mode);
            await Share.share({ title: 'Weekly Recap', message: shareText });
        } catch {
            Toast.show({ type: 'error', text1: 'Could not export recap' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportRecap = () => {
        if (!selectedRecap) return;
        setSharePickerVisible(true);
    };

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: Surface.page, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: Surface.page }}>
            <View
                style={{
                    paddingTop: insets.top,
                    backgroundColor: UtilityScreen.header.backgroundColor,
                    borderBottomWidth: UtilityScreen.header.borderBottomWidth,
                    borderBottomColor: UtilityScreen.header.borderBottomColor,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: UtilityScreen.header.horizontalPadding, paddingVertical: UtilityScreen.header.verticalPadding }}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={{ marginRight: UtilityScreen.header.backButtonMarginRight, minWidth: Layout.touch.minTarget, minHeight: Layout.touch.minTarget, justifyContent: 'center' }}
                    >
                        <Ionicons name="chevron-back" size={UtilityScreen.header.backIconSize} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: UtilityScreen.header.titleSize, fontWeight: UtilityScreen.header.titleWeight, letterSpacing: UtilityScreen.header.titleLetterSpacing }}>
                        Weekly Recap
                    </Text>
                </View>
            </View>

            <FlatList
                data={allRecaps}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{
                    paddingHorizontal: UtilityScreen.content.horizontalPadding,
                    paddingTop: UtilityScreen.content.topPadding,
                    paddingBottom: UtilityScreen.content.bottomPadding,
                }}
                ListHeaderComponent={
                    selectedRecap ? (
                        <View style={{ marginBottom: Layout.space[4], gap: Layout.space[3] }}>
                            <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Selected Week</Text>
                            <AppCard
                                style={{
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    backgroundColor: Surface.card,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                            {selectedRecap.id === latest?.id ? 'Latest Week' : 'Recap Archive'}
                                        </Text>
                                        <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', marginTop: 2 }}>Listening Recap</Text>
                                        <Text style={{ color: '#9ca3af', marginTop: 4 }}>Week of {selectedWeekLabel}</Text>
                                    </View>
                                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(250,36,60,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="stats-chart" size={20} color={Colors.primary} />
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: Layout.space[2], marginTop: Layout.space[3] }}>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>Scrobbles</Text>
                                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 24, marginTop: 2 }}>{selectedSummary?.total_scrobbles ?? 0}</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Top Artist</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{selectedSummary?.top_artist || '—'}</Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: Layout.space[2], marginTop: Layout.space[2] }}>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Artists</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>{selectedSummary?.unique_artists ?? 0}</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Tracks</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>{selectedSummary?.unique_tracks ?? 0}</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Albums</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>{selectedSummary?.unique_albums ?? 0}</Text>
                                    </View>
                                </View>

                                <Text style={{ color: '#9ca3af', marginTop: Layout.space[2], fontSize: 12 }}>
                                    Active on {selectedSummary?.active_days ?? 0} days {selectedSummary?.busiest_day ? `• Busiest: ${selectedSummary.busiest_day}` : ''}
                                </Text>

                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                    <TouchableOpacity
                                        onPress={handlePostRecapToFeed}
                                        style={{
                                            flex: 1,
                                            minHeight: 42,
                                            borderRadius: 10,
                                            backgroundColor: Colors.primary,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'row',
                                        }}
                                    >
                                        <Ionicons name="add-circle-outline" size={16} color="white" />
                                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>Post to Feed</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleExportRecap}
                                        disabled={isExporting}
                                        style={{
                                            flex: 1,
                                            minHeight: 42,
                                            borderRadius: 10,
                                            backgroundColor: isExporting ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                                            borderWidth: 1,
                                            borderColor: isExporting ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'row',
                                        }}
                                    >
                                        <Ionicons name="logo-instagram" size={16} color="#d1d5db" />
                                        <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>
                                            {isExporting ? 'Exporting...' : 'Export Story'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </AppCard>

                            <AppCard>
                                <Text style={{ color: Colors.primary, fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginBottom: UtilityScreen.card.headingMarginBottom, textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Artists</Text>
                                {(selectedSummary?.top_artists || []).slice(0, 5).map((artist, index) => (
                                    <View key={`${artist.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < Math.min((selectedSummary?.top_artists || []).length, 5) - 1 ? UtilityScreen.row.gap : 0 }}>
                                        <Text style={{ color: '#9ca3af', width: 22, fontWeight: '700' }}>{index + 1}</Text>
                                        <Text style={{ color: 'white', flex: 1, fontWeight: '600' }} numberOfLines={1}>{artist.name}</Text>
                                        <Text style={{ color: '#9ca3af', marginLeft: 10 }}>{artist.plays}</Text>
                                    </View>
                                ))}
                                {(!selectedSummary?.top_artists || selectedSummary.top_artists.length === 0) && (
                                    <Text style={{ color: '#6b7280' }}>No artist data this week.</Text>
                                )}
                            </AppCard>

                            <AppCard>
                                <Text style={{ color: Colors.primary, fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginBottom: UtilityScreen.card.headingMarginBottom, textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Tracks</Text>
                                {(selectedSummary?.top_tracks || []).slice(0, 5).map((track, index) => (
                                    <View key={`${track.title}-${track.artist}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < Math.min((selectedSummary?.top_tracks || []).length, 5) - 1 ? UtilityScreen.row.gap : 0 }}>
                                        <Text style={{ color: '#9ca3af', width: 22, fontWeight: '700' }}>{index + 1}</Text>
                                        {track.album_art_url ? (
                                            <Image source={{ uri: getArtUrl(track.album_art_url) }} style={{ width: 34, height: 34, borderRadius: 6, marginRight: 8 }} />
                                        ) : (
                                            <View style={{ width: 34, height: 34, borderRadius: 6, marginRight: 8, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name="musical-notes" size={14} color="#9ca3af" />
                                            </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: 'white', fontWeight: '600' }} numberOfLines={1}>{track.title}</Text>
                                            <Text style={{ color: '#9ca3af', fontSize: 12 }} numberOfLines={1}>{track.artist}</Text>
                                        </View>
                                        <Text style={{ color: '#9ca3af', marginLeft: 10 }}>{track.plays}</Text>
                                    </View>
                                ))}
                                {(!selectedSummary?.top_tracks || selectedSummary.top_tracks.length === 0) && (
                                    <Text style={{ color: '#6b7280' }}>No track data this week.</Text>
                                )}
                            </AppCard>

                            <AppCard>
                                <Text style={{ color: Colors.primary, fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginBottom: UtilityScreen.card.headingMarginBottom, textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Albums</Text>
                                {(selectedSummary?.top_albums || []).slice(0, 5).map((album, index) => (
                                    <View key={`${album.name}-${album.artist}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < Math.min((selectedSummary?.top_albums || []).length, 5) - 1 ? UtilityScreen.row.gap : 0 }}>
                                        <Text style={{ color: '#9ca3af', width: 22, fontWeight: '700' }}>{index + 1}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: 'white', fontWeight: '600' }} numberOfLines={1}>{album.name}</Text>
                                            <Text style={{ color: '#9ca3af', fontSize: 12 }} numberOfLines={1}>{album.artist}</Text>
                                        </View>
                                        <Text style={{ color: '#9ca3af', marginLeft: 10 }}>{album.plays}</Text>
                                    </View>
                                ))}
                                {(!selectedSummary?.top_albums || selectedSummary.top_albums.length === 0) && (
                                    <Text style={{ color: '#6b7280' }}>No album data this week.</Text>
                                )}
                            </AppCard>

                            <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>
                                Recap Archive
                            </Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => {
                    const weekLabel = formatWeekLabel(item.week_start);
                    const isSelected = item.id === selectedRecap?.id;

                    return (
                        <TouchableOpacity activeOpacity={0.86} onPress={() => setSelectedRecapId(item.id)}>
                            <AppCard
                                style={{
                                    marginBottom: UtilityScreen.card.gap,
                                    borderColor: isSelected ? `${Colors.primary}80` : 'rgba(255,255,255,0.08)',
                                    borderWidth: 1,
                                    backgroundColor: isSelected ? 'rgba(250,36,60,0.08)' : Surface.card,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ color: 'white', fontWeight: '700' }}>Week of {weekLabel}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ color: isSelected ? '#fecdd3' : '#9ca3af', fontSize: 12, fontWeight: '700', marginRight: 6 }}>
                                            {isSelected ? 'Viewing' : 'View details'}
                                        </Text>
                                        <Ionicons name="chevron-forward" size={14} color={isSelected ? '#fecdd3' : '#9ca3af'} />
                                    </View>
                                </View>

                                <Text style={{ color: '#9ca3af', marginTop: 4 }}>
                                    {item.summary.total_scrobbles ?? item.summary.posts_shared} scrobbles • {item.summary.unique_artists ?? 0} artists • {item.summary.unique_tracks ?? 0} tracks
                                </Text>
                                <Text style={{ color: '#6b7280', marginTop: 4, fontSize: 12 }} numberOfLines={1}>
                                    {item.summary.top_artist ? `Top artist: ${item.summary.top_artist}` : 'No artist highlights'}
                                    {item.summary.top_genre ? ` • Genre: ${item.summary.top_genre}` : ''}
                                </Text>
                            </AppCard>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={<Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 36 }}>No recap data yet.</Text>}
            />

            {selectedRecap && (
                <View
                    ref={sharePosterRef}
                    collapsable={false}
                    style={{
                        position: 'absolute',
                        left: -10000,
                        top: 0,
                        width: 1080,
                        height: 1920,
                        backgroundColor: '#0a0a0f',
                        paddingHorizontal: 64,
                        paddingTop: 108,
                        paddingBottom: 108,
                    }}
                >
                    <LinearGradient
                        colors={['#09090f', '#1a0f17', '#2a1322', '#0b101d']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <View style={{ position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: 'rgba(250,36,60,0.15)', top: -120, right: -120 }} />
                    <View style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(168,85,247,0.12)', bottom: 160, left: -100 }} />

                    {posterArtworks[0] ? (
                        <Image source={{ uri: posterArtworks[0] }} style={{ position: 'absolute', width: 240, height: 240, borderRadius: 28, top: 90, right: 60, opacity: 0.26, transform: [{ rotate: '-10deg' }] }} />
                    ) : null}
                    {posterArtworks[1] ? (
                        <Image source={{ uri: posterArtworks[1] }} style={{ position: 'absolute', width: 180, height: 180, borderRadius: 24, top: 320, right: 170, opacity: 0.24, transform: [{ rotate: '8deg' }] }} />
                    ) : null}
                    {posterArtworks[2] ? (
                        <Image source={{ uri: posterArtworks[2] }} style={{ position: 'absolute', width: 160, height: 160, borderRadius: 20, bottom: 300, right: 45, opacity: 0.22, transform: [{ rotate: '-6deg' }] }} />
                    ) : null}

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                            <Text style={{ color: '#f43f5e', fontSize: 38, fontWeight: '900', letterSpacing: 1.25 }}>WEEKLY RECAP</Text>
                            <Text style={{ color: '#d1d5db', fontSize: 35, marginTop: 10 }}>Week of {selectedWeekLabel}</Text>
                            <Text style={{ color: '#9ca3af', fontSize: 22, marginTop: 6 }}>{storyModeLabel[storyShareMode]}</Text>
                        </View>
                        <View style={{ width: 108, height: 108, borderRadius: 54, backgroundColor: 'rgba(250,36,60,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="stats-chart" size={52} color={Colors.primary} />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 42, gap: 16 }}>
                        <View style={{ flex: 1, backgroundColor: '#18181d', borderRadius: 24, padding: 32, minHeight: 212 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 28, fontWeight: '700' }}>Scrobbles</Text>
                            <Text style={{ color: 'white', fontSize: 76, fontWeight: '900', marginTop: 8 }}>{selectedSummary?.total_scrobbles ?? 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#18181d', borderRadius: 24, padding: 32, minHeight: 212 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 28, fontWeight: '700' }}>Top Artist</Text>
                            <Text style={{ color: 'white', fontSize: 45, fontWeight: '800', marginTop: 8 }} numberOfLines={2}>{selectedSummary?.top_artist || '—'}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 24, flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1, backgroundColor: '#141417', borderRadius: 18, padding: 20 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 23 }}>Artists</Text>
                            <Text style={{ color: 'white', fontSize: 46, fontWeight: '800', marginTop: 2 }}>{selectedSummary?.unique_artists ?? 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#141417', borderRadius: 18, padding: 20 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 23 }}>Tracks</Text>
                            <Text style={{ color: 'white', fontSize: 46, fontWeight: '800', marginTop: 2 }}>{selectedSummary?.unique_tracks ?? 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#141417', borderRadius: 18, padding: 20 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 23 }}>Albums</Text>
                            <Text style={{ color: 'white', fontSize: 46, fontWeight: '800', marginTop: 2 }}>{selectedSummary?.unique_albums ?? 0}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 24, backgroundColor: '#141417', borderRadius: 24, padding: 26 }}>
                        <Text style={{ color: '#f43f5e', fontSize: 27, fontWeight: '900', marginBottom: 14 }}>
                            {storyShareMode === 'full' ? 'TOP HIGHLIGHTS' : storyModeLabel[storyShareMode].toUpperCase()}
                        </Text>

                        {showArtistsInStory && (
                            <>
                                <Text style={{ color: '#d1d5db', fontSize: 22, fontWeight: '700', marginBottom: 10 }}>Artists</Text>
                                {(selectedSummary?.top_artists || []).slice(0, 3).map((artist, idx) => (
                                    <View key={`${artist.name}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                        <Text style={{ color: '#9ca3af', width: 36, fontSize: 24, fontWeight: '700' }}>{idx + 1}</Text>
                                        <Text style={{ color: 'white', fontSize: 25, fontWeight: '700', flex: 1 }} numberOfLines={1}>{artist.name}</Text>
                                        <Text style={{ color: '#9ca3af', fontSize: 21, marginLeft: 10 }}>{artist.plays}</Text>
                                    </View>
                                ))}
                            </>
                        )}

                        {showTracksInStory && (
                            <>
                                {showArtistsInStory && (
                                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 }} />
                                )}
                                <Text style={{ color: '#d1d5db', fontSize: 22, fontWeight: '700', marginBottom: 10 }}>Tracks</Text>
                                {(selectedSummary?.top_tracks || []).slice(0, 3).map((track, idx) => (
                                    <View key={`${track.title}-${track.artist}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                        <Text style={{ color: '#9ca3af', width: 36, fontSize: 24, fontWeight: '700' }}>{idx + 1}</Text>
                                        <Text style={{ color: 'white', fontSize: 25, fontWeight: '700', flex: 1 }} numberOfLines={1}>{track.title}</Text>
                                        <Text style={{ color: '#9ca3af', fontSize: 21, marginLeft: 10 }}>{track.plays}</Text>
                                    </View>
                                ))}
                            </>
                        )}

                        {showAlbumsInStory && (
                            <>
                                {(showArtistsInStory || showTracksInStory) && (
                                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 }} />
                                )}
                                <Text style={{ color: '#d1d5db', fontSize: 22, fontWeight: '700', marginBottom: 10 }}>Albums</Text>
                                {(selectedSummary?.top_albums || []).slice(0, 3).map((album, idx) => (
                                    <View key={`${album.name}-${album.artist}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                        <Text style={{ color: '#9ca3af', width: 36, fontSize: 24, fontWeight: '700' }}>{idx + 1}</Text>
                                        <Text style={{ color: 'white', fontSize: 25, fontWeight: '700', flex: 1 }} numberOfLines={1}>{album.name}</Text>
                                        <Text style={{ color: '#9ca3af', fontSize: 21, marginLeft: 10 }}>{album.plays}</Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>

                    <View style={{ marginTop: 'auto' }}>
                        <Text style={{ color: '#9ca3af', fontSize: 25 }}>
                            {selectedSummary?.top_genre ? `Top genre: ${selectedSummary.top_genre}` : 'Your week in music'}
                            {selectedSummary?.busiest_day ? ` • Busiest: ${selectedSummary.busiest_day}` : ''}
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 24, marginTop: 8 }}>
                            Active days: {selectedSummary?.active_days ?? 0}
                        </Text>
                        <Text style={{ color: '#d1d5db', fontSize: 30, marginTop: 12, fontWeight: '800' }}>music share</Text>
                    </View>
                </View>
            )}

            <Modal
                visible={sharePickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSharePickerVisible(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 20,
                }}>
                    <View style={{
                        width: '100%',
                        maxWidth: 420,
                        borderRadius: 16,
                        padding: 16,
                        backgroundColor: '#111218',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.09)',
                    }}>
                        <Text style={{ color: 'white', fontSize: 19, fontWeight: '800' }}>Export to Story</Text>
                        <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 6, marginBottom: 12 }}>
                            What do you want to share from this week?
                        </Text>

                        <View style={{ gap: 8 }}>
                            {(
                                [
                                    { mode: 'full', subtitle: 'Everything in one story card' },
                                    { mode: 'artists', subtitle: 'Only your top artists' },
                                    { mode: 'tracks', subtitle: 'Only your top tracks' },
                                    { mode: 'albums', subtitle: 'Only your top albums' },
                                ] as Array<{ mode: StoryShareMode; subtitle: string }>
                            ).map((option) => (
                                <TouchableOpacity
                                    key={option.mode}
                                    activeOpacity={0.86}
                                    onPress={() => void exportRecapStory(option.mode)}
                                    style={{
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.1)',
                                        backgroundColor: option.mode === 'full' ? 'rgba(250,36,60,0.16)' : 'rgba(255,255,255,0.04)',
                                        paddingHorizontal: 12,
                                        paddingVertical: 11,
                                    }}
                                >
                                    <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>{storyModeLabel[option.mode]}</Text>
                                    <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>{option.subtitle}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={() => setSharePickerVisible(false)}
                            style={{
                                marginTop: 12,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.12)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 42,
                            }}
                        >
                            <Text style={{ color: '#d1d5db', fontWeight: '700' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
