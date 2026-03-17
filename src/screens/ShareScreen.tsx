import React, { useState, useCallback, useMemo } from 'react';
import { FlatList, ScrollView, KeyboardAvoidingView, Platform, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MusicSearchResult, PostType } from '../types';
import { musicApi, postsApi } from '../api/endpoints';
import { Colors } from '../theme';

const POST_TYPE_OPTIONS: { key: PostType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bgClass: string; textClass: string; borderClass: string; desc: string }[] = [
    { key: 'now_playing', label: 'Now Playing', icon: 'musical-notes', color: Colors.primary, bgClass: 'bg-[#FA243C]/10', textClass: 'text-[#FA243C]', borderClass: 'border-[#FA243C]', desc: "What you're listening to right now" },
    { key: 'loved', label: 'Loved Track', icon: 'heart', color: Colors.primary, bgClass: 'bg-[#FA243C]/10', textClass: 'text-[#FA243C]', borderClass: 'border-[#FA243C]', desc: 'A track you absolutely love' },
    { key: 'history', label: 'History', icon: 'time', color: '#10B981', bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-500', borderClass: 'border-emerald-500', desc: 'Something you listened to recently' },
];

const POST_TEMPLATES: Array<{
    key: string;
    label: string;
    hint: string;
    suggestedType: PostType;
    captionStarter: string;
}> = [
    { key: 'on_repeat', label: 'On Repeat', hint: 'Loop-worthy right now', suggestedType: 'now_playing', captionStarter: 'On repeat this week.' },
    { key: 'hidden_gem', label: 'Hidden Gem', hint: 'Underrated discovery', suggestedType: 'loved', captionStarter: 'Hidden gem alert.' },
    { key: 'vinyl_pick', label: 'Vinyl Pick', hint: 'Collection favorite spin', suggestedType: 'spin', captionStarter: 'Vinyl pick of the day.' },
    { key: 'throwback', label: 'Throwback', hint: 'Nostalgic revisit', suggestedType: 'history', captionStarter: 'Throwback that still hits.' },
];

export default function ShareScreen({ navigation }: any) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MusicSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState<MusicSearchResult | null>(null);
    const [postType, setPostType] = useState<PostType>('loved');
    const [caption, setCaption] = useState('');
    const [posting, setPosting] = useState(false);
    const [promptSeed, setPromptSeed] = useState(0);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const insets = useSafeAreaInsets();

    const contextualPrompts = useMemo(() => {
        const hour = new Date().getHours();
        const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'night';

        const byType: Record<PostType, string[]> = {
            now_playing: [
                'Soundtracking this exact moment.',
                'This one is on repeat right now.',
                'Current mood in one track.',
            ],
            loved: [
                'This track never misses for me.',
                'Instant favorite energy.',
                'I keep coming back to this one.',
            ],
            history: [
                'Pulled this from my recent listens.',
                'Been revisiting this gem today.',
                'This popped up in my listening history.',
            ],
            spin: [
                'Giving this another spin today.',
                'From the collection to the speakers.',
                'Spinning this and loving every second.',
            ],
        };

        const byTime: Record<'morning' | 'afternoon' | 'night', string[]> = {
            morning: [
                'Morning soundtrack check-in.',
                'Starting the day with this vibe.',
            ],
            afternoon: [
                'Afternoon energy booster.',
                'Midday pick-me-up track.',
            ],
            night: [
                'Late-night listen that hits different.',
                'Ending the day with this one.',
            ],
        };

        const selectedHint = selected
            ? [`Sharing: ${selected.track_title} by ${selected.artist}.`]
            : ['Share your first spin today.'];

        const pool = [...selectedHint, ...byType[postType], ...byTime[timeOfDay]];
        const rotated = pool.slice(promptSeed % pool.length).concat(pool.slice(0, promptSeed % pool.length));
        return rotated.slice(0, 4);
    }, [postType, selected, promptSeed]);

    const applyPrompt = (prompt: string) => {
        setCaption(prev => {
            if (!prev.trim()) return prompt;
            return `${prev.trim()} ${prompt}`;
        });
    };

    const applyTemplate = (templateKey: string) => {
        const template = POST_TEMPLATES.find(t => t.key === templateKey);
        if (!template) return;

        setSelectedTemplate(templateKey);
        setPostType(template.suggestedType);
        setCaption(prev => {
            if (!prev.trim()) return template.captionStarter;
            if (prev.includes(template.captionStarter)) return prev;
            return `${template.captionStarter} ${prev}`;
        });
    };

    const searchMusic = useCallback(async (q: string) => {
        setQuery(q);
        if (!q.trim() || q.length < 2) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await musicApi.search(q.trim());
            setResults(res.data);
        } catch { }
        setSearching(false);
    }, []);

    const selectTrack = (track: MusicSearchResult) => {
        setSelected(track);
        setResults([]);
        setQuery('');
    };

    const clearTrack = () => {
        setSelected(null);
        setQuery('');
        setResults([]);
    };

    const submit = async () => {
        if (!selected) {
            Toast.show({
                type: 'error',
                text1: 'No track selected',
                text2: 'Search and select a track first!',
                position: 'bottom',
                bottomOffset: 100,
            });
            return;
        }
        setPosting(true);
        try {
            await postsApi.create({
                track_title: selected.track_title,
                artist: selected.artist,
                album: selected.album,
                album_art_url: selected.album_art_url,
                caption,
                post_type: postType,
                preview_url: selected.preview_url,
                genre: selected.genre,
            });
            setSelected(null);
            setCaption('');
            setPostType('loved');
            
            // Navigate FIRST, before React applies the state changes completely, to avoid mounting errors.
            navigation.navigate('Feed');
            
            // Add a small delay for Toast to ensure the new screen is mounted first
            setTimeout(() => {
                Toast.show({
                    type: 'success',
                    text1: 'Posted! 🎵',
                    text2: 'Your track has been shared.',
                    position: 'bottom',
                    bottomOffset: 100,
                });
            }, 100);
        } catch (e: any) {
            // Error is handled globally by api/client.ts
        }
        setPosting(false);
    };

    return (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                className="flex-1 bg-black"
                contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View className="flex-row gap-4 items-center mb-8">
                    <View className="w-10 h-10 bg-[#FA243C] rounded-lg shadow-sm shadow-[#FA243C]/20 justify-center items-center">
                        <Ionicons name="add" size={24} color="white" />
                    </View>
                    <Text className="text-white font-bold text-3xl tracking-tight">Share a Track</Text>
                </View>

                {/* Track picker */}
                <View className="flex-col gap-2 mb-8">
                    <Text className="text-sm font-semibold text-gray-400 uppercase tracking-widest pl-1">Search for a track</Text>

                    {!selected ? (
                        <View className="flex-col gap-2">
                            <View className="flex-row items-center border border-white/10 rounded-xl h-14 bg-white/5 backdrop-blur-md px-3">
                                <View className="pl-3 justify-center items-center">
                                    <Ionicons name="search" size={20} color={Colors.textSecondary} />
                                </View>
                                <TextInput
                                    className="flex-1 text-white text-base pl-3 h-full"
                                    placeholderTextColor="#6b7280"
                                    placeholder="Artist, song name..."
                                    value={query}
                                    onChangeText={searchMusic}
                                    returnKeyType="search"
                                    keyboardAppearance="dark"
                                />
                                {searching && (
                                    <View className="pr-3 justify-center items-center">
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    </View>
                                )}
                            </View>

                            {results.length > 0 && (
                                <View style={{ marginTop: 8, gap: 8 }}>
                                    {results.map((item, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            activeOpacity={0.75}
                                            onPress={() => selectTrack(item)}
                                            style={ss.resultCard}
                                        >
                                            {item.album_art_url ? (
                                                <Image source={{ uri: item.album_art_url }} style={ss.resultArt} />
                                            ) : (
                                                <View style={[ss.resultArt, { backgroundColor: '#1c1c1e', alignItems: 'center', justifyContent: 'center' }]}>
                                                    <Ionicons name="musical-note" size={20} color="#4b5563" />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={ss.resultTitle} numberOfLines={1}>{item.track_title}</Text>
                                                <Text style={ss.resultArtist} numberOfLines={1}>{item.artist}</Text>
                                                {item.album ? (
                                                    <Text style={ss.resultAlbum} numberOfLines={1}>{item.album}</Text>
                                                ) : null}
                                            </View>
                                            <Ionicons name="add-circle-outline" size={22} color="#4b5563" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : (
                        <View className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-md shadow-sm">
                            <View className="flex-row gap-4 items-center p-4">
                                {selected.album_art_url ? (
                                    <Image source={{ uri: selected.album_art_url }} className="w-20 h-20 rounded-xl shadow-sm" alt="art" />
                                ) : (
                                    <View className="w-20 h-20 rounded-xl bg-[#FA243C] shadow-sm shadow-[#FA243C]/20 justify-center items-center">
                                        <Ionicons name="musical-notes" size={32} color="white" />
                                    </View>
                                )}

                                <View className="flex-1 flex-col justify-center">
                                    <Text className="text-white font-bold leading-tight text-lg" numberOfLines={2}>{selected.track_title}</Text>
                                    <Text className="text-[#FA243C] text-sm mt-1 font-medium">{selected.artist}</Text>
                                    {selected.album ? <Text className="text-gray-400 text-xs mt-1">{selected.album}</Text> : null}
                                    {selected.genre ? (
                                        <View className="bg-[#FA243C]/10 rounded-full px-2 py-0.5 self-start mt-2 border border-[#FA243C]/30">
                                            <Text className="text-[#FA243C] text-[10px] uppercase font-bold">{selected.genre}</Text>
                                        </View>
                                    ) : null}
                                </View>

                                <TouchableOpacity onPress={clearTrack} className="p-2 self-start">
                                    <Ionicons name="close-circle" size={24} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Post type selector */}
                <View className="flex-col gap-2 mb-8">
                    <Text className="text-sm font-semibold text-gray-400 uppercase tracking-widest pl-1">Post type</Text>
                    <View className="flex-col gap-4">
                        {POST_TYPE_OPTIONS.map(opt => {
                            const active = postType === opt.key;
                            return (
                                <TouchableOpacity
                                    key={opt.key}
                                    onPress={() => setPostType(opt.key)}
                                    className={`bg-white/5 rounded-2xl border-2 p-4 relative ${active ? `border-[#FA243C] bg-white/10` : 'border-white/5'}`}
                                >
                                    <View className="flex-row gap-2 items-center mb-1">
                                        <View className={`w-8 h-8 rounded justify-center items-center ${opt.bgClass}`}>
                                            <Ionicons name={opt.icon} size={18} color={opt.color} />
                                        </View>
                                        <Text className={`font-semibold ${active ? opt.textClass : 'text-white'}`}>{opt.label}</Text>
                                    </View>
                                    <Text className="text-gray-400 text-xs ml-10">{opt.desc}</Text>

                                    {active && (
                                        <View className="absolute top-4 right-4 w-6 h-6 rounded-full justify-center items-center bg-[#FA243C]">
                                            <Ionicons name="checkmark-circle" size={20} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Caption */}
                <View className="flex-col gap-2 mb-8">
                    <Text className="text-sm font-semibold text-gray-400 uppercase tracking-widest pl-1">Caption (optional)</Text>

                    <View style={{ marginBottom: 4 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Template mode</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                            {POST_TEMPLATES.map((template) => {
                                const active = selectedTemplate === template.key;
                                return (
                                    <TouchableOpacity
                                        key={template.key}
                                        onPress={() => applyTemplate(template.key)}
                                        style={{
                                            borderWidth: 1,
                                            borderColor: active ? 'rgba(250,36,60,0.45)' : 'rgba(255,255,255,0.12)',
                                            backgroundColor: active ? 'rgba(250,36,60,0.14)' : 'rgba(255,255,255,0.06)',
                                            borderRadius: 12,
                                            paddingHorizontal: 10,
                                            paddingVertical: 8,
                                            minWidth: 110,
                                        }}
                                    >
                                        <Text style={{ color: active ? '#ffd3d8' : '#e5e7eb', fontSize: 12, fontWeight: '700' }}>{template.label}</Text>
                                        <Text style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }} numberOfLines={1}>{template.hint}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '600' }}>Prompt ideas</Text>
                        <TouchableOpacity onPress={() => setPromptSeed(prev => prev + 1)} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                            <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700' }}>Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                        {contextualPrompts.map((prompt, idx) => (
                            <TouchableOpacity
                                key={`${idx}-${prompt}`}
                                onPress={() => applyPrompt(prompt)}
                                style={{
                                    borderWidth: 1,
                                    borderColor: 'rgba(250,36,60,0.35)',
                                    backgroundColor: 'rgba(250,36,60,0.12)',
                                    borderRadius: 999,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                }}
                            >
                                <Text style={{ color: '#ffd3d8', fontSize: 12, fontWeight: '600' }}>{prompt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View className="flex-row items-center border border-white/10 rounded-2xl min-h-[100px] bg-white/5 px-3">
                        <TextInput
                            className="flex-1 text-white text-base py-3 h-full justify-start items-start"
                            style={{ textAlignVertical: 'top' }}
                            placeholderTextColor="#6b7280"
                            placeholder="What do you think of this track? 🎵"
                            value={caption}
                            onChangeText={setCaption}
                            multiline
                            maxLength={500}
                            keyboardAppearance="dark"
                        />
                    </View>
                    <Text className="text-gray-500 text-xs text-right mt-1">{caption.length}/500</Text>
                </View>

                {/* Submit */}
                <TouchableOpacity
                    className={`h-14 rounded-full flex-row justify-center items-center ${selected ? 'bg-[#FA243C] shadow-sm shadow-[#FA243C]/20' : 'bg-white/5 border border-white/10'} ${posting ? 'opacity-70' : ''}`}
                    onPress={submit}
                    disabled={posting || !selected}
                >
                    {posting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Ionicons name="share-outline" size={20} color={selected ? Colors.textInverse : Colors.textMuted} className="mr-2" style={{ marginRight: 8 }} />
                            <Text className={`font-semibold text-lg ${selected ? 'text-white' : 'text-gray-500'}`}>Share Track</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const ss = StyleSheet.create({
    resultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    resultArt: {
        width: 48,
        height: 48,
        borderRadius: 10,
    },
    resultTitle: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    resultArtist: {
        color: Colors.primary,
        fontSize: 12,
        marginTop: 2,
    },
    resultAlbum: {
        color: '#6b7280',
        fontSize: 11,
        marginTop: 1,
    },
});
