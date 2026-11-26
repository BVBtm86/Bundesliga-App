import test from "node:test";
import assert from "node:assert/strict";
import { historicalBenchmark, historicalTrend, pairedStatistics, performanceDirection } from "./historical-research";
const near=(actual:number|null,expected:number)=>assert.ok(actual!==null&&Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);

test("historical averages exclude evaluated/future seasons and missing values, preserving valid zero",()=>{
 const result=historicalBenchmark([{season:"2022-2023",value:0},{season:"2023-2024",value:null},{season:"2024-2025",value:2},{season:"2025-2026",value:NaN},{season:"2026-2027",value:100},{season:"2027-2028",value:200}],"2026-2027");
 assert.deepEqual(result,{value:1,count:2});
 assert.deepEqual(historicalBenchmark([{season:"2026-2027",value:2}],"2026-2027"),{value:null,count:0});
});
test("OLS trends use actual season spacing rather than observation indexes",()=>{
 const trend=historicalTrend([{season:"2010-2011",value:2},{season:"2012-2013",value:6},{season:"2014-2015",value:10}],"rate");
 near(trend.slope,2);assert.equal(trend.direction,"Increasing");
});
test("trend uses the latest five eligible observations in chronological order",()=>{
 const trend=historicalTrend([2019,2010,2026,2015,2011,2023].map(year=>({season:`${year}-${year+1}`,value:year-2000})),"rate");
 assert.deepEqual(trend.points.map(point=>point.season.slice(0,4)),["2011","2015","2019","2023","2026"]);
 near(trend.slope,1);
});
test("trend thresholds are metric-specific and insufficient samples are explicit",()=>{
 const rows=[{season:"2023-2024",value:50},{season:"2024-2025",value:50.1},{season:"2025-2026",value:50.2}];
 assert.equal(historicalTrend(rows,"percent").direction,"Stable");
 assert.equal(historicalTrend(rows,"rank").threshold,.1);
 assert.equal(historicalTrend(rows.slice(0,2),"percent").direction,"Insufficient");
});
test("regression, Pearson and Spearman use valid paired observations only",()=>{
 const result=pairedStatistics([{x:1,y:3},{x:2,y:5},{x:3,y:7},{x:null,y:100},{x:NaN,y:2},{x:4,y:undefined},{x:Infinity,y:1}]);
 assert.equal(result.count,3);near(result.slope,2);near(result.intercept,1);near(result.pearson,1);near(result.spearman,1);
});
test("Spearman uses average ranks for ties",()=>{
 near(pairedStatistics([{x:1,y:1},{x:1,y:2},{x:2,y:3}]).spearman,Math.sqrt(3)/2);
});
test("constant or insufficient paired values do not create invalid coefficients",()=>{
 const fixedX=pairedStatistics([{x:1,y:3},{x:1,y:5}]);assert.equal(fixedX.slope,null);assert.equal(fixedX.pearson,null);assert.equal(fixedX.spearman,null);
 const fixedY=pairedStatistics([{x:1,y:3},{x:2,y:3}]);near(fixedY.slope,0);assert.equal(fixedY.pearson,null);
 assert.equal(pairedStatistics([{x:1,y:2}]).pearson,null);
 near(pairedStatistics([{x:1,y:5},{x:2,y:3},{x:3,y:1}]).pearson,-1);
});
test("frequency trends stay neutral while meaningful performance directions account for Against",()=>{
 for(const key of ["passes","possession","touches","saves","corners"] as const)assert.equal(performanceDirection(key,false),null);
 assert.equal(performanceDirection("goals",false),"higher");assert.equal(performanceDirection("goals",true),"lower");
 assert.equal(performanceDirection("conceded",false),"lower");assert.equal(performanceDirection("position",false),"lower");
});
