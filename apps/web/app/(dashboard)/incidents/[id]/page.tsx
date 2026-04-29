import { IncidentDetailWorkspace } from "@/components/incidents/incident-detail-workspace";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: Props) {
  const { id } = await params;
  return <IncidentDetailWorkspace serverId={id} />;
}
