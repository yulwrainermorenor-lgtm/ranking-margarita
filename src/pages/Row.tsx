export function Row({
  name,
  sets,
  winner,
}: {
  name: string;
  sets: number;
  winner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={
          winner ? "font-semibold truncate" : "truncate text-muted-foreground"
        }
      >
        {name}
      </span>
      <span className="tabular-nums text-sm">{sets}</span>
    </div>
  );
}
