/**
 * Copy for the public marketing surface: the shared nav and footer, and every
 * section of the landing page.
 *
 * Deliberately a separate module from `src/locales/en.ts` - that file is the
 * product's string table (auth, emails, app chrome) and is edited constantly.
 * Marketing copy churns on its own schedule, so it lives here and is imported
 * directly (`import { marketing } from '@/locales/en/marketing'`).
 *
 * Long-form legal prose (/privacy, /terms) stays inline in its page: it is a
 * single document read top to bottom, not a set of reusable labels.
 *
 * Every claim here must be one the code can back. Two signal types exist - GPS
 * and IP - and when both are configured both must match. Presence events are
 * never edited or deleted. Nobody pays. Anything else is a promise, and a
 * marketing page is not the place to make one.
 */

/*
 * Mirrors `en.brand.contactEmail` / `en.brand.owner`. They are repeated rather
 * than imported because `src/locales/en.ts` imports THIS module, so importing
 * it back would read `en` before it is initialised.
 */
const contactEmail = 'kabir.innovate@gmail.com'
const owner = 'Kabir Innovations'
const hostedDomain = 'checkmark.kabirinnovations.com'
const repoUrl = 'https://github.com/ksharma20/checkmark'

export const marketing = {
  nav: {
    /** Cross-page site navigation - the default for every marketing page. */
    links: [
      { label: 'For Teams', href: '/for-teams' },
      { label: 'For You', href: '/for-you' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Open Source', href: '/open-source' },
    ],
    /** In-page section jumps - passed by the landing page only. */
    landingLinks: [
      { label: 'How it works', href: '#how' },
      { label: 'Features', href: '#features' },
      { label: 'Industries', href: '#industries' },
      { label: 'Compare', href: '#compare' },
      { label: 'FAQ', href: '#faq' },
    ],
    signIn: 'Sign in',
    getStarted: 'Get started',
    // Shown instead of the pair above once the visitor has a session. The nav
    // discovers that in the browser, so these are the signed-in half of a swap.
    dashboard: 'Dashboard',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    /** Accessible name for the <nav> landmark. */
    label: 'Main',
    logoAlt: 'CheckMark',
  },

  footer: {
    brand: 'CheckMark',
    links: [
      { label: 'For Teams', href: '/for-teams' },
      { label: 'For You', href: '/for-you' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Open Source', href: '/open-source' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
    tagline: (year: number) =>
      `© ${year} CheckMark · a ${owner} project · Apache 2.0`,
    label: 'Footer',
  },

  hero: {
    badge: 'Free and open source',
    headingBefore: 'Know who’s ',
    headingEmphasis: 'actually',
    headingAfter: ' at work',
    subtitle:
      'CheckMark replaces manual check-ins, WhatsApp selfies and spreadsheet chaos with one tap, verified by GPS and IP. Know where your team is. Own where you’ve been.',
    primaryCta: 'Get Started - It’s Free',
    secondaryCta: 'See how it works',
    sceneAlt: 'CheckMark',
    verifiedBadge: 'Verified',
    signalTags: ['GPS ✓', 'IP ✓'],
  },

  marquee: {
    items: [
      'No app install required',
      'GPS + IP verification',
      'Works in coworking spaces',
      'Check-ins are never edited or deleted',
      'Open source · Apache 2.0',
      'Free for everyone',
    ],
  },

  howItWorks: {
    eyebrow: 'How it works',
    headingBefore: 'One tap. Two ',
    headingEmphasis: 'signals',
    headingAfter: '. Zero chaos.',
    description:
      'CheckMark records presence in a second. You tap once; the checking happens on the server.',
    steps: [
      {
        num: '01',
        title: 'Tap "I’m at office"',
        description:
          'One tap from the home-screen shortcut. No app store. Works in the browser on any smartphone.',
        icon: 'location',
      },
      {
        num: '02',
        title: 'Two signals, at that moment only',
        description:
          'Your GPS position and IP address are captured when you tap - never in the background.',
        icon: 'signal',
      },
      {
        num: '03',
        title: 'Checked against your office',
        description:
          'Every signal your workspace has configured must match. Match only some and the check-in is marked partial, not verified.',
        icon: 'check',
      },
      {
        num: '04',
        title: 'Attendance adds itself up',
        description:
          'Office, remote and leave days are counted per member in a monthly grid you can export to Excel.',
        icon: 'chart',
      },
    ],
  },

  features: {
    eyebrow: 'Platform features',
    headingBefore: 'Built for the ',
    headingEmphasis: 'hybrid era',
    headingAfter: '',
    description: 'One platform, two ways to use it.',
    items: [
      {
        title: 'Hybrid Office Mode',
        description:
          'Register your office by GPS, by IP, or both. Check-ins that match every configured signal count as office days.',
        icon: 'grid',
      },
      {
        title: 'Field Force Mode',
        description:
          'No office to register? Skip the signals. Check-ins are still recorded with a GPS position and a place name wherever location is allowed.',
        icon: 'map',
      },
      {
        title: 'History You Own',
        description:
          'Check-ins are never edited or deleted - not by you, not by an admin. A correction is recorded beside the original, never over it.',
        icon: 'lock',
      },
      {
        title: 'Zero Hardware',
        description: 'No clocking machines. No IT setup. A phone and a browser are enough.',
        icon: 'phone',
      },
      {
        title: 'Coworking-Ready',
        description:
          'Register more than one location, coworking spaces included. Members check in the same way wherever they are.',
        icon: 'building',
      },
      {
        title: 'Leave, Holidays and People',
        description:
          'Leave balances and approvals, a holiday calendar, a people directory and documents sit in the same workspace as attendance.',
        icon: 'integration',
      },
    ],
  },

  industries: {
    eyebrow: 'Industries',
    headingBefore: 'Built for how ',
    headingEmphasis: 'India works',
    headingAfter: '',
    description:
      'From pharma field reps to IT hybrid teams, CheckMark fits the way your team actually operates.',
    tablistLabel: 'Industries',
    items: [
      {
        eyebrow: 'Hybrid offices',
        num: '01',
        title: 'IT and SaaS',
        description:
          'Track hybrid attendance across offices and coworking hubs, with office and remote days counted for every member.',
        metrics: [
          { value: 'GPS + IP', label: 'verification' },
          { value: 'PWA', label: 'no app store needed' },
          { value: 'Excel', label: 'monthly export' },
        ],
      },
      {
        eyebrow: 'Field force',
        num: '02',
        title: 'Pharma and Healthcare',
        description:
          'A GPS-stamped log of check-ins, with place names, for reps visiting clinics, hospitals and stockists.',
        metrics: [
          { value: 'GPS', label: 'position at check-in' },
          { value: 'Place', label: 'name per visit' },
          { value: 'Any', label: 'clinic / hospital' },
        ],
      },
      {
        eyebrow: 'Record-keeping',
        num: '03',
        title: 'BFSI and Insurance',
        description:
          'Timestamped check-ins that are never edited or deleted. Corrections sit beside the original, not over it.',
        metrics: [
          { value: 'Immutable', label: 'check-in events' },
          { value: 'Excel', label: 'attendance export' },
          { value: '0', label: 'hardware required' },
        ],
      },
      {
        eyebrow: 'Multi-location',
        num: '04',
        title: 'Retail and FMCG',
        description:
          'See who has checked in today across your distributor and retail points.',
        metrics: [
          { value: 'Many', label: 'locations per workspace' },
          { value: 'Today', label: 'live check-in view' },
          { value: '0', label: 'hardware required' },
        ],
      },
      {
        eyebrow: 'Zero hardware',
        num: '05',
        title: 'Logistics and Supply Chain',
        description: 'Verified presence at warehouses, docks and delivery hubs with one tap.',
        metrics: [
          { value: 'Any', label: 'warehouse / hub' },
          { value: 'GPS + IP', label: 'verification' },
          { value: '1 tap', label: 'per check-in' },
        ],
      },
      {
        eyebrow: 'Campus-ready',
        num: '06',
        title: 'Education and EdTech',
        description:
          'Faculty and staff presence verification across campuses and centres using GPS and IP signals.',
        metrics: [
          { value: 'Any', label: 'campus / centre' },
          { value: 'GPS + IP', label: 'verification' },
          { value: 'PWA', label: 'no app store needed' },
        ],
      },
    ],
  },

  comparison: {
    eyebrow: 'Why CheckMark',
    headingBefore: 'How CheckMark ',
    headingEmphasis: 'compares',
    headingAfter: '',
    description:
      'Keka and Zoho are full HRMS suites and do far more than attendance. This compares only the part CheckMark is built for.',
    columns: {
      feature: 'Feature',
      checkmark: 'CheckMark',
      keka: 'Keka / Zoho',
      whatsapp: 'WhatsApp / Forms',
    },
    /** Screen-reader text for the tick / cross cells. */
    cellLabels: { yes: 'Yes', no: 'No' },
    footnote: 'Based on publicly listed features. Check each vendor for the current picture.',
    groups: [
      {
        category: 'Openness',
        items: [
          { feature: 'Open source / self-hostable', checkmark: 'yes', keka: 'no', whatsapp: 'no' },
          { feature: 'Verification logic you can read', checkmark: 'yes', keka: 'no', whatsapp: 'no' },
        ],
      },
      {
        category: 'Check-in',
        items: [
          { feature: 'Location and network checked at check-in', checkmark: 'yes', keka: 'yes', whatsapp: 'no' },
          { feature: 'Attendance summarised automatically', checkmark: 'yes', keka: 'yes', whatsapp: 'no' },
          { feature: 'No dedicated hardware', checkmark: 'yes', keka: 'yes', whatsapp: 'yes' },
        ],
      },
    ],
  },

  forWho: {
    eyebrow: 'Built for everyone',
    headingBefore: 'One platform. ',
    headingEmphasis: 'Two perspectives.',
    headingAfter: '',
    description:
      'A personal tool for the people checking in, and verified data for the organisation. Users own their data; organisations query it, they do not own it.',
    perspectives: [
      {
        label: 'For Individuals',
        title: 'Your work, on your record.',
        description:
          'Your check-ins belong to your account, not to any one employer.',
        points: [
          { title: 'Personal timeline', desc: 'Each check-in, how long you stayed, and where.' },
          { title: 'Nothing hidden', desc: 'You see whether a check-in counted as verified - the same answer your admin sees.' },
          { title: 'Work streaks', desc: 'Track consistency and build sustainable work habits.' },
          { title: 'One account, many workspaces', desc: 'A single check-in counts for every workspace you belong to.' },
          { title: 'Always free', desc: 'Individuals never pay.' },
        ],
      },
      {
        label: 'For Organisations',
        title: 'Clean data. Zero drama.',
        description:
          'Stop reconciling attendance by hand. Get verified data you can export.',
        points: [
          { title: 'Automatic summaries', desc: 'Office, remote and leave days per member, in a monthly grid.' },
          { title: 'Multi-location support', desc: 'Register several offices and coworking hubs in one workspace.' },
          { title: 'Field force visibility', desc: 'Today’s check-ins, with a place name where one resolves.' },
          { title: 'Audit-ready logs', desc: 'Every check-in is timestamped and never edited.' },
        ],
      },
    ],
  },

  faq: {
    eyebrow: 'FAQ',
    headingBefore: 'Questions we get ',
    headingEmphasis: 'a lot',
    headingAfter: '',
    description: 'Everything you need to know before you get started.',
    items: [
      {
        q: 'How does CheckMark verify I am actually at the office?',
        a: 'When you tap check-in, CheckMark captures your GPS position and IP address and compares them with the locations your workspace has configured. If both GPS and IP are configured, both must match.',
      },
      {
        q: 'Do I need to install an app?',
        a: 'No. CheckMark is a Progressive Web App. Open it in the browser and add it to your home screen.',
      },
      {
        q: 'What if I work from a coworking space?',
        a: 'Coworking locations can be registered and verified the same way as office locations.',
      },
      {
        q: 'Who owns the check-in data?',
        a: 'You do. A workspace you belong to can see your check-ins, but nobody - including its admins - can edit or delete them.',
      },
      {
        q: 'How long does setup take?',
        a: 'Create a workspace, add your office location and invite your team. There is no hardware to install.',
      },
      {
        q: 'Does CheckMark track me continuously?',
        a: 'No. Data is captured only when you tap check-in or check-out.',
      },
      {
        q: 'Is CheckMark free?',
        a: 'Yes, for everyone. CheckMark is open source under the Apache 2.0 licence: self-host it, or use the hosted instance at no cost.',
      },
    ],
  },

  ctaBand: {
    headingBefore: 'Stop chasing',
    headingEmphasis: 'presence data.',
    description:
      'Know where your team is. Own where you’ve been. Free and open source, for everyone.',
    primaryCta: 'Get Started - It’s Free',
    secondaryCta: 'Talk to us',
    secondaryHref: `mailto:${contactEmail}`,
    copyright: (year: number) =>
      `© ${year} CheckMark · a ${owner} project · Apache 2.0`,
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Contact', href: `mailto:${contactEmail}` },
    ],
  },

  /** /pricing - there is no paid tier; the page explains what "free" covers. */
  pricing: {
    metaTitle: 'Pricing',
    metaDescription:
      'CheckMark is free and open source under the Apache 2.0 licence. Self-host it, or use the hosted instance - every feature is included either way.',
    ogTitle: 'CheckMark Pricing - Free and open source',
    ogDescription:
      'Nobody pays. Self-host CheckMark under Apache 2.0, or use the hosted instance at no cost.',

    eyebrow: 'Pricing',
    heading: 'Free and open source. Nobody pays.',
    subtitle:
      `CheckMark is a simple open-source project by ${owner}. There are no paid plans and no premium tier - pick how you want to run it.`,

    options: [
      {
        key: 'self-host',
        name: 'Self-host',
        price: 'Free',
        per: 'Apache 2.0',
        tagline: 'Run it on your own infrastructure. Your server, your database, your data.',
        cta: 'View on GitHub',
        href: repoUrl,
        external: true,
        highlight: false,
        points: [
          'The complete application - every screen and API route',
          'SQLite out of the box, or a Turso / libSQL database',
          'Use it, modify it and redistribute it under Apache 2.0',
          'You operate the instance and control every setting',
        ],
      },
      {
        key: 'hosted',
        name: 'Hosted instance',
        price: 'Free',
        per: 'no card required',
        tagline: `Use the instance ${owner} runs, at ${hostedDomain}.`,
        cta: 'Get started',
        href: '/login',
        external: false,
        highlight: true,
        points: [
          'The same code as the public repository',
          'Nothing to install - a PWA on any phone or browser',
          'Run on a best-effort basis, with no uptime guarantee',
          'Move to your own instance whenever you like',
        ],
      },
    ],

    includedEyebrow: 'What’s included',
    includedHeading: 'Everything. There is no premium tier.',
    included: [
      'Multi-signal check-in verification (GPS + IP)',
      'Personal timeline for every member',
      'Workspaces with roles and permissions',
      'Attendance, monthly grid and reports',
      'Leave types, balances and approvals',
      'Holiday calendar and office days',
      'People directory and reporting hierarchy',
      'Employee records with encrypted sensitive fields',
      'Employee documents and asset register',
      'Parental leave cases',
      'Announcements with attachments',
      'Push reminders and notifications',
    ],

    contactHeading: 'Questions?',
    contactBody:
      'CheckMark is maintained on a best-effort basis, so a reply may take a few days. For bugs and feature requests, a GitHub issue is the fastest route.',
    contactCta: 'Email us',
    contactHref: `mailto:${contactEmail}?subject=${encodeURIComponent('CheckMark question')}`,
    issuesCta: 'Open an issue',
    issuesHref: `${repoUrl}/issues`,
    contactEmail,
  },
} as const

export type MarketingCopy = typeof marketing
