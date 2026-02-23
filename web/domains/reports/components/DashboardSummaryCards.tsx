import { Card } from "../../../components/design-system/Card";

type DashboardSummaryCardsProps = {
  cards: Array<{ label: string; value: string; hint?: string }>;
};

export const DashboardSummaryCards = ({ cards }: DashboardSummaryCardsProps) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {cards.map((card) => (
      <Card key={card.label} className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
        <p className="mt-2 text-2xl font-semibold text-card-foreground">{card.value}</p>
        {card.hint ? <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p> : null}
      </Card>
    ))}
  </div>
);
