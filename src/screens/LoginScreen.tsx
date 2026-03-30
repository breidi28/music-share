import React, { useState, useRef, useEffect } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Keyboard,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

export default function LoginScreen({ navigation }: any) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [focusedInput, setFocusedInput] = useState<string | null>(null);
    const { login } = useAuthStore();
    const passwordRef = useRef<TextInput>(null);

    const validateUsername = (val: string) => {
        if (!val.trim()) {
            setUsernameError('Username or email is required');
            return false;
        }
        setUsernameError('');
        return true;
    };

    const validatePassword = (val: string) => {
        if (!val) {
            setPasswordError('Password is required');
            return false;
        }
        setPasswordError('');
        return true;
    };

    const handleLogin = async () => {
        Keyboard.dismiss();
        const isUsernameValid = validateUsername(username);
        const isPasswordValid = validatePassword(password);
        
        if (!isUsernameValid || !isPasswordValid) {
            return;
        }
        setLoading(true);
        try {
            await login(username.trim(), password);
        } catch (e: any) {
            // Error is handled globally by api/client.ts, but we catch here to stop loading state
            // If you wanted to override the global message, you could suppress there and alert here.
        }
        setLoading(false);
    };

    useEffect(() => {
        // App now assumes backend is production-ready and always awake.
    }, []);

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
                        <Text className="text-white font-bold text-4xl">musicshare</Text>
                        <Text className="text-gray-500 text-base">Share what moves you.</Text>
                    </View>



                    {/* Form */}
                    <View className="flex-col gap-6">
                        <View className="flex-col gap-4">
                            {/* Username input */}
                            <View>
                                <View style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    backgroundColor: focusedInput === 'username' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                    borderRadius: 12, 
                                    height: 56, 
                                    paddingHorizontal: 16,
                                    borderBottomWidth: 2,
                                    borderBottomColor: usernameError ? '#FA243C' : (focusedInput === 'username' ? Colors.primary : 'transparent')
                                }}>
                                    <Ionicons name="person" size={20} color={usernameError ? '#FA243C' : (focusedInput === 'username' ? Colors.primary : '#6b7280')} />
                                    <TextInput
                                        style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%', fontWeight: '600' }}
                                        placeholderTextColor="#6b7280"
                                        placeholder="Username or email"
                                        value={username}
                                        onChangeText={val => { setUsername(val); if (usernameError) validateUsername(val); }}
                                        onFocus={() => setFocusedInput('username')}
                                        onBlur={() => { setFocusedInput(null); validateUsername(username); }}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType="email-address"
                                        returnKeyType="next"
                                        onSubmitEditing={() => passwordRef.current?.focus()}
                                        blurOnSubmit={false}
                                        keyboardAppearance="dark"
                                    />
                                </View>
                                {usernameError ? <Text className="text-[#FA243C] text-xs mt-1 ml-1">{usernameError}</Text> : null}
                            </View>

                            {/* Password input */}
                            <View>
                                <View style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    backgroundColor: focusedInput === 'password' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                    borderRadius: 12, 
                                    height: 56, 
                                    paddingHorizontal: 16,
                                    borderBottomWidth: 2,
                                    borderBottomColor: passwordError ? '#FA243C' : (focusedInput === 'password' ? Colors.primary : 'transparent')
                                }}>
                                    <Ionicons name="lock-closed" size={20} color={passwordError ? '#FA243C' : (focusedInput === 'password' ? Colors.primary : '#6b7280')} />
                                    <TextInput
                                        ref={passwordRef}
                                        style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%', fontWeight: '600' }}
                                        placeholderTextColor="#6b7280"
                                        placeholder="Password"
                                        secureTextEntry={!showPass}
                                        value={password}
                                        onChangeText={val => { setPassword(val); if (passwordError) validatePassword(val); }}
                                        onFocus={() => setFocusedInput('password')}
                                        onBlur={() => { setFocusedInput(null); validatePassword(password); }}
                                        returnKeyType="done"
                                        onSubmitEditing={handleLogin}
                                        keyboardAppearance="dark"
                                    />
                                    <TouchableOpacity className="p-2" onPress={() => setShowPass(!showPass)}>
                                        <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={passwordError ? '#FA243C' : '#6b7280'} />
                                    </TouchableOpacity>
                                </View>
                                {passwordError ? <Text className="text-[#FA243C] text-xs mt-1 ml-1">{passwordError}</Text> : null}
                            </View>

                            <TouchableOpacity 
                                className="self-end mt-1" 
                                onPress={() => navigation.navigate('ForgotPassword')}
                            >
                                <Text className="text-[#FA243C] font-medium">Forgot password?</Text>
                            </TouchableOpacity>
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
