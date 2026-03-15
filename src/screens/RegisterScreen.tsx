import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical', 'R&B', 'Indie', 'Metal', 'Folk'];

export default function RegisterScreen({ navigation }: any) {
    const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '', bio: '' });
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const { register } = useAuthStore();

    const update = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

    const toggleGenre = (g: string) => {
        setSelectedGenres(prev =>
            prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].slice(0, 5)
        );
    };

    const handleRegister = async () => {
        if (!form.username || !form.email || !form.password || !form.display_name) {
            Toast.show({
                type: 'error',
                text1: 'Missing fields',
                text2: 'Please fill in all required fields.',
                position: 'bottom',
                bottomOffset: 100,
            });
            return;
        }
        setLoading(true);
        try {
            await register({ ...form, favorite_genres: selectedGenres.join(',') });
        } catch (e: any) {
            // Handled globally
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="flex-1 bg-black">
                <ScrollView contentContainerStyle={{ padding: 32, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

                    {/* Header */}
                    <View className="w-full flex-row items-center mb-6">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="p-1 mr-4">
                            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                        </TouchableOpacity>
                        <Text className="text-white font-bold text-2xl">Create Account</Text>
                    </View>

                    {/* Logo Area */}
                    <View className="items-center mb-8 flex-col">
                        <View className="w-16 h-16 bg-[#FA243C] rounded-full mb-4 justify-center items-center shadow-sm shadow-[#FA243C]/20">
                            <Ionicons name="musical-notes" size={28} color="white" />
                        </View>
                        <Text className="text-gray-300 text-lg">Join musicshare</Text>
                    </View>

                    {/* Form */}
                    <View className="w-full flex-col gap-4">
                        {[
                            { key: 'display_name', placeholder: 'Display Name', icon: 'person' },
                            { key: 'username', placeholder: 'Username', icon: 'at' },
                            { key: 'email', placeholder: 'Email', icon: 'mail', keyboardType: 'email-address' },
                            { key: 'password', placeholder: 'Password', icon: 'lock-closed', secure: true },
                            { key: 'bio', placeholder: 'Bio (optional)', icon: 'chatbubble-ellipses' },
                        ].map(f => (
                            <View key={f.key} className="flex-row items-center border border-gray-700 rounded-lg h-14 bg-neutral-900 px-3">
                                <View className="pl-3 justify-center items-center">
                                    <Ionicons name={f.icon as any} size={20} color={Colors.textSecondary} />
                                </View>
                                <TextInput
                                    className="flex-1 text-white text-base pl-3 h-full"
                                    placeholderTextColor="#6b7280"
                                    placeholder={f.placeholder}
                                    value={(form as any)[f.key]}
                                    onChangeText={update(f.key)}
                                    secureTextEntry={f.secure}
                                    autoCapitalize="none"
                                    keyboardType={(f as any).keyboardType}
                                    keyboardAppearance="dark"
                                />
                            </View>
                        ))}

                        {/* Genres */}
                        <Text className="text-sm font-semibold text-gray-400 mt-2">
                            Favorite Genres (pick up to 5)
                        </Text>

                        <View className="flex-row flex-wrap pt-2 gap-2">
                            {GENRES.map(g => {
                                const selected = selectedGenres.includes(g);
                                return (
                                    <TouchableOpacity
                                        key={g}
                                        onPress={() => toggleGenre(g)}
                                        className={`px-4 py-2 mb-2 rounded-full border ${selected ? 'bg-[#FA243C]/20 border-[#FA243C]' : 'bg-neutral-800 border-gray-700'}`}
                                    >
                                        <Text className={`text-sm ${selected ? 'text-[#FA243C] font-semibold' : 'text-gray-400'}`}>{g}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity
                            className={`mt-6 bg-[#FA243C] rounded-full h-14 flex-row justify-center items-center ${loading ? 'opacity-70' : ''}`}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Create Account</Text>}
                        </TouchableOpacity>

                        <View className="flex-row justify-center mt-6 gap-2">
                            <Text className="text-gray-500 text-base">Already have an account?</Text>
                            <TouchableOpacity onPress={() => navigation.goBack()}>
                                <Text className="text-[#FA243C] font-semibold text-base">Sign In</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}
