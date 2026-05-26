import { redirect } from 'next/navigation'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function LeavesLayout({ children, params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace || !workspace.leaves_enabled) {
    redirect(`/ws/${slug}`)
  }
  return <>{children}</>
}
