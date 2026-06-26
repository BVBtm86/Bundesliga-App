import { goalDifference, StandingTeam } from "@/lib/standings";
import { FormBadge } from "./FormBadge";
import { TeamLogo } from "./TeamLogo";

type StandingsTableProps = {
  teams: StandingTeam[];
};

const zoneClasses: Record<StandingTeam["zone"], string> = {
  champion: "bg-amber-400",
  champions_league: "bg-emerald-500",
  europe: "bg-blue-500",
  playoff: "bg-amber-400",
  relegation: "bg-red-500",
  midtable: "bg-slate-300",
};

export function StandingsTable({ teams }: StandingsTableProps) {
  return (
    <div className="table-scroll overflow-x-auto">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
            <th className="w-16 px-3 py-2 text-center">#</th>
            <th className="w-[280px] px-3 py-2 text-left">Team</th>
            <th className="px-3 py-2">P</th>
            <th className="px-3 py-2">W</th>
            <th className="px-3 py-2">D</th>
            <th className="px-3 py-2">L</th>
            <th className="px-3 py-2">G</th>
            <th className="px-3 py-2">GD</th>
            <th className="px-3 py-2">Pts</th>
            <th className="w-40 px-3 py-2 text-center">Form</th>
          </tr>
        </thead>

        <tbody>
          {teams.map((team) => (
            <tr key={team.team_id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50/80">
              <td className="px-3 py-2">
                <span className="flex items-center justify-center gap-2 text-sm font-semibold">
                  <i className={`h-5 w-1 rounded-full ${zoneClasses[team.zone]}`} />
                  {team.rank}
                </span>
              </td>

              <td className="px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamLogo src={team.team_logo} name={team.display_name || team.team_name} />
                  <strong className="truncate text-sm font-semibold text-slate-950">
                    {team.display_name || team.team_name}
                  </strong>
                </div>
              </td>

              <td className="px-3 py-2 text-center text-sm font-semibold">{team.played}</td>
              <td className="px-3 py-2 text-center text-sm font-semibold">{team.wins}</td>
              <td className="px-3 py-2 text-center text-sm font-semibold">{team.draws}</td>
              <td className="px-3 py-2 text-center text-sm font-semibold">{team.losses}</td>
              <td className="px-3 py-2 text-center text-sm font-semibold">
                {team.goals_for}:{team.goals_against}
              </td>
              <td
                className={`px-3 py-2 text-center text-sm font-semibold ${
                  team.goal_difference > 0
                    ? "text-emerald-600"
                    : team.goal_difference < 0
                    ? "text-red-600"
                    : "text-slate-500"
                }`}
              >
                {goalDifference(team.goal_difference)}
              </td>
              <td className="px-3 py-2 text-center text-sm font-bold text-slate-950">
                {team.points}
              </td>

              <td className="px-3 py-2">
                <div className="flex justify-center gap-1">
                  {(team.form || []).slice(0, 5).map((result, index) => (
                    <FormBadge key={`${team.team_id}-${index}`} result={result} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}