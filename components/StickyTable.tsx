"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
  type TableHTMLAttributes
} from "react";

type TableElement = ReactElement<TableHTMLAttributes<HTMLTableElement> & { children?: ReactNode }>;

export function StickyTable({ children }: { children: TableElement }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const stickyTableRef = useRef<HTMLTableElement>(null);
  const header = Children.toArray(children.props.children).find(
    (child) => isValidElement(child) && child.type === "thead"
  );

  useEffect(() => {
    const scroll = scrollRef.current;
    const table = scroll?.querySelector("table");
    const stickyHeader = stickyHeaderRef.current;
    const stickyTable = stickyTableRef.current;
    if (!scroll || !table || !stickyHeader || !stickyTable) return;
    const scrollElement = scroll;
    const tableElement = table;
    const stickyHeaderElement = stickyHeader;
    const stickyTableElement = stickyTable;
    let scrollFrame: number | null = null;

    function syncHorizontalPosition() {
      stickyTableElement.style.transform = `translateX(${-scrollElement.scrollLeft}px)`;
    }

    function syncColumnWidths() {
      // The visible header is mirrored outside the horizontal scroll container so it can stay pinned.
      // Its width and column widths must follow the source table as content or viewport size changes.
      stickyTableElement.style.width = `${tableElement.scrollWidth}px`;
      const sourceHeaders = tableElement.querySelectorAll("thead th");
      const stickyHeaders = stickyTableElement.querySelectorAll("th");
      sourceHeaders.forEach((source, index) => {
        const sticky = stickyHeaders[index] as HTMLElement | undefined;
        if (sticky) sticky.style.width = `${source.getBoundingClientRect().width}px`;
      });
      syncHorizontalPosition();
    }

    function scheduleHorizontalSync() {
      if (scrollFrame !== null) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        syncHorizontalPosition();
      });
    }

    function syncPinnedState() {
      stickyHeaderElement.classList.toggle("is-pinned", stickyHeaderElement.getBoundingClientRect().top <= 0);
    }

    syncColumnWidths();
    syncPinnedState();
    const observer = new ResizeObserver(syncColumnWidths);
    observer.observe(scrollElement);
    observer.observe(tableElement);
    scrollElement.addEventListener("scroll", scheduleHorizontalSync, { passive: true });
    window.addEventListener("scroll", syncPinnedState, { passive: true });
    window.addEventListener("resize", syncPinnedState, { passive: true });

    return () => {
      observer.disconnect();
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      scrollElement.removeEventListener("scroll", scheduleHorizontalSync);
      window.removeEventListener("scroll", syncPinnedState);
      window.removeEventListener("resize", syncPinnedState);
    };
  }, []);

  return (
    <div className="sticky-table-shell">
      <div className="sticky-table-header" ref={stickyHeaderRef}>
        <table className={children.props.className} ref={stickyTableRef}>
          {header}
        </table>
      </div>
      <div className="table-scroll" ref={scrollRef}>
        {children}
      </div>
    </div>
  );
}
