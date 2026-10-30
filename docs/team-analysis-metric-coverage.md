# Team Analysis metric coverage

Team Analysis Performance now consumes `TEAM_ANALYSIS_METRICS`, the shared catalog used to drive the statistical cards, Performance Trend, and League Comparison selectors. The catalog follows the Match Report Team Stats order and uses the dashboard's period fields.

| Category | Covered Match Report metrics |
| --- | --- |
| Attacking | Goals, own goals, shots, shots on target, shots off target, blocked shots, woodwork, shot accuracy, goal conversion, inside/outside box shots, open-play, fast-break, set-piece and penalty shots, corners, offsides, dribbles, successful dribbles |
| Defending | Tackles, successful tackles, tackle success, interceptions, recoveries, clearances, blocks, blocked shots, aerial duels, aerial duels won, errors |
| Passing | Pass attempts, completed passes, pass completion, key passes, assists, through balls, long passes and accuracy, crosses and completion, forward/backward passes, final-third passes and completion |
| Possession | Possession, touches, losses of possession, dispossessed, turnovers, recoveries |
| Discipline | Fouls committed, fouls suffered, yellow cards, second yellow cards, red cards, offsides |
| Goalkeeping | Goalkeeper actions, saves, save percentage, claims, punches, keeper pickups, sweeper actions |

Count metrics are averaged over the qualifying completed matches. Rate metrics are calculated from aggregated numerators and denominators (including pass, shot, tackle, cross, long-pass, final-third and save percentages). For/Against always select the corresponding team or its opponent from each match; no league-total subtraction is used.

Some historical seasons do not contain every raw event field. Those observations remain unavailable and are excluded from the relevant average, rank, chart point, or trend observation rather than being converted to zero. A metric is shown whenever at least one eligible observation exists.
