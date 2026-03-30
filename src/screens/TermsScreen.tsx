import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function TermsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            {/* Header */}
            <View
                style={{
                    paddingTop: insets.top,
                    backgroundColor: '#000',
                    borderBottomWidth: 0.5,
                    borderBottomColor: 'rgba(255,255,255,0.1)',
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: '600' }}>
                        Terms of Service
                    </Text>
                </View>
            </View>

            {/* Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
                    Last Updated: March 30, 2026
                </Text>

                <Section title="1. Acceptance of Terms">
                    By accessing and using music share, you accept and agree to be bound by the terms and 
                    provision of this agreement. If you do not agree to these terms, please do not use our service.
                </Section>

                <Section title="2. Description of Service">
                    music share is a social platform for music lovers to discover, share, and discuss music 
                    from various streaming services including Spotify, YouTube Music, Apple Music, Tidal, and Qobuz.
                </Section>

                <Section title="3. User Accounts">
                    - You must create an account to use music share
                    {'\n'}- You are responsible for maintaining the confidentiality of your account credentials
                    {'\n'}- You must be at least 13 years old to use this service
                    {'\n'}- You agree to provide accurate and complete information
                    {'\n'}- You are responsible for all activities that occur under your account
                </Section>

                <Section title="4. Music Service Integration">
                    - Connecting to music streaming services (Spotify, YouTube Music, etc.) is optional
                    {'\n'}- You grant music share permission to access your music data from connected services
                    {'\n'}- We do not store your streaming service credentials
                    {'\n'}- You can disconnect services at any time from Settings
                    {'\n'}- We are not responsible for issues with third-party music services
                </Section>

                <Section title="5. User Content">
                    - You retain ownership of content you post
                    {'\n'}- By posting, you grant music share a license to display and distribute your content
                    {'\n'}- You are responsible for the content you share
                    {'\n'}- We reserve the right to remove content that violates our policies
                    {'\n'}- Do not post copyrighted material without permission
                </Section>

                <Section title="6. Prohibited Conduct">
                    You agree NOT to:
                    {'\n'}- Harass, abuse, or harm other users
                    {'\n'}- Post spam or misleading content
                    {'\n'}- Violate any laws or regulations
                    {'\n'}- Attempt to hack or disrupt the service
                    {'\n'}- Impersonate others or create fake accounts
                    {'\n'}- Share explicit or inappropriate content
                </Section>

                <Section title="7. Intellectual Property">
                    - All music share branding, logos, and features are our property
                    {'\n'}- Music metadata and cover art belong to respective rights holders
                    {'\n'}- You may not copy, modify, or distribute our service
                </Section>

                <Section title="8. Privacy">
                    Your use of music share is also governed by our Privacy Policy. Please review it to 
                    understand how we collect, use, and protect your information.
                </Section>

                <Section title="9. Service Modifications">
                    We reserve the right to modify, suspend, or discontinue any part of the service at any 
                    time with or without notice.
                </Section>

                <Section title="10. Termination">
                    - We may terminate or suspend your account for violations of these terms
                    {'\n'}- You may delete your account at any time from Settings
                    {'\n'}- Upon termination, your right to use the service ceases immediately
                </Section>

                <Section title="11. Disclaimers">
                    - music share is provided "AS IS" without warranties of any kind
                    {'\n'}- We do not guarantee uninterrupted or error-free service
                    {'\n'}- We are not responsible for third-party music service availability
                </Section>

                <Section title="12. Limitation of Liability">
                    music share and its developers shall not be liable for any indirect, incidental, special, 
                    or consequential damages resulting from your use of the service.
                </Section>

                <Section title="13. Changes to Terms">
                    We may update these terms from time to time. Continued use of the service after changes 
                    constitutes acceptance of the new terms.
                </Section>

                <Section title="14. Contact">
                    If you have questions about these terms, please contact us at:
                    {'\n'}legal@musicshare.app
                </Section>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={{ marginBottom: 24 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
                {title}
            </Text>
            <Text style={{ color: '#d1d5db', fontSize: 15, lineHeight: 24 }}>
                {children}
            </Text>
        </View>
    );
}
