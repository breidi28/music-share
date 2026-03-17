# Music Share Product Plan

## Overview

This plan includes all requested interaction features and design improvements, organized into delivery phases so the team can ship safely and continuously.

## Product Goals

1. Increase weekly active usage through stronger social loops.
2. Reduce friction from discovery to action (share, save, discuss, revisit).
3. Improve retention via personalized and collaborative experiences.
4. Raise UI quality and consistency across feed, profile, and collection.

## Success Metrics

1. D7 retention: +8% within 8 weeks of phase launches.
2. Weekly posts per active user: +20%.
3. Average feed session length: +15%.
4. Comment depth (replies per post): +25%.
5. Save actions (to collection/listen later): +30%.
6. Notification CTR for followed users: +18%.

## Full Feature Scope

### A. Core Interaction Features

1. Listening Reactions (beyond like)
   - Reactions: saved, on_repeat, skip, crate_worthy.
   - One-tap reaction bar on each post.
   - Optional aggregate counts and user-reaction state.

2. Inline Track Actions in Feed
   - Save to collection from post.
   - Add to listen later queue.
   - Open in source service (Spotify/YouTube/Apple).

3. Post Prompts
   - Contextual prompts in composer/feed empty states.
   - Examples: "Share your first spin today", "What are you looping tonight?".
   - Prompt variants by time-of-day and user activity.

4. Collaborative Mini-Lists
   - Small list objects with invited members.
   - Weekly challenge mode with start/end date.
   - Add/remove tracks, comments, and list likes.

5. Taste Rooms
   - Temporary themed group rooms.
   - Members can drop tracks and react/comment.
   - Auto-expire after duration (24h, 72h, 7d).

6. Follow Notification Tuning
   - Granular controls by event type:
     - New post
     - Now playing
     - Collection add
     - Mention/reply
   - Per-user mute/unfollow shortcuts.

7. Weekly Recap Cards
   - Personalized weekly summary card.
   - Shareable image card and in-app detail view.
   - Metrics: top genre, top artist, posts shared, collection adds.

8. Advanced Comments UX
   - Threaded replies (single-level to start).
   - @mentions with user autocomplete.
   - Post owner can pin one top comment.

### B. Design Improvements

1. Feed hierarchy refinement (title/artist/action clarity).
2. Unified spacing scale (4/8/12/16/24).
3. Service identity chips on content cards.
4. Actionable empty states for every tab.
5. Motion polish: feed entry stagger + tap feedback.
6. Readability upgrades: stronger contrast and touch targets.
7. Unified feedback system with consistent toasts.
8. Profile personalization accent color.

## Technical Plan

## Backend Work (Flask)

### 1. Reactions
- New table: post_reactions
  - id, post_id, user_id, reaction_type, created_at
  - unique constraint: (post_id, user_id, reaction_type)
- Endpoints:
  - POST /api/posts/<post_id>/reactions
  - DELETE /api/posts/<post_id>/reactions/<reaction_type>
  - GET /api/posts/<post_id>/reactions

### 2. Listen Later Queue
- New table: listen_later_items
  - id, user_id, track_title, artist, album, album_art_url, source_service, source_url, added_at
- Endpoints:
  - GET /api/listen-later
  - POST /api/listen-later
  - DELETE /api/listen-later/<item_id>

### 3. Collaborative Mini-Lists
- New tables:
  - collab_lists (id, owner_id, name, description, is_weekly_challenge, starts_at, ends_at, created_at)
  - collab_list_members (list_id, user_id, role)
  - collab_list_tracks (id, list_id, added_by, track metadata, created_at)
- Endpoints:
  - GET /api/collab-lists
  - POST /api/collab-lists
  - POST /api/collab-lists/<id>/invite
  - POST /api/collab-lists/<id>/tracks
  - DELETE /api/collab-lists/<id>/tracks/<track_id>

### 4. Taste Rooms
- New tables:
  - taste_rooms (id, host_id, title, theme, expires_at, created_at)
  - taste_room_members (room_id, user_id)
  - taste_room_posts (id, room_id, user_id, track metadata, created_at)
- Endpoints:
  - GET /api/taste-rooms
  - POST /api/taste-rooms
  - POST /api/taste-rooms/<id>/join
  - POST /api/taste-rooms/<id>/tracks
- Scheduled cleanup:
  - Remove expired rooms or archive daily.

### 5. Comment Enhancements
- Schema changes:
  - comments.parent_id (nullable)
  - comments.mentioned_user_ids (json/text)
  - posts.pinned_comment_id (nullable)
- Endpoints:
  - POST /api/posts/<post_id>/comments (supports parent_id)
  - POST /api/posts/<post_id>/pin-comment/<comment_id>
  - GET /api/users/mention-search?q=

### 6. Notification Preferences
- New table: notification_preferences
  - user_id (PK), notify_new_post, notify_now_playing, notify_collection_add, notify_mentions, notify_replies
- Endpoints:
  - GET /api/notifications/preferences
  - PUT /api/notifications/preferences

### 7. Weekly Recap
- New table: weekly_recaps
  - id, user_id, week_start, summary_json, image_url(optional), generated_at
- Job:
  - Weekly cron task to compute recap stats.
- Endpoints:
  - GET /api/recap/latest
  - GET /api/recap/history

## Frontend Work (React Native)

### 1. Feed and PostCard
- Extend [src/components/PostCard.tsx](src/components/PostCard.tsx):
  - reaction pill row
  - inline action buttons (save, listen later, open service)
  - service chip
  - improved visual hierarchy and spacing scale

### 2. Composer + Prompts
- Extend [src/screens/ShareScreen.tsx](src/screens/ShareScreen.tsx):
  - dynamic prompt suggestions
  - one-tap prompt insert

### 3. Comments Modal
- Extend [src/components/CommentsModal.tsx](src/components/CommentsModal.tsx):
  - reply threads
  - mention autocomplete
  - pin comment action for owner

### 4. New Screens
- Add:
  - src/screens/ListenLaterScreen.tsx
  - src/screens/CollaborativeListsScreen.tsx
  - src/screens/TasteRoomsScreen.tsx
  - src/screens/WeeklyRecapScreen.tsx

### 5. Settings and Notification Controls
- Extend [src/screens/SettingsScreen.tsx](src/screens/SettingsScreen.tsx):
  - granular notification toggles
  - per-event explanation text

### 6. Profile Personalization
- Extend [src/screens/ProfileScreen.tsx](src/screens/ProfileScreen.tsx):
  - accent color selector
  - apply accent across profile tabs/chips/buttons

### 7. Design System Cleanup
- Add a UI constants file:
  - src/theme/layout.ts for spacing, radii, touch targets.
- Standardize card, chip, and button primitives.

## Delivery Roadmap

## Phase 0 (Week 1): Foundations
1. Finalize schema migrations for reactions, listen later, preferences, comments threading.
2. Add API contracts and response shapes.
3. Add analytics events and naming standard.
4. Define design tokens for spacing/typography/chips.

## Phase 1 (Weeks 2-3): Fast-Win Interactions
1. Listening reactions.
2. Inline track actions.
3. Listen later queue screen + backend.
4. Actionable empty states.

Outcome: immediate engagement lift and lower action friction.

## Phase 2 (Weeks 4-5): Social Depth
1. Threaded comments.
2. Mentions.
3. Pin comment.
4. Follow notification preferences.

Outcome: deeper discussion loops and cleaner notifications.

## Phase 3 (Weeks 6-7): Collaborative Features
1. Collaborative mini-lists.
2. Weekly challenge mode.
3. Taste Rooms with expiration and cleanup job.

Outcome: stronger multi-user retention loops.

## Phase 4 (Weeks 8-9): Personalization + Recap
1. Weekly recap generation and UI.
2. Shareable recap card.
3. Profile accent color personalization.

Outcome: identity and weekly return behavior.

## Phase 5 (Week 10): Polish and Stabilization
1. Motion pass and hierarchy refinements.
2. Performance pass (feed rendering, list virtualization).
3. Bug bash, QA, and release hardening.

## API and Data Notes

1. Keep reaction types as validated enum values on backend.
2. For mention parsing, store normalized username + user_id at write time.
3. Store recap summary as compact JSON for future versioning.
4. Add server-side pagination to list-heavy endpoints (rooms, collab lists, comments).

## Analytics Events (Minimum)

1. post_reaction_added
2. post_reaction_removed
3. feed_action_save_collection
4. feed_action_listen_later
5. prompt_selected
6. collab_list_created
7. collab_track_added
8. taste_room_created
9. taste_room_track_added
10. mention_used
11. comment_reply_added
12. recap_viewed
13. recap_shared

## QA Plan

1. Unit tests for core serializers and validators.
2. API integration tests for reactions, listen later, comments threading, notifications preferences.
3. UI tests for feed actions and comments modal paths.
4. Device QA on Android + iOS for touch targets and animations.
5. Load test for comments and room timelines.

## Risks and Mitigations

1. Scope too broad for one release.
   - Mitigation: phase-by-phase release gates and feature flags.
2. Notification fatigue.
   - Mitigation: default conservative settings + digest fallback.
3. Complex real-time expectations in rooms.
   - Mitigation: start with polling/refresh, then optional websocket upgrade.
4. Data quality for recap metrics.
   - Mitigation: define event schema early and backfill checks.

## Feature Flags

1. feature_reactions
2. feature_listen_later
3. feature_threaded_comments
4. feature_mentions
5. feature_collab_lists
6. feature_taste_rooms
7. feature_weekly_recap
8. feature_profile_accent

## Team Execution Plan

1. Backend engineer: schema + endpoints + jobs + tests.
2. Frontend engineer: feed, comments, new screens, design token pass.
3. Product/design: prompt copy, recap templates, empty-state UX.
4. QA: phase validation and regression suite.

## Immediate Next Implementation Tasks

1. Create DB migrations for reactions, listen later, notification preferences, comment parent/pin support.
2. Implement reactions and listen-later endpoints.
3. Update PostCard and Feed with reaction/action row.
4. Add Listen Later screen and navigation entry.
5. Add notification preferences UI and endpoint wiring.

## Release Strategy

1. Internal alpha after Phase 1.
2. 20% rollout after Phase 2.
3. Full rollout after Phase 3 if crash-free and KPI thresholds are met.
4. Recap + personalization release after Phase 4 with marketing push.
