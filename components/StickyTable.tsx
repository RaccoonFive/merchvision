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

    function syncHeader() {
      stickyTableElement.style.width = `${tableElement.scrollWidth}px`;
      stickyTableElement.style.transform = `translateX(${-scrollElement.scrollLeft}px)`;
      const sourceHeaders = tableElement.querySelectorAll("thead th");
      const stickyHeaders = stickyTableElement.querySelectorAll("th");
      sourceHeaders.forEach((source, index) => {
        const sticky = stickyHeaders[index] as HTMLElement | undefined;
        if (sticky) sticky.style.width = `${source.getBoundingClientRect().width}px`;
      });
    }

    function syncPinnedState() {
      stickyHeaderElement.classList.toggle("is-pinned", stickyHeaderElement.getBoundingClientRect().top <= 0);
    }

    syncHeader();
    syncPinnedState();
    const observer = new ResizeObserver(syncHeader);
    observer.observe(scrollElement);
    observer.observe(tableElement);
    scrollElement.addEventListener("scroll", syncHeader, { passive: true });
    window.addEventListener("scroll", syncPinnedState, { passive: true });
    window.addEventListener("resize", syncPinnedState, { passive: true });

    return () => {
      observer.disconnect();
      scrollElement.removeEventListener("scroll", syncHeader);
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
