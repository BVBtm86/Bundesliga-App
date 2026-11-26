import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewStageMatches} from './season-overview-stage';
import {completed} from './analytics';
import type {Match} from './types';
const match=(id:number,week:number,date:string,homeId=44,awayId=37):Match=>({id,season:'2026-2027',week,date,homeId,awayId,home:'Home',away:'Away',homeGoals:1,awayGoals:0,finished:true,venue:'',attendance:null});
test('same stage uses games played in chronological order, including postponed fixtures',()=>{
 const matches=[match(1,1,'2026-08-01'),match(2,2,'2026-10-01'),match(3,3,'2026-08-15'),match(4,4,'2026-08-22',5,6)];
 assert.deepEqual(completed(overviewStageMatches(matches,44,2)).map(m=>m.id),[1,3]);
 assert.equal(matches.every(m=>m.finished),true);
});
test('missing stage and zero games produce no invented records',()=>{
 const matches=[match(1,1,'2026-08-01')];
 assert.equal(completed(overviewStageMatches(matches,44,2)).length,0);
 assert.equal(completed(overviewStageMatches(matches,44,0)).length,0);
});
test('same-stage league snapshot includes other clubs only through the cutoff',()=>{
 const matches=[match(1,1,'2026-08-01'),match(2,2,'2026-08-15'),match(3,1,'2026-08-08',5,6),match(4,3,'2026-08-22',5,6)];
 assert.deepEqual(completed(overviewStageMatches(matches,44,2)).map(m=>m.id),[1,2,3]);
});
test('Mongo Date strings are ordered by timestamp rather than weekday text',()=>{
 const matches=[match(1,1,new Date('2026-08-01T12:00:00Z').toString()),match(2,2,new Date('2026-08-08T12:00:00Z').toString()),match(3,3,new Date('2026-08-14T12:00:00Z').toString())];
 assert.deepEqual(completed(overviewStageMatches(matches,44,2)).map(m=>m.id),[1,2]);
});
