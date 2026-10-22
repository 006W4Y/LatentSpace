import { useMemo } from "react";
export default function Illustration() {
  const dots = useMemo(
    () =>
      Array.from({ length: 135 }, (_, i) => {
        const cluster = i % 3;
        const angle = i * 2.39996;
        const radius = Math.sqrt(i / 3) * 10;
        return {
          x:
            [135, 280, 395][cluster] +
            Math.cos(angle) * radius * [1, 0.8, 1.1][cluster],
          y: [180, 95, 220][cluster] + Math.sin(angle) * radius * 0.75,
          color: ["#8fae84", "#dca67a", "#a7a0c7"][cluster],
        };
      }),
    [],
  );
  return (
    <svg
      className="illustration"
      viewBox="0 0 540 330"
      aria-label="Illustration einer Datenlandschaft"
    >
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#c4d0bf" />
        </pattern>
      </defs>
      <rect width="540" height="330" fill="url(#grid)" />
      <ellipse cx="135" cy="180" rx="94" ry="74" fill="#e6eedf" />
      <ellipse cx="280" cy="95" rx="83" ry="64" fill="#f3e8d9" />
      <ellipse cx="395" cy="220" rx="97" ry="78" fill="#eae7ee" />
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={i % 9 === 0 ? 4.5 : 3}
          fill={dot.color}
          opacity={0.85}
        />
      ))}
      <circle cx="270" cy="255" r="7" fill="#d28058" />
      <circle
        cx="270"
        cy="255"
        r="13"
        stroke="#d28058"
        fill="none"
        opacity="0.4"
      />
      <rect
        x="290"
        y="250"
        width="142"
        height="46"
        rx="10"
        fill="white"
        stroke="#dfe4da"
      />
      <text x="304" y="270" fontSize="11" fontWeight="600" fill="#263c31">
        Neue Perspektiven.
      </text>
      <text x="304" y="286" fontSize="10" fill="#7c8679">
        Illustrative Datenansicht
      </text>
    </svg>
  );
}
