import { CalendarDays, Fingerprint, Text } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Profile } from "../api";
import { number, roleLabels } from "../api";

export default function ProfileCard({ profile }: { profile: Profile }) {
  const categorical = profile.distribution_kind === "categories";
  const textual = ["identifier", "text"].includes(profile.distribution_kind);
  const calendar = ["calendar", "month_codes"].includes(
    profile.distribution_kind,
  );
  const max = Math.max(1, ...profile.distribution.map((item) => item.count));
  return (
    <section
      className={`card profile-card profile-${profile.distribution_kind}`}
    >
      <div className="profile-heading">
        <h3 title={profile.name}>{profile.name.replaceAll("_", " ")}</h3>
        <span className="badge">
          {calendar && <CalendarDays size={11} />}
          {roleLabels[profile.role]}
        </span>
      </div>
      {profile.unit_label && (
        <p className="user-unit-label">
          Label (Nutzereingabe): {profile.unit_label}
        </p>
      )}
      {textual ? (
        <div className="identifier-profile">
          {profile.distribution_kind === "identifier" ? (
            <Fingerprint size={30} />
          ) : (
            <Text size={30} />
          )}
          <strong>{number(profile.unique, 0)}</strong>
          <span>
            verschiedene{" "}
            {profile.distribution_kind === "identifier"
              ? "Kennungen"
              : "Texteinträge"}
          </span>
        </div>
      ) : categorical ? (
        <div className="category-distribution">
          {profile.distribution.map((item) => (
            <div className="category-bar-row" key={item.label}>
              <div>
                <span title={item.label}>{item.label}</span>
                <strong>{number(item.count, 0)}</strong>
              </div>
              <div className="category-track">
                <i style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="profile-chart">
          <ResponsiveContainer width="100%" height={158}>
            <BarChart
              data={profile.distribution}
              margin={{ left: 0, right: 4, top: 12, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#edf0f5" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={calendar ? 8 : 18}
                interval="preserveStartEnd"
                tick={{ fontSize: 10, fill: "#738198" }}
                tickFormatter={(label: string) => {
                  const item = profile.distribution.find(
                    (v) => v.label === label,
                  );
                  return (
                    item?.short_label ??
                    (calendar ? label.slice(0, 3) : label.split(" – ")[0])
                  );
                }}
                height={30}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "#edf2ff" }}
                formatter={(value) => [number(Number(value), 0), "Zeilen"]}
                contentStyle={{
                  borderRadius: 9,
                  border: "1px solid #dfe6f0",
                  color: "#27384f",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                fill={calendar ? "#7c94cd" : "#6e8bd1"}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="profile-interpretation">{profile.summary}</p>
      <div className="profile-stats">
        {profile.role === "number" ? (
          <>
            <span>
              Durchschnitt<strong>{number(profile.mean, 2)}</strong>
            </span>
            <span>
              Median<strong>{number(profile.median, 2)}</strong>
            </span>
          </>
        ) : (
          <span>
            Beobachtete Werte<strong>{number(profile.observed, 0)}</strong>
          </span>
        )}
        <span>
          Fehlend
          <strong className={profile.missing ? "warm-text" : ""}>
            {number(profile.missing, 0)}
          </strong>
        </span>
      </div>
      <p className="profile-distribution-note">{profile.distribution_note}</p>
    </section>
  );
}
