import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme';
import { UtilityScreen } from '../theme/utilityScreen';

type ChangelogEntry = {
    version: string;
    date: string;
    highlights: string[];
    fixes: string[];
};

const CHANGELOG: ChangelogEntry[] = [
    {
        version: '1.4.0',
        date: '2026-03-30',
        highlights: [
            'Major UI Redesign: Implemented an Apple Music-inspired aesthetic with immersive dark modes and vibrant frosted glass.',
            'Native Navigation: Added true frosted-glass BlurViews to the bottom tabs and app headers.',
            'Authentication Overhaul: Redesigned the Login and Registration flow with dynamic, translucent focus states.',
            'Performance Leap: Integrated expo-image for buttery smooth, disk-cached scrolling on the Feed and Collection.',
            'Tactile Engine: Added subtle iOS-like haptic feedback (expo-haptics) across all major app interactions.',
            'Skeleton Loaders: Replaced generic loading spinners with animated post skeletons.',
            'Empty States: Transformed all empty states (Search, Notifications, Listen Later) with beautiful bold iconography.'
        ],
        fixes: [
            'Fixed accessibility contrast ratios across buttons and action items.',
            'Removed debug development artifacts and dummy test accounts from production builds.',
            'Resolved input layout jumping and keyboard overlap in the auth flow.'
        ],
    },
    {
        version: '1.3.0',
        date: '2026-03-15',
        highlights: [
            'Added Weekly Recap cards with latest summary and recap history.',
            'Added in-app Weekly Recap screen access from Settings.',
            'Advanced comments UX improved with owner unpin action and stronger reply notification behavior.',
            'Design system cleanup started: added shared layout tokens and reusable card/chip/icon-button primitives.',
        ],
        fixes: [
            'Improved comment thread moderation flow by allowing pinned-comment removal.',
            'Improved social feedback loops by notifying users on direct replies.',
            'Standardized spacing, radii, and touch-target usage across key screens for more consistent UI rhythm.',
        ],
    },
    {
        version: '1.2.0',
        date: '2026-03-15',
        highlights: [
            'Added contextual caption prompts in Share composer based on post type and time of day.',
            'Added one-tap prompt insertion and a refresh button to cycle prompt ideas quickly.',
            'Added profile accent color personalization for your profile chips, key buttons, and active tabs.',
            'Added service identity chips on post cards to clearly show the track source platform.',
            'Shipped Collaborative Lists v1: create lists, invite members, and add/remove tracks together.',
        ],
        fixes: [
            'Reduced composer friction so users can post faster without staring at an empty caption field.',
            'Improved profile visual identity without changing the global app theme.',
            'Improved action clarity by labeling open-source behavior with platform-specific names.',
            'Added cleaner group music workflow with dedicated screen and direct feed entry point.',
        ],
    },
    {
        version: '1.1.1',
        date: '2026-03-15',
        highlights: [
            'Post cards are now cleaner: only Like, Comment, Share, and Save to Collection stay visible.',
            'Advanced post actions moved under the 3-dots menu (reactions, listen later, open in service, and delete for owners).',
        ],
        fixes: [
            'Reduced action-row clutter to improve readability and tap confidence on smaller screens.',
        ],
    },
    {
        version: '1.1.0',
        date: '2026-03-15',
        highlights: [
            'Threaded comments with direct reply flow.',
            'Mention autocomplete in comments with @username search.',
            'Listen Later queue with quick-save actions from post cards.',
            'Quick reaction actions expanded to Feed, Explore, Activity, and Profile.',
        ],
        fixes: [
            'Fixed SQLAlchemy Post/Comment relationship ambiguity that could break login.',
            'Removed noisy OAuth and playlist debug logging for cleaner runtime output.',
        ],
    },
    {
        version: '1.0.0',
        date: '2026-03-01',
        highlights: [
            'Initial public release of music share.',
            'Core social feed, profiles, likes, comments, and follow system.',
            'Spotify and YouTube Music integration foundations.',
        ],
        fixes: [],
    },
];

export default function ChangelogScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <View
                style={{
                    paddingTop: insets.top,
                    backgroundColor: UtilityScreen.header.backgroundColor,
                    borderBottomWidth: UtilityScreen.header.borderBottomWidth,
                    borderBottomColor: UtilityScreen.header.borderBottomColor,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: UtilityScreen.header.horizontalPadding, paddingVertical: UtilityScreen.header.verticalPadding }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: UtilityScreen.header.backButtonMarginRight, minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
                        <Ionicons name="chevron-back" size={UtilityScreen.header.backIconSize} color="white" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: UtilityScreen.header.titleSize, fontWeight: UtilityScreen.header.titleWeight, color: 'white', letterSpacing: UtilityScreen.header.titleLetterSpacing, flex: 1 }}>
                        Changelog
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: UtilityScreen.content.horizontalPadding, paddingTop: UtilityScreen.content.topPadding, paddingBottom: UtilityScreen.content.bottomPadding }}>
                {CHANGELOG.map((entry) => (
                    <View
                        key={entry.version}
                        style={{
                            backgroundColor: '#141417',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.08)',
                            borderRadius: 14,
                            padding: 14,
                            marginBottom: UtilityScreen.card.gap,
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={{ color: 'white', fontSize: 19, fontWeight: '700' }}>v{entry.version}</Text>
                            <Text style={{ color: '#9ca3af', fontSize: 12 }}>{entry.date}</Text>
                        </View>

                        <Text style={{ color: Colors.primary, fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginBottom: UtilityScreen.card.headingMarginBottom }}>New and improved</Text>
                        {entry.highlights.map((line) => (
                            <View key={`${entry.version}-h-${line}`} style={{ flexDirection: 'row', marginBottom: UtilityScreen.row.gap }}>
                                <Text style={{ color: '#d1d5db', fontSize: 13, marginRight: 8 }}>•</Text>
                                <Text style={{ color: '#d1d5db', fontSize: 13, flex: 1 }}>{line}</Text>
                            </View>
                        ))}

                        {entry.fixes.length > 0 && (
                            <>
                                <Text style={{ color: '#f59e0b', fontSize: UtilityScreen.card.headingSize, fontWeight: UtilityScreen.card.headingWeight, marginTop: 8, marginBottom: UtilityScreen.card.headingMarginBottom }}>Major fixes</Text>
                                {entry.fixes.map((line) => (
                                    <View key={`${entry.version}-f-${line}`} style={{ flexDirection: 'row', marginBottom: UtilityScreen.row.gap }}>
                                        <Text style={{ color: '#d1d5db', fontSize: 13, marginRight: 8 }}>•</Text>
                                        <Text style={{ color: '#d1d5db', fontSize: 13, flex: 1 }}>{line}</Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
