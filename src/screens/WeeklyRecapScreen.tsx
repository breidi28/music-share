import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Share, StyleSheet } from 'react-native';
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
    const [loading, setLoading] = useState(true);

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

    const latestWeekLabel = useMemo(() => {
        if (!latest?.week_start) return '';
        try {
            return format(parseISO(latest.week_start), 'MMM d, yyyy');
        } catch {
            return latest.week_start;
        }
    }, [latest?.week_start]);

    const latestSummary = latest?.summary;
    const posterArtworks = useMemo(
        () => (latestSummary?.top_tracks || []).map(t => getArtUrl(t.album_art_url)).filter(Boolean).slice(0, 4),
        [latestSummary?.top_tracks]
    );

    const buildRecapShareText = (recap: WeeklyRecap, weekLabel: string) => {
        const s = recap.summary;
        return [
            `My Weekly Recap (${weekLabel})`,
            `Scrobbles: ${s.total_scrobbles ?? s.posts_shared}`,
            `Top Artist: ${s.top_artist || '—'}`,
            `Top Genre: ${s.top_genre || '—'}`,
            `Unique Artists: ${s.unique_artists ?? 0}`,
            `Unique Tracks: ${s.unique_tracks ?? 0}`,
            `#musicshare #weeklyrecap`,
        ].join('\n');
    };

    const handlePostRecapToFeed = async () => {
        if (!latest) return;
        try {
            const shareText = buildRecapShareText(latest, latestWeekLabel);
            await postsApi.create({
                track_title: `Weekly Recap • ${latestWeekLabel}`,
                artist: 'music share recap',
                album: 'Weekly Listening Report',
                caption: shareText,
                post_type: 'history',
                genre: latest.summary.top_genre || '',
            });
            Toast.show({ type: 'success', text1: 'Recap posted', text2: 'Your weekly recap was shared to feed.' });
        } catch {
            Toast.show({ type: 'error', text1: 'Could not post recap' });
        }
    };

    const handleExportRecap = async () => {
        if (!latest) return;
        try {
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
            const shareText = buildRecapShareText(latest, latestWeekLabel);
            await Share.share({ title: 'Weekly Recap', message: shareText });
        } catch {
            Toast.show({ type: 'error', text1: 'Could not export recap' });
        }
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
                data={history}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{
                    paddingHorizontal: UtilityScreen.content.horizontalPadding,
                    paddingTop: UtilityScreen.content.topPadding,
                    paddingBottom: UtilityScreen.content.bottomPadding,
                }}
                ListHeaderComponent={
                    latest ? (
                        <View style={{ marginBottom: Layout.space[4], gap: Layout.space[3] }}>
                            <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Latest Week</Text>
                            <AppCard
                                style={{
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    backgroundColor: Surface.card,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 }}>Your Week</Text>
                                        <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', marginTop: 2 }}>Listening Recap</Text>
                                        <Text style={{ color: '#9ca3af', marginTop: 4 }}>Week of {latestWeekLabel}</Text>
                                    </View>
                                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(250,36,60,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="stats-chart" size={20} color={Colors.primary} />
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: Layout.space[2], marginTop: Layout.space[3] }}>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700' }}>Scrobbles</Text>
                                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 24, marginTop: 2 }}>{latestSummary?.total_scrobbles ?? 0}</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Top Artist</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{latestSummary?.top_artist || '—'}</Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: Layout.space[2], marginTop: Layout.space[2] }}>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Artists</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>{latestSummary?.unique_artists ?? 0}</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Tracks</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>{latestSummary?.unique_tracks ?? 0}</Text>
                                    </View>
                                    <View style={{ flex: 1, backgroundColor: Surface.cardAlt, borderRadius: Layout.radius.md, padding: Layout.space[2] }}>
                                        <Text style={{ color: '#9ca3af', fontSize: 11 }}>Albums</Text>
                                        <Text style={{ color: 'white', fontWeight: '700', marginTop: 4 }}>{latestSummary?.unique_albums ?? 0}</Text>
                                    </View>
                                </View>

                                <Text style={{ color: '#9ca3af', marginTop: Layout.space[2], fontSize: 12 }}>
                                    Active on {latestSummary?.active_days ?? 0} days {latestSummary?.busiest_day ? `• Busiest: ${latestSummary.busiest_day}` : ''}
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
                                        style={{
                                            flex: 1,
                                            minHeight: 42,
                                            borderRadius: 10,
                                            backgroundColor: 'rgba(255,255,255,0.06)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(255,255,255,0.12)',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'row',
                                        }}
                                    >
                                        <Ionicons name="logo-instagram" size={16} color="#d1d5db" />
                                        <Text style={{ color: '#d1d5db', fontWeight: '700', fontSize: 13, marginLeft: 6 }}>Export Story</Text>
                                    </TouchableOpacity>
                                </View>
                            </AppCard>

                            <AppCard>
                                <Text style={{ color: Colors.primary, fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginBottom: UtilityScreen.card.headingMarginBottom, textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Artists</Text>
                                {(latestSummary?.top_artists || []).slice(0, 5).map((artist, index) => (
                                    <View key={`${artist.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < Math.min((latestSummary?.top_artists || []).length, 5) - 1 ? UtilityScreen.row.gap : 0 }}>
                                        <Text style={{ color: '#9ca3af', width: 22, fontWeight: '700' }}>{index + 1}</Text>
                                        <Text style={{ color: 'white', flex: 1, fontWeight: '600' }} numberOfLines={1}>{artist.name}</Text>
                                        <Text style={{ color: '#9ca3af', marginLeft: 10 }}>{artist.plays}</Text>
                                    </View>
                                ))}
                                {(!latestSummary?.top_artists || latestSummary.top_artists.length === 0) && (
                                    <Text style={{ color: '#6b7280' }}>No artist data this week.</Text>
                                )}
                            </AppCard>

                            <AppCard>
                                <Text style={{ color: Colors.primary, fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginBottom: UtilityScreen.card.headingMarginBottom, textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Tracks</Text>
                                {(latestSummary?.top_tracks || []).slice(0, 5).map((track, index) => (
                                    <View key={`${track.title}-${track.artist}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < Math.min((latestSummary?.top_tracks || []).length, 5) - 1 ? UtilityScreen.row.gap : 0 }}>
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
                                {(!latestSummary?.top_tracks || latestSummary.top_tracks.length === 0) && (
                                    <Text style={{ color: '#6b7280' }}>No track data this week.</Text>
                                )}
                            </AppCard>

                            <AppCard>
                                <Text style={{ color: Colors.primary, fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginBottom: UtilityScreen.card.headingMarginBottom, textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Albums</Text>
                                {(latestSummary?.top_albums || []).slice(0, 5).map((album, index) => (
                                    <View key={`${album.name}-${album.artist}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < Math.min((latestSummary?.top_albums || []).length, 5) - 1 ? UtilityScreen.row.gap : 0 }}>
                                        <Text style={{ color: '#9ca3af', width: 22, fontWeight: '700' }}>{index + 1}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: 'white', fontWeight: '600' }} numberOfLines={1}>{album.name}</Text>
                                            <Text style={{ color: '#9ca3af', fontSize: 12 }} numberOfLines={1}>{album.artist}</Text>
                                        </View>
                                        <Text style={{ color: '#9ca3af', marginLeft: 10 }}>{album.plays}</Text>
                                    </View>
                                ))}
                                {(!latestSummary?.top_albums || latestSummary.top_albums.length === 0) && (
                                    <Text style={{ color: '#6b7280' }}>No album data this week.</Text>
                                )}
                            </AppCard>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => {
                    let weekLabel = item.week_start;
                    try {
                        weekLabel = format(parseISO(item.week_start), 'MMM d, yyyy');
                    } catch { }

                    return (
                        <AppCard style={{ marginBottom: UtilityScreen.card.gap }}>
                            <Text style={{ color: 'white', fontWeight: '700' }}>Week of {weekLabel}</Text>
                            <Text style={{ color: '#9ca3af', marginTop: 4 }}>
                                {item.summary.total_scrobbles ?? item.summary.posts_shared} scrobbles • {item.summary.unique_artists ?? 0} artists • {item.summary.unique_tracks ?? 0} tracks
                            </Text>
                        </AppCard>
                    );
                }}
                ListEmptyComponent={<Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 36 }}>No recap data yet.</Text>}
            />

            {latest && (
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
                        paddingHorizontal: 72,
                        paddingTop: 120,
                        paddingBottom: 120,
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
                            <Text style={{ color: '#f43f5e', fontSize: 34, fontWeight: '800', letterSpacing: 1.2 }}>WEEKLY RECAP</Text>
                            <Text style={{ color: '#d1d5db', fontSize: 34, marginTop: 10 }}>Week of {latestWeekLabel}</Text>
                        </View>
                        <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(250,36,60,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="stats-chart" size={44} color={Colors.primary} />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 44, gap: 18 }}>
                        <View style={{ flex: 1, backgroundColor: '#18181d', borderRadius: 20, padding: 28, minHeight: 190 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 25, fontWeight: '700' }}>Scrobbles</Text>
                            <Text style={{ color: 'white', fontSize: 66, fontWeight: '800', marginTop: 10 }}>{latestSummary?.total_scrobbles ?? 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#18181d', borderRadius: 20, padding: 28, minHeight: 190 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 25, fontWeight: '700' }}>Top Artist</Text>
                            <Text style={{ color: 'white', fontSize: 42, fontWeight: '700', marginTop: 10 }} numberOfLines={2}>{latestSummary?.top_artist || '—'}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 30, flexDirection: 'row', gap: 14 }}>
                        <View style={{ flex: 1, backgroundColor: '#141417', borderRadius: 16, padding: 18 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 21 }}>Artists</Text>
                            <Text style={{ color: 'white', fontSize: 40, fontWeight: '700', marginTop: 4 }}>{latestSummary?.unique_artists ?? 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#141417', borderRadius: 16, padding: 18 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 21 }}>Tracks</Text>
                            <Text style={{ color: 'white', fontSize: 40, fontWeight: '700', marginTop: 4 }}>{latestSummary?.unique_tracks ?? 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#141417', borderRadius: 16, padding: 18 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 21 }}>Albums</Text>
                            <Text style={{ color: 'white', fontSize: 40, fontWeight: '700', marginTop: 4 }}>{latestSummary?.unique_albums ?? 0}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 36, backgroundColor: '#141417', borderRadius: 20, padding: 28 }}>
                        <Text style={{ color: '#f43f5e', fontSize: 24, fontWeight: '800', marginBottom: 14 }}>TOP TRACKS</Text>
                        {(latestSummary?.top_tracks || []).slice(0, 5).map((track, idx) => (
                            <View key={`${track.title}-${track.artist}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: idx < Math.min((latestSummary?.top_tracks || []).length, 5) - 1 ? 12 : 0 }}>
                                <Text style={{ color: '#9ca3af', width: 38, fontSize: 23, fontWeight: '700' }}>{idx + 1}</Text>
                                <Text style={{ color: 'white', fontSize: 26, fontWeight: '600', flex: 1 }} numberOfLines={1}>{track.title}</Text>
                                <Text style={{ color: '#9ca3af', fontSize: 21, marginLeft: 12 }}>{track.plays}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={{ marginTop: 'auto' }}>
                        <Text style={{ color: '#9ca3af', fontSize: 24 }}>
                            {latestSummary?.busiest_day ? `Busiest day: ${latestSummary.busiest_day}` : 'Your week in music'}
                        </Text>
                        <Text style={{ color: '#d1d5db', fontSize: 26, marginTop: 10, fontWeight: '700' }}>music share</Text>
                    </View>
                </View>
            )}
        </View>
    );
}
