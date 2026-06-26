type FormBadgeProps = {
  result: string;
};

const styles: Record<string, string> = {
  W: "bg-emerald-500 text-white",
  D: "bg-amber-500 text-white",
  L: "bg-red-600 text-white",
};

export function FormBadge({ result }: FormBadgeProps) {
  return (
    <span className={`grid size-6 place-items-center rounded text-xs font-bold ${styles[result] || "bg-slate-500"}`}>
      {result}
    </span>
  );
}
