import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Jazz', 'Electronic', 'Classical', 'R&B', 'Indie', 'Metal', 'Folk'];

export default function RegisterScreen({ navigation }: any) {
    const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '', bio: '' });
    const [errors, setErrors] = useState({ username: '', email: '', password: '', display_name: '' });
    const [touched, setTouched] = useState({ username: false, email: false, password: false, display_name: false, bio: false });
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const { register } = useAuthStore();

    const validateField = (key: string, val: string) => {
        let error = '';
        if (key === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            error = 'Please enter a valid email address';
        } else if (key === 'password' && val && val.length < 6) {
            error = 'Password must be at least 6 characters';
        } else if (key === 'username' && val && !/^[a-zA-Z0-9_]+$/.test(val)) {
            error = 'Username can only contain letters, numbers, and underscores';
        } else if (key !== 'bio' && touched[key as keyof typeof touched] && !val) {
            error = 'This field is required';
        }
        setErrors(prev => ({ ...prev, [key]: error }));
        return !error && val;
    };

    const update = (key: string) => (val: string) => {
        setForm(f => ({ ...f, [key]: val }));
        if (touched[key as keyof typeof touched]) {
            validateField(key, val);
        }
    };

    const handleBlur = (key: string) => () => {
        setFocusedInput(null);
        setTouched(prev => ({ ...prev, [key]: true }));
        validateField(key, form[key as keyof typeof form]);
    };

    const toggleGenre = (g: string) => {
        setSelectedGenres(prev =>
            prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].slice(0, 5)
        );
    };

    const handleRegister = async () => {
        // Mark all as touched
        setTouched({ username: true, email: true, password: true, display_name: true, bio: true });
        
        const isEmailValid = validateField('email', form.email);
        const isUsernameValid = validateField('username', form.username);
        const isPasswordValid = validateField('password', form.password);
        const isDisplayNameValid = validateField('display_name', form.display_name);

        if (!isEmailValid || !isUsernameValid || !isPasswordValid || !isDisplayNameValid) {
            Toast.show({
                type: 'error',
                text1: 'Validation Error',
                text2: 'Please fix the errors in the form before continuing.',
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
                        ].map(f => {
                            const hasError = touched[f.key as keyof typeof touched] && errors[f.key as keyof typeof errors];
                            const isFocused = focusedInput === f.key;
                            return (
                                <View key={f.key} className="mb-2">
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: isFocused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                        borderRadius: 12,
                                        height: 56,
                                        paddingHorizontal: 16,
                                        borderBottomWidth: 2,
                                        borderBottomColor: hasError ? '#FA243C' : (isFocused ? Colors.primary : 'transparent')
                                    }}>
                                        <Ionicons name={f.icon as any} size={20} color={hasError ? '#FA243C' : (isFocused ? Colors.primary : '#6b7280')} />
                                        <TextInput
                                            style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%', fontWeight: '600' }}
                                            placeholderTextColor="#6b7280"
                                            placeholder={f.placeholder}
                                            value={(form as any)[f.key]}
                                            onChangeText={update(f.key)}
                                            onFocus={() => setFocusedInput(f.key)}
                                            onBlur={handleBlur(f.key)}
                                            secureTextEntry={f.secure}
                                            autoCapitalize="none"
                                            keyboardType={(f as any).keyboardType}
                                            keyboardAppearance="dark"
                                        />
                                    </View>
                                    {hasError ? (
                                        <Text className="text-[#FA243C] text-xs mt-1 ml-1">{errors[f.key as keyof typeof errors]}</Text>
                                    ) : null}
                                </View>
                            );
                        })}

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
