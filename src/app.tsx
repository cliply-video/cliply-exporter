import { useCallback, useEffect, useState } from "react";
import { type BinariesStatus, binariesStatus } from "./lib/api";
import { Clips } from "./screens/clips";
import { Home } from "./screens/home";
import { ImportXml } from "./screens/import";
import { Setup } from "./screens/setup";

type Step =
  | { name: "home" }
  | { name: "import"; videoId: string }
  | { name: "clips"; videoId: string };

// ffprobe isn't used yet; gate only on what the flow needs.
const ready = (s: BinariesStatus | null) => !!s && s.ffmpeg && s.ytdlp;

export function App() {
  const [status, setStatus] = useState<BinariesStatus | null>(null);
  const [step, setStep] = useState<Step>({ name: "home" });

  const refresh = useCallback(async () => {
    setStatus(await binariesStatus());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!ready(status)) {
    return <Setup status={status} onReady={refresh} />;
  }

  if (step.name === "home") {
    return (
      <Home onVideo={(videoId) => setStep({ name: "import", videoId })} />
    );
  }
  if (step.name === "import") {
    return (
      <ImportXml
        videoId={step.videoId}
        onDone={() => setStep({ name: "clips", videoId: step.videoId })}
      />
    );
  }
  return <Clips videoId={step.videoId} onBack={() => setStep({ name: "home" })} />;
}
