import { StandingTeam } from "@/lib/standings";
import { TeamLogo } from "./TeamLogo";

type AdvancedTableProps = {
  teams: StandingTeam[];
};

export function AdvancedTable({ teams }: AdvancedTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
      <div className="table-scroll overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed border-collapse">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-500">
              <th className="w-16 px-3 py-2 text-center">#</th>
              <th className="w-[280px] px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2">Pts</th>
              <th className="px-3 py-2">xPts</th>
              <th className="px-3 py-2">Diff</th>
              <th className="px-3 py-2">xG</th>
              <th className="px-3 py-2">xGA</th>
              <th className="px-3 py-2">xGD</th>
            </tr>
          </thead>

          <tbody>
            {teams.map((team) => (
              <tr
                key={team.team_id}
                className="border-t border-slate-200 odd:bg-white even:bg-slate-50/80"
              >
                <td className="px-3 py-2 text-center text-sm font-semibold">
                  {team.rank}
                </td>

                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamLogo
                      src={team.team_logo}
                      name={team.display_name || team.team_name}
                    />
                    <strong className="truncate text-sm font-semibold text-slate-950">
                      {team.display_name || team.team_name}
                    </strong>
                  </div>
                </td>

                <td className="px-3 py-2 text-center text-sm font-bold text-slate-950">
                  {team.points}
                </td>

                <td className="px-3 py-2 text-center text-sm text-slate-500">
                  --
                </td>

                <td className="px-3 py-2 text-center text-sm text-slate-500">
                  --
                </td>

                <td className="px-3 py-2 text-center text-sm text-slate-500">
                  --
                </td>

                <td className="px-3 py-2 text-center text-sm text-slate-500">
                  --
                </td>

                <td className="px-3 py-2 text-center text-sm text-slate-500">
                  --
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}