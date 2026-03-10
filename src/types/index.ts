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
  current_streak: number;
  longest_streak: number;
  collection_count: number;
}

export type PostType = 'now_playing' | 'loved' | 'history';

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
  created_at: string;
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

export interface CollectionResponse {
  items: CollectionItem[];
  total: number;
}
