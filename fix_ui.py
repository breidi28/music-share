import sys

with open('src/screens/ProfileScreen.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start_str = '    const renderTopNav = () => ('
end_str = '    return (\n        <View className="flex-1 bg-black">'

start_idx = text.find(start_str)
end_idx = text.find(end_str)

if start_idx == -1 or end_idx == -1:
    print('Failed to find indices')
    sys.exit(1)

new_jsx = """    const renderTopNav = () => (
        <BlurView
            intensity={90}
            tint="dark"
            style={{ 
                paddingTop: insets.top, 
                position: 'absolute', 
                top: 0, left: 0, right: 0, 
                zIndex: 10,
                borderBottomWidth: StyleSheet.hairlineWidth, 
                borderBottomColor: 'rgba(255,255,255,0.1)' 
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 44 }}>
                {!isMe ? (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, flexDirection: 'row', alignItems: 'center', marginLeft: -8 }}>
                        <Ionicons name="chevron-back" size={28} color={Colors.primary} />
                        <Text style={{ color: Colors.primary, fontSize: 17, marginLeft: -4 }}>Back</Text>
                    </TouchableOpacity>
                ) : <View style={{ width: 60 }} />}

                <Text style={{ color: 'white', fontWeight: '600', fontSize: 17, letterSpacing: -0.4 }}>
                    {profile?.username || 'Profile'}
                </Text>

                {isMe ? (
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('Settings')} 
                        style={{ padding: 4, width: 60 }}
                    >
                        <Ionicons name="gear-outline" size={24} color={Colors.primary} style={{ alignSelf: 'flex-end' }} />
                    </TouchableOpacity>
                ) : <View style={{ width: 60 }} />}
            </View>
        </BlurView>
    );

    const renderHeader = () => (
        <View style={{ paddingTop: insets.top + 60, zIndex: 10, paddingBottom: 10 }}>
            {/* ── Identity ───────────────────────────────────────────── */}
            <View style={{ alignItems: 'center', paddingHorizontal: 24, zIndex: 1 }}>

                {profile?.avatar_url ? (
                    <Image
                        source={{ uri: getAvatarUrl(profile.avatar_url) }}
                        style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#2C2C2E', marginBottom: 16 }}
                    />
                ) : (
                    <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Text style={{ color: 'white', fontSize: 36, fontWeight: '600' }}>{profile?.display_name?.[0]?.toUpperCase()}</Text>
                    </View>
                )}

                <Text style={{ color: 'white', fontWeight: '700', fontSize: 28, letterSpacing: 0.35 }}>{profile?.display_name}</Text>
                <Text style={{ color: '#8E8E93', fontSize: 15, marginTop: 4, fontWeight: '400' }}>@{profile?.username}</Text>

                {profile?.bio ? (
                    <Text style={{ color: '#EBEBF5', textAlign: 'center', fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 300 }}>{profile.bio}</Text>
                ) : null}

                {/* Genre pills - more subtle for Apple design */}
                {profile?.favorite_genres ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                        {profile.favorite_genres.split(',').filter(Boolean).map(g => (
                            <View key={g} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1C1C1E' }}>
                                <Text style={{ color: '#EBEBF5', fontSize: 13, fontWeight: '500' }}>{g.trim()}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}

                {/* Actions Row */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
                    {isMe ? (
                        <TouchableOpacity
                            onPress={() => {
                                setEditData({
                                    display_name: profile?.display_name || '',
                                    bio: profile?.bio || '',
                                    favorite_genres: profile?.favorite_genres || '',
                                    avatar_url: profile?.avatar_url || ''
                                });
                                setEditMode(true);
                            }}
                            style={{ flex: 1, backgroundColor: '#2C2C2E', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                        >
                            <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Edit Profile</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={handleFollow}
                                style={{ flex: 1, borderRadius: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: profile?.is_following ? '#2C2C2E' : Colors.primary }}
                            >
                                <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{profile?.is_following ? 'Following' : 'Follow'}</Text>
                            </TouchableOpacity>
                            {tasteMatch !== null && (
                                <View style={{ backgroundColor: 'rgba(191,90,242,0.15)', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: '#BF5AF2', fontWeight: '700', fontSize: 15 }}>{tasteMatch}%</Text>
                                    <Text style={{ color: '#BF5AF2', fontSize: 10, fontWeight: '600', marginTop: 2 }}>MATCH</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </View>

            {/* ── Stats card (Inset Grouped Style) ────────────────────── */}
            <View style={{ marginHorizontal: 16, marginTop: 24, flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 14, overflow: 'hidden' }}>
                {[
                    { label: 'Posts', val: profile?.posts_count ?? 0, onPress: null }, 
                    { label: 'Followers', val: profile?.followers_count ?? 0, onPress: () => navigation.navigate('FollowersList', { userId: targetId, listType: 'followers', username: profile?.username }) }, 
                    { label: 'Following', val: profile?.following_count ?? 0, onPress: () => navigation.navigate('FollowersList', { userId: targetId, listType: 'following', username: profile?.username }) },
                    { label: 'Collection', val: profile?.collection_count ?? 0, onPress: () => navigation.navigate('Collection', { userId: targetId, username: profile?.username }) }
                ].map((s, i, arr) => {
                    const Wrapper = s.onPress ? TouchableOpacity : View;
                    return (
                        <Wrapper key={s.label} onPress={s.onPress || undefined} style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRightWidth: i < arr.length - 1 ? StyleSheet.hairlineWidth : 0, borderRightColor: '#38383A' }}>
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>{s.val}</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 4, fontWeight: '500' }}>{s.label}</Text>
                        </Wrapper>
                    );
                })}
            </View>

            {/* ── Listening Streak Badge ─────────────────────────────── */}
            {profile && profile.current_streak > 0 && (
                <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: '#1C1C1E', borderRadius: 14, padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 32 }}>🔥</Text>
                        <View>
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 17 }}>{profile.current_streak} Day Streak!</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 3 }}>Longest: {profile.longest_streak} days</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* ── Live Now Playing ───────────────────────────────────── */}
            {liveTrack && (
                <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: '#1C1C1E', borderRadius: 14, padding: 16, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <Ionicons name="musical-notes" size={14} color="#34C759" />
                        <Text style={{ color: '#34C759', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', flex: 1 }}>Live on Spotify</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                        {liveTrack.album_art_url ? (
                            <Image source={{ uri: liveTrack.album_art_url }} style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#2C2C2E' }} />
                        ) : (
                            <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#34C759', justifyContent: 'center', alignItems: 'center' }}>
                                <FontAwesome5 name="music" size={24} color="black" />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }} numberOfLines={1}>{liveTrack.track_title}</Text>
                            <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 2 }} numberOfLines={1}>{liveTrack.artist}</Text>
                            {liveTrack.duration_ms > 0 && (
                                <View style={{ marginTop: 10, height: 4, backgroundColor: '#38383A', borderRadius: 2, overflow: 'hidden' }}>
                                    <View style={{ height: 4, backgroundColor: '#34C759', width: `${Math.round((liveTrack.progress_ms / liveTrack.duration_ms) * 100)}%` }} />
                                </View>
                            )}
                        </View>
                    </View>

                    {isMe && (
                        <TouchableOpacity
                            onPress={handleShareLive}
                            disabled={sharingLive}
                            style={{ marginTop: 16, backgroundColor: '#2C2C2E', borderRadius: 10, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                        >
                            {sharingLive
                                ? <ActivityIndicator color="white" size="small" />
                                : <><Ionicons name="share-outline" size={18} color="white" /><Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Share to Feed</Text></>}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* ── Music Service Stats ────────────────────────────────── */}
            {(profile?.has_spotify_linked || profile?.has_youtube_linked || profile?.has_apple_music_linked) && (
                <View style={{ marginHorizontal: 20, marginTop: 20 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
                        {selectedMusicService === 'spotify' && 'Spotify Stats'}
                        {selectedMusicService === 'youtube' && 'YouTube Music'}
                        {selectedMusicService === 'apple' && 'Apple Music'}
                    </Text>

                    {/* Spotify tabs */}
                    {selectedMusicService === 'spotify' && profile?.has_spotify_linked && (
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                            {(['recent', 'artists', 'playlists'] as const).map(tab => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setSpotifyTab(tab)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, borderWidth: 1, backgroundColor: spotifyTab === tab ? Colors.primary : 'rgba(255,255,255,0.05)', borderColor: spotifyTab === tab ? Colors.primary : 'rgba(255,255,255,0.1)' }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: spotifyTab === tab ? 'white' : '#9ca3af' }}>
                                        {tab === 'recent' ? 'Recent' : tab === 'artists' ? 'Top Artists' : 'Playlists'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Spotify Data */}
                    {selectedMusicService === 'spotify' && profile?.has_spotify_linked && (
                        spotifyLoading ? (
                            <ActivityIndicator color="#34C759" />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {spotifyTab === 'recent' && spotifyRecent.map((t, i) => (
                                    <TouchableOpacity key={i} onPress={() => t.spotify_url && Linking.openURL(t.spotify_url)} style={{ width: 120 }}>
                                        {t.album_art_url
                                            ? <Image source={{ uri: t.album_art_url }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                                            : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E' }} />}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{t.track_title}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{t.artist}</Text>
                                    </TouchableOpacity>
                                ))}
                                {spotifyTab === 'artists' && spotifyArtists.map((a, i) => (
                                    <TouchableOpacity key={i} onPress={() => a.spotify_url && Linking.openURL(a.spotify_url)} style={{ width: 100, alignItems: 'center' }}>
                                        {a.image_url
                                            ? <Image source={{ uri: a.image_url }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                                            : <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#2C2C2E' }} />}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' }} numberOfLines={1}>{a.name}</Text>
                                        {a.genres?.[0] && <Text style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', marginTop: 2 }} numberOfLines={1}>{a.genres[0]}</Text>}
                                    </TouchableOpacity>
                                ))}
                                {spotifyTab === 'playlists' && spotifyPlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.spotify_url && Linking.openURL(p.spotify_url)} style={{ width: 120 }}>
                                        {p.image_url
                                            ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                                            : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}>
                                                <FontAwesome5 name="list-ul" size={24} color="#8E8E93" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {((spotifyTab === 'recent' && spotifyRecent.length === 0) ||
                                    (spotifyTab === 'artists' && spotifyArtists.length === 0) ||
                                    (spotifyTab === 'playlists' && spotifyPlaylists.length === 0)) && (
                                    <Text style={{ color: '#8E8E93', fontSize: 15, paddingVertical: 12, paddingHorizontal: 16 }}>
                                        {spotifyTab === 'recent' ? 'No recent tracks' : spotifyTab === 'artists' ? 'No top artists yet' : 'No playlists found'}
                                    </Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* YouTube Music Data */}
                    {selectedMusicService === 'youtube' && profile?.has_youtube_linked && (
                        youtubeLoading ? (
                            <ActivityIndicator color="#FF3B30" />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {youtubePlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.youtube_url && Linking.openURL(p.youtube_url)} style={{ width: 120 }}>
                                        {p.image_url
                                            ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                                            : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}>
                                                <FontAwesome5 name="youtube" size={24} color="#FF3B30" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{p.track_count} videos</Text>
                                    </TouchableOpacity>
                                ))}
                                {youtubePlaylists.length === 0 && (
                                    <Text style={{ color: '#8E8E93', fontSize: 15, paddingVertical: 12, paddingHorizontal: 16 }}>No playlists found</Text>
                                )}
                            </ScrollView>
                        )
                    )}

                    {/* Apple Music Data */}
                    {selectedMusicService === 'apple' && profile?.has_apple_music_linked && (
                        appleLoading ? (
                            <ActivityIndicator color="#FF2D55" />
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
                                {applePlaylists.map((p, i) => (
                                    <TouchableOpacity key={i} onPress={() => p.apple_url && Linking.openURL(p.apple_url)} style={{ width: 120 }}>
                                        {p.image_url
                                            ? <Image source={{ uri: p.image_url }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                                            : <View style={{ width: 120, height: 120, borderRadius: 8, backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' }}>
                                                <FontAwesome5 name="apple" size={24} color="#FF2D55" /></View>}
                                        <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }} numberOfLines={1}>{p.name}</Text>
                                        <Text style={{ color: '#8E8E93', fontSize: 13, marginTop: 2 }} numberOfLines={1}>{p.track_count} tracks</Text>
                                    </TouchableOpacity>
                                ))}
                                {applePlaylists.length === 0 && (
                                    <Text style={{ color: '#8E8E93', fontSize: 15, paddingVertical: 12, paddingHorizontal: 16 }}>No playlists found</Text>
                                )}
                            </ScrollView>
                        )
                    )}
                </View>
            )}

            {/* ── Filter tabs ────────────────────────────────────────── */}
            <View style={{ marginTop: 24, paddingBottom: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                    {FILTER_TABS.map(tab => {
                        const active = filter === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setFilter(tab.key)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? '#FFFFFF' : '#1C1C1E' }}
                            >
                                <Ionicons name={tab.icon} size={15} color={active ? 'black' : '#8E8E93'} />
                                <Text style={{ fontSize: 15, fontWeight: '600', color: active ? 'black' : '#8E8E93' }}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
"""

new_text = text[:start_idx] + new_jsx + '\n' + text[end_idx:]

with open('src/screens/ProfileScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Success')
