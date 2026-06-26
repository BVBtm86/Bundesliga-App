"use client";

import { formPoints, goalDifference, StandingTeam } from "@/lib/standings";
import { FormBadge } from "./FormBadge";
import { TeamLogo } from "./TeamLogo";

type FormTableProps = {
  teams: StandingTeam[];
  windowSize: number;
};

export function FormTable({ teams, windowSize }: FormTableProps) {
  const rows = [...teams]
    .map((team) => {
      const formMatches = (team.form_matches || []).slice(0, windowSize);
      const form = formMatches.length
        ? formMatches.map((match) => match.result)
        : (team.form_history || team.form || []).slice(0, windowSize);

      const formGoalsFor = formMatches.reduce((sum, match) => sum + match.goals_for, 0);
      const formGoalsAgainst = formMatches.reduce((sum, match) => sum + match.goals_against, 0);

      return {
        ...team,
        recentForm: form,
        formGoalsFor,
        formGoalsAgainst,
        formGoalDifference: formGoalsFor - formGoalsAgainst,
        formPoints: formPoints(form),
      };
    })
    .sort(
      (a, b) =>
        b.formPoints - a.formPoints ||
        b.formGoalDifference - a.formGoalDifference ||
        b.formGoalsFor - a.formGoalsFor ||
        b.points - a.points,
    );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
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
              <th className="px-3 py-2">GF-GA</th>
              <th className="px-3 py-2">GD</th>
              <th className="px-3 py-2">Pts</th>
              <th className="w-44 px-3 py-2 text-center">Form</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((team, index) => (
              <tr key={team.team_id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50/80">
                <td className="px-3 py-2 text-center text-sm font-semibold">{index + 1}</td>

                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamLogo src={team.team_logo} name={team.display_name || team.team_name} />
                    <strong className="truncate text-sm font-semibold text-slate-950">
                      {team.display_name || team.team_name}
                    </strong>
                  </div>
                </td>

                <td className="px-3 py-2 text-center text-sm font-semibold">{team.recentForm.length}</td>
                <td className="px-3 py-2 text-center text-sm font-semibold">
                  {team.recentForm.filter((result) => result === "W").length}
                </td>
                <td className="px-3 py-2 text-center text-sm font-semibold">
                  {team.recentForm.filter((result) => result === "D").length}
                </td>
                <td className="px-3 py-2 text-center text-sm font-semibold">
                  {team.recentForm.filter((result) => result === "L").length}
                </td>
                <td className="px-3 py-2 text-center text-sm font-semibold">
                  {team.formGoalsFor}-{team.formGoalsAgainst}
                </td>
                <td className={`px-3 py-2 text-center text-sm font-semibold ${
                    team.formGoalDifference > 0
                      ? "text-emerald-600"
                      : team.formGoalDifference < 0
                      ? "text-red-600"
                      : "text-slate-500"
                  }`}
                >
                  {goalDifference(team.formGoalDifference)}
                </td>
                <td className="px-3 py-2 text-center text-sm font-bold text-slate-950">{team.formPoints}</td>

                <td className="px-3 py-2">
                  <div className="mx-auto grid w-[136px] grid-cols-5 gap-1">
                    {team.recentForm.map((result, resultIndex) => (
                      <FormBadge key={`${team.team_id}-${resultIndex}`} result={result} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
