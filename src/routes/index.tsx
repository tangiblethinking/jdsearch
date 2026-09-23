import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchApp } from "@/components/search-app";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q.slice(0, 120) : "",
  }),
  component: Home,
});

function Home() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  return (
    <SearchApp
      query={q}
      onQuery={(next) => {
        if (next === q) return;
        void navigate({ search: { q: next }, replace: true });
      }}
    />
  );
}
