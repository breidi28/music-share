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

export default function ForgotPasswordScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendCode = async () => {
        Keyboard.dismiss();
        if (!email) {
            Toast.show({
                type: 'error',
                text1: 'Email required',
                position: 'bottom',
                bottomOffset: 100,
            });
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email: email.trim() });
            Toast.show({
                type: 'success',
                text1: 'Code sent!',
                text2: 'If the email exists, a reset code was sent.',
                position: 'bottom',
                bottomOffset: 100,
            });
            navigation.navigate('ResetPassword', { email: email.trim() });
        } catch (e: any) {
            // Toast will be shown by client.ts interceptor
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
                <Text className="text-white text-xl font-bold ml-2">Reset Password</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 32 }}>
                <Text className="text-gray-400 text-base mb-8">
                    Enter the email address associated with your account and we'll send you a 6-digit reset code.
                </Text>

                <View className="flex-row items-center border border-gray-700 rounded-xl h-14 bg-neutral-900 px-4 mb-6">
                    <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                    <TextInput
                        style={{ flex: 1, color: 'white', fontSize: 16, paddingLeft: 12, height: '100%' }}
                        placeholderTextColor="#6b7280"
                        placeholder="Email address"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        returnKeyType="send"
                        onSubmitEditing={handleSendCode}
                        keyboardAppearance="dark"
                    />
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
                    onPress={handleSendCode}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Send Code</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
