"use client";

import { useEffect, useRef, useState } from "react";

const MEDIA = "/media/hero";

/**
 * The home hero film.
 *
 * - The poster (AVIF/WebP, ~60 KB) paints first; the headline stays the LCP element.
 * - The video is only fetched when motion is allowed and Save-Data is off. Reduced-motion
 *   visitors never download it.
 * - Portrait screens get their own cut (composed for phones, not a crop).
 * - It fades in once actually playing, and pauses off-screen or in a background tab.
 */
export function HeroFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduce || saveData) return;

    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const name = portrait ? "hero-portrait" : "hero-1080";
    const canAv1 = el.canPlayType('video/webm; codecs="av01.0.08M.08"') !== "";
    el.src = `${MEDIA}/${name}.${canAv1 ? "webm" : "mp4"}`;

    const onPlaying = () => setPlaying(true);
    el.addEventListener("playing", onPlaying);
    const tryPlay = () => el.play().catch(() => {});

    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting && !document.hidden ? tryPlay() : el.pause()), { threshold: 0.1 });
    io.observe(el);
    const onVisibility = () => (document.hidden ? el.pause() : tryPlay());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      el.removeEventListener("playing", onPlaying);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
    };
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden bg-bg">
      <picture>
        <source media="(orientation: portrait)" type="image/avif" srcSet={`${MEDIA}/hero-portrait-poster.avif`} />
        <source media="(orientation: portrait)" type="image/webp" srcSet={`${MEDIA}/hero-portrait-poster.webp`} />
        <source type="image/avif" srcSet={`${MEDIA}/hero-poster.avif`} />
        <img
          src={`${MEDIA}/hero-poster.webp`}
          alt=""
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
          className="hero-poster absolute inset-0 size-full object-cover"
        />
      </picture>
      <video
        ref={video}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-1000 ease-out data-[playing=true]:opacity-100"
        data-playing={playing}
      />
    </div>
  );
}
