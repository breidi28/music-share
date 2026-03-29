export interface User {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  favorite_genres: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  created_at: string;
  is_following?: boolean;
  has_spotify_linked?: boolean;
  has_youtube_linked?: boolean;
  has_apple_music_linked?: boolean;
  has_tidal_linked?: boolean;
  has_qobuz_linked?: boolean;
  has_deezer_linked?: boolean;
  collection_count: number;
}

export type PostType = 'now_playing' | 'loved' | 'history' | 'spin';

export interface Post {
  id: number;
  user_id: number;
  author: User;
  track_title: string;
  artist: string;
  album: string;
  album_art_url: string;
  caption: string;
  post_type: PostType;
  preview_url: string;
  spotify_url: string;
  genre: string;
  likes_count: number;
  is_liked: boolean;
  my_reactions?: ReactionType[];
  reaction_counts?: Record<string, number>;
  pinned_comment_id?: number | null;
  listened_at: string;
  created_at: string;
  comments?: Comment[];
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  author: User;
  text: string;
  parent_id?: number | null;
  created_at: string;
}

export type ReactionType = 'saved' | 'on_repeat' | 'skip' | 'crate_worthy';

export interface AppNotification {
  id: number;
  recipient_id: number;
  actor: Pick<User, 'id' | 'username' | 'display_name' | 'avatar_url'>;
  notif_type: 'like' | 'comment' | 'follow' | 'mention' | 'reply';
  post_id?: number | null;
  is_read: boolean;
  created_at: string;
}

export interface PostReactionsPayload {
  counts: Record<string, number>;
  my_reactions: ReactionType[];
}

export interface ListenLaterItem {
  id: number;
  user_id: number;
  track_title: string;
  artist: string;
  album: string;
  album_art_url: string;
  source_service?: string;
  source_url?: string;
  added_at: string;
}

export interface NotificationPreferences {
  notify_new_post: boolean;
  notify_now_playing: boolean;
  notify_collection_add: boolean;
  notify_mentions: boolean;
  notify_replies: boolean;
}

export interface MusicSearchResult {
  track_title: string;
  artist: string;
  album: string;
  album_art_url: string;
  preview_url: string;
  genre: string;
  track_id: number;
}

export interface PaginatedPosts {
  posts: Post[];
  total: number;
  pages: number;
  current_page: number;
}

export type MediaType = 'vinyl' | 'cd' | 'cassette' | 'digital';

export interface CollectionItem {
  id: number;
  user_id: number;
  media_type: MediaType;
  album_title: string;
  artist: string;
  album_art_url: string;
  release_year?: number;
  notes: string;
  condition: string;
  purchase_date?: string;
  created_at: string;
}

export interface CollectionStats {
  total: number;
  vinyl_count: number;
  cd_count: number;
  cassette_count: number;
  top_artist: string | null;
}

export interface CollectionResponse {
  items: CollectionItem[];
  total: number;
  stats?: CollectionStats;
}

export interface ArtistDiscographyProgressSummary {
  artist: string;
  owned_count: number;
  total_known: number;
  missing_count: number;
  completion_pct: number;
  missing_preview: string[];
}

export interface ArtistDiscographyProgressDetail {
  artist: string;
  owned_count: number;
  total_known: number;
  completion_pct: number;
  owned_albums: string[];
  missing_albums: MusicSearchResult[];
}

export interface CollabListTrack {
  id: number;
  list_id: number;
  added_by: number;
  track_title: string;
  artist: string;
  album: string;
  album_art_url: string;
  source_service: string;
  source_url: string;
  created_at: string;
  added_by_user?: User | null;
}

export interface CollabList {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  is_weekly_challenge: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  owner: User;
  member_count: number;
  track_count: number;
  my_role?: 'owner' | 'member' | null;
  tracks: CollabListTrack[];
}

export interface WeeklyRecapSummary {
  top_artist: string | null;
  top_genre: string | null;
  posts_shared: number;
  now_playing_posts: number;
  collection_adds: number;
  total_scrobbles: number;
  unique_artists: number;
  unique_tracks: number;
  unique_albums: number;
  active_days: number;
  busiest_day: string | null;
  top_artists: Array<{ name: string; plays: number }>;
  top_tracks: Array<{ title: string; artist: string; plays: number; album_art_url?: string }>;
  top_albums: Array<{ name: string; artist: string; plays: number; album_art_url?: string }>;
}

export interface WeeklyRecap {
  id: number;
  user_id: number;
  week_start: string;
  summary: WeeklyRecapSummary;
  image_url: string;
  generated_at: string;
}
