import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Platform, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usersApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../api/client';
import { Colors } from '../theme';
import KawarpBackground from '../components/KawarpBackground';

const PROFILE_ACCENTS = ['#FA243C', '#10B981', '#3B82F6', '#F59E0B', '#A855F7', '#14B8A6'];

const BACKGROUND_PRESETS = [
    { id: 'track', label: 'Recent Track', url: 'track' },
    { id: 'avatar', label: 'Avatar', url: 'avatar' },
    { id: 'accent', label: 'Accent Color', url: 'accent' },
    { id: 'fluid', label: 'Fluid Dream', url: 'https://images.unsplash.com/photo-1558470598-a5dda9640f68?w=400&q=80' },
    { id: 'aurora', label: 'Aurora', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&q=80' },
    { id: 'neon', label: 'Neon Lines', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&q=80' },
];

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
        kawarp_config: '',
    });
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

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
                    kawarp_config: profile.kawarp_config || '',
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

    const editOptions = React.useMemo(() => {
        const defaults = { warpIntensity: 1.0, blurPasses: 8, animationSpeed: 1.0, transitionDuration: 1000, saturation: 1.5, tintIntensity: 0.15, dithering: 0.008, scale: 1.0, backgroundImage: 'track' };
        try { return form.kawarp_config ? { ...defaults, ...JSON.parse(form.kawarp_config) } : defaults; } catch { return defaults; }
    }, [form.kawarp_config]);

    const handleOptionChange = (key: string, val: number) => {
        setForm(prev => ({ ...prev, kawarp_config: JSON.stringify({ ...editOptions, [key]: val }) }));
    };

    const SimpleSlider = ({ label, value, min, max, step, onChange }: any) => (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
                <Text style={{ color: 'white', fontSize: 11 }}>{value.toFixed(2)}</Text>
            </View>
            <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))}><Ionicons name="remove-circle-outline" size={24} color="#8E8E93" /></TouchableOpacity>
                <View style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: `${((value - min) / (max - min)) * 100}%`, height: '100%', backgroundColor: Colors.primary }} />
                </View>
                <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))}><Ionicons name="add-circle-outline" size={24} color="#8E8E93" /></TouchableOpacity>
            </View>
        </View>
    );

    const SimpleSliderLabelOnly = ({ label }: any) => <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: -4, marginBottom: 16 }}>{label}</Text>;

    const getPreviewImage = (bgUrl: string) => {
        if (bgUrl === 'track' || bgUrl === 'auto') return 'https://images.unsplash.com/photo-1614613500854-ce1f148902ee?w=400&q=80'; // Explicit generic track art
        if (bgUrl === 'avatar') return form.avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'; // Avatar or generic portrait pattern
        if (bgUrl === 'accent') return undefined; // Will evaluate to gradient
        return bgUrl;
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <View style={{ 
                paddingTop: insets.top, 
                backgroundColor: '#000',
                borderBottomWidth: 0.5, 
                borderBottomColor: 'rgba(255,255,255,0.1)' 
            }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
                        <Text style={{ color: 'white', fontSize: 17 }}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 20, letterSpacing: -0.4 }}>Edit Profile</Text>
                    <TouchableOpacity onPress={save} style={{ padding: 4 }} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 17 }}>Save</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingTop: 24, paddingHorizontal: 20 }}>
                    <View style={{ alignItems: 'center', marginBottom: 28 }}>
                        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={{ position: 'relative' }}>
                            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <Image
                                    source={{ uri: getAvatarUrl(form.avatar_url) }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="camera" size={36} color="rgba(255,255,255,0.9)" />
                                </View>
                            </View>
                        </TouchableOpacity>
                        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 10 }}>Tap to change avatar</Text>
                    </View>

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Display Name</Text>
                    <TextInput
                        style={{ backgroundColor: focusedInput === 'name' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', color: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginBottom: 18, fontWeight: '600', fontSize: 16, borderBottomWidth: 2, borderBottomColor: focusedInput === 'name' ? Colors.primary : 'transparent' }}
                        value={form.display_name}
                        onChangeText={t => setForm(prev => ({ ...prev, display_name: t }))}
                        onFocus={() => setFocusedInput('name')}
                        onBlur={() => setFocusedInput(null)}
                        placeholder="Your display name"
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Bio</Text>
                    <TextInput
                        style={{ backgroundColor: focusedInput === 'bio' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', color: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginBottom: 18, textAlignVertical: 'top', minHeight: 80, borderBottomWidth: 2, borderBottomColor: focusedInput === 'bio' ? Colors.primary : 'transparent', fontSize: 15 }}
                        value={form.bio}
                        onChangeText={t => setForm(prev => ({ ...prev, bio: t }))}
                        onFocus={() => setFocusedInput('bio')}
                        onBlur={() => setFocusedInput(null)}
                        multiline
                        numberOfLines={3}
                        placeholder="Tell the world about yourself..."
                        placeholderTextColor="#4b5563"
                        keyboardAppearance="dark"
                    />

                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Favorite Genres</Text>
                    <TextInput
                        style={{ backgroundColor: focusedInput === 'genres' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', color: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginBottom: 18, borderBottomWidth: 2, borderBottomColor: focusedInput === 'genres' ? Colors.primary : 'transparent', fontSize: 15 }}
                        value={form.favorite_genres}
                        onChangeText={t => setForm(prev => ({ ...prev, favorite_genres: t }))}
                        onFocus={() => setFocusedInput('genres')}
                        onBlur={() => setFocusedInput(null)}
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

                    <Text style={{ color: 'white', fontSize: 15, fontWeight: '700', marginBottom: 12, marginTop: 8 }}>Dynamic Background</Text>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, marginBottom: 16 }}>
                        {BACKGROUND_PRESETS.map(preset => {
                            const isSelected = editOptions.backgroundImage === preset.url || (editOptions.backgroundImage === 'auto' && preset.url === 'track');
                            return (
                                <TouchableOpacity 
                                    key={preset.id} 
                                    onPress={() => handleOptionChange('backgroundImage', preset.url as any)}
                                    style={{ 
                                        marginRight: 10, 
                                        paddingHorizontal: 14, 
                                        paddingVertical: 8, 
                                        borderRadius: 20, 
                                        backgroundColor: isSelected ? Colors.primary : 'rgba(255,255,255,0.08)',
                                        borderWidth: 1,
                                        borderColor: isSelected ? Colors.primary : 'rgba(255,255,255,0.1)'
                                    }}>
                                    <Text style={{ color: isSelected ? 'white' : '#9ca3af', fontSize: 13, fontWeight: '600' }}>{preset.label}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>

                    <View style={{ width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                        <KawarpBackground accent={accentColor} avatarUrl={getPreviewImage(editOptions.backgroundImage)} options={editOptions} />
                    </View>

                    <SimpleSlider label="Warp Intensity" value={editOptions.warpIntensity} min={0} max={1} step={0.1} onChange={(v: number) => handleOptionChange('warpIntensity', v)} />
                    <SimpleSlider label="Blur Passes" value={editOptions.blurPasses} min={1} max={40} step={2} onChange={(v: number) => handleOptionChange('blurPasses', v)} />
                    <SimpleSlider label="Animation Speed" value={editOptions.animationSpeed} min={0} max={5} step={0.2} onChange={(v: number) => handleOptionChange('animationSpeed', v)} />
                    <SimpleSlider label="Scale" value={editOptions.scale} min={0.01} max={4} step={0.25} onChange={(v: number) => handleOptionChange('scale', v)} />
                    <SimpleSlider label="Color Saturation" value={editOptions.saturation} min={0} max={3} step={0.25} onChange={(v: number) => handleOptionChange('saturation', v)} />
                    <SimpleSliderLabelOnly label="Tint Intensity & Dithering updates dynamically" />

                    </ScrollView>
                </View>
            )}
        </View>
    );
}
