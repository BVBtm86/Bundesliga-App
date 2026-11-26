import test from "node:test";
import assert from "node:assert/strict";
import {spatialStageRows} from "./spatial-stage";
const row=(id:number,season:string,date:string,goals:unknown=0)=>({game_id:id,season,game_date:date,home_goals:goals,away_goals:0});
test("same stage uses equal completed games in actual completion order",()=>{
 const rows=[row(3,"2026-2027","2026-10-01"),row(1,"2026-2027","2026-08-01"),row(2,"2026-2027","2026-09-01"),row(4,"2025-2026","2025-08-01"),row(5,"2025-2026","2025-09-01")];
 assert.deepEqual(spatialStageRows(rows,"2026-2027","2025-2026").map(row=>row.game_id),[1,2]);
 assert.deepEqual(spatialStageRows(rows,"2025-2026","2026-2027").map(row=>row.game_id),[4,5]);
});
test("same stage excludes missing scores while retaining zero goals",()=>{assert.equal(spatialStageRows([row(1,"2026-2027","2026-08-01"),row(2,"2025-2026","2025-08-01",null)],"2026-2027","2025-2026").length,0);});
test("same stage supports comparing a season with itself",()=>{assert.equal(spatialStageRows([row(1,"2026-2027","2026-08-01")],"2026-2027","2026-2027").length,1);});
