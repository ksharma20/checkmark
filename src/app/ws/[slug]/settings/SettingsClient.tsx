'use client'

import { useState } from 'react'
import { TabBar } from '@/components/ui'
import type { Tab } from '@/components/ui'
import type { PlanLimits } from '@/lib/plans'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'
import { wsAnnouncements } from '@/locales/en/ws-announcements'
import OrgTab from './OrgTab'
import NotificationsTab from './NotificationsTab'
import LeaveTypesSection from './LeaveTypesSection'
import OpeningBalancesSection from './OpeningBalancesSection'
import SignalsTab from './SignalsTab'
import DomainsTab from './DomainsTab'
import BillingTab from './BillingTab'
import AnnouncementsSection from './AnnouncementsSection'

const s = wsAdmin.settings

type TabKey =
  | 'org'
  | 'leave'
  | 'balances'
  | 'notifications'
  | 'announcements'
  | 'signals'
  | 'domains'
  | 'billing'

interface Props {
  slug: string
  plan: string
  planLimits: PlanLimits
  leavesEnabled: boolean
  canWriteSettings: boolean
  canReadLeaves: boolean
  canWriteLeaves: boolean
  canReadSignals: boolean
  canWriteSignals: boolean
  canDeleteSignals: boolean
  canReadDomains: boolean
  canWriteDomains: boolean
  canDeleteDomains: boolean
  /**
   * `ownership` has no read action in the catalogue - it is write/delete only -
   * so write is what gates the Billing tab.
   */
  canManageOwnership: boolean
  /** `announcements:read` - workspace-wide comms, gated on its own resource. */
  canReadAnnouncements: boolean
  canWriteAnnouncements: boolean
  canDeleteAnnouncements: boolean
}

export default function SettingsClient(props: Props) {
  const tabs: Tab[] = [
    { key: 'org', label: s.tabOrg },
    ...(props.canReadLeaves && props.leavesEnabled
      ? [
          { key: 'leave', label: s.tabLeave },
          { key: 'balances', label: s.tabBalances },
        ]
      : []),
    // `settings:read` opened this page, so the tab is always present - it is
    // gated on the same resource as Org details, not on one of its own.
    { key: 'notifications', label: s.tabNotifications },
    ...(props.canReadAnnouncements
      ? [{ key: 'announcements', label: wsAnnouncements.title }]
      : []),
    ...(props.canReadSignals ? [{ key: 'signals', label: s.tabSignals }] : []),
    ...(props.canReadDomains ? [{ key: 'domains', label: s.tabDomains }] : []),
    ...(props.canManageOwnership ? [{ key: 'billing', label: s.tabBilling }] : []),
  ]

  const [tab, setTab] = useState<TabKey>('org')
  // A tab can disappear between renders (permissions are resolved server-side
  // and re-resolved on refresh), so never render a body whose tab is gone.
  const active = tabs.some((x) => x.key === tab) ? tab : 'org'

  return (
    <>
      <h1 className="t-h1 fx-snap">{en.wsSettings.pageTitle}</h1>
      <TabBar
        className="fx-snap"
        tabs={tabs}
        active={active}
        onChange={(key) => setTab(key as TabKey)}
        style={{ margin: '14px 0 16px' }}
      />

      {active === 'org' && <OrgTab slug={props.slug} canWrite={props.canWriteSettings} />}

      {active === 'leave' && (
        <LeaveTypesSection slug={props.slug} canWrite={props.canWriteLeaves} />
      )}

      {active === 'balances' && (
        <OpeningBalancesSection slug={props.slug} canWrite={props.canWriteLeaves} />
      )}

      {active === 'notifications' && (
        <NotificationsTab slug={props.slug} canWrite={props.canWriteSettings} />
      )}

      {active === 'announcements' && (
        <AnnouncementsSection
          slug={props.slug}
          canWrite={props.canWriteAnnouncements}
          canDelete={props.canDeleteAnnouncements}
        />
      )}

      {active === 'signals' && (
        <SignalsTab
          slug={props.slug}
          canWrite={props.canWriteSignals}
          canDelete={props.canDeleteSignals}
        />
      )}

      {active === 'domains' && (
        <DomainsTab
          slug={props.slug}
          canWrite={props.canWriteDomains}
          canDelete={props.canDeleteDomains}
        />
      )}

      {active === 'billing' && (
        <BillingTab slug={props.slug} plan={props.plan} planLimits={props.planLimits} />
      )}
    </>
  )
}
