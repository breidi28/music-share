import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

export default function HelpSupportScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [contactMessage, setContactMessage] = useState('');

    const faqs = [
        {
            question: "How do I connect my music streaming services?",
            answer: "Go to Settings → Music Services and tap 'Connect' next to the service you want to link. You'll be redirected to authenticate with that service. For Tidal and Qobuz, API credentials need to be configured on the backend first."
        },
        {
            question: "Why can't I see my recently played music?",
            answer: "Make sure you've connected your streaming service in Settings and authorized the necessary permissions. It may take a few minutes for your data to sync after connecting."
        },
        {
            question: "How do I disconnect a music service?",
            answer: "Go to Settings → Music Services, find the connected service, and tap 'Disconnect'. This will remove access but won't delete your music share posts."
        },
        {
            question: "Can I use music share without connecting a streaming service?",
            answer: "Yes! You can still browse, discover music, and interact with other users' posts. Connecting services enhances your experience by showing your listening activity and making it easier to share music."
        },
        {
            question: "How do I change my privacy settings?",
            answer: "Go to Settings → Privacy. You can control your profile visibility, whether others see your listening activity, and who can view your collection."
        },
        {
            question: "How do I delete my account?",
            answer: "Go to Settings → Account Actions → Delete Account. This will permanently delete all your data including posts, comments, and connections. This action cannot be undone."
        },
        {
            question: "What notifications can I receive?",
            answer: "You can receive notifications for likes on your posts, comments, new followers, and when friends share new music. Customize these in Settings → Notifications."
        },
        {
            question: "Is my data secure?",
            answer: "Yes. We use industry-standard encryption for data transmission, hash all passwords, and use OAuth for music service authentication (we never see your streaming service passwords). Review our Privacy Policy for details."
        },
        {
            question: "Which music services are supported?",
            answer: "We support Spotify, YouTube Music, Apple Music (coming soon), Tidal, and Qobuz. More services may be added in the future."
        },
        {
            question: "Can I share playlists?",
            answer: "Yes! When you connect a music service, you can share individual tracks, albums, and playlists from that service with your friends."
        },
        {
            question: "How do I report inappropriate content?",
            answer: "Long-press on any post or comment to see options including 'Report'. We review all reports and take action against violations of our Terms of Service."
        },
        {
            question: "Why isn't my app updating in real-time?",
            answer: "Try pulling down to refresh on any feed screen. If issues persist, try logging out and back in, or reinstalling the app."
        }
    ];

    const handleContactSubmit = () => {
        if (!contactMessage.trim()) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter your message' });
            return;
        }

        const subject = 'Help & Support Request';
        const body = contactMessage;
        const mailto = `mailto:support@musicshare.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        Linking.openURL(mailto)
            .then(() => {
                setContactMessage('');
                Toast.show({ type: 'success', text1: 'Email App Opened', text2: 'Please send the email to reach our support.' });
            })
            .catch(() => {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Could not open email app. Please email us manually.' });
            });
    };

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
                        Help & Support
                    </Text>
                </View>
            </View>

            {/* Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                {/* Quick Links */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
                        Quick Links
                    </Text>
                    
                    <QuickLinkCard
                        icon="mail-outline"
                        title="Email Support"
                        description="support@musicshare.app"
                        onPress={() => Linking.openURL('mailto:support@musicshare.app')}
                    />
                    
                    <QuickLinkCard
                        icon="logo-twitter"
                        title="Follow Us"
                        description="@musicshareapp"
                        onPress={() => Toast.show({ type: 'info', text1: 'Social Media', text2: 'Find us on Twitter @musicshareapp' })}
                    />
                    
                    <QuickLinkCard
                        icon="document-text-outline"
                        title="Terms of Service"
                        description="Read our terms"
                        onPress={() => navigation.navigate('Terms')}
                    />
                    
                    <QuickLinkCard
                        icon="shield-checkmark-outline"
                        title="Privacy Policy"
                        description="How we protect your data"
                        onPress={() => navigation.navigate('PrivacyPolicy')}
                    />
                </View>

                {/* FAQ Section */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
                        Frequently Asked Questions
                    </Text>
                    
                    {faqs.map((faq, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
                            style={{
                                backgroundColor: '#1c1c1e',
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 12,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 12 }}>
                                    {faq.question}
                                </Text>
                                <Ionicons 
                                    name={expandedFaq === index ? "chevron-up" : "chevron-down"} 
                                    size={20} 
                                    color="#9ca3af" 
                                />
                            </View>
                            {expandedFaq === index && (
                                <Text style={{ color: '#d1d5db', fontSize: 14, marginTop: 12, lineHeight: 20 }}>
                                    {faq.answer}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Contact Form */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={{ color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
                        Send Us a Message
                    </Text>
                    
                    <View style={{
                        backgroundColor: '#1c1c1e',
                        borderRadius: 12,
                        padding: 16,
                    }}>
                        <TextInput
                            style={{
                                color: 'white',
                                fontSize: 15,
                                minHeight: 120,
                                textAlignVertical: 'top',
                                padding: 12,
                                backgroundColor: '#2c2c2e',
                                borderRadius: 8,
                                marginBottom: 16,
                            }}
                            placeholder="Describe your issue or question..."
                            placeholderTextColor="#6b7280"
                            multiline
                            numberOfLines={6}
                            value={contactMessage}
                            onChangeText={setContactMessage}
                        />
                        
                        <TouchableOpacity
                            onPress={handleContactSubmit}
                            style={{
                                backgroundColor: Colors.primary,
                                borderRadius: 8,
                                padding: 14,
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                                Send Message
                            </Text>
                        </TouchableOpacity>
                        
                        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                            We typically respond within 24-48 hours
                        </Text>
                    </View>
                </View>

                {/* App Info */}
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>
                        music share • Version 1.0.0
                    </Text>
                    <Text style={{ color: '#4b5563', fontSize: 12, marginTop: 4 }}>
                        © 2026 music share. All rights reserved.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

function QuickLinkCard({ icon, title, description, onPress }: any) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                backgroundColor: '#1c1c1e',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <View style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: `${Colors.primary}20`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
            }}>
                <Ionicons name={icon} size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                    {title}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                    {description}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#4b5563" />
        </TouchableOpacity>
    );
}
