export type Role = "number" | "date" | "category" | "identifier" | "text";
export type Value = string | number | boolean | null;
export type Column = {
  name: string;
  role: Role;
  missing: number;
  unique: number;
  examples: Value[];
  date_ambiguous?: boolean;
  date_format_suggestion?: "iso" | "dmy" | "mdy" | null;
  month_choices?: ("zero" | "one")[];
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
  rule: "iqr" | "distance" | "constant" | null;
  criterion: string | null;
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
  assessment: "value_deviation" | "model_only" | "unmarked" | "unavailable";
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
  result_type: "observation" | "rule" | "model";
  procedure: string;
  basis: FindingBasis;
  metrics: Record<
    "effect" | "strength" | "sample_size" | "coverage",
    { value: number; label: string } | null
  >;
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
  token: string;
  columns: string[];
  cell_evidence: CellRule[];
  comparison_groups: Cohort[];
  reference: { id: string; count: number; label: string };
};
export type ColumnDisplay = {
  date_format: "iso" | "dmy" | "mdy" | null;
  month_base: "none" | "zero" | "one";
  unit_label: string;
};
export type AnalysisConfig = {
  display?: Record<string, ColumnDisplay>;
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
  finding_sort: "name" | "effect" | "strength" | "sample_size" | "coverage";
  finding_direction: "asc" | "desc";
  finding_kind: "all" | Insight["kind"];
  finding_origin: "all" | Insight["result_type"];
  finding_offset: number;
  finding_limit: number;
  duplicate_keys: string[];
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
  unit_label: string;
  display: ColumnDisplay;
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
  coverage: {
    columns_checked: number;
    numeric_pairs_tested: number;
    group_measure_pairs: number;
    date_measure_pairs: number;
    duplicate_check: {
      keys: string[];
      complete: number;
      duplicate_rows: number;
      skipped: number;
    };
    numeric_columns: number;
    category_columns: number;
    date_columns: number;
    candidates: number;
    matched: number;
    shown: number;
    offset: number;
    kind_counts: Partial<Record<Insight["kind"], number>>;
    origin_counts: Partial<Record<Insight["result_type"], number>>;
    displayed_limit: number;
    note: string;
  };
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

let sessionToken: Promise<string> | null = null;
async function token(): Promise<string> {
  if (!sessionToken)
    sessionToken = fetch("/api/session", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Der lokale Arbeitsbereich ist nicht erreichbar.");
        const data = await response.json();
        return data.token as string;
      })
      .catch((error) => {
        sessionToken = null;
        throw error;
      });
  return sessionToken;
}

export async function localFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(
    (options.method ?? "GET").toUpperCase(),
  );
  const headers = new Headers(options.headers);
  if (mutation) headers.set("X-LatentSpace-Token", await token());
  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (mutation && response.status === 403) {
    const error = await response
      .clone()
      .json()
      .catch(() => ({}));
    if (error.code === "LOCAL_TOKEN") {
      sessionToken = null;
      headers.set("X-LatentSpace-Token", await token());
      response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin",
      });
    }
  }
  return response;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await localFetch(`/api${path}`, options);
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

export type CellRule = {
  column: string;
  kind: "iqr" | "missing" | "duplicate" | "combination";
  rule: string;
  reference_n: number;
  median?: number;
  q1?: number;
  q3?: number;
  lower?: number;
  upper?: number;
};
export type Cohort = {
  label: string;
  count: number;
  missing?: number;
  rate?: number;
  correlation?: number;
  median?: number;
  mean?: number;
};
export type InvestigationSource =
  | { job: string; token: string }
  | { savedId: string };
export type ResearchRecord = {
  id: string;
  dataset: string;
  kind: "finding" | "session";
  name: string;
  notes: string;
  created_at: string;
  config?: ExploreConfig;
  view?: View;
  analysis_config?: AnalysisConfig;
};
export type View =
  | "overview"
  | "insights"
  | "trends"
  | "groups"
  | "anomalies"
  | "relations"
  | "landscape"
  | "data";
export type Investigation = {
  finding: Insight;
  mode: "affected" | "comparison" | "reference";
  page: number;
  count: number;
  rows: {
    id: number;
    values: Record<string, Value>;
    anomaly: boolean;
    finding_evidence: Record<string, CellRule>;
  }[];
  column: string;
  columns: string[];
  all_columns: string[];
  role: Role;
  reference_count: number;
  reference_row_ids: number[];
  affected_count: number;
  comparison_count: number;
  excluded_comparison_count: number;
  summaries: {
    label: string;
    count: number;
    missing: number;
    median: number | null;
    mean: number | null;
  }[];
  distribution: {
    label: string;
    reference: number;
    affected: number;
    comparison: number;
  }[];
  comparison_groups: Cohort[];
  scatter: {
    x: number;
    y: number;
    row_id: number;
    affected: boolean;
    group: string;
  }[];
  scatter_total: number;
  scatter_columns: string[];
  analysis_config: AnalysisConfig;
  source_filters: ExploreConfig;
  fingerprint: string;
  notes?: string;
  saved_id?: string;
  saved_name?: string;
  display: Partial<ColumnDisplay>;
  review: SensitivityReview;
};

export type FindingBasis = {
  label: string;
  reference_rows: number;
  dataset_rows: number;
  complete_rows: number;
  missing_cells: number;
  filters: string[];
  model_training_rows: number | null;
  columns: {
    name: string;
    role: Role;
    observed: number;
    missing: number;
    source_missing: number;
    conversion_missing: number;
    display: Partial<ColumnDisplay>;
  }[];
};
export type NumericSummary = {
  observed: number;
  missing: number;
  mean: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
  std: number | null;
};
export type SingleExclusion = {
  available: boolean;
  metric: string;
  count: number;
  full?: number;
  minimum?: number;
  maximum?: number;
  undefined?: number;
  columns?: string[];
  largest_changes: { row_id: number; without: number; difference: number }[];
};
export type SensitivityReview = {
  reference_rows: number;
  remaining_rows: number;
  excluded_rows: number[];
  column: string;
  method: string;
  column_comparison: { before: NumericSummary; after: NumericSummary } | null;
  pair_comparison: {
    columns: string[];
    before: number | null;
    after: number | null;
    before_n: number;
    after_n: number;
  } | null;
  single_exclusion: SingleExclusion[];
};
