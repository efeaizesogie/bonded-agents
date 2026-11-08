import type { Metadata } from "next";
import { PublicKey } from "@solana/web3.js";
import { JobView } from "@/components/app/JobView";
import { fetchJob, isAddress, parseSpec, readonlyProgram } from "@/lib/chain";
import { sol } from "@/lib/program";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const image = `/api/og/job/${address}`;
  if (!isAddress(address)) return { title: "Job not found" };
  try {
    const j = await fetchJob(readonlyProgram(), new PublicKey(address));
    if (!j) return { title: "Job not found" };
    const title =
      j.status === "Slashed"
        ? `Proof of slash: an agent lost ${sol(j.slashedAmount)} SOL`
        : `${j.status} job`;
    const description = j.verdict || parseSpec(j.spec).text;
    return {
      title,
      description,
      openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
      twitter: { card: "summary_large_image", title, description, images: [image] },
    };
  } catch {
    return { title: "Marketplace" };
  }
}

export default async function Page({ params }: Props) {
  const { address } = await params;
  return <JobView address={address} />;
}
