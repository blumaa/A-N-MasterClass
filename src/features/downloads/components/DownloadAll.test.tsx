import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadAll, DOWNLOAD_GAP_MS } from "./DownloadAll";

const hrefs = [
  "/downloads/pack/files/a",
  "/downloads/pack/files/b",
  "/downloads/pack/files/c",
];

describe("DownloadAll", () => {
  const clicked: string[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    clicked.length = 0;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.getAttribute("href") ?? "");
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts one download per file, one after another with a gap", () => {
    render(<DownloadAll hrefs={hrefs} />);
    fireEvent.click(screen.getByRole("button", { name: "Download all" }));
    expect(clicked).toEqual([hrefs[0]]);
    act(() => vi.advanceTimersByTime(DOWNLOAD_GAP_MS));
    expect(clicked).toEqual([hrefs[0], hrefs[1]]);
    act(() => vi.advanceTimersByTime(DOWNLOAD_GAP_MS));
    expect(clicked).toEqual(hrefs);
  });

  it("ignores clicks while running, then allows again", () => {
    render(<DownloadAll hrefs={hrefs} />);
    const button = screen.getByRole("button", { name: "Download all" });
    fireEvent.click(button);
    fireEvent.click(button);
    act(() => vi.advanceTimersByTime(DOWNLOAD_GAP_MS * 3));
    expect(clicked).toEqual(hrefs);
    fireEvent.click(screen.getByRole("button", { name: "Download all" }));
    expect(clicked).toHaveLength(4);
  });

  it("removes its temporary anchors", () => {
    const { container } = render(<DownloadAll hrefs={hrefs} />);
    fireEvent.click(screen.getByRole("button", { name: "Download all" }));
    act(() => vi.advanceTimersByTime(DOWNLOAD_GAP_MS * 3));
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
    expect(container).toBeTruthy();
  });
});
