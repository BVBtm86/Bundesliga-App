import { spatialCategoryPriority } from "./spatial-density";
import { NEGATIVE_OUTCOME, POSITIVE_DRIBBLE, POSITIVE_PASS, TERRITORY_CATEGORIES } from "./spatial-distributions";
/** Database counterpart of the shared Event Explorer qualification rules. */
export function spatialDistributionPipeline(gameIds:number[],period:"ft"|"fh"|"sh"){
 const flag=(field:string)=>({$switch:{branches:[{case:{$in:[{$toLower:{$convert:{input:field,to:"string",onError:"",onNull:""}}},["true","1","successful","complete","completed"]]},then:true},{case:{$in:[{$toLower:{$convert:{input:field,to:"string",onError:"",onNull:""}}},["false","0","unsuccessful","incomplete","failed"]]},then:false}],default:null}});
 const regex=(pattern:string)=>({$regexMatch:{input:"$_outcome",regex:pattern,options:"i"}});
 const bucket=(coordinate:unknown)=>({$min:[2,{$max:[0,{$floor:{$multiply:[{$divide:[coordinate,100]},3]}}]}]});
 const pipeline:Record<string,unknown>[]=[
 {$match:{game_id:{$in:gameIds},period:{$in:period==="fh"?["FirstHalf"]:period==="sh"?["SecondHalf"]:["FirstHalf","SecondHalf"]}}},
 {$project:{game_id:1,team_id:1,period:1,_x:{$convert:{input:"$x",to:"double",onError:null,onNull:null}},_y:{$convert:{input:"$y",to:"double",onError:null,onNull:null}},_category:{$switch:{branches:spatialCategoryPriority.map(([raw,name])=>({case:{$in:[raw,{$cond:[{$isArray:"$categories"},"$categories",[]]}]},then:name})),default:"other"}},_flag:{$ifNull:[flag("$pass_completed"),flag("$pass_successful")]},_outcome:{$convert:{input:{$ifNull:["$aerial_result","$outcome_type"]},to:"string",onError:"",onNull:""}}}},
 {$set:{_valid:{$and:[{$isNumber:"$_x"},{$isNumber:"$_y"},{$gte:["$_x",0]},{$lte:["$_x",100]},{$gte:["$_y",0]},{$lte:["$_y",100]}]},_territory:{$in:["$_category",TERRITORY_CATEGORIES]},_attacking:{$or:[{$eq:["$_category","shots"]},{$and:[{$eq:["$_category","passing"]},{$or:[{$eq:["$_flag",true]},{$and:[{$eq:["$_flag",null]},regex(POSITIVE_PASS),{$not:[regex(NEGATIVE_OUTCOME)]}]}]}]},{$and:[{$eq:["$_category","dribbles"]},regex(POSITIVE_DRIBBLE),{$not:[regex(NEGATIVE_OUTCOME)]}]}]}}},
 {$set:{_thirdFor:bucket("$_x"),_thirdAgainst:bucket({$subtract:[100,"$_x"]}),_channelFor:bucket({$subtract:[100,"$_y"]}),_channelAgainst:bucket("$_y")}}
 ];
 const group:Record<string,unknown>={_id:{game:"$game_id",team:"$team_id"},events:{$sum:1},periods:{$addToSet:"$period"}};
 for(const [name,qualifier,zone] of [["territory","$_territory","$_thirdFor"],["againstTerritory","$_territory","$_thirdAgainst"],["channels","$_attacking","$_channelFor"],["againstChannels","$_attacking","$_channelAgainst"]])for(let index=0;index<3;index++)group[`${name}${index}`]={$sum:{$cond:[{$and:["$_valid",qualifier,{$eq:[zone,index]}]},1,0]}};
 pipeline.push({$group:group});return pipeline;
}
