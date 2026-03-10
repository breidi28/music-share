import React, { useState, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Alert,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

export default function LoginScreen({ navigation }: any) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuthStore();
    const passwordRef = useRef<TextInput>(null);

    const handleLogin = async () => {
        Keyboard.dismiss();
        if (!username || !password) {
            Alert.alert('Missing fields', 'Please fill in all fields.');
            return;
        }
        setLoading(true);
        try {
            await login(username.trim(), password);
        } catch (e: any) {
            Alert.alert('Login failed', e?.response?.data?.error || 'Invalid credentials');
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: 'black' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
            <ScrollView
                style={{ flex: 1, backgroundColor: 'black' }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 32, backgroundColor: 'black' }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View className="bg-black flex-1 justify-center">

                    {/* Logo Area */}
                    <View className="items-center mb-10 flex-col gap-4">
                        <View className="w-20 h-20 bg-[#FA243C] rounded-full mb-2 justify-center items-center shadow-sm shadow-[#FA243C]/20">
                            <Ionicons name="musical-notes" size={36} color="white" />
                        </View>
                        <Text className="text-white font-bold text-4xl">tuneshare</Text>
                        <Text className="text-gray-500 text-base">Share what moves you.</Text>
                    </View>

                    {/* Form */}
                    <View className="flex-col gap-6">
                        <View className="flex-col gap-4">
                            {/* Username input */}
                            <View className="flex-row items-center border border-gray-700 rounded-xl h-14 bg-neutral-900 px-4">
                                <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
                                <TextInput
                                    style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%' }}
                                    placeholderTextColor="#6b7280"
                                    placeholder="Username or email"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordRef.current?.focus()}
                                    blurOnSubmit={false}
                                    keyboardAppearance="dark"
                                />
                            </View>

                            {/* Password input */}
                            <View className="flex-row items-center border border-gray-700 rounded-xl h-14 bg-neutral-900 px-4">
                                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                                <TextInput
                                    ref={passwordRef}
                                    style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%' }}
                                    placeholderTextColor="#6b7280"
                                    placeholder="Password"
                                    secureTextEntry={!showPass}
                                    value={password}
                                    onChangeText={setPassword}
                                    returnKeyType="done"
                                    onSubmitEditing={handleLogin}
                                    keyboardAppearance="dark"
                                />
                                <TouchableOpacity className="p-2" onPress={() => setShowPass(!showPass)}>
                                    <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={{
                                backgroundColor: '#FA243C',
                                borderRadius: 12,
                                height: 56,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                opacity: loading ? 0.7 : 1,
                            }}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading
                                ? <ActivityIndicator color="white" />
                                : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Sign In</Text>
                            }
                        </TouchableOpacity>

                        {/* Demo Box */}
                        <View className="border border-gray-800 bg-neutral-900 rounded-xl p-4">
                            <View className="items-center flex-col gap-2">
                                <Text className="text-gray-500 text-xs">Demo accounts</Text>
                                <View className="flex-row justify-center gap-4">
                                    {['alex_m', 'soundjunkie', 'vinyl_vibes'].map(u => (
                                        <TouchableOpacity key={u} onPress={() => { setUsername(u); setPassword('password123'); }}>
                                            <Text className="text-[#FA243C] font-medium text-sm">@{u}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text className="text-gray-400 text-xs mt-1">password: password123</Text>
                            </View>
                        </View>

                        {/* Sign Up Link */}
                        <View className="flex-row justify-center gap-2">
                            <Text className="text-gray-500 text-base">New here?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text className="text-[#FA243C] font-semibold text-base">Create an account</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
