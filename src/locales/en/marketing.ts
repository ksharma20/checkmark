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
 * and IP (`deriveConfiguredTypes` in src/lib/signals.ts returns nothing else) -
 * and when both are configured both must match. Presence events are never
 * edited or deleted. Nobody pays. Anything else is a promise, and a marketing
 * page is not the place to make one.
 *
 * THE ORDER OF THE ARGUMENT IS THE POSITIONING, and it is deliberate.
 *
 * The page leads with the PERSON - "own where you've been" - and only then
 * reaches the organisation's need to verify. That is not a softer way of saying
 * the same thing: `presence_events` carries no `workspace_id`, so a check-in
 * genuinely is the member's row and a workspace genuinely is a query over it.
 * Copy that opened with "know who's actually at work" sold the opposite product
 * - it made the reader the subject of the tool rather than its owner, which is
 * the one thing the design spec says the surface must never do.
 *
 * Three claims carry most of the weight and each is checkable:
 *   - AND, not OR. Configure GPS and IP and both must match; one match is
 *     `partial`, and the member sees that word on their own timeline.
 *   - Nothing runs in the background. Both signals are read inside the tap.
 *   - Nobody pays, and the history is not the employer's to keep.
 *
 * Do not reintroduce claims the code cannot serve: there is no Wi-Fi signal
 * type, no face or biometric check, no hardware, no payroll pipe, no retention
 * window, and no measured metric anybody can source.
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
      { label: 'Who it’s for', href: '#for-who' },
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
    badge: 'Open source · Apache 2.0',
    headingBefore: 'Own ',
    headingEmphasis: 'where you’ve been',
    headingAfter: '.',
    subtitle:
      'One tap when you arrive, one when you leave, and the record is yours. The workspaces you join query that record through rules they set - they never own it, and nobody can edit or delete what you logged.',
    primaryCta: 'Start your record - it’s free',
    secondaryCta: 'See how it works',
    sceneAlt: 'CheckMark',
    verifiedBadge: 'Verified',
    signalTags: ['GPS ✓', 'IP ✓'],
  },

  marquee: {
    items: [
      'Your history, on your account',
      'Nothing is recorded in the background',
      'GPS + IP verification',
      'Check-ins are never edited or deleted',
      'No app install · no hardware',
      'Open source · Apache 2.0',
      'Nobody pays',
    ],
  },

  howItWorks: {
    eyebrow: 'How it works',
    headingBefore: 'One tap. Nothing in the ',
    headingEmphasis: 'background',
    headingAfter: '.',
    description:
      'CheckMark reads a signal at the moment you tap, and at no other moment. There is no tracker to leave running and nothing to switch off when you go home.',
    steps: [
      {
        num: '01',
        title: 'You tap "I’m here"',
        description:
          'From the browser, or a shortcut on your home screen. No app store, no clocking machine, no hardware anywhere in this.',
        icon: 'location',
      },
      {
        num: '02',
        title: 'Two signals, read once',
        description:
          'Your GPS position and your IP address, captured inside that tap. Neither is sampled before it or after it.',
        icon: 'signal',
      },
      {
        num: '03',
        title: 'Your workspace applies its own rules',
        description:
          'Configure GPS and IP and both must match to count as verified - match one and the check-in is partial, and your timeline says so too. Configure nothing and every check-in counts.',
        icon: 'check',
      },
      {
        num: '04',
        title: 'The record stays yours',
        description:
          'The timeline sits on your account, not inside a company. The days roll up into a monthly grid your workspace can export.',
        icon: 'chart',
      },
    ],
  },

  features: {
    eyebrow: 'What you get',
    headingBefore: 'One record, read ',
    headingEmphasis: 'two ways',
    headingAfter: '.',
    description:
      'The same check-in answers a person’s question and an organisation’s, without either having to take the other’s spreadsheet on trust.',
    items: [
      {
        title: 'History you own',
        description:
          'A check-in is stored against your account and carries no company on it. Join a workspace, leave it, join another - the timeline stays where it was.',
        icon: 'lock',
      },
      {
        title: 'Nothing edited behind you',
        description:
          'No check-in is ever modified or deleted, by anyone. An admin correction is recorded beside the original and both stay visible to you.',
        icon: 'shield',
      },
      {
        title: 'Verification you can read',
        description:
          'The matching rule is a function in a public repository, not a black box. You can read exactly why a check-in counted - and so can your admin.',
        icon: 'code',
      },
      {
        title: 'Office mode',
        description:
          'Register an office by GPS, by IP, or both, and as many locations as you run. Coworking desks register the same way a leased floor does.',
        icon: 'building',
      },
      {
        title: 'Field mode',
        description:
          'Nothing to register? Skip the signals entirely. Every check-in is still logged with a position and a place name wherever location is allowed.',
        icon: 'map',
      },
      {
        title: 'The rest of the workspace',
        description:
          'Leave balances and approvals, a holiday calendar, a people directory, documents and announcements sit beside attendance, not in another tool.',
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
        category: 'Ownership',
        items: [
          { feature: 'Record belongs to the person, not the employer', checkmark: 'yes', keka: 'no', whatsapp: 'no' },
          { feature: 'History survives leaving the organisation', checkmark: 'yes', keka: 'no', whatsapp: 'no' },
          { feature: 'Nobody can edit or delete a recorded check-in', checkmark: 'yes', keka: 'no', whatsapp: 'no' },
        ],
      },
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
    eyebrow: 'Two perspectives',
    headingBefore: 'Yours first. ',
    headingEmphasis: 'Theirs second.',
    headingAfter: '',
    description:
      'A person records their presence because the record is worth having. An organisation queries that record through rules it sets. Users never pay, and organisations never own the history they are reading.',
    perspectives: [
      {
        label: 'For you',
        title: 'Your work, on your record.',
        description:
          'Your check-ins are stored against your account, and they outlast any one employer.',
        points: [
          { title: 'Personal timeline', desc: 'Each check-in, how long you stayed, and where.' },
          { title: 'Nothing hidden', desc: 'You see whether a check-in counted as verified, partial or neither - the same answer your admin is looking at.' },
          { title: 'Nothing in the background', desc: 'Location and IP are read inside the tap, and at no other time.' },
          { title: 'One account, many workspaces', desc: 'A single check-in counts for every workspace you belong to.' },
          { title: 'Always free', desc: 'Individuals never pay. There is no tier to reach for.' },
        ],
      },
      {
        label: 'For organisations',
        title: 'Verify without surveilling.',
        description:
          'Set the rules, query what matches them, export the answer. You get a number at month end, not a feed of where everyone went.',
        points: [
          { title: 'Your rules, your filter', desc: 'Configure GPS, IP, both or nothing at all. Verification is computed against what your workspace configured, and only that.' },
          { title: 'Automatic summaries', desc: 'Office, remote and leave days per member, in a monthly grid you can export.' },
          { title: 'Corrections, not edits', desc: 'An override is recorded beside the check-in. The original stays, and the member can see both.' },
          { title: 'No hardware, no rollout', desc: 'Nothing to mount on a wall and nothing to push through an app store. A browser is the whole install.' },
          { title: 'Self-host it', desc: 'Apache 2.0. Run the entire thing on your own infrastructure if the data should not leave it.' },
        ],
      },
    ],
  },

  faq: {
    eyebrow: 'FAQ',
    headingBefore: 'Questions we get ',
    headingEmphasis: 'a lot',
    headingAfter: '',
    description: 'The ones worth answering before you sign in.',
    items: [
      {
        q: 'Does CheckMark track me in the background?',
        a: 'No. Your GPS position and your IP address are read at the moment you tap check in or check out, and at no other moment. There is no always-on location and nothing left running - close the tab and nothing further is recorded.',
      },
      {
        q: 'How does the verification actually work?',
        a: 'Your workspace registers its locations by GPS, by IP, or both. If it has configured both, a check-in must match BOTH to count as verified; matching one makes it partial, and your own timeline shows that word too. A workspace that has configured nothing counts every check-in - there is nothing for it to fail against.',
      },
      {
        q: 'Who owns the check-in data?',
        a: 'You do. A check-in is stored against your account and carries no company on it at all. Workspaces you belong to query it through their own rules, and nobody - including an admin - can edit or delete something you recorded.',
      },
      {
        q: 'What happens to my history if I leave the company?',
        a: 'It stays with you. What ends is your membership of that workspace; the record it was querying sits on your account and does not leave with them.',
      },
      {
        q: 'Do I need to install an app, or any hardware?',
        a: 'Neither. CheckMark is a Progressive Web App - open it in the browser and add it to your home screen. There is nothing to mount on a wall, no cards and no readers of any kind.',
      },
      {
        q: 'What if I work from a coworking space?',
        a: 'Register it like any other location. A workspace can hold several, so a coworking desk, a leased floor and a second city all sit side by side.',
      },
      {
        q: 'Is CheckMark free?',
        a: 'Yes, for everyone. It is open source under the Apache 2.0 licence: self-host it on your own infrastructure, or use the hosted instance at no cost. Individuals never pay, and today nor does any organisation.',
      },
    ],
  },

  ctaBand: {
    headingBefore: 'Know where your team is.',
    headingEmphasis: 'Own where you’ve been.',
    description:
      'Free, open source and yours to self-host. Start your own record, or bring a team onto one.',
    primaryCta: 'Start your record - it’s free',
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
