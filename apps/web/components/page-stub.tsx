import { Card, CardContent } from "@/components/ui/card";

export function PageStub({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
