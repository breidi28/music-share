import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Platform, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../api/client';
import { Colors } from '../theme';

const PROFILE_ACCENTS = ['#FA243C', '#10B981', '#3B82F6', '#F59E0B', '#A855F7', '#14B8A6'];

const getAvatarUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return API_BASE_URL.replace('/api', '') + url;
};

export default function EditProfileScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, updateUser } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [accentColor, setAccentColor] = useState(Colors.primary);
    const [form, setForm] = useState({
        display_name: '',
        bio: '',
        favorite_genres: '',
        avatar_url: '',
    });

    useEffect(() => {
        const load = async () => {
            if (!user?.id) {
                setLoading(false);
                return;
            }
            try {
                const [profileRes, storedAccent] = await Promise.all([
                    usersApi.getUser(user.id),
                    AsyncStorage.getItem(`profileAccent:${user.id}`),
                ]);
                const profile = profileRes.data;
                setForm({
                    display_name: profile.display_name || '',
                    bio: profile.bio || '',
                    favorite_genres: profile.favorite_genres || '',
                    avatar_url: profile.avatar_url || '',
                });
                if (storedAccent) setAccentColor(storedAccent);
            } catch { }
            setLoading(false);
        };
        load();
    }, [user?.id]);

    const pickAvatar = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Permission to access camera roll is required' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            const base64Image = `data:image/jpeg;base64,${asset.base64}`;
            setForm(prev => ({ ...prev, avatar_url: base64Image }));
        }
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await usersApi.updateProfile(form);
            updateUser(res.data);
            if (user?.id) {
                await AsyncStorage.setItem(`profileAccent:${user.id}`, accentColor);
            }
            Toast.show({ type: 'success', text1: 'Profile updated' });
            navigation.goBack();
        } catch {
            Toast.show({ type: 'error', text1: 'Failed to update profile' });
        }
        setSaving(false);
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#0A0A0F', paddingTop: Platform.OS === 'ios' ? insets.top + 6 : insets.top + 12, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                    <Text style={{ color: '#6b7280', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 22 }}>Edit Profile</Text>
                <TouchableOpacity onPress={save} style={{ padding: 4 }} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 16 }}>Save</Text>}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            ) : (
                <>
                    <View style={{ alignItems: 'center', marginBottom: 28 }}>
                        <TouchableOpacity onPress={pickAvatar} style={{ position: 'relative' }}>
                            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <Image
                                    source={{ uri: getAvatarUrl(form.avatar_url) }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                            </View>
                            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: accentColor, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#0A0A0F' }}>
                                <Ionicons name="camera" size={18} color="white" />
                            </View>
                        </TouchableOpacity>
                        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 10 }}>Tap to change avatar</Text>
                    </View>

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Display Name</Text>
                    <TextInput
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 18, fontWeight: '600', fontSize: 16 }}
                        value={form.display_name}
                        onChangeText={t => setForm(prev => ({ ...prev, display_name: t }))}
                        placeholder="Your display name"
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Bio</Text>
                    <TextInput
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 18, textAlignVertical: 'top', minHeight: 80 }}
                        value={form.bio}
                        onChangeText={t => setForm(prev => ({ ...prev, bio: t }))}
                        multiline
                        numberOfLines={3}
                        placeholder="Tell the world about yourself..."
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Favorite Genres</Text>
                    <TextInput
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 18 }}
                        value={form.favorite_genres}
                        onChangeText={t => setForm(prev => ({ ...prev, favorite_genres: t }))}
                        placeholder="e.g. Rock, Indie, Synthpop"
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Profile Accent</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                        {PROFILE_ACCENTS.map(color => (
                            <TouchableOpacity
                                key={color}
                                onPress={() => setAccentColor(color)}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: color,
                                    borderWidth: accentColor === color ? 2 : 0,
                                    borderColor: 'white',
                                }}
                            />
                        ))}
                    </View>
                </>
            )}
        </View>
    );
}
