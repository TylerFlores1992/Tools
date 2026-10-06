import { NotFoundScreen } from "@/lab/camphawk/round2/pages/ErrorStates";

// Any unknown Golden hour address lands here (via [...missing]), with a real 404 status.
export default function GoldenHourNotFound() {
  return <NotFoundScreen />;
}
