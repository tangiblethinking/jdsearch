import { createServerFn } from "@tanstack/react-start";
import { validateSearchInput, type SearchPayload } from "./jobs";

export const searchJobs = createServerFn({ method: "POST" })
  .validator(validateSearchInput)
  .handler(async ({ data }): Promise<SearchPayload> => {
    const { runSearch } = await import("./jobs.fetch.server");
    return runSearch(data.query, data.companies);
  });
