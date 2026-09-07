'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'
import { Button, Card, Chip, Field, Input, WorkspaceAvatar } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-settings'

const t = wsAdmin.picker

interface Workspace {
  id: string
  slug: string
  name: string
  plan: string
  archived_at: string | null
  /** null when the workspace has no logo; also the image cache-buster. */
  logo_updated_at?: string | null
}

interface Props {
  workspaces: Workspace[]
  archivedWorkspaces: Workspace[]
  /** /ws/new opens straight into the create form rather than the picker. */
  startCreating?: boolean
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
}

type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

function CreateWorkspaceForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugState, setSlugState] = useState<SlugState>('idle')
  const [slugTimer, setSlugTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSlugChange(value: string) {
    setSlug(value)
    if (slugTimer) clearTimeout(slugTimer)
    if (!value) { setSlugState('idle'); return }
    if (!/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/.test(value) && value.length > 1) {
      setSlugState('invalid')
      return
    }
    setSlugState('checking')
    // Debounced so typing does not fire a request per keystroke.
    setSlugTimer(setTimeout(async () => {
      const res = await fetch('/api/workspace/check-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: value }),
      })
      const data = await res.json()
      setSlugState(data.available ? 'available' : 'taken')
    }, 400))
  }

  async function submit() {
    if (!orgName.trim() || !slug || slugState !== 'available') return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), slug }),
      })
      const data = await res.json()
      if (res.ok) onCreated(data.workspace.slug)
      else setError(data.error || t.createFailed)
    } finally {
      setLoading(false)
    }
  }

  const slugMessage =
    slugState === 'available' ? t.slugAvailable
    : slugState === 'taken' ? t.slugTaken
    : slugState === 'invalid' ? t.slugInvalid
    : slugState === 'checking' ? t.slugChecking
    : null

  const slugIsError = slugState === 'taken' || slugState === 'invalid'
  const disabled = loading || slugState !== 'available' || !orgName.trim()

  return (
    <div className="stack">
      <Field label={t.fieldOrgName} htmlFor={t.fieldOrgNameId}>
        <Input
          id={t.fieldOrgNameId}
          autoFocus
          value={orgName}
          placeholder={t.fieldOrgNamePlaceholder}
          onChange={(e) => {
            setOrgName(e.target.value)
            handleSlugChange(slugify(e.target.value))
          }}
        />
      </Field>

      <Field
        label={t.fieldSlug}
        htmlFor={t.fieldSlugId}
        error={slugIsError ? slugMessage : undefined}
        hint={!slugIsError && slugMessage ? slugMessage : undefined}
      >
        <Input
          id={t.fieldSlugId}
          value={slug}
          invalid={slugIsError}
          placeholder={t.fieldSlugPlaceholder}
          onChange={(e) => handleSlugChange(e.target.value)}
        />
      </Field>

      {slug && slugState === 'available' && (
        <p className="mono t-muted">{t.slugPreview(slug)}</p>
      )}

      {error && <p style={{ fontSize: '13px', color: 'var(--danger)' }}>{error}</p>}

      <Button block loading={loading} disabled={disabled} onClick={submit}>
        {loading ? t.creatingBtn : t.createBtn}
      </Button>
    </div>
  )
}

function WorkspaceRow({ workspace, archived }: { workspace: Workspace; archived?: boolean }) {
  return (
    <Link
      href={`/ws/${workspace.slug}`}
      className="rowlink hoverlift"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        textDecoration: 'none',
        color: 'inherit',
        opacity: archived ? 0.72 : 1,
      }}
    >
      <WorkspaceAvatar
        id={workspace.id}
        slug={workspace.slug}
        name={workspace.name}
        logoUpdatedAt={workspace.logo_updated_at}
        size="lg"
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{workspace.name}</span>
          {archived
            ? <Chip tone="roadmap">{t.archivedBadge}</Chip>
            : <Chip tone="leave" style={{ textTransform: 'capitalize' }}>{workspace.plan}</Chip>}
        </span>
        <span className="mono t-muted" style={{ display: 'block', marginTop: '2px' }}>
          {t.slugPreview(workspace.slug)}
        </span>
      </span>
      <ChevronRight size={16} className="t-muted" aria-hidden />
    </Link>
  )
}

export default function WsClient({ workspaces, archivedWorkspaces, startCreating = false }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(startCreating)

  const hasAny = workspaces.length > 0 || archivedWorkspaces.length > 0

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        {showForm ? (
          <Card className="fx-spring">
            <h1 className="t-h1">{t.createTitle}</h1>
            <p className="t-secondary" style={{ margin: '6px 0 20px' }}>{t.createSubtitle}</p>

            <CreateWorkspaceForm onCreated={(slug) => router.push(`/ws/${slug}`)} />

            <Button variant="ghost" size="sm" style={{ marginTop: '12px' }} onClick={() => setShowForm(false)}>
              {t.cancelBtn}
            </Button>
          </Card>
        ) : (
          <>
            <div className="fx-snap" style={{ marginBottom: '24px' }}>
              <h1 className="t-h1">{hasAny ? t.titleWithWorkspaces : t.titleEmpty}</h1>
              <p className="t-secondary" style={{ marginTop: '6px' }}>
                {hasAny ? t.subtitleWithWorkspaces : t.subtitleEmpty}
              </p>
            </div>

            {workspaces.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <p className="t-eyebrow" style={{ marginBottom: '8px' }}>{t.sectionActive}</p>
                <div className="stack-sm">
                  {workspaces.map((ws) => <WorkspaceRow key={ws.id} workspace={ws} />)}
                </div>
              </div>
            )}

            {archivedWorkspaces.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <p className="t-eyebrow" style={{ marginBottom: '8px' }}>{t.sectionArchived}</p>
                <div className="stack-sm">
                  {archivedWorkspaces.map((ws) => <WorkspaceRow key={ws.id} workspace={ws} archived />)}
                </div>
              </div>
            )}

            <Button
              block
              variant={hasAny ? 'secondary' : 'primary'}
              icon={<Plus size={15} />}
              onClick={() => setShowForm(true)}
            >
              {t.newBtn}
            </Button>
          </>
        )}

        <Link
          href="/me"
          className="t-muted"
          style={{ display: 'inline-block', marginTop: '20px', textDecoration: 'none' }}
        >
          ← {t.backToMe}
        </Link>
      </div>
    </div>
  )
}
