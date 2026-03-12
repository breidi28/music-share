import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen({ navigation }: any) {
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
                        Privacy Policy
                    </Text>
                </View>
            </View>

            {/* Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
                    Last Updated: March 2026
                </Text>

                <Section title="Introduction">
                    music share ("we", "our", or "us") is committed to protecting your privacy. This Privacy 
                    Policy explains how we collect, use, disclose, and safeguard your information when you use 
                    our mobile application.
                </Section>

                <Section title="Information We Collect">
                    <Subsection title="Account Information">
                        - Username and display name
                        {'\n'}- Email address
                        {'\n'}- Profile picture (if provided)
                        {'\n'}- Password (encrypted and hashed)
                    </Subsection>

                    <Subsection title="Music Service Data">
                        When you connect music streaming services:
                        {'\n'}- Basic profile information from the service
                        {'\n'}- Your top tracks and artists
                        {'\n'}- Recently played music
                        {'\n'}- Playlists (if you choose to share them)
                        {'\n'}- Currently playing tracks
                        {'\n\n'}We only access data you explicitly authorize through OAuth consent screens.
                    </Subsection>

                    <Subsection title="Content You Create">
                        - Posts and music shares
                        {'\n'}- Comments and likes
                        {'\n'}- Messages and interactions
                        {'\n'}- Collection and saved items
                    </Subsection>

                    <Subsection title="Usage Data">
                        - Device information (model, OS version)
                        {'\n'}- App usage statistics
                        {'\n'}- Crash reports and error logs
                        {'\n'}- IP address and general location
                    </Subsection>
                </Section>

                <Section title="How We Use Your Information">
                    We use your information to:
                    {'\n'}- Provide and maintain our service
                    {'\n'}- Connect you with music from streaming platforms
                    {'\n'}- Display your music activity to friends
                    {'\n'}- Send notifications (if enabled)
                    {'\n'}- Improve and personalize your experience
                    {'\n'}- Detect and prevent fraud or abuse
                    {'\n'}- Respond to support requests
                    {'\n'}- Comply with legal obligations
                </Section>

                <Section title="Information Sharing">
                    <Subsection title="We Share Information With:">
                        <BulletPoint>
                            Music Services: When you connect Spotify, YouTube Music, etc., we share authentication 
                            tokens to access your music data
                        </BulletPoint>
                        <BulletPoint>
                            Other Users: Your profile, posts, and music activity are visible according to your 
                            privacy settings
                        </BulletPoint>
                        <BulletPoint>
                            Service Providers: Cloud hosting, analytics, and infrastructure providers who help 
                            us operate the service
                        </BulletPoint>
                        <BulletPoint>
                            Legal Requirements: If required by law, court order, or to protect our rights
                        </BulletPoint>
                    </Subsection>

                    <Subsection title="We Do NOT:">
                        - Sell your personal information to third parties
                        {'\n'}- Share your data for advertising purposes
                        {'\n'}- Access your streaming service credentials (we use OAuth)
                        {'\n'}- Share your private messages publicly
                    </Subsection>
                </Section>

                <Section title="Your Privacy Choices">
                    You can control your privacy through Settings:
                    {'\n\n'}<BulletPoint>
                        Profile Visibility: Make your profile public or private
                    </BulletPoint>
                    <BulletPoint>
                        Listening Activity: Show or hide what you're currently listening to
                    </BulletPoint>
                    <BulletPoint>
                        Collection: Control who can see your music collection
                    </BulletPoint>
                    <BulletPoint>
                        Notifications: Enable or disable push notifications
                    </BulletPoint>
                    <BulletPoint>
                        Music Services: Disconnect any linked streaming service
                    </BulletPoint>
                    <BulletPoint>
                        Account Deletion: Permanently delete your account and all data
                    </BulletPoint>
                </Section>

                <Section title="Data Security">
                    We implement industry-standard security measures:
                    {'\n'}- Encrypted data transmission (HTTPS/TLS)
                    {'\n'}- Password hashing with bcrypt
                    {'\n'}- Secure token-based authentication
                    {'\n'}- Regular security audits
                    {'\n'}- Limited employee access to user data
                    {'\n\n'}However, no method of transmission over the Internet is 100% secure. We cannot 
                    guarantee absolute security.
                </Section>

                <Section title="Data Retention">
                    - Account data is kept while your account is active
                    {'\n'}- Deleted accounts are permanently removed within 30 days
                    {'\n'}- Some data may be retained for legal compliance
                    {'\n'}- Music service tokens are refreshed periodically
                </Section>

                <Section title="Third-Party Services">
                    We integrate with:
                    {'\n'}- Spotify (spotify.com/privacy)
                    {'\n'}- YouTube Music (policies.google.com/privacy)
                    {'\n'}- Apple Music (apple.com/legal/privacy)
                    {'\n'}- Tidal (tidal.com/privacy)
                    {'\n'}- Qobuz (qobuz.com/privacy)
                    {'\n\n'}Each service has its own privacy policy. We recommend reviewing them.
                </Section>

                <Section title="Children's Privacy">
                    music share is not intended for users under 13. We do not knowingly collect data from 
                    children. If we learn we have collected data from a child under 13, we will delete it.
                </Section>

                <Section title="International Users">
                    Your information may be transferred to and processed in countries other than your own. 
                    By using music share, you consent to such transfers.
                </Section>

                <Section title="Changes to This Policy">
                    We may update this Privacy Policy from time to time. We will notify you of significant 
                    changes via the app or email. Continued use after changes constitutes acceptance.
                </Section>

                <Section title="Your Rights">
                    Depending on your location, you may have rights to:
                    {'\n'}- Access your personal data
                    {'\n'}- Correct inaccurate data
                    {'\n'}- Request deletion of your data
                    {'\n'}- Object to data processing
                    {'\n'}- Data portability
                    {'\n\n'}Contact us to exercise these rights.
                </Section>

                <Section title="Contact Us">
                    If you have questions about this Privacy Policy or our data practices:
                    {'\n\n'}Email: privacy@musicshare.app
                    {'\n'}In-App: Settings → Help & Support
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

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={{ marginTop: 12, marginBottom: 8 }}>
            <Text style={{ color: '#e5e7eb', fontSize: 16, fontWeight: '500', marginBottom: 8 }}>
                {title}
            </Text>
            <Text style={{ color: '#d1d5db', fontSize: 15, lineHeight: 24 }}>
                {children}
            </Text>
        </View>
    );
}

function BulletPoint({ children }: { children: React.ReactNode }) {
    return (
        <Text style={{ color: '#d1d5db', fontSize: 15, lineHeight: 24, marginBottom: 8 }}>
            • {children}
        </Text>
    );
}
