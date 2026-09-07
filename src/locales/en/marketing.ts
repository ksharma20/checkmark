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
 */

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
    links: [
      { label: 'For Teams', href: '/for-teams' },
      { label: 'For You', href: '/for-you' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Open Source', href: '/open-source' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
    tagline: (year: number) =>
      `© ${year} checkmark. Presence intelligence for modern teams.`,
    label: 'Footer',
  },

  hero: {
    badge: 'Presence Intelligence Platform',
    headingBefore: 'Know who’s ',
    headingEmphasis: 'actually',
    headingAfter: ' at work',
    subtitle:
      'CheckMark replaces manual check-ins, WhatsApp selfies, and Zoho chaos with one tap, verified by GPS and IP.',
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
      '7-year immutable history',
      'Self-serve under 10 minutes',
      'Under Rs 100 / user / month',
    ],
  },

  howItWorks: {
    eyebrow: 'How it works',
    headingBefore: 'One tap. Two ',
    headingEmphasis: 'signals',
    headingAfter: '. Zero chaos.',
    description:
      'CheckMark captures verified presence in seconds. Employees tap once, the system does the rest.',
    steps: [
      {
        num: '01',
        title: 'Employee taps "I’m at office"',
        description:
          'A single tap on the PWA home-screen shortcut. No app store, no login friction. Works on any smartphone.',
        icon: 'location',
      },
      {
        num: '02',
        title: 'Two signals captured silently',
        description:
          'GPS coordinates and IP address are captured in the background and cross-validated for accuracy.',
        icon: 'wifi',
      },
      {
        num: '03',
        title: 'Presence verified instantly',
        description:
          'Both signals must match the registered office profile. No match, no credit. Tamper-proof by design.',
        icon: 'check',
      },
      {
        num: '04',
        title: 'HR gets clean data automatically',
        description:
          'Month-end reports, allowance calculations, and attendance summaries are generated automatically.',
        icon: 'chart',
      },
    ],
  },

  features: {
    eyebrow: 'Platform features',
    headingBefore: 'Built for the ',
    headingEmphasis: 'hybrid era',
    headingAfter: '',
    description: 'One platform, two modes. Same architecture, different use cases.',
    items: [
      {
        title: 'Hybrid Office Mode',
        description:
          'Register your GPS and IP. CheckMark auto-filters presence events to verified office check-ins.',
        icon: 'grid',
      },
      {
        title: 'Field Force Mode',
        description:
          'No location pre-registration needed. Every check-in is logged with full location for agents.',
        icon: 'map',
      },
      {
        title: 'Immutable History',
        description:
          'Companies cannot delete or alter user check-ins. Seven-year retention keeps a portable proof-of-work record.',
        icon: 'lock',
      },
      {
        title: 'Zero Hardware',
        description: 'No biometric devices. No IT setup. If you have a phone, setup is quick.',
        icon: 'phone',
      },
      {
        title: 'Coworking-Ready',
        description:
          'Works where biometric systems fail. Multi-location support handles distributed teams.',
        icon: 'building',
      },
      {
        title: 'Payroll and HRMS Integration',
        description:
          'Clean presence data feeds payroll, incentives, leave management, and compliance workflows.',
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
      'From pharma field reps to IT hybrid teams, CheckMark fits the way your industry actually operates.',
    tablistLabel: 'Industries',
    items: [
      {
        eyebrow: 'Hybrid offices',
        num: '01',
        title: 'IT and SaaS',
        description:
          'Track hybrid attendance across offices and coworking hubs. CheckMark auto-reconciles allowance data directly into payroll.',
        metrics: [
          { value: '~5 hrs', label: 'HR time saved / month' },
          { value: '4+', label: 'locations supported' },
          { value: '<10 min', label: 'setup time' },
        ],
      },
      {
        eyebrow: 'Field force',
        num: '02',
        title: 'Pharma and Healthcare',
        description:
          'Verified location diaries for field reps visiting clinics, hospitals, and stockists.',
        metrics: [
          { value: '0', label: 'disputes after go-live' },
          { value: '100%', label: 'tamper-proof logs' },
          { value: 'Any', label: 'clinic / hospital' },
        ],
      },
      {
        eyebrow: 'Compliance-ready',
        num: '03',
        title: 'BFSI and Insurance',
        description:
          'Timestamped and immutable attendance logs that are always audit-accessible.',
        metrics: [
          { value: '7 yrs', label: 'log retention' },
          { value: 'Instant', label: 'audit export' },
          { value: '0', label: 'hardware required' },
        ],
      },
      {
        eyebrow: 'Multi-location',
        num: '04',
        title: 'Retail and FMCG',
        description:
          'Real-time visibility into field agent activity across hundreds of distributor and retail points.',
        metrics: [
          { value: '500+', label: 'locations supported' },
          { value: 'Real-time', label: 'field visibility' },
          { value: 'Rs0', label: 'hardware cost' },
        ],
      },
      {
        eyebrow: 'Zero hardware',
        num: '05',
        title: 'Logistics and Supply Chain',
        description: 'Verified presence at warehouses, docks, and delivery hubs with one tap.',
        metrics: [
          { value: 'Any', label: 'warehouse / hub' },
          { value: '2-signal', label: 'verification' },
          { value: '1 tap', label: 'per check-in' },
        ],
      },
      {
        eyebrow: 'Campus-ready',
        num: '06',
        title: 'Education and EdTech',
        description:
          'Faculty and staff presence verification across campuses and centers using GPS and IP signals.',
        metrics: [
          { value: 'Any', label: 'campus / centre' },
          { value: 'GPS+IP', label: 'Based' },
          { value: 'PWA', label: 'no app store needed' },
        ],
      },
    ],
  },

  comparison: {
    eyebrow: 'Why CheckMark',
    headingBefore: 'How we stack up against the ',
    headingEmphasis: 'rest',
    headingAfter: '',
    description: 'Traditional HRMS tools were not designed for hybrid work or field teams.',
    columns: {
      feature: 'Feature',
      checkmark: 'CheckMark',
      keka: 'Keka / Zoho',
      whatsapp: 'WhatsApp / Forms',
    },
    /** Screen-reader text for the tick / dash / cross cells. */
    cellLabels: { yes: 'Yes', partial: 'Partial', no: 'No' },
    footnote: 'Partial = available only in higher tiers or with significant configuration.',
    groups: [
      {
        category: 'Setup and Access',
        items: [
          { feature: 'No app install (PWA)', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
          { feature: 'Self-serve setup under 10 min', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
          { feature: 'Zero hardware required', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
        ],
      },
      {
        category: 'Verification and Accuracy',
        items: [
          { feature: 'GPS + IP cross-validation', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
          { feature: 'Tamper-proof check-ins', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
          { feature: 'Works in coworking spaces', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
        ],
      },
      {
        category: 'Data and Compliance',
        items: [
          { feature: 'Immutable 7-year history', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
          { feature: 'User-owned portable data', checkmark: 'yes', keka: 'no', whatsapp: 'no' },
          { feature: 'Automated month-end reports', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
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
      'Whether you are an employee who wants proof of effort or an org that needs verified data, CheckMark works for both sides.',
    perspectives: [
      {
        label: 'For Individuals',
        title: 'Your work, verified. Always.',
        description:
          'Build a permanent, portable record of your professional presence, owned by you.',
        points: [
          { title: 'Personal timeline', desc: 'See every day you showed up, for how long, and where.' },
          { title: 'Dispute protection', desc: 'Verified proof if your allowance or incentive is disputed.' },
          { title: 'Work streaks', desc: 'Track consistency and build sustainable work habits.' },
          { title: 'Portable history', desc: 'Your presence log follows you across employers.' },
          { title: 'Always free', desc: 'Individuals never pay.' },
        ],
      },
      {
        label: 'For Organisations',
        title: 'Clean data. Zero drama.',
        description:
          'Stop wasting HR time on manual reconciliation and plug verified data into payroll and compliance.',
        points: [
          { title: 'Automated reports', desc: 'Month-end allowance calculations without manual work.' },
          { title: 'Multi-location support', desc: 'Manage multiple offices and coworking hubs from one dashboard.' },
          { title: 'Field force visibility', desc: 'Real-time location diaries for on-ground agents.' },
          { title: 'Audit-ready logs', desc: 'Every check-in is timestamped and immutable.' },
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
        a: 'When you tap check-in, CheckMark captures IP address and GPS coordinates and validates them against office profile data.',
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
        a: 'Users own their data. Organizations can query with consent but cannot alter immutable records.',
      },
      {
        q: 'How long does setup take?',
        a: 'Typically under 10 minutes for an organization with no hardware setup.',
      },
      {
        q: 'Does CheckMark track me continuously?',
        a: 'No. Data is captured only when you tap check-in.',
      },
      {
        q: 'Is CheckMark free for employees?',
        a: 'Yes. Individuals do not pay. Organizations pay per enrolled user.',
      },
    ],
  },

  comingSoon: {
    eyebrow: 'What’s Next',
    headingBefore: 'We’re Not Done ',
    headingEmphasis: 'Yet.',
    headingAfter: '',
    description:
      'Great platforms don’t stop evolving. AI verification is coming to CheckMark - empowering teams with the next frontier of presence intelligence, built on the same trusted foundation you rely on today.',
    badge: 'Coming Soon',
    title: 'AI Face Verification',
    body: 'On check-in, CheckMark will capture a facial match - like unlocking your phone, but for your attendance record. Your face becomes the fifth signal: the one that proves it was really you, not a proxy or a script.',
    signalStackLabel: 'Signal Stack',
    signals: [
      { label: 'GPS', active: true },
      { label: 'IP', active: true },
      { label: 'Device', active: true },
      { label: 'Face ✦', active: false },
    ],
    bullets: [
      {
        icon: 'pin',
        title: 'Next signal - biometric',
        desc: 'Joins GPS, IP, and device. All must match for verified office presence.',
      },
      {
        icon: 'eye',
        title: 'Liveness detection',
        desc: 'A photo won’t pass. The system detects a live face - same tech as your phone’s face unlock.',
      },
      {
        icon: 'lock',
        title: 'Privacy-first',
        desc: 'No face images stored. A one-way mathematical hash is saved - the face cannot be reconstructed.',
      },
      {
        icon: 'people',
        title: 'Proxy-proof attendance',
        desc: 'A colleague can’t check in for you. Your face is your signature - tied to your identity, not your device.',
      },
    ],
    footnoteStrong: 'Built on the same foundation.',
    footnote:
      ' AI verification will be an optional additional signal - existing GPS + IP + device setups are unaffected. Orgs opt in when ready.',
  },

  ctaBand: {
    headingBefore: 'Stop chasing',
    headingEmphasis: 'presence data.',
    description:
      'From one frustrated engineer’s allowance hack to a platform that makes presence tracking invisible.',
    primaryCta: 'Get Started - It’s Free',
    secondaryCta: 'Talk to us',
    copyright: 'Copyright 2026 CheckMark. Presence Intelligence Platform.',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Contact', href: 'mailto:kabir.innovate@gmail.com' },
    ],
  },
} as const

export type MarketingCopy = typeof marketing
