import { ExternalLink } from "lucide-react";
import { WORK_MODE_LABEL, sourceLabel, type Job, type Source } from "@/lib/jobs";
import { formatUpdated } from "./search-shared";

export function TitleLink({ job }: { job: Job }) {
  if (!job.url.startsWith("https://")) {
    return <span className="text-ink">{job.title}</span>;
  }
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-start gap-1 text-ink underline decoration-line underline-offset-2"
    >
      <span>{job.title}</span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
    </a>
  );
}

export function JobCard({ job }: { job: Job }) {
  const when = formatUpdated(job.updated);
  return (
    <article className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">
        {sourceLabel(job.source)} · {job.company}
      </p>
      <TitleLink job={job} />
      <p className="text-sm text-muted">
        {WORK_MODE_LABEL[job.workMode]}
        {job.country ? ` · ${job.country}` : ""}
        {job.location ? ` · ${job.location}` : " · Location not listed"}
        {when ? ` · ${when}` : ""}
      </p>
    </article>
  );
}

export function JobRow({ job }: { job: Job }) {
  const when = formatUpdated(job.updated);
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-3 py-3 text-muted">{sourceLabel(job.source)}</td>
      <td className="px-3 py-3 text-ink">{job.company}</td>
      <td className="px-3 py-3">
        <TitleLink job={job} />
      </td>
      <td className="px-3 py-3 text-muted">{WORK_MODE_LABEL[job.workMode]}</td>
      <td className="px-3 py-3 text-muted">{job.location || "—"}</td>
      <td className="px-3 py-3 text-muted">{job.country || "—"}</td>
      <td className="px-3 py-3 whitespace-nowrap text-muted tabular-nums">{when || "—"}</td>
    </tr>
  );
}

export function GroupRows({ source, jobs }: { source: Source; jobs: Job[] }) {
  return (
    <>
      <tr>
        <td colSpan={7} className="bg-bg px-3 py-2 text-xs font-medium text-muted">
          {sourceLabel(source)}
          <span className="tabular-nums"> · {jobs.length}</span>
        </td>
      </tr>
      {jobs.map((job, index) => (
        <JobRow key={`${job.url}-${job.title}-${index}`} job={job} />
      ))}
    </>
  );
}
