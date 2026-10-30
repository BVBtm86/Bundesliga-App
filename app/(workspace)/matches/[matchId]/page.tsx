import { redirect } from "next/navigation";

export default async function Page({params}:{params:Promise<{matchId:string}>}) {
  const {matchId}=await params;
  redirect(`/results/${matchId}`);
}
