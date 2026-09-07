'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui'
import EmployeeFormHost from '@/components/ws/employee/EmployeeFormHost'
import { wsEmployees, wsPeopleUi } from '@/locales/en/ws-people'

interface Props {
  slug: string
}

/**
 * Add an employee: three fields, then straight to their record.
 *
 * There is no wizard and no invite modal here any more. Both existed because
 * this screen used to be the only place a person could be described, so it had
 * to ask everything before letting go. It no longer is - the person screen
 * edits the record a tab at a time, and offers the invitation - so this page's
 * whole job is to open the record and hand over.
 *
 * The create writes a `workspace_members` row alongside the `employees` row and
 * returns its id. That is what makes the navigation possible at all: the person
 * screen is keyed on `workspace_members.id`, so an employee record with no
 * membership has no URL and vanishes from the directory.
 */
export default function NewEmployeeClient({ slug }: Props) {
  const router = useRouter()

  return (
    <div>
      <Link href={`/ws/${slug}/people`} className="btn btn-ghost btn-sm pressable link-plain btn-flush">
        <ArrowLeft size={14} aria-hidden />
        {wsPeopleUi.detailsBack}
      </Link>

      <h1 className="t-h1 mt-10">{wsEmployees.createTitle}</h1>
      <p className="t-secondary page-subtitle">{wsEmployees.createSubtitle}</p>

      <Card className="form-narrow">
        <EmployeeFormHost
          slug={slug}
          member={null}
          onCancel={() => router.push(`/ws/${slug}/people`)}
          onSaved={(_employee, memberId) => {
            // Land on the person, not back on the list: the record is three
            // fields old and the next thing anyone wants is the rest of it.
            // Falling back to the directory rather than guessing a URL - a
            // create that somehow returned no membership id must not become a
            // 404 on top of a successful save.
            router.push(
              memberId
                ? `/ws/${slug}/people/${memberId}/details`
                : `/ws/${slug}/people`,
            )
            router.refresh()
          }}
        />
      </Card>
    </div>
  )
}
