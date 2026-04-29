export default function VoiceSessionPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Ride-back log</h1>
        <p className="text-muted-foreground">
          Session {params.id} — voice capture coming in Stage 4.
        </p>
      </div>
    </div>
  );
}
