'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { useReducedMotion } from 'framer-motion';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

import africaGeo from '@/data/africa-geo.json';
import { AFRICA_CENTRE_LNG } from '@/data/country-coordinates';
import { cn } from '@/lib/utils';

/**
 * Rotating orthographic globe of the African Union.
 *
 * Each Member State is a real vector boundary, filled by how completely it has
 * reported for the current cycle — a choropleth on a sphere rather than a dot
 * beside a country. Rendering as SVG rather than WebGL means the shapes take
 * their colours from the design tokens, stay crisp at any size, need no
 * fallback for machines without WebGL, and expose one focusable element per
 * Member State to keyboard and screen-reader users.
 *
 * Performance note: re-rendering 55 React paths at 60fps would be far too slow,
 * so rotation updates the `d` attributes imperatively through refs. React only
 * re-renders when the hovered country changes.
 */

const GEO = africaGeo as unknown as FeatureCollection<Geometry, { iso2: string; name: string }>;

/** Degrees of longitude per frame. Deliberately slow — this sits behind text. */
const ROTATION_SPEED = 0.06;

/** Fill bands. Null completeness renders as "not reported", never as 0%. */
function bandOf(completeness: number | null): 0 | 1 | 2 | 3 | 4 {
  if (completeness === null) return 0;
  if (completeness >= 80) return 4;
  if (completeness >= 50) return 3;
  if (completeness >= 25) return 2;
  return 1;
}

const BAND_CLASS: Record<number, string> = {
  0: 'fill-muted stroke-border',
  1: 'fill-primary/25 stroke-background',
  2: 'fill-primary/45 stroke-background',
  3: 'fill-primary/70 stroke-background',
  4: 'fill-primary stroke-background',
};

const BAND_LABEL: Record<number, string> = {
  0: 'not reported',
  1: 'under 25% complete',
  2: '25–49% complete',
  3: '50–79% complete',
  4: '80–100% complete',
};

export interface GlobeCountry {
  iso2: string;
  name: string;
  /** Null when the Member State has published nothing for this cycle. */
  completeness: number | null;
  targetProgress: number | null;
  reported: number;
  expected: number;
}

export interface ReportingGlobeProps {
  countries: GlobeCountry[];
  className?: string;
  /** Sentence describing the whole globe, for assistive technology. */
  summary: string;
}

export function ReportingGlobe({ countries, className, summary }: ReportingGlobeProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<GlobeCountry | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const graticuleRef = useRef<SVGPathElement>(null);
  const lambdaRef = useRef(-AFRICA_CENTRE_LNG);
  const pausedRef = useRef(false);
  const dragRef = useRef<{ x: number; lambda: number } | null>(null);

  const byIso2 = useMemo(() => new Map(countries.map((c) => [c.iso2, c])), [countries]);

  // A fixed viewBox means the projection never needs recomputing on resize —
  // the SVG scales itself.
  const SIZE = 600;
  const projection = useMemo(
    () =>
      geoOrthographic()
        .scale(SIZE / 2 - 2)
        .translate([SIZE / 2, SIZE / 2])
        .clipAngle(90),
    [],
  );
  const pathGen = useMemo(() => geoPath(projection), [projection]);

  /**
   * The opening frame, computed during render so it is present in the
   * server-rendered HTML. Without this the paths would have no `d` until the
   * first animation frame, flashing an empty sphere on load — and the globe
   * would be blank entirely for anyone with JavaScript disabled.
   */
  const initialPaths = useMemo(() => {
    projection.rotate([-AFRICA_CENTRE_LNG, -8, 0]);
    const map = new Map<string, string>();
    for (const feature of GEO.features) {
      const d = pathGen(feature as Feature<Geometry>);
      if (d) map.set(feature.properties.iso2, d);
    }
    return { paths: map, graticule: pathGen(geoGraticule10()) ?? '' };
  }, [pathGen, projection]);

  const registerPath = useCallback((iso2: string, el: SVGPathElement | null) => {
    if (el) pathRefs.current.set(iso2, el);
    else pathRefs.current.delete(iso2);
  }, []);

  useEffect(() => {
    let frame = 0;

    const draw = () => {
      // Tilt slightly so the equator is not dead-centre, which frames the
      // continent better in a hero.
      projection.rotate([lambdaRef.current, -8, 0]);

      for (const feature of GEO.features) {
        const el = pathRefs.current.get(feature.properties.iso2);
        if (!el) continue;
        const d = pathGen(feature as Feature<Geometry>);
        // An empty path means the country is on the far side of the sphere.
        if (d) {
          el.setAttribute('d', d);
          el.removeAttribute('visibility');
        } else {
          el.setAttribute('visibility', 'hidden');
        }
      }

      if (graticuleRef.current) {
        graticuleRef.current.setAttribute('d', pathGen(geoGraticule10()) ?? '');
      }
    };

    if (reducedMotion) {
      draw();
      return;
    }

    const tick = () => {
      if (!pausedRef.current && !dragRef.current) {
        lambdaRef.current += ROTATION_SPEED;
      }
      draw();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [pathGen, projection, reducedMotion]);

  return (
    <div className={cn('relative', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
        role="img"
        aria-label={summary}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, lambda: lambdaRef.current };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          dragRef.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          lambdaRef.current = dragRef.current.lambda + (e.clientX - dragRef.current.x) * 0.35;
        }}
        onPointerEnter={() => {
          pausedRef.current = true;
        }}
        onPointerLeave={() => {
          pausedRef.current = false;
          dragRef.current = null;
          setHovered(null);
        }}
      >
        <defs>
          <radialGradient id="globe-ocean" cx="35%" cy="30%">
            <stop offset="0%" stopColor="var(--color-muted)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0.75" />
          </radialGradient>
        </defs>

        {/* Sphere */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={SIZE / 2 - 2}
          fill="url(#globe-ocean)"
          className="stroke-border"
          strokeWidth={1}
        />

        {/* Graticule, kept very faint so it reads as texture not data */}
        <path
          ref={graticuleRef}
          d={initialPaths.graticule}
          fill="none"
          className="stroke-border"
          strokeWidth={0.4}
          opacity={0.4}
        />

        {/* One vector boundary per Member State */}
        <g>
          {GEO.features.map((feature) => {
            const iso2 = feature.properties.iso2;
            const country = byIso2.get(iso2);
            const band = bandOf(country?.completeness ?? null);
            const label = country
              ? `${country.name}: ${
                  country.completeness === null
                    ? 'no published data'
                    : `${country.completeness.toFixed(0)}% complete, ${country.reported} of ${country.expected} indicators`
                }`
              : feature.properties.name;

            return (
              <path
                key={iso2}
                ref={(el) => registerPath(iso2, el)}
                d={initialPaths.paths.get(iso2)}
                visibility={initialPaths.paths.has(iso2) ? undefined : 'hidden'}
                className={cn(
                  BAND_CLASS[band],
                  'transition-[fill-opacity] duration-200 outline-none',
                  'hover:fill-accent focus-visible:fill-accent',
                )}
                strokeWidth={0.5}
                tabIndex={0}
                role="link"
                aria-label={label}
                onPointerEnter={() => country && setHovered(country)}
                onFocus={() => country && setHovered(country)}
                onBlur={() => setHovered(null)}
                onClick={() => router.push(`/countries/${iso2}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/countries/${iso2}`);
                  }
                }}
              />
            );
          })}
        </g>
      </svg>

      {/* Hover readout. Positioned rather than following the cursor so it
          never obscures the country being inspected. */}
      {hovered ? (
        <div
          role="status"
          className="bg-popover text-popover-foreground pointer-events-none absolute inset-x-2 bottom-2 rounded-md border px-3 py-2 text-xs shadow-lg"
        >
          <p className="font-medium">{hovered.name}</p>
          <p className="text-muted-foreground tnum">
            {hovered.completeness === null
              ? 'No published data for this cycle'
              : `${hovered.completeness.toFixed(0)}% complete · ${hovered.reported} of ${hovered.expected} indicators`}
            {hovered.targetProgress !== null
              ? ` · ${hovered.targetProgress.toFixed(0)}% target progress`
              : ''}
          </p>
        </div>
      ) : null}

      {/* Legend */}
      <ul className="text-muted-foreground mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.68rem]">
        {[0, 1, 2, 3, 4].map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn('inline-block size-2.5 rounded-[2px] border', BAND_CLASS[b])}
            />
            {BAND_LABEL[b]}
          </li>
        ))}
      </ul>
    </div>
  );
}
