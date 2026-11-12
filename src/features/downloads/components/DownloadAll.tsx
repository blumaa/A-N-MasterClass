"use client";
// "Download all": one download per file, started one after another. No zip (PLAN: Vercel
// duration limit + transfer cost). Each href is the signed-redirect route, which checks access.
// A temporary <a download> is clicked per file (MDN: the standard way to start a download from
// script; a hidden iframe is the legacy route and gives no per-file control).
import { useRef, useState } from "react";
import { Button } from "@/components/ui/mds";

/** Gap between downloads so browsers do not drop any. */
export const DOWNLOAD_GAP_MS = 500;

function startDownload(href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
}

export function DownloadAll({ hrefs }: { hrefs: string[] }) {
  const [running, setRunning] = useState(false);
  const busy = useRef(false);

  function run() {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    const next = (i: number) => {
      startDownload(hrefs[i]);
      if (i === hrefs.length - 1) {
        busy.current = false;
        setRunning(false);
        return;
      }
      setTimeout(() => next(i + 1), DOWNLOAD_GAP_MS);
    };
    next(0);
  }

  return (
    <div>
      <Button type="button" onClick={run} loading={running}>
        Download all
      </Button>
    </div>
  );
}
