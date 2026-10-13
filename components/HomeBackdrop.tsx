"use client";

import { useState } from "react";

// Inline the tiny preview so the first paint never waits for an image request.
const preview = "data:image/webp;base64,UklGRpYAAABXRUJQVlA4IIoAAABQBQCdASogABIAPu1kqU2ppaOiMAgBMB2JZACdMtDDC2kvtQ2UwybrJh91qWzHvh/STHAA+4eHnGOUEY3nnP1reJ0rnSt/F3nLOEwRB9wy3yXj2/Xa1cbsejOfphutOZoFuCj6SBKdwjcQ1IfLQYY+ykk4ck3dMn4QXwx8IrcHW009pZuIKieAAAA=";

export function HomeBackdrop() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="home-backdrop" style={{ backgroundImage: `url(${preview})` }}>
      <img
        alt="An Old School RuneScape-inspired Grand Exchange beneath a golden sunset"
        className={`home-backdrop-image${loaded ? " is-loaded" : ""}`}
        decoding="async"
        fetchPriority="high"
        height={1440}
        loading="eager"
        onLoad={() => setLoaded(true)}
        ref={(image) => {
          // Cached images can finish before hydration attaches the load handler.
          if (image?.complete && image.naturalWidth > 0) setLoaded(true);
        }}
        sizes="100vw"
        src="/images/home/grand-exchange-sunset-1600.webp"
        srcSet="/images/home/grand-exchange-sunset-960.webp 960w, /images/home/grand-exchange-sunset-1600.webp 1600w, /images/home/grand-exchange-sunset-2560.webp 2560w"
        width={2560}
      />
      <noscript><style>{".home-backdrop-image { opacity: 1; }"}</style></noscript>
    </div>
  );
}
