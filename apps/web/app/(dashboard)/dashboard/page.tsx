import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STAT_CARDS = [
  { label: "Open incidents", value: "0", hint: "this week" },
  { label: "Apparatus in service", value: "0", hint: "of 0 total" },
  { label: "PPE due for inspection", value: "0", hint: "in next 30 days" },
  { label: "Pending sync", value: "0", hint: "records queued" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Department overview. All readings update automatically when online.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
