import type { MetadataRoute } from 'next'
import { en } from '@/locales/en'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: en.brand.name,
    short_name: en.brand.shortName,
    description: en.brand.description,
    start_url: '/me',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#F8FAFC',
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
