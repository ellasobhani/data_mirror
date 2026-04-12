export type Platform =
  | 'google' | 'meta' | 'apple' | 'x'
  | 'amazon' | 'spotify' | 'linkedin' | 'tiktok'
  | 'reddit' | 'microsoft' | 'uber';

export type Category =
  | 'search'
  | 'location'
  | 'message'
  | 'purchase'
  | 'media'
  | 'social'
  | 'browse'
  | 'ad_profile'
  | 'health'
  | 'app_usage';

export interface DataRecord {
  id?: number;
  platform: Platform;
  category: Category;
  timestamp: number;       // unix ms
  title?: string;
  body?: string;           // kept local, never sent to AI
  url?: string;
  metadata: string;        // JSON blob
  entities_people?: string;
  entities_places?: string;
  entities_topics?: string;
  summary?: string;
}

export interface PlatformStatus {
  platform: Platform;
  status: 'idle' | 'requesting' | 'waiting' | 'downloading' | 'processing' | 'done' | 'error';
  requestedAt?: number;
  readyAt?: number;
  recordCount?: number;
  error?: string;
}
