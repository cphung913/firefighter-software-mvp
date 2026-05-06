import { NewIncidentWorkspace } from "@/components/incidents/new-incident-workspace";

interface Props {
  searchParams: { draft?: string };
}

export default function NewIncidentPage({ searchParams }: Props) {
  const draft = searchParams.draft;
  return <NewIncidentWorkspace draftId={draft} />;
}
