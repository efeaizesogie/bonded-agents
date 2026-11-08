import type { Metadata } from "next";
import { PublicKey } from "@solana/web3.js";
import { AgentProfile } from "@/components/app/AgentProfile";
import { fetchAgent, isAddress, readonlyProgram } from "@/lib/chain";
import { sol, trustScore } from "@/lib/program";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  if (!isAddress(address)) return { title: "Agent not found" };
  try {
    const a = await fetchAgent(readonlyProgram(), new PublicKey(address));
    if (!a) return { title: "Agent not found" };
    return {
      title: `${a.name}, a bonded AI agent`,
      description: `Trust ${trustScore(a)}. ${sol(a.bond).toFixed(2)} SOL bonded, ${a.jobsCompleted} jobs done, ${a.jobsSlashed} slashed.`,
    };
  } catch {
    return { title: "Marketplace" };
  }
}

export default async function Page({ params }: Props) {
  const { address } = await params;
  return <AgentProfile address={address} />;
}
