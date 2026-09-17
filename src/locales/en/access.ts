/**
 * Copy for the two screens that decide whether a person joins a workspace:
 * `/join/[slug]` and `/consent/[token]`.
 *
 * They were the last pages in the repository with their user-facing strings
 * written inline (invariant 16). That is not a tidiness point here: both pages
 * are almost entirely refusals - wrong account, link expired, link already
 * used, invite required - and a refusal is the hardest copy in a product to get
 * right and the easiest to write twice in two slightly different tones. Six of
 * the seven below say no. Keeping them in one list is what lets them say it the
 * same way, and say what to do next.
 *
 * `/login` is not here: its copy already lives in `src/locales/en/auth.ts`.
 *
 * The workspace NAME stays in this copy, unlike on `/me`, and for the reason
 * `/me` gives for its own exception - here the reader is deciding BETWEEN
 * organisations, or being told which one is asking for them. There it is the
 * information, not decoration.
 */

export const access = {
  /** The brand mark above the card on both screens. */
  logoAlt: 'CheckMark',

  join: {
    /** The live invitation: this is the only screen here that says yes. */
    invitedTitle: 'You’ve been invited',
    /**
     * States the transaction in the product's own terms rather than "accept to
     * continue": the workspace gets to QUERY presence events, it does not get
     * given them, and leaving is a thing the member does, not a request.
     */
    invitedBody: (workspaceName: string) =>
      `${workspaceName} wants to include your check-ins in their workspace. They will be able to see the ones their rules match - they never own your record, and you can leave the workspace at any time.`,
    accept: 'Accept',
    accepting: 'Accepting…',
    decline: 'Decline',
    declining: 'Declining…',

    notFoundTitle: 'Workspace not found',
    notFoundBody:
      'This workspace link is not valid, or the workspace no longer exists.',

    inviteRequiredTitle: 'Invite required',
    inviteRequiredBody: (workspaceName: string) =>
      `A ${workspaceName} admin has to invite you before you can join. Ask them to send an invitation to this email address.`,

    backToApp: 'Back to your timeline',
    genericError: 'Something went wrong. Please try again.',
  },

  consent: {
    invalidTitle: 'Invalid or expired link',
    invalidBody:
      'This consent link is no longer valid. Ask your workspace admin to send the invitation again.',

    declinedTitle: 'Invitation declined',

    usedTitle: 'Link already used',
    usedBody: 'This invitation has already been accepted or declined.',

    expiredTitle: 'Link expired',
    expiredBody:
      'This invitation has expired. Ask your workspace admin to send it again.',

    /**
     * Names the invited address rather than the signed-in one. The person is
     * looking at the screen from the wrong account and it is the address they
     * need to switch TO that they have to be told.
     */
    wrongAccountTitle: 'Wrong account',
    wrongAccountBody: (invitedEmail: string) =>
      `This invitation was sent to ${invitedEmail}. Sign in with that address to accept it.`,
    wrongAccountCta: 'Sign in with that account',

    missingActionTitle: 'Nothing to do here',
    missingActionBody:
      'The link you followed is missing the part that says whether you are accepting or declining. Open the invitation from your email again.',

    signIn: 'Go to sign in',
    dashboard: 'Go to your timeline',
  },
} as const

export type AccessCopy = typeof access
