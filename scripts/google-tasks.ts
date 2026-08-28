#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

type SheetKey =
  | "intro"
  | "features"
  | "backend"
  | "frontend"
  | "design"
  | "common"
  | "glossary"
  | "summary";

interface SheetDefinition {
  key: SheetKey;
  title: string;
  gid: string;
  label?: string;
}

interface Spreadsheet {
  id: string;
  title: string;
  url: string;
}

interface Sheet extends SheetDefinition {
  hash: string;
  rows: string[][];
}

interface Task {
  rowNumber: number;
  id: string | null;
  week: string | null;
  featureId: string | null;
  name: string | null;
  description: string | null;
  doneDefinition: string | null;
  dependencies: string | null;
  estimatedHours: string | null;
  assignee: string | null;
  status: string | null;
  memo: string | null;
  extra: string[];
}

interface Snapshot {
  schemaVersion: 1;
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  syncedAt: string;
  sheets: Sheet[];
}

interface CategorySummary {
  key: SheetKey;
  label: string;
  count: number;
  statuses: StatusCounts;
  hours: number;
  missingIds: number[];
}

interface TaskGroup {
  sheet: Sheet;
  tasks: Task[];
}

interface SummaryTotals {
  count: number;
  hours: number;
  statuses: StatusCounts;
}

type Status = (typeof STATUS_ORDER)[number];
type StatusCounts = Record<Status, number>;
type ComparableTaskField =
  | "week"
  | "featureId"
  | "name"
  | "description"
  | "doneDefinition"
  | "dependencies"
  | "estimatedHours"
  | "assignee"
  | "status"
  | "memo";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT_PATH = resolve(ROOT, "docs/tasks/google-sheet-snapshot.json");
const TASKS_PATH = resolve(ROOT, "docs/tasks/all-tasks.md");
const README_PATH = resolve(ROOT, "docs/tasks/README.md");

const SPREADSHEET = {
  id: "1FW508w8fH26xQPqVVBr8nZcPqa91Myz6f0Jq2WECwb0",
  title: "michinavi_tasks",
  url: "https://docs.google.com/spreadsheets/d/1FW508w8fH26xQPqVVBr8nZcPqa91Myz6f0Jq2WECwb0/edit",
} satisfies Spreadsheet;

const SHEETS = [
  { key: "intro", title: "00_はじめに", gid: "481289993" },
  { key: "features", title: "01_機能一覧", gid: "364183905" },
  { key: "backend", title: "02_タスク_BE", gid: "55691257", label: "BE" },
  { key: "frontend", title: "03_タスク_FE", gid: "1904119206", label: "FE" },
  {
    key: "design",
    title: "04_タスク_デザイナー",
    gid: "304199246",
    label: "デザイナー",
  },
  { key: "common", title: "05_タスク_共通", gid: "1506492464", label: "共通" },
  { key: "glossary", title: "06_用語集", gid: "959367190" },
  { key: "summary", title: "07_進捗サマリ", gid: "942977878" },
] satisfies readonly SheetDefinition[];

const TASK_SHEET_KEYS = new Set<SheetKey>([
  "backend",
  "frontend",
  "design",
  "common",
]);
const STATUS_ORDER = ["未着手", "進行中", "完了", "見送り"] as const;

function normalizeCsv(csv: string): string {
  return csv
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/\n+$/, "");
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new Error(
      "CSVの引用符が閉じられていません。Google Sheetsの応答を確認してください。",
    );
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function exportUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET.id}/export?format=csv&gid=${gid}`;
}

async function fetchSheet(sheet: SheetDefinition): Promise<Sheet> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(exportUrl(sheet.gid), {
        headers: { "user-agent": "michinavi-task-sync/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(
          `Google Sheetsから取得できませんでした (${response.status})`,
        );
      }

      const csv = normalizeCsv(await response.text());
      if (!csv || /^\s*</.test(csv)) {
        throw new Error(
          "CSVではない応答です。シートのリンク共有設定を確認してください。",
        );
      }

      return {
        ...sheet,
        hash: digest(csv),
        rows: parseCsv(csv),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3)
        await new Promise<void>((resolveDelay) =>
          setTimeout(resolveDelay, attempt * 500),
        );
    }
  }

  throw new Error(
    `${sheet.title}: ${lastError instanceof Error ? lastError.message : "取得に失敗しました"}`,
  );
}

async function fetchWorkbook(): Promise<Sheet[]> {
  const sheets: Sheet[] = [];
  // GoogleのCSVエクスポートは同時リクエストで一時的な404を返すことがあるため順次取得する。
  for (const sheet of SHEETS) sheets.push(await fetchSheet(sheet));
  return sheets;
}

function taskRows(sheet: Sheet): Task[] {
  const headerIndex = sheet.rows.findIndex(
    (row) => row[0] === "ID" && row[3] === "タスク名",
  );
  if (headerIndex < 0) {
    throw new Error(`${sheet.title}: タスク表のヘッダーを検出できません。`);
  }

  const headers = sheet.rows[headerIndex];
  return sheet.rows
    .slice(headerIndex + 1)
    .map((row, offset) => ({ row, rowNumber: headerIndex + offset + 2 }))
    .filter(({ row }) => row.some(Boolean))
    .map(({ row, rowNumber }) => {
      const isStructuredTask = Boolean(row[3]);
      return {
        rowNumber,
        id: row[0] || null,
        week: row[1] || null,
        featureId: row[2] || null,
        name: row[3] || row.find(Boolean) || null,
        description: isStructuredTask ? row[4] || null : null,
        doneDefinition: isStructuredTask ? row[5] || null : null,
        dependencies: isStructuredTask ? row[6] || null : null,
        estimatedHours: isStructuredTask ? row[7] || null : null,
        assignee: isStructuredTask ? row[8] || null : null,
        status: isStructuredTask ? row[9] || null : null,
        memo: isStructuredTask ? row[10] || null : null,
        extra: row.slice(headers.length).filter(Boolean),
      };
    });
}

function workbookTasks(sheets: readonly Sheet[]): TaskGroup[] {
  return sheets
    .filter((sheet) => TASK_SHEET_KEYS.has(sheet.key))
    .map((sheet) => ({ sheet, tasks: taskRows(sheet) }));
}

function createStatusCounts(): StatusCounts {
  return Object.fromEntries(
    STATUS_ORDER.map((status) => [status, 0]),
  ) as StatusCounts;
}

function isStatus(value: string | null): value is Status {
  return value !== null && STATUS_ORDER.includes(value as Status);
}

function summarize(sheets: readonly Sheet[]): CategorySummary[] {
  return workbookTasks(sheets).map(({ sheet, tasks }) => {
    const statuses = createStatusCounts();
    let hours = 0;
    for (const task of tasks) {
      if (isStatus(task.status)) statuses[task.status] += 1;
      const taskHours = Number.parseFloat(task.estimatedHours ?? "");
      if (Number.isFinite(taskHours)) hours += taskHours;
    }
    return {
      key: sheet.key,
      label: sheet.label ?? sheet.title,
      count: tasks.length,
      statuses,
      hours,
      missingIds: tasks
        .filter((task) => !task.id)
        .map((task) => task.rowNumber),
    };
  });
}

function escapeTable(value: unknown): string {
  return String(value ?? "-")
    .replaceAll("|", "\\|")
    .replaceAll("\n", "<br>");
}

function taskHeading(task: Task): string {
  return task.id
    ? `${task.id} ${task.name}`
    : `ID未設定（行${task.rowNumber}） ${task.name}`;
}

function renderTasks(snapshot: Snapshot): string {
  const lines = [
    "# みちナビ 全タスク",
    "",
    "> このファイルは `pnpm tasks:sync` で自動生成されます。直接編集しないでください。",
    "",
    `同期日時: ${snapshot.syncedAt}`,
    "",
    `参照元: [${SPREADSHEET.title}](${SPREADSHEET.url})`,
    "",
  ];

  for (const { sheet, tasks } of workbookTasks(snapshot.sheets)) {
    lines.push(`## ${sheet.label}（${tasks.length}件）`, "");
    for (const task of tasks) {
      lines.push(
        `### ${taskHeading(task)}`,
        "",
        `- 週: ${task.week ?? "-"}`,
        `- 機能ID: ${task.featureId ?? "-"}`,
        `- やること: ${task.description ?? "-"}`,
        `- 完了の定義: ${task.doneDefinition ?? "-"}`,
        `- 依存: ${task.dependencies ?? "-"}`,
        `- 想定工数: ${task.estimatedHours ? `${task.estimatedHours}h` : "-"}`,
        `- 担当者: ${task.assignee ?? "未設定"}`,
        `- ステータス: ${task.status ?? "未設定"}`,
        `- メモ: ${task.memo ?? "-"}`,
        "",
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderReadme(snapshot: Snapshot): string {
  const summary = summarize(snapshot.sheets);
  const totals = summary.reduce<SummaryTotals>(
    (result, category) => {
      result.count += category.count;
      result.hours += category.hours;
      for (const status of STATUS_ORDER)
        result.statuses[status] += category.statuses[status];
      return result;
    },
    {
      count: 0,
      hours: 0,
      statuses: createStatusCounts(),
    },
  );

  const lines = [
    "# Google Sheets タスク同期",
    "",
    `Google Sheets の [${SPREADSHEET.title}](${SPREADSHEET.url}) を正本として、全8タブをローカルに同期します。`,
    "",
    `最終同期: ${snapshot.syncedAt}`,
    "",
    "## 現在の進捗",
    "",
    "| 区分 | タスク数 | 未着手 | 進行中 | 完了 | 見送り | 想定工数 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const category of summary) {
    lines.push(
      `| ${escapeTable(category.label)} | ${category.count} | ${category.statuses.未着手} | ${category.statuses.進行中} | ${category.statuses.完了} | ${category.statuses.見送り} | ${category.hours}h |`,
    );
  }
  lines.push(
    `| 合計 | ${totals.count} | ${totals.statuses.未着手} | ${totals.statuses.進行中} | ${totals.statuses.完了} | ${totals.statuses.見送り} | ${totals.hours}h |`,
    "",
  );

  const missingIds = summary.flatMap((category) =>
    category.missingIds.map(
      (rowNumber) => `${category.label} ${rowNumber}行目`,
    ),
  );
  if (missingIds.length > 0) {
    lines.push(
      `注意: Google Sheetsの進捗集計対象はID付き75件です。これとは別に、IDや各列の値が未設定の作業行が ${missingIds.length} 件あります（${missingIds.join("、")}）。見落とし防止のため上のタスク数には含めています。`,
      "",
    );
  }

  lines.push(
    "## 使い方",
    "",
    "```bash",
    "pnpm tasks:status # 保存済みスナップショットの進捗を表示（通信なし）",
    "pnpm tasks:check  # Google Sheetsに更新があるか確認（ファイル変更なし）",
    "pnpm tasks:sync   # 最新内容を取得してスナップショットを更新",
    "```",
    "",
    "タスクの詳細は [all-tasks.md](./all-tasks.md)、全タブの生データとハッシュは [google-sheet-snapshot.json](./google-sheet-snapshot.json) にあります。",
    "",
    "`tasks:check` はタブ単位の変更に加え、タスクの追加・削除・ステータスなどの変更内容を表示し、更新があれば終了コード1を返します。Google Sheetsへの書き込みは行いません。",
    "",
  );

  return lines.join("\n");
}

function taskKey(task: Task): string {
  return task.id || `row:${task.rowNumber}:${task.name}`;
}

function describeTaskChanges(
  previousSheet: Sheet,
  currentSheet: Sheet,
): string[] {
  const previous = new Map<string, Task>(
    taskRows(previousSheet).map((task) => [taskKey(task), task] as const),
  );
  const current = new Map<string, Task>(
    taskRows(currentSheet).map((task) => [taskKey(task), task] as const),
  );
  const changes: string[] = [];

  for (const [key, task] of current) {
    const oldTask = previous.get(key);
    if (!oldTask) {
      changes.push(`  + ${taskHeading(task)}`);
      continue;
    }

    const comparableFields: ReadonlyArray<
      readonly [label: string, field: ComparableTaskField]
    > = [
      ["週", "week"],
      ["機能ID", "featureId"],
      ["タスク名", "name"],
      ["やること", "description"],
      ["完了の定義", "doneDefinition"],
      ["依存", "dependencies"],
      ["想定工数", "estimatedHours"],
      ["担当者", "assignee"],
      ["ステータス", "status"],
      ["メモ", "memo"],
    ];
    const changedFields = comparableFields.filter(
      ([, field]) => (oldTask[field] ?? "") !== (task[field] ?? ""),
    );

    if (changedFields.length > 0) {
      changes.push(`  ~ ${taskHeading(task)}`);
      for (const [label, field] of changedFields) {
        changes.push(
          `    ${label}: ${oldTask[field] ?? "-"} -> ${task[field] ?? "-"}`,
        );
      }
    }
  }

  for (const [key, task] of previous) {
    if (!current.has(key)) changes.push(`  - ${taskHeading(task)}`);
  }

  return changes;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function readSnapshot(): Promise<Snapshot> {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as Snapshot;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(
        "スナップショットがありません。先に `pnpm tasks:sync` を実行してください。",
      );
    }
    throw error;
  }
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
}

async function sync(): Promise<void> {
  const sheets = await fetchWorkbook();
  const snapshot: Snapshot = {
    schemaVersion: 1,
    spreadsheetId: SPREADSHEET.id,
    spreadsheetTitle: SPREADSHEET.title,
    spreadsheetUrl: SPREADSHEET.url,
    syncedAt: new Date().toISOString(),
    sheets,
  };

  await atomicWrite(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  await atomicWrite(TASKS_PATH, renderTasks(snapshot));
  await atomicWrite(README_PATH, renderReadme(snapshot));

  const total = summarize(sheets).reduce(
    (sum, category) => sum + category.count,
    0,
  );
  console.log(`同期完了: ${sheets.length}タブ / ${total}タスク`);
  console.log(`出力: ${TASKS_PATH}`);
}

async function check(): Promise<void> {
  const previous = await readSnapshot();
  const currentSheets = await fetchWorkbook();
  const previousByKey = new Map<SheetKey, Sheet>(
    previous.sheets.map((sheet) => [sheet.key, sheet] as const),
  );
  const changed = currentSheets.filter(
    (sheet) => previousByKey.get(sheet.key)?.hash !== sheet.hash,
  );

  if (changed.length === 0) {
    console.log(`更新なし（保存済みスナップショット: ${previous.syncedAt}）`);
    return;
  }

  console.log(`更新あり: ${changed.length}タブ`);
  for (const sheet of changed) {
    console.log(`- ${sheet.title}`);
    const oldSheet = previousByKey.get(sheet.key);
    if (oldSheet && TASK_SHEET_KEYS.has(sheet.key)) {
      for (const line of describeTaskChanges(oldSheet, sheet))
        console.log(line);
    }
  }
  console.log("`pnpm tasks:sync` でローカルの一覧を更新してください。");
  process.exitCode = 1;
}

async function status(): Promise<void> {
  const snapshot = await readSnapshot();
  console.log(`保存済みスナップショット: ${snapshot.syncedAt}`);
  for (const category of summarize(snapshot.sheets)) {
    console.log(
      `${category.label}: ${category.count}件（未着手 ${category.statuses.未着手} / 進行中 ${category.statuses.進行中} / 完了 ${category.statuses.完了} / 見送り ${category.statuses.見送り}）`,
    );
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "status";
  if (command === "sync") return sync();
  if (command === "check") return check();
  if (command === "status") return status();

  console.error("使い方: node scripts/google-tasks.ts <sync|check|status>");
  process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
