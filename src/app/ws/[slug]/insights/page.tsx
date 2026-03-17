import InsightsClient from '../InsightsClient'

interface Props { params: Promise<{ slug: string }> }

export default async function InsightsPage({ params }: Props) {
  const { slug } = await params
  return <InsightsClient slug={slug} />
}
