/** Signed-URL exporter for rendered reports.
 *
 * Uploads PDF/PPTX bytes to the private `reports` storage bucket using the
 * service-role client, then returns a short-lived signed download URL. Re-
 * exports of the same report overwrite the same object path so we don't
 * accumulate orphaned files.
 *
 * Path scheme: <workspace_id>/<report_id>/<format>/<slug>.<ext>
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const REPORT_BUCKET = "reports";

export interface SignedExport {
  signedUrl: string;
  path: string;
  expiresIn: number;
  filename: string;
  contentType: string;
  bytes: number;
}

export async function uploadAndSignReport(args: {
  workspaceId: string;
  reportId: string;
  format: "pdf" | "pptx";
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  expiresInSeconds?: number;
}): Promise<SignedExport> {
  const expiresIn = args.expiresInSeconds ?? 3600;
  const path = `${args.workspaceId}/${args.reportId}/${args.format}/${args.filename}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(REPORT_BUCKET)
    .upload(path, args.bytes, {
      contentType: args.contentType,
      upsert: true,
    });
  if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

  const { data, error: signErr } = await supabaseAdmin.storage
    .from(REPORT_BUCKET)
    .createSignedUrl(path, expiresIn, { download: args.filename });
  if (signErr || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${signErr?.message ?? "unknown"}`);
  }

  return {
    signedUrl: data.signedUrl,
    path,
    expiresIn,
    filename: args.filename,
    contentType: args.contentType,
    bytes: args.bytes.length,
  };
}
