import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View, Text, Image, Animated, Share, StyleSheet, Linking, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Post, PostType, ReactionType } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '../theme';
import { API_BASE_URL } from '../api/client';
import { Layout, Surface } from '../theme/layout';
import { AppChip, AppIconButton } from './ui/Primitives';
import { MenuModal, MenuOption } from './ui/MenuModal';

// Helper to get full avatar URL
const getAvatarUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return API_BASE_URL.replace('/api', '') + url;
};

interface Props {
    post: Post;
    onLike: (postId: number) => void;
    onComment: (post: Post) => void;
    onAuthorPress: (userId: number) => void;
    onSaveToCollection?: (post: Post) => void;
    onQuickReact?: (postId: number, reaction: ReactionType) => void;
    onListenLater?: (post: Post) => void;
    onDelete?: (postId: number) => void;
    isOwn?: boolean;
}

const TYPE_CFG: Record<PostType, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
    now_playing: { label: 'Now Playing', icon: 'radio',          color: Colors.primary },
    loved:       { label: 'Loved',       icon: 'heart',          color: Colors.primary },
    history:     { label: 'History',     icon: 'time-outline',   color: '#9ca3af' },
    spin:        { label: 'Spinning',    icon: 'disc',           color: '#10B981' },
};

type SourceService = 'spotify' | 'youtube' | 'apple' | 'external';

const detectSourceService = (post: Post): SourceService | null => {
    const haystack = `${post.spotify_url || ''} ${post.preview_url || ''}`.toLowerCase();
    if (!haystack.trim()) return null;
    if (haystack.includes('spotify')) return 'spotify';
    if (haystack.includes('youtube') || haystack.includes('youtu.be')) return 'youtube';
    if (haystack.includes('music.apple.com') || haystack.includes('apple')) return 'apple';
    return 'external';
};

const SOURCE_CFG: Record<SourceService, { label: string; color: string }> = {
    spotify: { label: 'Spotify', color: '#1DB954' },
    youtube: { label: 'YouTube', color: '#FF0000' },
    apple: { label: 'Apple Music', color: '#FC3A6E' },
    external: { label: 'Source', color: '#60A5FA' },
};

const AVATAR_COLORS = ['#3B82F6', '#EC4899', '#10B981', '#6366F1', '#F59E0B'];

// ─── Animated equaliser bar ──────────────────────────────────────────────────
const EqBar = ({ delay, peak }: { delay: number; peak: number }) => {
    const h = useRef(new Animated.Value(3)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(h, { toValue: peak, duration: 400, useNativeDriver: false }),
                Animated.timing(h, { toValue: 3,    duration: 400, useNativeDriver: false }),
            ])
        );
        const t = setTimeout(() => loop.start(), delay);
        return () => { clearTimeout(t); loop.stop(); };
    }, []);
    return <Animated.View style={{ width: 3, height: h, backgroundColor: 'white', borderRadius: 2, opacity: 0.85 }} />;
};

export default function PostCard({
    post,
    onLike,
    onComment,
    onAuthorPress,
    onSaveToCollection,
    onQuickReact,
    onListenLater,
    onDelete,
    isOwn,
}: Props) {
    const [sound,     setSound]     = React.useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [menuVisible, setMenuVisible] = React.useState(false);

    useEffect(() => {
        return sound ? () => { sound.unloadAsync(); } : undefined;
    }, [sound]);

    const togglePreview = async () => {
        if (!post.preview_url) return;
        if (sound) {
            if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
            else           { await sound.playAsync();  setIsPlaying(true);  }
            return;
        }
        try {
            const { sound: s } = await Audio.Sound.createAsync(
                { uri: post.preview_url },
                { shouldPlay: true },
                (st) => { if (st.isLoaded && st.didJustFinish) { setIsPlaying(false); s.setPositionAsync(0); } }
            );
            setSound(s);
            setIsPlaying(true);
        } catch {}
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `🎵 "${post.track_title}" by ${post.artist} — shared via tuneshare`,
            });
        } catch {}
    };

    const handleOpenSource = async () => {
        const url = post.spotify_url || post.preview_url;
        if (!url) return;
        try {
            await Linking.openURL(url);
        } catch {}
    };

    const postActions = React.useMemo(() => {
        const actions: MenuOption[] = [];

        if (post.spotify_url || post.preview_url) {
            const service = detectSourceService(post);
            actions.push({ text: service ? `Open in ${SOURCE_CFG[service].label}` : 'Open in Service', icon: 'open-outline', onPress: handleOpenSource });
        }

        if (onListenLater) {
            actions.push({ text: 'Add to Listen Later', icon: 'bookmark-outline', onPress: () => onListenLater(post) });
        }

        if (onQuickReact) {
            actions.push({ text: 'React: On Repeat', icon: 'repeat', onPress: () => onQuickReact(post.id, 'on_repeat') });
            actions.push({ text: 'React: Saved', icon: 'heart-outline', onPress: () => onQuickReact(post.id, 'saved') });
            actions.push({ text: 'React: Crate Worthy', icon: 'cube-outline', onPress: () => onQuickReact(post.id, 'crate_worthy') });
            actions.push({ text: 'React: Skip', icon: 'play-skip-forward-outline', onPress: () => onQuickReact(post.id, 'skip') });
        }

        if (isOwn && onDelete) {
            actions.push({ text: 'Delete Post', icon: 'trash-outline', style: 'destructive', onPress: () => onDelete(post.id) });
        }

        actions.push({ text: 'Cancel', style: 'cancel' });
        return actions;
    }, [post, isOwn, onListenLater, onQuickReact, onDelete]);

    const openMoreActions = () => {
        setMenuVisible(true);
    };

    const cfg       = TYPE_CFG[post.post_type] ?? TYPE_CFG.loved;
    const source    = detectSourceService(post);
    const avatarBg  = AVATAR_COLORS[post.author.id % AVATAR_COLORS.length];
    const timeAgo   = (() => {
        try { return formatDistanceToNow(new Date(post.created_at), { addSuffix: true }); }
        catch { return ''; }
    })();
    const isNowPlay = post.post_type === 'now_playing';

    return (
        <View style={s.card}>

            {/* ── Author row ─────────────────────────────────────────── */}
            <View style={s.header}>
                <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => onAuthorPress(post.author.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                >
                    {post.author.avatar_url ? (
                        <View style={s.avatar}>
                            <Image source={{ uri: getAvatarUrl(post.author.avatar_url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        </View>
                    ) : (
                        <View style={[s.avatar, { backgroundColor: avatarBg, alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={s.avatarLetter}>{post.author.display_name[0]?.toUpperCase()}</Text>
                        </View>
                    )}
                    <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={s.displayName} numberOfLines={1}>{post.author.display_name}</Text>
                        <Text style={s.meta}>@{post.author.username} · {timeAgo}</Text>
                    </View>
                </TouchableOpacity>

                <View style={[s.badge, { borderColor: cfg.color + '35', backgroundColor: cfg.color + '18' }]}>
                    <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                    <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>

                <AppIconButton onPress={openMoreActions} style={{ marginLeft: 4 }}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#4b5563" />
                </AppIconButton>
            </View>

            {/* ── Album art — full-width square ──────────────────────── */}
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={togglePreview}
                disabled={!post.preview_url}
                style={s.artWrap}
            >
                {post.album_art_url ? (
                    <Image source={{ uri: post.album_art_url }} style={s.art} resizeMode="cover" />
                ) : (
                    <View style={[s.art, { backgroundColor: avatarBg, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="musical-notes" size={72} color="rgba(255,255,255,0.45)" />
                    </View>
                )}

                {/* Equaliser — now_playing */}
                {isNowPlay && (
                    <View style={s.eqContainer}>
                        <EqBar delay={0}   peak={18} />
                        <EqBar delay={140} peak={26} />
                        <EqBar delay={70}  peak={14} />
                        <EqBar delay={210} peak={22} />
                        <EqBar delay={105} peak={10} />
                    </View>
                )}

                {/* Preview pill */}
                {post.preview_url && (
                    <View style={s.playPill}>
                        <Ionicons
                            name={isPlaying ? 'pause' : 'play'}
                            size={13}
                            color="white"
                            style={{ marginLeft: isPlaying ? 0 : 1 }}
                        />
                        <Text style={s.playText}>{isPlaying ? 'Pause' : 'Preview'}</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* ── Track info ─────────────────────────────────────────── */}
            <View style={s.trackRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={s.trackTitle} numberOfLines={1}>{post.track_title}</Text>
                    <Text style={s.artist} numberOfLines={1}>
                        {post.artist}
                        {post.album ? <Text style={s.album}> · {post.album}</Text> : null}
                    </Text>
                </View>
                {post.genre ? (
                    <View style={s.genrePill}>
                        <Text style={s.genreText}>{post.genre}</Text>
                    </View>
                ) : null}
            </View>

            {source && (
                <View style={{ paddingHorizontal: Layout.space[3], paddingBottom: Layout.space[2] }}>
                    <AppChip label={SOURCE_CFG[source].label} color={SOURCE_CFG[source].color} />
                </View>
            )}

            {/* ── Caption ────────────────────────────────────────────── */}
            {post.caption ? (
                <View style={s.captionRow}>
                    <Text style={s.caption}>{post.caption}</Text>
                </View>
            ) : null}

            {/* ── Actions ────────────────────────────────────────────── */}
            <View style={s.actions}>
                <TouchableOpacity onPress={() => onLike(post.id)} style={s.actionBtn}>
                    <Ionicons
                        name={post.is_liked ? 'heart' : 'heart-outline'}
                        size={22}
                        color={post.is_liked ? Colors.primary : '#4b5563'}
                    />
                    {post.likes_count > 0 && (
                        <Text style={[s.actionCount, post.is_liked && { color: Colors.primary }]}>
                            {post.likes_count}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onComment(post)} style={s.actionBtn}>
                    <Ionicons name="chatbubble-outline" size={20} color="#4b5563" />
                    {(post.comments?.length ?? 0) > 0 && (
                        <Text style={s.actionCount}>{post.comments?.length}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleShare} style={s.actionBtn}>
                    <Ionicons name="paper-plane-outline" size={20} color="#4b5563" />
                </TouchableOpacity>

                {onSaveToCollection && (
                    <TouchableOpacity onPress={() => onSaveToCollection(post)} style={s.actionBtn}>
                        <Ionicons name="albums-outline" size={20} color="#4b5563" />
                    </TouchableOpacity>
                )}

                <Text style={[s.actionCount, { marginLeft: 'auto' }]}>{timeAgo}</Text>
            </View>

            <MenuModal 
                visible={menuVisible}
                title="Post Actions"
                options={postActions}
                onClose={() => setMenuVisible(false)}
            />
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    card: {
        marginHorizontal: 0,
        marginBottom: Layout.space[3],
        borderRadius: 0,
        backgroundColor: Surface.card,
        borderBottomWidth: Layout.border.hairline,
        borderBottomColor: Surface.borderStrong,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.space[4],
        paddingTop: Layout.space[3],
        paddingBottom: Layout.space[2],
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: Layout.radius.pill,
        overflow: 'hidden',
    },
    avatarLetter: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    displayName: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    meta: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 1,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Layout.space[2],
        paddingVertical: 4,
        borderRadius: Layout.radius.pill,
        borderWidth: 1,
        marginLeft: Layout.space[2],
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    artWrap: { position: 'relative' },
    art: {
        width: '100%',
        aspectRatio: 1,
    },
    eqContainer: {
        position: 'absolute',
        bottom: 14,
        left: 14,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 3,
        height: 30,
    },
    playPill: {
        position: 'absolute',
        bottom: Layout.space[3],
        right: Layout.space[3],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Layout.space[3],
        paddingVertical: 6,
        backgroundColor: 'rgba(0,0,0,0.58)',
        borderRadius: Layout.radius.pill,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    playText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.space[3],
        paddingTop: Layout.space[3],
        paddingBottom: Layout.space[2],
    },
    trackTitle: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: -0.3,
    },
    artist: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    album: {
        color: '#6b7280',
        fontWeight: '400',
    },
    genrePill: {
        backgroundColor: 'rgba(250,36,60,0.12)',
        paddingHorizontal: Layout.space[2],
        paddingVertical: 3,
        borderRadius: Layout.radius.pill,
        borderWidth: 1,
        borderColor: 'rgba(250,36,60,0.28)',
    },
    genreText: {
        color: Colors.primary,
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    captionRow: {
        paddingHorizontal: Layout.space[3],
        paddingBottom: Layout.space[3],
    },
    caption: {
        color: '#d1d5db',
        fontSize: 14,
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.space[3],
        paddingBottom: Layout.space[3],
        paddingTop: Layout.space[2],
        borderTopWidth: 1,
        borderTopColor: Surface.borderSoft,
        gap: 20,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    actionCount: {
        color: '#6b7280',
        fontSize: 13,
        fontWeight: '500',
    },
});
