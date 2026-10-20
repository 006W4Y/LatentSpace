export type Role = "number" | "date" | "category" | "identifier" | "text";
export type Value = string | number | boolean | null;
export type Column = {
  name: string;
  role: Role;
  missing: number;
  unique: number;
  examples: Value[];
};
export type Dataset = {
  id: string;
  name: string;
  row_count: number;
  created_at: string;
  columns: Column[];
  preview: Record<string, Value>[];
  notices: string[];
};
export type Demo = {
  id: "retail" | "energy" | "learning";
  title: string;
  description: string;
  grain: string;
  row_count: number;
  tags: string[];
};
export type DataRow = {
  id: number;
  values: Record<string, Value>;
  coords: number[];
  cluster: number;
  anomaly: boolean;
  score: number;
  explanation?: RowExplanation;
};
export type Comparison = {
  feature: string;
  value: number;
  kind: "global" | "context";
  direction: string;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  reference_n: number;
  percentile: number;
  deviation: number | null;
  is_evidence: boolean;
  other_features: string[];
  title: string;
  detail: string;
};
export type RowExplanation = {
  row_id: number;
  available: boolean;
  flagged: boolean;
  score: number;
  score_percentile: number | null;
  summary: string;
  reasons: Comparison[];
  comparisons: Comparison[];
  missing_features: string[];
  reference_scope: string;
  method: string;
  limitation: string;
};
export type Insight = {
  id: string;
  kind: "anomaly" | "trend" | "group" | "relation" | "quality";
  title: string;
  detail: string;
  evidence: { label: string; value: string }[];
  method: string;
  priority: number;
  sample_size: number;
  scope: string;
  action: Partial<ExploreConfig> & {
    view:
      | "overview"
      | "insights"
      | "trends"
      | "groups"
      | "anomalies"
      | "relations"
      | "landscape"
      | "data";
  };
  limitation: string;
  row_ids: number[];
};
export type AnalysisConfig = {
  roles: Record<string, Role>;
  features: string[];
  projection: "pca" | "umap";
  min_cluster_size: number;
};
export type Analysis = {
  dataset_id: string;
  name: string;
  roles: Record<string, Role>;
  features: string[];
  numeric_columns: string[];
  rows: DataRow[];
  cluster_count: number;
  anomaly_count: number;
  notices: string[];
  projection: string;
  explained_variance: number[] | null;
  config: AnalysisConfig;
  seed: number;
  versions: Record<string, string>;
};
export type ExploreConfig = {
  query: string;
  category_column: string | null;
  category_value: string | null;
  anomalies_only: boolean;
  cluster: number | null;
  row_ids: number[] | null;
  date_column: string | null;
  value_column: string | null;
  group_column: string | null;
  period: string;
  aggregation: string;
  page: number;
};
export type Profile = {
  name: string;
  role: Role;
  missing: number;
  unique: number;
  mean?: number | null;
  median?: number | null;
  min?: number | null;
  max?: number | null;
  q1?: number | null;
  q3?: number | null;
  observed: number;
  distribution_kind:
    | "histogram"
    | "discrete"
    | "calendar"
    | "month_codes"
    | "categories"
    | "identifier"
    | "text";
  summary: string;
  distribution_note: string;
  distribution: {
    label: string;
    count: number;
    short_label?: string;
    start?: number;
    end?: number;
  }[];
};
export type Exploration = {
  count: number;
  total: number;
  filtered_ids: number[];
  missing: number;
  duplicates: number;
  page: number;
  profiles: Profile[];
  correlations: {
    x: string;
    y: string;
    value: number;
    spearman: number | null;
    count: number;
  }[];
  trend: { date: string; value: number | null }[];
  groups: { label: string; count: number; value: number | null }[];
  group_total: number;
  skipped_dates: number;
  clusters: {
    cluster: number;
    count: number;
    differences: {
      feature: string;
      delta: number;
      mean: number;
      baseline: number;
    }[];
  }[];
  anomalies: DataRow[];
  anomaly_count: number;
  rows: DataRow[];
  insights: Insight[];
};

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : `Anfrage fehlgeschlagen (${response.status}).`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function post<T>(
  path: string,
  data: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal,
  });
}

export const number = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value)
    ? "–"
    : new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(
        value,
      );
export const roleLabels: Record<Role, string> = {
  number: "Messwert",
  category: "Kategorie",
  date: "Datum",
  identifier: "Kennung",
  text: "Text",
};
export const palette = [
  "#4e77c9",
  "#d99861",
  "#8d8cc3",
  "#6aa9b4",
  "#c66b83",
  "#8b9a53",
  "#b389bb",
  "#7293bf",
];
export const clusterColor = (cluster: number) =>
  cluster < 0 ? "#b6bdb6" : palette[cluster % palette.length];

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
