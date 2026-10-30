export type TeamAnalysisCategory = "attacking" | "defending" | "passing" | "possession" | "discipline" | "goalkeeping";
export type TeamAnalysisMetricKey =
  | "goals" | "ownGoals" | "shots" | "onTarget" | "shotsOffTarget" | "blockedShots" | "woodwork" | "corners" | "shotAccuracy" | "goalConversion"
  | "insideBoxShots" | "outsideBoxShots" | "openPlayShots" | "fastbreakShots" | "setPieceShots" | "penaltyShots" | "dribbles" | "successfulDribbles"
  | "interceptions" | "tackles" | "successfulTackles" | "tackleSuccess" | "recoveries" | "clearances" | "blocks" | "blockedShot" | "errors" | "aerialDuels" | "aerialDuelsWon"
  | "passes" | "successfulPasses" | "passAccuracy" | "keyPasses" | "assists" | "throughBalls" | "crosses" | "crossCompletion" | "longPasses" | "longPassAccuracy" | "finalThirdPasses" | "finalThirdCompletion" | "forwardPasses" | "backwardPasses"
  | "possession" | "touches" | "lossOfPossession" | "dispossessed" | "turnovers"
  | "yellowCards" | "secondYellowCards" | "redCards" | "fouls" | "foulsSuffered" | "offsides"
  | "saves" | "savePercentage" | "goalkeeperActions" | "claims" | "punches" | "keeperPickup" | "keeperSweeper";
export type TeamAnalysisMetric = { key: TeamAnalysisMetricKey; labelKey: string; unit: "number" | "percent"; additive?: boolean };
const n=(key:TeamAnalysisMetricKey,labelKey:string):TeamAnalysisMetric=>({key,labelKey,unit:"number",additive:true});
const p=(key:TeamAnalysisMetricKey,labelKey:string):TeamAnalysisMetric=>({key,labelKey,unit:"percent"});
export const TEAM_ANALYSIS_METRICS: Record<TeamAnalysisCategory, TeamAnalysisMetric[]> = {
  attacking:[
    n("goals","stats.metric.goals"), n("ownGoals","stats.metric.own_goals"), n("shots","stats.metric.shots"), n("onTarget","stats.metric.shot_on_target"), n("shotsOffTarget","stats.metric.shot_off_target"), n("blockedShots","stats.metric.shot_blocked"), n("woodwork","stats.metric.shot_woodwork"), p("shotAccuracy","stats.metric.shot_accuracy"), p("goalConversion","stats.metric.goal_conversion_pct"),
    n("insideBoxShots","stats.metric.shot_zone_inside_box"), n("outsideBoxShots","stats.metric.shot_zone_outside_box"), n("openPlayShots","stats.metric.shot_open_play"), n("fastbreakShots","stats.metric.shot_fastbreak"), n("setPieceShots","stats.metric.shot_set_piece"), n("penaltyShots","stats.metric.shot_penalty"), n("corners","stats.metric.pass_corner"), n("offsides","stats.metric.offsides"), n("dribbles","stats.metric.dribbles"), n("successfulDribbles","stats.metric.dribble_successful")
  ],
  defending:[
    n("tackles","stats.metric.tackles_attempted"), n("successfulTackles","stats.metric.tackle_gained_possession"), p("tackleSuccess","stats.metric.tackle_success_pct"), n("interceptions","stats.metric.interceptions"), n("recoveries","stats.metric.ball_recoveries"), n("clearances","stats.metric.clearances"), n("blocks","stats.metric.blocks"), n("blockedShot","stats.metric.blocked_shot"), n("aerialDuels","stats.metric.aerial_duels"), n("aerialDuelsWon","stats.metric.aerial_duel_won"), n("errors","stats.metric.errors")
  ],
  passing:[
    n("passes","stats.metric.pass_attempt"), n("successfulPasses","stats.metric.pass_completed"), p("passAccuracy","stats.metric.pass_completion_pct"), n("keyPasses","stats.metric.pass_key_pass"), n("assists","stats.metric.pass_assist"), n("throughBalls","stats.metric.pass_through_ball"), n("longPasses","stats.metric.pass_long"), p("longPassAccuracy","stats.metric.pass_long_completion_pct"), n("crosses","stats.metric.pass_cross"), p("crossCompletion","stats.metric.pass_cross_completion_pct"), n("forwardPasses","stats.metric.pass_forward"), n("backwardPasses","stats.metric.pass_backward"), n("finalThirdPasses","stats.metric.pass_final_third"), p("finalThirdCompletion","stats.metric.pass_final_third_completion_pct")
  ],
  possession:[n("possession","stats.metric.possession"),n("touches","stats.metric.touches"),n("lossOfPossession","stats.metric.loss_of_possession"),n("dispossessed","stats.metric.dispossessed"),n("turnovers","stats.metric.turnover"),n("recoveries","stats.metric.ball_recoveries")],
  discipline:[n("fouls","stats.metric.foul_committed"),n("foulsSuffered","stats.metric.foul_suffered"),n("yellowCards","stats.metric.yellow_card"),n("secondYellowCards","stats.metric.second_yellow_card"),n("redCards","stats.metric.red_card"),n("offsides","stats.metric.offsides")],
  goalkeeping:[n("goalkeeperActions","stats.metric.goalkeeper_actions"),n("saves","stats.metric.saves"),p("savePercentage","stats.metric.save_percentage"),n("claims","stats.metric.claims"),n("punches","stats.metric.punches"),n("keeperPickup","stats.metric.keeper_pickup"),n("keeperSweeper","stats.metric.keeper_sweeper")]
};
export const ALL_TEAM_ANALYSIS_CATEGORIES: TeamAnalysisCategory[]=["attacking","defending","passing","possession","discipline","goalkeeping"];
export const TEAM_ANALYSIS_SCATTER_DEFAULTS:Record<TeamAnalysisCategory,[string,string]>={attacking:["shots:for","goals:for"],defending:["shots:against","goals:against"],passing:["passes:for","passAccuracy:for"],possession:["possession:for","shots:for"],discipline:["fouls:for","yellowCards:for"],goalkeeping:["onTarget:against","savePercentage:for"]};