// Single source of truth for all brand strings and user-facing copy.
// To rename the product: change `brand` below — every string that embeds
// the brand name is built from it, so it updates everywhere automatically.

const brand = 'CheckMark'

export const en = {
  brand: {
    name: brand,
    shortName: brand,
    tagline: 'Presence Intelligence Platform',
    taglineLong: "Know where your team is. Own where you've been.",
    domain: 'checkmark.kabirinnovations.com',
    email: 'noreply@kabirinnovations.com',
    description: `Presence Intelligence Platform — know where your team is, own where you've been.`,
  },

  landing: {
    heroHeadline: 'Presence intelligence\nfor modern teams',
    heroSubtitle: `Know who's in the office. Plan your week with purpose. ${brand} makes hybrid work actually work — without surveillance.`,
    footerText: 'Built for humans who work in offices sometimes.',
    features: [
      {
        title: "Know who's in today",
        body: 'Your Today dashboard shows which team members are in the office right now, who visited earlier, and who stayed remote — updated by the second.',
      },
      {
        title: 'Privacy by design',
        body: 'Employees choose to participate. Every data point belongs to the person who created it. Consent can be withdrawn at any time with one click.',
      },
      {
        title: 'Verified domains, zero friction',
        body: 'Add your company domain and anyone who signs up with a matching email is auto-enrolled — no invite required.',
      },
      {
        title: 'Multiple signals',
        body: "Wi-Fi network detection, GPS check-in, IP geofencing, and manual override. Whichever fits your team's setup.",
      },
    ],
  },

  auth: {
    welcomeHeading: `Welcome to ${brand}`,
    accountTypeHeading: `How will you use ${brand}?`,
    sessionLogoutText: `Sign out of your ${brand} account on this device.`,
  },

  consent: {
    // Used on the /consent/[token] page
    brandLogo: brand,
    declineBody: `You won't appear in that workspace's presence dashboard. You can always sign in to ${brand} to manage your own presence.`,
  },

  join: {
    // Used on the /join/[slug] page
    brandLogo: brand,
  },

  workspace: {
    // Used on /ws and /ws/:slug pages
    brandLogo: brand,
  },

  email: {
    otp: {
      subject: (code: string) => `${code} is your ${brand} verification code`,
      heading: `Your ${brand} verification code`,
      body: 'Use this code to verify your email address. It expires in 10 minutes.',
      footer: "If you didn't request this, you can safely ignore this email.",
    },
    consent: {
      subject: (workspaceName: string) => `${workspaceName} wants to track your work presence`,
      heading: (workspaceName: string) => `You've been invited to ${workspaceName}`,
      body: (workspaceName: string) =>
        `<strong>${workspaceName}</strong> has added your email to their ${brand} workspace. This means they can see your work presence events (office check-ins, client visits, etc.) after you consent.`,
      revoke: `Your data always belongs to you. You can revoke access at any time from your ${brand} profile.`,
      footer: `${brand} is a presence intelligence platform that lets employees own their work history.`,
    },
  },

  notifications: {
    // Stale check-in reminders — fired at 8h, 12h, 16h, 18h, 20h, 22h after check-in
    stale: {
      8:  { title: `${brand} — time to wrap up?`,          body: "It's been 8 hours. Work-life balance matters — feel free to head out!" },
      12: { title: `${brand} — still going?`,              body: '12 hours in! Dedication noted, but rest is important too. Time to head home.' },
      16: { title: `${brand} — seriously though`,          body: '16 hours checked in. Even the most committed need sleep. Please check out!' },
      18: { title: `${brand} — we are worried`,            body: "18 hours! Your productivity has left the building. Be kind to yourself — go home." },
      20: { title: `${brand} — this is getting serious`,   body: '20 hours and counting. We genuinely recommend a bed over your desk right now.' },
      22: { title: `${brand} — final warning`,             body: '22 hours! Auto-checkout happens in 2 hours. This is your last chance to do it yourself.' },
    } as Record<number, { title: string; body: string }>,
    staleFallback: {
      title: `${brand} — still checked in?`,
      body: (hours: number) => `You've been checked in for ${hours} hours. Did you forget to check out?`,
    },
    autoCheckout: {
      title: `${brand} — auto checked out`,
      body: 'You were automatically checked out after 24 hours.',
    },
  },
}
