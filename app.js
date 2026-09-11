const elements = {
  search: document.querySelector("#search-input"),
  clearSearch: document.querySelector("#clear-search"),
  outputFilter: document.querySelector("#output-filter"),
  outputList: document.querySelector("#output-list"),
  outputCount: document.querySelector("#output-count"),
  resultsTitle: document.querySelector("#results-title"),
  resultsCount: document.querySelector("#results-count"),
  grid: document.querySelector("#recipe-grid"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  activeFilter: document.querySelector("#active-filter"),
  activeFilterText: document.querySelector("#active-filter span"),
  reset: document.querySelector("#reset-filters"),
  footerStats: document.querySelector("#footer-stats"),
  chips: [...document.querySelectorAll(".filter-chip")],
  localeButtons: [...document.querySelectorAll(".language-button")],
};

const state = { groups: [], items: new Map(), itemData: new Map(), itemIcons: new Map(), dropSources: new Map(), locale: "traditional", query: "", outputQuery: "", selected: null, mode: "all" };
const colors = ["#d9ae63", "#4eb8a8", "#bf7891", "#7fa8d4", "#c28d5f", "#9b91cf"];
const localeFiles = {
  traditional: { recipes: "./data-traditional.json", items: "./data-traditional.csv", language: "zh-Hant" },
  simplified: { recipes: "./data.json", items: "./data.csv", language: "zh-Hans" },
};
const translations = {
  traditional: {
    brandLabel: "返回配方典藏首頁", headerNote: "探索每一件裝備的鍛造之路", languageLabel: "語言切換",
    eyebrow: "冒險者工坊", pageTitle: "配方典藏", heroCopy: "從材料到傳說裝備，快速查找你需要的合成路線。",
    searchPlaceholder: "搜尋裝備、材料或物品代碼…", clearSearch: "清除搜尋", quickFilters: "快速篩選",
    allRecipes: "全部配方", alternateRecipes: "多種配方", threeMaterials: "三種材料", browseByOutput: "按成品瀏覽",
    equipmentCatalog: "裝備目錄", outputPlaceholder: "篩選成品…", outputListLabel: "可製作物品列表",
    craftingRecipes: "鍛造配方", viewAll: "查看全部", noRecipes: "沒有找到匹配的配方",
    noRecipesHelp: "試試不同的物品名稱、材料名稱或物品代碼。", resetFilters: "重置篩選",
    loadError: "配方資料無法載入", loadErrorHelp: "請透過本地伺服器開啟網站，而不是直接雙擊 HTML 文件。",
    footerTitle: "WORLD RPG · 配方資料庫", loadingRecipes: "讀取配方中…", searchResults: "搜尋結果",
    complexRecipes: "複雜配方", showing: "顯示", outputs: "件成品", baseMaterial: "基礎材料",
    browsing: "正在瀏覽：", recipe: "配方", requiredMaterials: "所需材料", record: "配方記錄",
    materialNotCraftable: "此物品未收錄為可製作成品", itemDetails: "物品屬性",
    stats: "條配方 · {outputs} 件成品 · {alternates} 件替代路線 · {items} 條物品資料 · {icons} 個圖標",
  },
  simplified: {
    brandLabel: "返回配方典藏首页", headerNote: "探索每一件装备的锻造之路", languageLabel: "语言切换",
    eyebrow: "冒险者工坊", pageTitle: "配方典藏", heroCopy: "从材料到传说装备，快速查找你需要的合成路线。",
    searchPlaceholder: "搜索装备、材料或物品代码…", clearSearch: "清除搜索", quickFilters: "快速筛选",
    allRecipes: "全部配方", alternateRecipes: "多种配方", threeMaterials: "三种材料", browseByOutput: "按成品浏览",
    equipmentCatalog: "装备目录", outputPlaceholder: "筛选成品…", outputListLabel: "可制作物品列表",
    craftingRecipes: "锻造配方", viewAll: "查看全部", noRecipes: "没有找到匹配的配方",
    noRecipesHelp: "试试不同的物品名称、材料名称或物品代码。", resetFilters: "重置筛选",
    loadError: "配方数据无法加载", loadErrorHelp: "请通过本地服务器打开网站，而不是直接双击 HTML 文件。",
    footerTitle: "WORLD RPG · 配方数据库", loadingRecipes: "读取配方中…", searchResults: "搜索结果",
    complexRecipes: "复杂配方", showing: "显示", outputs: "件成品", baseMaterial: "基础材料",
    browsing: "正在浏览：", recipe: "配方", requiredMaterials: "所需材料", record: "配方记录",
    materialNotCraftable: "此物品未收录为可制作成品", itemDetails: "物品属性",
    stats: "条配方 · {outputs} 件成品 · {alternates} 件替代路线 · {items} 条物品资料 · {icons} 个图标",
  },
};

function text(key, values = {}) {
  return translations[state.locale][key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

function applyTranslations() {
  document.documentElement.lang = localeFiles[state.locale].language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = text(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = text(element.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => { element.setAttribute("aria-label", text(element.dataset.i18nAriaLabel)); });
  elements.localeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.locale === state.locale);
    button.textContent = button.dataset.locale === "traditional" ? "繁體" : "简体";
  });
}

function escapeText(value) {
  const node = document.createElement("span");
  node.textContent = value ?? "";
  return node.innerHTML;
}

function colorFor(rawcode) {
  let hash = 0;
  for (const character of rawcode) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

function normalize(value) {
  return String(value ?? "").toLocaleLowerCase();
}

function buildGroups(recipes) {
  const grouped = new Map();
  for (const recipe of recipes) {
    const key = recipe.output.rawcode;
    if (!grouped.has(key)) grouped.set(key, { output: recipe.output, recipes: [] });
    grouped.get(key).recipes.push(recipe);
  }
  return [...grouped.values()].sort((a, b) => a.output.name.localeCompare(b.output.name, "zh-Hans-CN"));
}

function buildItemIndex(recipes) {
  const items = new Map();
  for (const recipe of recipes) {
    items.set(recipe.output.rawcode, recipe.output);
    for (const item of recipe.ingredients) items.set(item.rawcode, item);
  }
  return items;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      row.push(value); value = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ""));
  return rows.filter((values) => values.length === headers.length).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]]))
  );
}

function buildItemData(rows) {
  return new Map(rows.filter((row) => row.key).map((row) => [row.key, row]));
}

function itemHref(rawcode) {
  return `#item=${encodeURIComponent(rawcode)}`;
}

function itemVisual(item, compact = false) {
  const icon = state.itemIcons.get(item.rawcode);
  const image = icon ? `<img class="${compact ? "ingredient-image" : "item-image"}" src="${icon}" alt="" loading="lazy" />` : "";
  return compact ? image : `<span class="item-emblem">${escapeText(item.name.slice(0, 1))}${image}</span>`;
}

function readItemFromHash() {
  const match = window.location.hash.match(/^#item=(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function clearItemHash() {
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

function selectFromHash() {
  state.selected = readItemFromHash();
  state.query = "";
  state.mode = "all";
  elements.search.value = "";
  render();
}

function matchingGroups() {
  const query = normalize(state.query).trim();
  return state.groups.filter((group) => {
    const matchText = [
      ...itemSearchText(group.output),
      ...group.recipes.flatMap((recipe) => recipe.ingredients.flatMap(itemSearchText)),
    ].join(" ");
    const searchMatches = !query || normalize(matchText).includes(query);
    const selectedMatches = !state.selected || group.output.rawcode === state.selected;
    const modeMatches =
      state.mode === "all" ||
      (state.mode === "alternate" && group.recipes.length > 1) ||
      (state.mode === "materials" && group.recipes.some((recipe) => recipe.ingredients.length >= 3));
    return searchMatches && selectedMatches && modeMatches;
  });
}

function itemSearchText(item) {
  const itemData = state.itemData.get(item.rawcode);
  return [item.name, item.rawcode, itemData?.name, itemData?.description];
}

function renderOutputList() {
  const query = normalize(state.outputQuery).trim();
  const visible = state.groups.filter((group) =>
    !query || normalize(`${group.output.name} ${group.output.rawcode}`).includes(query)
  );
  elements.outputCount.textContent = `${state.groups.length} 件`;
  elements.outputList.innerHTML = visible.map((group) => `
    <a class="output-item ${state.selected === group.output.rawcode ? "is-active" : ""}" href="${itemHref(group.output.rawcode)}">
      <i class="item-dot"></i><span>${escapeText(group.output.name)}</span>
      ${group.recipes.length > 1 ? `<small class="alt-count">${group.recipes.length}</small>` : ""}
    </a>`).join("");
}

function recipeMarkup(group) {
  const output = group.output;
  const color = colorFor(output.rawcode);
  const itemData = state.itemData.get(output.rawcode);
  const alternatives = group.recipes.map((recipe, index) => `
    ${group.recipes.length > 1 ? `<p class="alternative-label">${text("recipe")} <span>${index + 1}</span> / ${group.recipes.length}</p>` : `<p class="alternative-label">${text("requiredMaterials")}</p>`}
    <div class="ingredients">${recipe.ingredients.map((item) => `
      <a class="ingredient" href="${itemHref(item.rawcode)}" title="查看 ${escapeText(item.name)}">
        ${itemVisual(item, true)}
        <span class="ingredient-name">${escapeText(item.name)}</span>${item.quantity > 1 ? `<b class="quantity">×${item.quantity}</b>` : ""}
      </a>
    `).join("")}</div>
  `).join('<div class="recipe-divider"></div>');
  return `<article class="recipe-card" style="--card-color:${color}">
    <div class="card-top">${itemVisual(output)}
      <div><h3 class="output-name"><a href="${itemHref(output.rawcode)}">${escapeText(output.name)}</a></h3><code class="rawcode">${escapeText(output.rawcode)}</code></div>
    </div>${itemData ? itemDataMarkup(itemData, output.rawcode) : dropSourceMarkup(output.rawcode)}${alternatives}<p class="recipe-source">${text("record")} #${group.recipes[0].source_line}</p>
    ${state.selected ? itemNavigationMarkup() : ""}
  </article>`;
}

function itemDataMarkup(itemData, rawcode) {
  const lines = itemData.description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const quality = lines.find((line) => /^\[.+\]$/.test(line));
  const category = lines.find((line) => /^-\s*.+\s*-$/.test(line));
  const details = lines.filter((line) => line !== quality && line !== category);
  return `<div class="item-data">
    ${quality || category ? `<div class="item-tags">${quality ? `<span>${escapeText(quality.slice(1, -1))}</span>` : ""}${category ? `<span>${escapeText(category.replace(/^-|-$|\s{2,}/g, "").trim())}</span>` : ""}</div>` : ""}
    ${details.length ? `<div class="item-description" aria-label="${text("itemDetails")}">${details.map((line) => `<p>${escapeText(line)}</p>`).join("")}</div>` : ""}
  </div>${dropSourceMarkup(rawcode)}`;
}

function dropSourceMarkup(rawcode) {
  const drop = state.dropSources.get(rawcode);
  if (!drop) return "";
  return `<div class="drop-sources"><strong>掉落來源</strong><span>${drop.status === "unknown" ? "未確認（動態掉落系統）" : "無掉落資料"}</span></div>`;
}

function materialCardMarkup(item, itemData) {
  const color = colorFor(item.rawcode);
  return `<article class="recipe-card material-card" style="--card-color:${color}">
    <div class="card-top">${itemVisual(item)}
      <div><h3 class="output-name">${escapeText(item.name)}</h3><code class="rawcode">${escapeText(item.rawcode)}</code></div>
    </div>${itemData ? itemDataMarkup(itemData, item.rawcode) : dropSourceMarkup(item.rawcode)}
    <p class="recipe-source">${text("materialNotCraftable")}</p>
    ${itemNavigationMarkup()}
  </article>`;
}

function itemNavigationMarkup() {
  return `<nav class="item-navigation" aria-label="物品浏览导航">
    <button type="button" data-history-back>← 上一个物品</button>
    <button type="button" data-home>⌂ 回主頁</button>
    <button type="button" data-history-forward>下一个物品 →</button>
  </nav>`;
}

function render() {
  const groups = matchingGroups();
  const selectedGroup = state.groups.find((group) => group.output.rawcode === state.selected);
  const selectedItem = state.items.get(state.selected);
  renderOutputList();
  elements.resultsTitle.textContent = selectedItem ? selectedItem.name : state.query ? text("searchResults") : state.mode === "alternate" ? text("alternateRecipes") : state.mode === "materials" ? text("complexRecipes") : text("allRecipes");
  elements.resultsCount.textContent = selectedItem && !selectedGroup ? text("baseMaterial") : `${text("showing")} ${groups.length} / ${state.groups.length} ${text("outputs")}`;
  elements.grid.innerHTML = groups.length
    ? groups.map(recipeMarkup).join("")
    : selectedItem
      ? materialCardMarkup(selectedItem, state.itemData.get(selectedItem.rawcode))
      : "";
  elements.empty.hidden = groups.length !== 0 || Boolean(selectedItem);
  elements.activeFilter.hidden = !selectedItem;
  if (selectedItem) elements.activeFilterText.textContent = `${text("browsing")}${selectedItem.name}`;
  if (selectedItem && !selectedGroup) {
    elements.empty.querySelector("h3").textContent = text("baseMaterial");
    elements.empty.querySelector("p").textContent = text("materialNotCraftable");
    elements.reset.textContent = text("allRecipes");
  } else {
    elements.empty.querySelector("h3").textContent = text("noRecipes");
    elements.empty.querySelector("p").textContent = text("noRecipesHelp");
    elements.reset.textContent = text("resetFilters");
  }
  elements.chips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.filter === state.mode));
}

function resetFilters() {
  state.query = ""; state.outputQuery = ""; state.selected = null; state.mode = "all";
  elements.search.value = ""; elements.outputFilter.value = "";
  clearItemHash();
  render();
}

async function loadLocale(locale) {
  state.locale = locale;
  state.query = ""; state.outputQuery = "";
  elements.search.value = ""; elements.outputFilter.value = "";
  applyTranslations();
  try {
    const files = localeFiles[locale];
    const [recipeResponse, itemResponse, iconResponse] = await Promise.all([fetch(files.recipes), fetch(files.items), fetch("./item-icons.json")]);
    if (!recipeResponse.ok || !itemResponse.ok || !iconResponse.ok) throw new Error(`HTTP ${recipeResponse.status}/${itemResponse.status}/${iconResponse.status}`);
    const [data, itemCsv, iconPaths] = await Promise.all([recipeResponse.json(), itemResponse.text(), iconResponse.json()]);
    if (!Array.isArray(data.recipes)) throw new Error("Invalid recipe data");
    state.groups = buildGroups(data.recipes);
    state.items = buildItemIndex(data.recipes);
    state.itemData = buildItemData(parseCsv(itemCsv));
    state.itemIcons = new Map(Object.entries(iconPaths));
    state.dropSources = new Map(Object.entries(data.item_drop_sources || {}));
    const alternateCount = state.groups.filter((group) => group.recipes.length > 1).length;
    elements.footerStats.textContent = `${data.recipe_count} ${text("stats", { outputs: state.groups.length, alternates: alternateCount, items: state.itemData.size, icons: state.itemIcons.size })}`;
    selectFromHash();
  } catch (error) {
    console.error("Unable to load recipe data:", error);
    elements.resultsCount.textContent = text("loadError");
    elements.error.hidden = false;
  }
}

elements.search.addEventListener("input", (event) => { state.query = event.target.value; render(); });
elements.outputFilter.addEventListener("input", (event) => { state.outputQuery = event.target.value; renderOutputList(); });
elements.clearSearch.addEventListener("click", () => { state.query = ""; elements.search.value = ""; render(); elements.search.focus(); });
elements.reset.addEventListener("click", resetFilters);
elements.activeFilter.querySelector("button").addEventListener("click", resetFilters);
elements.grid.addEventListener("click", (event) => {
  if (event.target.closest("[data-history-back]")) window.history.back();
  if (event.target.closest("[data-home]")) resetFilters();
  if (event.target.closest("[data-history-forward]")) window.history.forward();
});
elements.chips.forEach((chip) => chip.addEventListener("click", () => { state.mode = chip.dataset.filter; render(); }));
elements.localeButtons.forEach((button) => button.addEventListener("click", () => loadLocale(button.dataset.locale)));
window.addEventListener("hashchange", selectFromHash);
loadLocale("traditional");
