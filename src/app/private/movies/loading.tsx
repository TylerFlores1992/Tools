import { PageLoading } from "@/components/PageLoading";
import { MoviesShell } from "@/tools/movies/ui/MoviesShell";

/** Shown at once while the page asks the home server, which can take a few seconds. */
export default function Loading() {
  return (
    <MoviesShell>
      <PageLoading label="Asking the home server for movies…" />
    </MoviesShell>
  );
}
