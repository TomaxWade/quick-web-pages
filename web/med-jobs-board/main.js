const DATA_PATH = "./data/jobs.json";

const expandedDetailIds = new Set();
const viewState = {
  quickSearch: "",
  platform: "all",
  active: "all",
  from: "",
  to: "",
};

const elements = {
  quickSearch: document.getElementById("quick-search"),
  platformFilter: document.getElementById("platform-filter"),
  activeFilter: document.getElementById("active-filter"),
  dateFrom: document.getElementById("date-from"),
  dateTo: document.getElementById("date-to"),
  btnReload: document.getElementById("btn-reload"),
  btnReset: document.getElementById("btn-reset"),
  btnExportCsv: document.getElementById("btn-export-csv"),
  btnExportXlsx: document.getElementById("btn-export-xlsx"),
  totalCount: document.getElementById("total-count"),
  filteredCount: document.getElementById("filtered-count"),
  updatedAt: document.getElementById("updated-at"),
  tableRoot: document.getElementById("jobs-table"),
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const normalizeText = (value) => String(value ?? "").trim();

const normalizeRow = (row, index) => ({
  id: normalizeText(row.id) || `row-${index + 1}`,
  posted_date: normalizeText(row.posted_date) || "未知",
  is_active: normalizeText(row.is_active) || "未知",
  job_title: normalizeText(row.job_title) || "未命名岗位",
  job_detail: normalizeText(row.job_detail) || "暂无详情",
  company: normalizeText(row.company) || "未知公司",
  location: normalizeText(row.location) || "未知地区",
  role_type: normalizeText(row.role_type) || "待标注",
  platform: normalizeText(row.platform) || "未知平台",
  source_url: normalizeText(row.source_url),
  first_seen_date: normalizeText(row.first_seen_date),
  last_checked_at: normalizeText(row.last_checked_at),
});

const detailPreview = (text, maxLength = 120) => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
};

const createDetailFormatter = () => (cell) => {
  const row = cell.getRow().getData();
  const expanded = expandedDetailIds.has(row.id);
  const rawText = row.job_detail || "暂无详情";
  const viewText = expanded ? rawText : detailPreview(rawText, 120);

  return `<div class="detail-box" data-row-id="${escapeHtml(row.id)}">
      <div class="detail-text">${escapeHtml(viewText).replaceAll("\n", "<br>")}</div>
      <button class="detail-toggle" type="button">${expanded ? "收起" : "展开"}</button>
    </div>`;
};

const createSourceFormatter = () => (cell) => {
  const url = normalizeText(cell.getValue());
  if (!url) {
    return "-";
  }
  return `<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">查看原链接</a>`;
};

const table = new Tabulator(elements.tableRoot, {
  data: [],
  layout: "fitColumns",
  height: "72vh",
  pagination: true,
  paginationSize: 50,
  paginationSizeSelector: [20, 50, 100, 200],
  movableColumns: true,
  selectableRange: true,
  selectableRangeColumns: true,
  selectableRangeRows: true,
  selectableRangeClearCells: true,
  clipboard: true,
  clipboardCopyStyled: false,
  clipboardCopyRowRange: "range",
  placeholder: "暂无数据，等待 cron 首次写入...",
  columns: [
    { title: "上架日期", field: "posted_date", sorter: "string", width: 120, headerFilter: "input" },
    { title: "未下架", field: "is_active", sorter: "string", width: 96, headerFilter: "select", headerFilterParams: { values: { "": "全部", 是: "是", 否: "否", 未知: "未知" } } },
    { title: "岗位名称", field: "job_title", sorter: "string", widthGrow: 1.8, headerFilter: "input" },
    { title: "公司", field: "company", sorter: "string", widthGrow: 1.2, headerFilter: "input" },
    { title: "城市", field: "location", sorter: "string", width: 120, headerFilter: "input" },
    { title: "适配方向", field: "role_type", sorter: "string", width: 170, headerFilter: "input" },
    { title: "平台", field: "platform", sorter: "string", width: 120, headerFilter: "input" },
    { title: "岗位详情", field: "job_detail", formatter: createDetailFormatter(), headerSort: false, widthGrow: 3 },
    { title: "来源链接", field: "source_url", formatter: createSourceFormatter(), headerSort: false, width: 140 },
  ],
});

const updateCounters = () => {
  elements.totalCount.textContent = String(table.getDataCount("active") || 0);
  elements.filteredCount.textContent = String(table.getDataCount("visible") || 0);
};

const updatePlatformOptions = (rows) => {
  const platforms = Array.from(new Set(rows.map((item) => item.platform).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  elements.platformFilter.innerHTML = '<option value="all">全部</option>';
  for (const item of platforms) {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    elements.platformFilter.appendChild(option);
  }
};

const matchDateRange = (dateText) => {
  const value = normalizeText(dateText);
  if (!value || value === "未知") {
    return true;
  }
  if (viewState.from && value < viewState.from) {
    return false;
  }
  if (viewState.to && value > viewState.to) {
    return false;
  }
  return true;
};

const matchKeyword = (row) => {
  const keyword = viewState.quickSearch;
  if (!keyword) {
    return true;
  }
  const haystack = [
    row.job_title,
    row.job_detail,
    row.company,
    row.location,
    row.platform,
    row.role_type,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword);
};

const applyFilters = () => {
  table.setFilter((row) => {
    if (viewState.platform !== "all" && row.platform !== viewState.platform) {
      return false;
    }
    if (viewState.active !== "all" && row.is_active !== viewState.active) {
      return false;
    }
    if (!matchDateRange(row.posted_date)) {
      return false;
    }
    if (!matchKeyword(row)) {
      return false;
    }
    return true;
  });
  updateCounters();
};

const bindControlEvents = () => {
  elements.quickSearch.addEventListener("input", (event) => {
    viewState.quickSearch = normalizeText(event.target.value).toLowerCase();
    applyFilters();
  });

  elements.platformFilter.addEventListener("change", (event) => {
    viewState.platform = event.target.value;
    applyFilters();
  });

  elements.activeFilter.addEventListener("change", (event) => {
    viewState.active = event.target.value;
    applyFilters();
  });

  elements.dateFrom.addEventListener("change", (event) => {
    viewState.from = normalizeText(event.target.value);
    applyFilters();
  });

  elements.dateTo.addEventListener("change", (event) => {
    viewState.to = normalizeText(event.target.value);
    applyFilters();
  });

  elements.btnReset.addEventListener("click", () => {
    viewState.quickSearch = "";
    viewState.platform = "all";
    viewState.active = "all";
    viewState.from = "";
    viewState.to = "";

    elements.quickSearch.value = "";
    elements.platformFilter.value = "all";
    elements.activeFilter.value = "all";
    elements.dateFrom.value = "";
    elements.dateTo.value = "";

    table.clearHeaderFilter();
    table.clearFilter(true);
    applyFilters();
  });

  elements.btnExportCsv.addEventListener("click", () => {
    const fileName = `med-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    table.download("csv", fileName);
  });

  elements.btnExportXlsx.addEventListener("click", () => {
    const fileName = `med-jobs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    table.download("xlsx", fileName, { sheetName: "jobs" });
  });

  elements.btnReload.addEventListener("click", () => {
    void loadData();
  });

  elements.tableRoot.addEventListener("click", (event) => {
    const toggle = event.target.closest(".detail-toggle");
    if (!toggle) {
      return;
    }
    const rowContainer = toggle.closest(".detail-box");
    const rowId = rowContainer?.dataset?.rowId;
    if (!rowId) {
      return;
    }

    if (expandedDetailIds.has(rowId)) {
      expandedDetailIds.delete(rowId);
    } else {
      expandedDetailIds.add(rowId);
    }

    table.redraw(true);
  });
};

const loadData = async () => {
  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload)
      ? payload.map((item, index) => normalizeRow(item, index))
      : [];

    updatePlatformOptions(rows);
    await table.replaceData(rows);
    applyFilters();

    const latest = rows
      .map((item) => item.last_checked_at || item.first_seen_date || item.posted_date)
      .filter(Boolean)
      .sort()
      .at(-1);
    elements.updatedAt.textContent = latest || new Date().toISOString();
  } catch (error) {
    console.error("加载岗位数据失败", error);
    await table.replaceData([]);
    elements.updatedAt.textContent = `加载失败：${error.message}`;
    updateCounters();
  }
};

table.on("dataFiltered", updateCounters);
table.on("dataLoaded", updateCounters);

bindControlEvents();
void loadData();
