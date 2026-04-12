export type ReclaimActionType =
  | 'data-deletion'         // GDPR/CCPA right to erasure
  | 'opt-out-ads'           // opt out of targeted advertising
  | 'opt-out-sale'          // opt out of data sale (CCPA)
  | 'download-copy'         // right to data portability
  | 'privacy-settings'      // general privacy settings page

export interface ReclaimActionDefinition {
  type: ReclaimActionType
  label: string
  description: string
  url: string
  jurisdiction?: 'gdpr' | 'ccpa' | 'global'
  estimatedDays?: number     // platform's typical response time
}

export interface PlatformReclaimOptions {
  platform: string
  displayName: string
  tagline: string            // one-line description of the data risk
  actions: ReclaimActionDefinition[]
}

export const PLATFORM_RECLAIM_OPTIONS: PlatformReclaimOptions[] = [
  {
    platform: 'linkedin',
    displayName: 'LinkedIn',
    tagline: 'Sells your professional profile to advertisers and recruiters',
    actions: [
      {
        type: 'data-deletion',
        label: 'Close your account',
        description: 'Permanently deletes your profile, connections, and all activity after a 30-day grace period.',
        url: 'https://www.linkedin.com/help/linkedin/answer/a1346213',
        jurisdiction: 'global',
        estimatedDays: 30,
      },
      {
        type: 'download-copy',
        label: 'Download your data',
        description: 'Export your profile, connections, messages, and activity before deleting.',
        url: 'https://www.linkedin.com/mypreferences/d/download-my-data',
        jurisdiction: 'global',
      },
      {
        type: 'opt-out-ads',
        label: 'Opt out of ad targeting',
        description: 'Disable LinkedIn\'s use of your profile data for ad targeting and interest categories.',
        url: 'https://www.linkedin.com/mypreferences/d/advertising',
        jurisdiction: 'global',
      },
      {
        type: 'privacy-settings',
        label: 'Privacy settings',
        description: 'Control who sees your profile, activity, and connections.',
        url: 'https://www.linkedin.com/mypreferences/d/privacy',
        jurisdiction: 'global',
      },
    ],
  },
  {
    platform: 'google',
    displayName: 'Google',
    tagline: 'Holds the most comprehensive behavioral profile of anyone you\'ve ever met',
    actions: [
      {
        type: 'data-deletion',
        label: 'Delete your Google Account',
        description: 'Permanently removes all data across Google services: Search, Gmail, YouTube, Maps, and more.',
        url: 'https://myaccount.google.com/deleteaccount',
        jurisdiction: 'global',
        estimatedDays: 60,
      },
      {
        type: 'download-copy',
        label: 'Download your data (Takeout)',
        description: 'Export everything Google has on you before deletion.',
        url: 'https://takeout.google.com/',
        jurisdiction: 'global',
      },
      {
        type: 'opt-out-ads',
        label: 'Turn off ad personalization',
        description: 'Disable interest-based advertising across Google Search, YouTube, and partner sites.',
        url: 'https://adssettings.google.com/authenticated',
        jurisdiction: 'global',
      },
      {
        type: 'privacy-settings',
        label: 'Delete specific activity',
        description: 'Selectively delete Search history, YouTube history, location history, and more.',
        url: 'https://myactivity.google.com/delete-activity',
        jurisdiction: 'global',
      },
      {
        type: 'privacy-settings',
        label: 'Privacy Checkup',
        description: 'Step-by-step review of all Google privacy settings.',
        url: 'https://myaccount.google.com/privacycheckup',
        jurisdiction: 'global',
      },
    ],
  },
  {
    platform: 'meta',
    displayName: 'Meta (Facebook & Instagram)',
    tagline: 'Tracks you across the web even when you\'re not on their platforms',
    actions: [
      {
        type: 'data-deletion',
        label: 'Delete Facebook account',
        description: 'Permanently removes your Facebook profile and data after a 30-day grace period.',
        url: 'https://www.facebook.com/help/delete_account',
        jurisdiction: 'global',
        estimatedDays: 30,
      },
      {
        type: 'data-deletion',
        label: 'Delete Instagram account',
        description: 'Permanently removes your Instagram account and data.',
        url: 'https://accountscenter.instagram.com/personal_info/',
        jurisdiction: 'global',
        estimatedDays: 30,
      },
      {
        type: 'download-copy',
        label: 'Download your Facebook data',
        description: 'Export your posts, messages, photos, and ad data before deleting.',
        url: 'https://www.facebook.com/dyi/',
        jurisdiction: 'global',
      },
      {
        type: 'opt-out-ads',
        label: 'Off-Facebook Activity',
        description: 'Disconnect the tracking data Meta collects about you on third-party websites and apps.',
        url: 'https://www.facebook.com/off_facebook_activity/',
        jurisdiction: 'global',
      },
      {
        type: 'opt-out-ads',
        label: 'Ad preferences',
        description: 'Review and remove the interest categories Meta uses to target you.',
        url: 'https://www.facebook.com/ads/preferences/',
        jurisdiction: 'global',
      },
    ],
  },
  {
    platform: 'reddit',
    displayName: 'Reddit',
    tagline: 'Your upvote history is one of the most precise interest graphs on the internet',
    actions: [
      {
        type: 'data-deletion',
        label: 'Delete your account',
        description: 'Deactivates your Reddit account. Posted content may remain but will be anonymized.',
        url: 'https://www.reddit.com/settings/deactivate',
        jurisdiction: 'global',
      },
      {
        type: 'download-copy',
        label: 'Request your data',
        description: 'Download your posts, comments, votes, and account data.',
        url: 'https://www.reddit.com/settings/data-request',
        jurisdiction: 'global',
        estimatedDays: 30,
      },
      {
        type: 'opt-out-ads',
        label: 'Ad personalization',
        description: 'Opt out of interest-based ad targeting based on your Reddit activity.',
        url: 'https://www.reddit.com/personalization',
        jurisdiction: 'global',
      },
      {
        type: 'privacy-settings',
        label: 'Privacy settings',
        description: 'Control who can see your profile, posts, and activity.',
        url: 'https://www.reddit.com/settings/privacy',
        jurisdiction: 'global',
      },
    ],
  },
  {
    platform: 'x',
    displayName: 'X (Twitter)',
    tagline: 'Sells your posts and behavioral data to AI training and advertisers',
    actions: [
      {
        type: 'data-deletion',
        label: 'Deactivate your account',
        description: 'Deactivates your account for 30 days; permanently deletes after that period.',
        url: 'https://x.com/settings/deactivate',
        jurisdiction: 'global',
        estimatedDays: 30,
      },
      {
        type: 'download-copy',
        label: 'Download your archive',
        description: 'Export your tweets, DMs, likes, and account data.',
        url: 'https://x.com/settings/download_your_data',
        jurisdiction: 'global',
        estimatedDays: 1,
      },
      {
        type: 'opt-out-ads',
        label: 'Ad preferences',
        description: 'Remove interest categories and opt out of interest-based advertising.',
        url: 'https://x.com/settings/ads_preferences',
        jurisdiction: 'global',
      },
      {
        type: 'opt-out-sale',
        label: 'Data sharing settings',
        description: 'Control what data X shares with partners and advertisers.',
        url: 'https://x.com/settings/data_and_privacy',
        jurisdiction: 'global',
      },
      {
        type: 'privacy-settings',
        label: 'Privacy and safety',
        description: 'Control who can see your posts, message you, and find your account.',
        url: 'https://x.com/settings/privacy_and_safety',
        jurisdiction: 'global',
      },
    ],
  },
]

export function getPlatformOptions(platform: string): PlatformReclaimOptions | undefined {
  return PLATFORM_RECLAIM_OPTIONS.find(p => p.platform === platform.toLowerCase())
}
