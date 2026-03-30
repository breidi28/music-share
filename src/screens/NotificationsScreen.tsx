import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationsApi } from '../api/endpoints';
import { Colors } from '../theme';

export default function NotificationsScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    const fetchNotifications = async () => {
        try {
            const res = await notificationsApi.getAll();
            setNotifications(res.data.notifications);
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch { }
    };

    const handlePress = async (notif: any) => {
        if (!notif.is_read) {
            try {
                await notificationsApi.markRead(notif.id);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            } catch { }
        }
        if (notif.type === 'follow') {
            navigation.navigate('Profile', { userId: notif.actor.id });
        } else if (notif.post_id) {
            // Ideally navigate to single post view. We'll navigate to Profile for now since we don't have SinglePostScreen
            navigation.navigate('Profile', { userId: notif.actor.id });
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        let text = '';
        let iconName = '';
        let iconColor = '';
        if (item.type === 'like') { text = 'liked your post.'; iconName = 'heart'; iconColor = '#FA243C'; }
        else if (item.type === 'comment') { text = 'commented on your post.'; iconName = 'chatbubble'; iconColor = '#9ca3af'; }
        else if (item.type === 'follow') { text = 'started following you.'; iconName = 'person-add'; iconColor = '#FA243C'; }

        return (
            <TouchableOpacity
                onPress={() => handlePress(item)}
                className={`flex-row items-center p-4 border-b border-white/5 ${item.is_read ? 'bg-black' : 'bg-white/5'}`}
            >
                <View className="mr-3 w-10 items-center">
                    <Ionicons name={iconName as any} size={22} color={iconColor} />
                </View>
                {item.actor.avatar_url ? (
                    <Image source={{ uri: item.actor.avatar_url }} className="w-10 h-10 rounded-full mr-3 bg-gray-800" />
                ) : (
                    <View className="w-10 h-10 rounded-full mr-3 bg-gray-800 items-center justify-center">
                        <Text className="text-white font-bold text-lg">{item.actor.display_name.charAt(0).toUpperCase()}</Text>
                    </View>
                )}
                <View className="flex-1">
                    <Text className="text-white">
                        <Text className="font-bold">{item.actor.display_name}</Text> {text}
                    </Text>
                    <Text className="text-gray-500 text-[10px] mt-1 uppercase font-bold tracking-wider">
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>
                {!item.is_read && <View className="w-2.5 h-2.5 rounded-full bg-[#FA243C] ml-2 shadow-sm shadow-[#FA243C]/40" />}
            </TouchableOpacity>
        );
    };

    const renderHeader = () => (
        <BlurView
            intensity={80}
            tint="dark"
            style={{ paddingTop: insets.top + 8, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
            className="flex-row justify-between items-center px-4 pb-4 border-b border-white/10"
        >
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2">
                <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>
            <Text className="font-bold text-xl text-white">Notifications</Text>
            <TouchableOpacity onPress={markAllRead} className="p-2 -mr-2">
                <Ionicons name="checkmark-done" size={24} color={Colors.primary} />
            </TouchableOpacity>
        </BlurView>
    );

    return (
        <View className="flex-1 bg-black">
            {renderHeader()}

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 100 }}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View className="flex-1 justify-center items-center mt-32 px-10">
                            <View className="w-24 h-24 rounded-full bg-purple-500/20 mb-6 justify-center items-center">
                                <Ionicons name="notifications" size={40} color="#A855F7" />
                            </View>
                            <Text className="text-white font-bold text-xl text-center mb-2">You're all caught up</Text>
                            <Text className="text-gray-400 text-center text-sm">When your friends interact with your collection or follow you, you'll see it here.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
