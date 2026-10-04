import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { ScanDetailClient } from "./measurement-client";

export const dynamic = "force-dynamic";

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const scanResult = await db
    .from("scans")
    .select("*, worker:profiles(full_name, email), measurements(processing_metadata), scan_images(public_url, storage_path, angle)")
    .eq("id", scanId)
    .single();

  if (scanResult.error || !scanResult.data) notFound();

  const scan = scanResult.data;
  let image = scan.scan_images?.[0] || null;

  if (image && !image.public_url && image.storage_path) {
    const { data: publicUrlData } = supabase.storage.from("scan-images").getPublicUrl(image.storage_path);
    image = { ...image, public_url: publicUrlData.publicUrl };
  }

  return (
    <ScanDetailClient
      scan={scan}
      image={image}
    />
  );
}
