import { LocalIncidentWorkspace } from "@/components/incidents/local-incident-workspace";

interface Props {
  params: Promise<{ localId: string }>;
}

export default async function LocalIncidentPage({ params }: Props) {
  const { localId } = await params;
  return <LocalIncidentWorkspace localId={localId} />;
}
