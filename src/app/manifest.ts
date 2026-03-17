import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CheckMark',
    short_name: 'CheckMark',
    description: 'Presence Intelligence Platform — know where your team is, own where you\'ve been.',
    start_url: '/me',
    display: 'standalone',
    background_color: '#f5f4f2',
    theme_color: '#1a1a2e',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
