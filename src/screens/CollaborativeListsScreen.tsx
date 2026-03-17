import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { CollabList, MusicSearchResult, User } from '../types';
import { collabListsApi, musicApi, usersApi } from '../api/endpoints';
import { Colors } from '../theme';
import { Layout, Surface } from '../theme/layout';
import { AppCard } from '../components/ui/Primitives';

export default function CollaborativeListsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [lists, setLists] = useState<CollabList[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedList, setSelectedList] = useState<CollabList | null>(null);
    const [createName, setCreateName] = useState('');
    const [createDesc, setCreateDesc] = useState('');
    const [creating, setCreating] = useState(false);
    const [trackQuery, setTrackQuery] = useState('');
    const [trackResults, setTrackResults] = useState<MusicSearchResult[]>([]);
    const [searchingTracks, setSearchingTracks] = useState(false);
    const [inviteQuery, setInviteQuery] = useState('');
    const [inviteResults, setInviteResults] = useState<User[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await collabListsApi.getAll();
            setLists(res.data || []);
            if (selectedList) {
                const found = (res.data || []).find(l => l.id === selectedList.id) || null;
                setSelectedList(found);
            }
        } catch {
            Toast.show({ type: 'error', text1: 'Failed to load collaborative lists' });
        }
        setLoading(false);
    };

    React.useEffect(() => {
        load();
    }, []);

    const createList = async () => {
        if (!createName.trim()) return;
        setCreating(true);
        try {
            await collabListsApi.create({ name: createName.trim(), description: createDesc.trim() });
            setCreateName('');
            setCreateDesc('');
            Toast.show({ type: 'success', text1: 'List created' });
            await load();
        } catch {
            Toast.show({ type: 'error', text1: 'Failed to create list' });
        }
        setCreating(false);
    };

    const searchTracks = async (q: string) => {
        setTrackQuery(q);
        if (!q.trim() || q.length < 2 || !selectedList) {
            setTrackResults([]);
            return;
        }
        setSearchingTracks(true);
        try {
            const res = await musicApi.search(q.trim());
            setTrackResults(res.data || []);
        } catch {
            setTrackResults([]);
        }
        setSearchingTracks(false);
    };

    const addTrack = async (track: MusicSearchResult) => {
        if (!selectedList) return;
        try {
            await collabListsApi.addTrack(selectedList.id, {
                track_title: track.track_title,
                artist: track.artist,
                album: track.album,
                album_art_url: track.album_art_url,
                source_service: 'itunes',
                source_url: track.preview_url || '',
            });
            setTrackQuery('');
            setTrackResults([]);
            await load();
            Toast.show({ type: 'success', text1: 'Track added to list' });
        } catch {
            Toast.show({ type: 'error', text1: 'Failed to add track' });
        }
    };

    const removeTrack = async (trackId: number) => {
        if (!selectedList) return;
        Alert.alert('Remove track', 'Remove this track from the list?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await collabListsApi.removeTrack(selectedList.id, trackId);
                        await load();
                    } catch {
                        Toast.show({ type: 'error', text1: 'Failed to remove track' });
                    }
                },
            },
        ]);
    };

    const searchUsers = async (q: string) => {
        setInviteQuery(q);
        if (!q.trim() || q.length < 2 || !selectedList) {
            setInviteResults([]);
            return;
        }
        setSearchingUsers(true);
        try {
            const res = await usersApi.search(q.trim());
            setInviteResults(res.data || []);
        } catch {
            setInviteResults([]);
        }
        setSearchingUsers(false);
    };

    const inviteUser = async (userId: number) => {
        if (!selectedList) return;
        try {
            await collabListsApi.invite(selectedList.id, userId);
            setInviteQuery('');
            setInviteResults([]);
            await load();
            Toast.show({ type: 'success', text1: 'Member invited' });
        } catch {
            Toast.show({ type: 'error', text1: 'Invite failed' });
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
            <View style={{ paddingTop: insets.top, borderBottomWidth: Layout.border.hairline, borderBottomColor: Surface.borderStrong, backgroundColor: Surface.page }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Layout.space[4], paddingVertical: Layout.space[3] }}>
                    <TouchableOpacity onPress={() => (selectedList ? setSelectedList(null) : navigation.goBack())} style={{ marginRight: Layout.space[2] }}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: 30, fontWeight: '700', letterSpacing: -0.5, flex: 1 }}>
                        {selectedList ? selectedList.name : 'Collaborative Lists'}
                    </Text>
                </View>
            </View>

            {!selectedList ? (
                <FlatList
                    data={lists}
                    keyExtractor={item => String(item.id)}
                    ListHeaderComponent={
                        <View style={{ padding: Layout.space[3], gap: Layout.space[2] }}>
                            <TextInput
                                value={createName}
                                onChangeText={setCreateName}
                                placeholder="List name"
                                placeholderTextColor="#6b7280"
                                style={{ backgroundColor: Surface.card, color: 'white', borderRadius: Layout.radius.md, paddingHorizontal: Layout.space[3], paddingVertical: Layout.space[2] }}
                            />
                            <TextInput
                                value={createDesc}
                                onChangeText={setCreateDesc}
                                placeholder="Description (optional)"
                                placeholderTextColor="#6b7280"
                                style={{ backgroundColor: Surface.card, color: 'white', borderRadius: Layout.radius.md, paddingHorizontal: Layout.space[3], paddingVertical: Layout.space[2] }}
                            />
                            <TouchableOpacity
                                onPress={createList}
                                disabled={creating || !createName.trim()}
                                style={{ backgroundColor: createName.trim() ? Colors.primary : '#27272a', borderRadius: Layout.radius.md, alignItems: 'center', paddingVertical: Layout.space[2], minHeight: Layout.touch.minTarget, justifyContent: 'center' }}
                            >
                                {creating ? <ActivityIndicator size="small" color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Create List</Text>}
                            </TouchableOpacity>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => setSelectedList(item)}
                            style={{ marginHorizontal: Layout.space[3], marginBottom: Layout.space[2] }}
                        >
                            <AppCard>
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{item.name}</Text>
                                {!!item.description && <Text style={{ color: '#9ca3af', marginTop: 4 }} numberOfLines={2}>{item.description}</Text>}
                                <Text style={{ color: '#6b7280', marginTop: Layout.space[2], fontSize: 12 }}>{item.member_count} members • {item.track_count} tracks</Text>
                            </AppCard>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 40 }}>No collaborative lists yet.</Text>}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            ) : (
                <FlatList
                    data={selectedList.tracks || []}
                    keyExtractor={item => String(item.id)}
                    ListHeaderComponent={
                        <View style={{ padding: Layout.space[3], gap: Layout.space[2] }}>
                            <Text style={{ color: '#9ca3af', fontSize: 13 }}>{selectedList.member_count} members • {selectedList.track_count} tracks</Text>

                            <TextInput
                                value={trackQuery}
                                onChangeText={searchTracks}
                                placeholder="Search track to add"
                                placeholderTextColor="#6b7280"
                                style={{ backgroundColor: Surface.card, color: 'white', borderRadius: Layout.radius.md, paddingHorizontal: Layout.space[3], paddingVertical: Layout.space[2] }}
                            />
                            {searchingTracks && <ActivityIndicator size="small" color={Colors.primary} />}
                            {trackResults.slice(0, 5).map((item, idx) => (
                                <TouchableOpacity key={`${item.track_id}-${idx}`} onPress={() => addTrack(item)} style={{ backgroundColor: Surface.input, borderRadius: Layout.radius.sm, padding: Layout.space[2], minHeight: Layout.touch.minTarget, justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontWeight: '600' }} numberOfLines={1}>{item.track_title}</Text>
                                    <Text style={{ color: '#9ca3af' }} numberOfLines={1}>{item.artist}</Text>
                                </TouchableOpacity>
                            ))}

                            <TextInput
                                value={inviteQuery}
                                onChangeText={searchUsers}
                                placeholder="Search user to invite"
                                placeholderTextColor="#6b7280"
                                style={{ backgroundColor: Surface.card, color: 'white', borderRadius: Layout.radius.md, paddingHorizontal: Layout.space[3], paddingVertical: Layout.space[2], marginTop: Layout.space[2] }}
                            />
                            {searchingUsers && <ActivityIndicator size="small" color={Colors.primary} />}
                            {inviteResults.slice(0, 5).map((u) => (
                                <TouchableOpacity key={u.id} onPress={() => inviteUser(u.id)} style={{ backgroundColor: Surface.input, borderRadius: Layout.radius.sm, padding: Layout.space[2], minHeight: Layout.touch.minTarget, justifyContent: 'center' }}>
                                    <Text style={{ color: 'white', fontWeight: '600' }}>@{u.username}</Text>
                                    <Text style={{ color: '#9ca3af' }}>{u.display_name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={{ marginHorizontal: Layout.space[3], marginBottom: Layout.space[2] }}>
                            <AppCard style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {item.album_art_url ? (
                                <Image source={{ uri: item.album_art_url }} style={{ width: 46, height: 46, borderRadius: Layout.radius.sm, marginRight: Layout.space[2] }} />
                            ) : (
                                <View style={{ width: 46, height: 46, borderRadius: Layout.radius.sm, marginRight: Layout.space[2], backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="musical-notes" size={18} color="#9ca3af" />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: 'white', fontWeight: '700' }} numberOfLines={1}>{item.track_title}</Text>
                                <Text style={{ color: '#9ca3af' }} numberOfLines={1}>{item.artist}{item.album ? ` • ${item.album}` : ''}</Text>
                            </View>
                            <TouchableOpacity onPress={() => removeTrack(item.id)} style={{ minWidth: Layout.touch.iconButton, minHeight: Layout.touch.iconButton, justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="trash-outline" size={18} color="#9ca3af" />
                            </TouchableOpacity>
                            </AppCard>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 20 }}>No tracks yet.</Text>}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}
        </View>
    );
}
