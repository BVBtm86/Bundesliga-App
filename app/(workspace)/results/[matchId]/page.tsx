import MatchReport from "@/components/match-report";

export default async function Page({params}:{params:Promise<{matchId:string}>}) {
  const {matchId}=await params;
  return <MatchReport matchId={matchId}/>;
}
