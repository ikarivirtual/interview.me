import ScoreCard from "./ScoreCard";

interface ScoreGridProps {
  scores: Record<string, number>;
}

export default function ScoreGrid({ scores }: ScoreGridProps) {
  // Put "overall" first as the hero card, then the rest
  const entries = Object.entries(scores);
  const overall = entries.find(([label]) => label === "overall");
  const rest = entries.filter(([label]) => label !== "overall");
  const sorted = overall ? [overall, ...rest] : entries;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {sorted.map(([label, score], index) => (
        <ScoreCard key={label} label={label} score={score} index={index} />
      ))}
    </div>
  );
}
