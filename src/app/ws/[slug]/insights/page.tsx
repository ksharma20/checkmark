import { notFound } from 'next/navigation'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import InsightsClient from '../InsightsClient'

interface Props { params: Promise<{ slug: string }> }

export default async function InsightsPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()
  return <InsightsClient slug={slug} workspaceCreatedAt={workspace.created_at.slice(0, 10)} />
}
