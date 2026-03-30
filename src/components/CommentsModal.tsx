import React, { useMemo, useState, useEffect } from 'react';
import { FlatList, Platform, KeyboardAvoidingView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import Modal from 'react-native-modal';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Post, Comment, User } from '../types';
import { API_BASE_URL } from '../api/client';
import { postsApi, usersApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { formatDistanceToNow } from 'date-fns';

interface Props {
    post: Post | null;
    visible: boolean;
    onClose: () => void;
}

export default function CommentsModal({ post, visible, onClose }: Props) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [replyTo, setReplyTo] = useState<Comment | null>(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionResults, setMentionResults] = useState<Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>[]>([]);
    const [mentionLoading, setMentionLoading] = useState(false);
    const { user } = useAuthStore();

    useEffect(() => {
        if (visible && post) fetchComments();
    }, [visible, post?.id]);

    useEffect(() => {
        if (!visible) {
            setReplyTo(null);
            setMentionQuery('');
            setMentionResults([]);
        }
    }, [visible]);

    useEffect(() => {
        if (!mentionQuery.trim()) {
            setMentionResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setMentionLoading(true);
            try {
                const res = await usersApi.mentionSearch(mentionQuery.trim());
                setMentionResults(res.data || []);
            } catch {
                setMentionResults([]);
            }
            setMentionLoading(false);
        }, 220);

        return () => clearTimeout(timer);
    }, [mentionQuery]);

    const byId = useMemo(() => {
        const map = new Map<number, Comment>();
        comments.forEach(c => map.set(c.id, c));
        return map;
    }, [comments]);

    const topLevelComments = useMemo(
        () => {
            const base = comments.filter(c => !c.parent_id);
            if (!post?.pinned_comment_id) return base;
            return [...base].sort((a, b) => {
                if (a.id === post.pinned_comment_id) return -1;
                if (b.id === post.pinned_comment_id) return 1;
                return 0;
            });
        },
        [comments, post?.pinned_comment_id]
    );

    const repliesByParent = useMemo(() => {
        const grouped: Record<number, Comment[]> = {};
        comments.forEach(c => {
            if (c.parent_id) {
                if (!grouped[c.parent_id]) grouped[c.parent_id] = [];
                grouped[c.parent_id].push(c);
            }
        });
        return grouped;
    }, [comments]);

    const getAvatarUrl = (url: string | null | undefined): string => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        return API_BASE_URL.replace('/api', '') + url;
    };

    const fetchComments = async () => {
        if (!post) return;
        setLoading(true);
        try {
            const res = await postsApi.getComments(post.id);
            setComments(res.data);
        } catch { }
        setLoading(false);
    };

    const submit = async () => {
        if (!text.trim() || !post) return;
        setSending(true);
        try {
            const res = await postsApi.addComment(post.id, text.trim(), replyTo?.id);
            setComments(prev => [...prev, res.data]);
            setText('');
            setReplyTo(null);
            setMentionQuery('');
            setMentionResults([]);
        } catch { }
        setSending(false);
    };

    const handleTextChange = (value: string) => {
        setText(value);
        const match = value.match(/(?:^|\s)@([A-Za-z0-9_]{1,30})$/);
        setMentionQuery(match ? match[1] : '');
    };

    const applyMention = (item: { username: string }) => {
        setText(prev => prev.replace(/@([A-Za-z0-9_]{1,30})$/, `@${item.username} `));
        setMentionQuery('');
        setMentionResults([]);
    };

    const handlePinComment = async (commentId: number) => {
        if (!post) return;
        try {
            await postsApi.pinComment(post.id, commentId);
            if (post) post.pinned_comment_id = commentId;
            setComments(prev => [...prev]);
        } catch { }
    };

    const handleUnpinComment = async () => {
        if (!post) return;
        try {
            await postsApi.unpinComment(post.id);
            if (post) post.pinned_comment_id = null;
            setComments(prev => [...prev]);
        } catch { }
    };

    const renderSingleComment = (item: Comment, isReply = false) => (
        <View key={item.id} style={{ marginBottom: 12, marginLeft: isReply ? 28 : 0 }}>
            <View className="flex-row gap-4">
            {item.author.avatar_url ? (
                <Image source={{ uri: getAvatarUrl(item.author.avatar_url) }} className="w-9 h-9 rounded-full" alt="avatar" />
            ) : (
                <View className="w-9 h-9 rounded-full bg-[#FA243C] justify-center items-center shadow-sm shadow-[#FA243C]/20">
                    <Text className="text-white font-bold text-sm">{item.author.display_name[0]?.toUpperCase()}</Text>
                </View>
            )}
            <View className="flex-1 flex-col">
                <Text className="text-white font-semibold text-sm">{item.author.display_name}</Text>
                {item.parent_id && byId.get(item.parent_id) && (
                    <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
                        Replying to @{byId.get(item.parent_id)?.author.username}: {byId.get(item.parent_id)?.text}
                    </Text>
                )}
                <Text className="text-gray-300 text-sm mt-0.5 leading-snug">{item.text}</Text>
                <View className="flex-row items-center gap-3 mt-1">
                    {post?.pinned_comment_id === item.id && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: 'rgba(250,36,60,0.15)' }}>
                            <Text style={{ color: '#FA243C', fontSize: 10, fontWeight: '700' }}>Pinned</Text>
                        </View>
                    )}
                    <Text className="text-gray-500 text-xs">
                        {(() => { try { return formatDistanceToNow(new Date(item.created_at), { addSuffix: true }); } catch { return ''; } })()}
                    </Text>
                    {!isReply && (
                        <TouchableOpacity onPress={() => setReplyTo(item)}>
                            <Text className="text-gray-400 text-xs font-semibold">Reply</Text>
                        </TouchableOpacity>
                    )}
                    {!isReply && user?.id === post?.user_id && post?.pinned_comment_id !== item.id && (
                        <TouchableOpacity onPress={() => handlePinComment(item.id)}>
                            <Text className="text-gray-400 text-xs font-semibold">Pin</Text>
                        </TouchableOpacity>
                    )}
                    {!isReply && user?.id === post?.user_id && post?.pinned_comment_id === item.id && (
                        <TouchableOpacity onPress={handleUnpinComment}>
                            <Text className="text-gray-400 text-xs font-semibold">Unpin</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
        </View>
    );

    const renderComment = ({ item }: { item: Comment }) => {
        const replies = repliesByParent[item.id] || [];
        return (
            <View>
                {renderSingleComment(item)}
                {replies.map(reply => renderSingleComment(reply, true))}
            </View>
        );
    };

    return (
        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            animationIn="slideInUp"
            animationOut="slideOutDown"
            animationInTiming={300}
            animationOutTiming={250}
            backdropTransitionOutTiming={0}
            useNativeDriverForBackdrop={true}
            style={{ margin: 0, justifyContent: 'flex-end' }}
            avoidKeyboard
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, justifyContent: 'flex-end' }}
            >
                <BlurView 
                    intensity={90} 
                    tint="dark" 
                    style={{ 
                        borderTopLeftRadius: 28, 
                        borderTopRightRadius: 28, 
                        minHeight: 300, 
                        maxHeight: '85%', 
                        paddingBottom: 8, 
                        flexDirection: 'column', 
                        borderTopWidth: 1, 
                        borderColor: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden'
                    }}
                >
                    <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12, marginBottom: 4, alignSelf: 'center' }} />
                    <Text className="font-bold text-xl text-center text-white py-3 border-b border-white/5">
                        Comments
                    </Text>

                    {loading ? (
                        <View className="p-8 justify-center items-center">
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={topLevelComments}
                            keyExtractor={i => String(i.id)}
                            renderItem={renderComment}
                            contentContainerStyle={{ padding: 16 }}
                            ListEmptyComponent={
                                <Text className="text-center text-gray-500 p-8 text-base">
                                    No comments yet. Be the first! 🎵
                                </Text>
                            }
                        />
                    )}

                    {replyTo && (
                        <View style={{ marginHorizontal: 12, marginBottom: 8, marginTop: 4, padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: '#d1d5db', fontSize: 12, flex: 1 }} numberOfLines={1}>
                                Replying to @{replyTo.author.username}
                            </Text>
                            <TouchableOpacity onPress={() => setReplyTo(null)}>
                                <Ionicons name="close" size={16} color="#9ca3af" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {mentionQuery.length > 0 && (
                        <View style={{ marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#111115', maxHeight: 160 }}>
                            {mentionLoading ? (
                                <View style={{ padding: 10 }}><ActivityIndicator size="small" color={Colors.primary} /></View>
                            ) : (
                                <FlatList
                                    keyboardShouldPersistTaps="handled"
                                    data={mentionResults}
                                    keyExtractor={item => String(item.id)}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity onPress={() => applyMention(item)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                                            <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>@{item.username}</Text>
                                            <Text style={{ color: '#9ca3af', fontSize: 12 }}>{item.display_name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0A0A0F' }}>
                        <View className="w-9 h-9 rounded-full bg-[#FA243C] justify-center items-center shadow-sm shadow-[#FA243C]/20">
                            <Text className="text-white font-bold text-sm">{user?.display_name[0]?.toUpperCase()}</Text>
                        </View>

                        <View className="flex-row flex-1 items-center bg-white/5 border border-white/10 rounded-xl max-h-[100px] px-3">
                            <TextInput
                                className="flex-1 text-white py-2.5 h-full text-base"
                                value={text}
                                onChangeText={handleTextChange}
                                placeholder={replyTo ? `Reply to @${replyTo.author.username}...` : 'Add a comment...'}
                                placeholderTextColor={Colors.textSecondary}
                                multiline
                                maxLength={500}
                            />
                        </View>

                        <TouchableOpacity onPress={submit} disabled={!text.trim() || sending} className="p-2">
                            {sending ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <Ionicons name="arrow-up-circle" size={32} color={text.trim() ? '#FA243C' : '#333'} />
                            )}
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </KeyboardAvoidingView>
        </Modal>
    );
}
