import React, { useState } from 'react';
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
import { Colors } from '../theme';

export default function ResetPasswordScreen({ route, navigation }: any) {
    const { email: initialEmail } = route.params || {};
    const [email, setEmail] = useState(initialEmail || '');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleReset = async () => {
        Keyboard.dismiss();
        if (!email || !code || !password) {
            Toast.show({
                type: 'error',
                text1: 'Missing fields',
                position: 'bottom',
                bottomOffset: 100,
            });
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { 
                email: email.trim(),
                code: code.trim(),
                new_password: password
            });
            Toast.show({
                type: 'success',
                text1: 'Password Reset',
                text2: 'You can now log in with your new password.',
                position: 'bottom',
                bottomOffset: 100,
            });
            navigation.navigate('Login');
        } catch (e: any) {
            // Handled by global interceptor typically
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: 'black' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View className="flex-row items-center pt-16 pb-4 px-4">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
                    <Ionicons name="chevron-back" size={28} color="white" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-bold ml-2">Enter Code</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 32 }}>
                <Text className="text-gray-400 text-base mb-8">
                    Enter the 6-digit code sent to your email along with your new password.
                </Text>

                <View className="flex-col gap-4 mb-8">
                    {!initialEmail && (
                        <View className="flex-row items-center border border-gray-700 rounded-xl h-14 bg-neutral-900 px-4">
                            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                            <TextInput
                                style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%' }}
                                placeholderTextColor="#6b7280"
                                placeholder="Email address"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardAppearance="dark"
                            />
                        </View>
                    )}

                    <View className="flex-row items-center border border-gray-700 rounded-xl h-14 bg-neutral-900 px-4">
                        <Ionicons name="keypad-outline" size={20} color={Colors.textSecondary} />
                        <TextInput
                            style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%', letterSpacing: 5, textAlign: 'center' }}
                            placeholderTextColor="#6b7280"
                            placeholder="0 0 0 0 0 0"
                            value={code}
                            onChangeText={setCode}
                            keyboardType="number-pad"
                            maxLength={6}
                            keyboardAppearance="dark"
                        />
                    </View>

                    <View className="flex-row items-center border border-gray-700 rounded-xl h-14 bg-neutral-900 px-4">
                        <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                        <TextInput
                            style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%' }}
                            placeholderTextColor="#6b7280"
                            placeholder="New password"
                            secureTextEntry={!showPass}
                            value={password}
                            onChangeText={setPassword}
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
                    onPress={handleReset}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Reset Password</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
