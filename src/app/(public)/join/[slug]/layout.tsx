import type { Metadata } from "next";

/**
 * `noindex`, like `/login` and `/consent/[token]` beside it.
 *
 * `/join/:slug` is reachable only with a session and does nothing for a stranger
 * but redirect them to sign in, so there is nothing here for a crawler to index
 * - and a slug in a search result is a workspace name leaking out of a private
 * invitation. `robots.ts` already disallows `/login` and `/consent/`; this was
 * the third of the set and had neither the rule nor the tag.
 */
export const metadata: Metadata = {
  title: "Join workspace",
  robots: {
    index: false,
    follow: false,
  },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
