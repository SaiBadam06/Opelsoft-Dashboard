import { notFound } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { getApplication } from "@/lib/job-applications";
import { findCandidateForApplication } from "../actions";
import { ApplicationDetail } from "./application-detail";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const application = await getApplication(id);
  if (!application) notFound();

  const linked = await findCandidateForApplication(
    application.email,
    application.candidate_id,
  );

  return (
    <ApplicationDetail
      application={application}
      linkedCandidateId={linked?.id ?? null}
    />
  );
}
