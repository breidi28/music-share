import React, { useState, useEffect } from 'react';
import { FlatList, Platform, KeyboardAvoidingView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { Post, Comment } from '../types';
import { postsApi } from '../api/endpoints';
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
    const { user } = useAuthStore();

    useEffect(() => {
        if (visible && post) fetchComments();
    }, [visible, post?.id]);

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
            const res = await postsApi.addComment(post.id, text.trim());
            setComments(prev => [...prev, res.data]);
            setText('');
        } catch { }
        setSending(false);
    };

    const renderComment = ({ item }: { item: Comment }) => (
        <View className="flex-row gap-4 mb-4">
            {item.author.avatar_url ? (
                <Image source={{ uri: item.author.avatar_url }} className="w-9 h-9 rounded-full" alt="avatar" />
            ) : (
                <View className="w-9 h-9 rounded-full bg-[#FA243C] justify-center items-center shadow-sm shadow-[#FA243C]/20">
                    <Text className="text-white font-bold text-sm">{item.author.display_name[0]?.toUpperCase()}</Text>
                </View>
            )}
            <View className="flex-1 flex-col">
                <Text className="text-white font-semibold text-sm">{item.author.display_name}</Text>
                <Text className="text-gray-300 text-sm mt-0.5 leading-snug">{item.text}</Text>
                <Text className="text-gray-500 text-xs mt-1">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </Text>
            </View>
        </View>
    );

    return (
        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            style={{ margin: 0, justifyContent: 'flex-end' }}
            avoidKeyboard
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, justifyContent: 'flex-end' }}
            >
                <View style={{ backgroundColor: '#0A0A0F', borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: 300, maxHeight: '85%', paddingBottom: 8, flexDirection: 'column', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
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
                            data={comments}
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

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0A0A0F' }}>
                        <View className="w-9 h-9 rounded-full bg-[#FA243C] justify-center items-center shadow-sm shadow-[#FA243C]/20">
                            <Text className="text-white font-bold text-sm">{user?.display_name[0]?.toUpperCase()}</Text>
                        </View>

                        <View className="flex-row flex-1 items-center bg-white/5 border border-white/10 rounded-xl max-h-[100px] px-3">
                            <TextInput
                                className="flex-1 text-white py-2.5 h-full text-base"
                                value={text}
                                onChangeText={setText}
                                placeholder="Add a comment..."
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
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
