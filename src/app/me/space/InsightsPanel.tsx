import { Card, SplitBar, StatCard } from '@/components/ui'
import { meSpace } from '@/locales/en/me-space'
import { getSpaceInsights } from './insights'

/**
 * The Insights tab - the member's own presence numbers, rendered on the server.
 *
 * A Server Component with no client half at all: nothing here is interactive, so
 * shipping it to the browser would buy a round trip and a loading state and
 * change nothing on screen.
 *
 * The three tiles that are NOT the split hold facts that are true without a
 * workspace - days present, hours tracked, check-ins, streak - because
 * `presence_events` carries no `workspace_id`. The split is different in kind
 * and says so: office versus remote is `matched_by`, which is computed against
 * one workspace's signal configuration, so it is shown for the active workspace
 * and replaced by an explanation when there is none. Drawing a 0/0 bar there
 * would claim the member worked no days rather than that the question has no
 * answer yet.
 */

const t = meSpace.insights

function fmtHours(hours: number): string {
  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)}h`
}

export default async function InsightsPanel({ userId }: { userId: string }) {
  const insights = await getSpaceInsights(userId)

  if (!insights.hasEvents) {
    return (
      <Card>
        <div className="t-h2">{t.emptyTitle}</div>
        <p className="t-muted space-mt-6">{t.emptyHint}</p>
      </Card>
    )
  }

  const split = insights.split
  const splitTotal = split ? split.office + split.remote : 0

  return (
    <div className="stack">
      <p className="t-muted">{t.scopeHint}</p>

      <div className="t-eyebrow">{t.weekHeading}</div>
      <div className="space-stat-grid">
        <StatCard label={t.daysPresent} value={insights.week.daysPresent} />
        <StatCard
          label={t.hoursTracked}
          value={fmtHours(insights.week.hours)}
          hint={t.hoursHint}
        />
      </div>

      <div className="t-eyebrow">{t.monthHeading}</div>
      <div className="space-stat-grid">
        <StatCard label={t.daysPresent} value={insights.month.daysPresent} />
        <StatCard label={t.sessions} value={insights.month.checkins} />
      </div>

      <Card>
        <div className="t-eyebrow">{t.streak}</div>
        <div className="stat-num space-mt-6">{t.streakValue(insights.streakDays)}</div>
        <p className="t-muted space-mt-6">{t.streakHint}</p>
      </Card>

      <Card>
        <div className="t-eyebrow">{t.splitHeading}</div>
        {split === null ? (
          <p className="t-secondary space-mt-6">{t.splitNoWorkspace}</p>
        ) : (
          <>
            <div className="space-mt-10">
              <SplitBar
                segments={[
                  { value: split.office, color: 'var(--brand)', label: t.splitOffice },
                  { value: split.remote, color: 'var(--amber)', label: t.splitRemote },
                ]}
              />
            </div>
            <div className="row-between space-mt-10">
              <span className="t-secondary">
                {t.splitOffice} · {t.splitDays(split.office)}
              </span>
              <span className="t-secondary">
                {t.splitRemote} · {t.splitDays(split.remote)}
              </span>
            </div>
            {splitTotal === 0 ? null : <p className="t-muted space-mt-6">{t.splitHint}</p>}
          </>
        )}
      </Card>
    </div>
  )
}
