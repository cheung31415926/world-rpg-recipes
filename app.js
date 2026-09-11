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
};

const state = { groups: [], items: new Map(), itemData: new Map(), itemIcons: new Map(), query: "", outputQuery: "", selected: null, mode: "all" };
const colors = ["#d9ae63", "#4eb8a8", "#bf7891", "#7fa8d4", "#c28d5f", "#9b91cf"];

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
      group.output.name, group.output.rawcode,
      ...group.recipes.flatMap((recipe) => recipe.ingredients.flatMap((item) => [item.name, item.rawcode])),
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
    ${group.recipes.length > 1 ? `<p class="alternative-label">配方 <span>${index + 1}</span> / ${group.recipes.length}</p>` : "<p class=\"alternative-label\">所需材料</p>"}
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
    </div>${itemData ? itemDataMarkup(itemData) : ""}${alternatives}<p class="recipe-source">配方记录 #${group.recipes[0].source_line}</p>
    ${state.selected ? itemNavigationMarkup() : ""}
  </article>`;
}

function itemDataMarkup(itemData) {
  const lines = itemData.description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const quality = lines.find((line) => /^\[.+\]$/.test(line));
  const category = lines.find((line) => /^-\s*.+\s*-$/.test(line));
  const details = lines.filter((line) => line !== quality && line !== category);
  return `<div class="item-data">
    ${quality || category ? `<div class="item-tags">${quality ? `<span>${escapeText(quality.slice(1, -1))}</span>` : ""}${category ? `<span>${escapeText(category.replace(/^-|-$|\s{2,}/g, "").trim())}</span>` : ""}</div>` : ""}
    ${details.length ? `<details open><summary>查看物品属性</summary><div class="item-description">${details.map((line) => `<p>${escapeText(line)}</p>`).join("")}</div></details>` : ""}
  </div>`;
}

function materialCardMarkup(item, itemData) {
  const color = colorFor(item.rawcode);
  return `<article class="recipe-card material-card" style="--card-color:${color}">
    <div class="card-top">${itemVisual(item)}
      <div><h3 class="output-name">${escapeText(item.name)}</h3><code class="rawcode">${escapeText(item.rawcode)}</code></div>
    </div>${itemData ? itemDataMarkup(itemData) : ""}
    <p class="recipe-source">此物品未收录为可制作成品</p>
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
  elements.resultsTitle.textContent = selectedItem ? selectedItem.name : state.query ? "搜索结果" : state.mode === "alternate" ? "多种合成路线" : state.mode === "materials" ? "复杂配方" : "全部配方";
  elements.resultsCount.textContent = selectedItem && !selectedGroup ? "基础材料" : `显示 ${groups.length} / ${state.groups.length} 件成品`;
  elements.grid.innerHTML = groups.length
    ? groups.map(recipeMarkup).join("")
    : selectedItem
      ? materialCardMarkup(selectedItem, state.itemData.get(selectedItem.rawcode))
      : "";
  elements.empty.hidden = groups.length !== 0 || Boolean(selectedItem);
  elements.activeFilter.hidden = !selectedItem;
  if (selectedItem) elements.activeFilterText.textContent = `正在浏览：${selectedItem.name}`;
  if (selectedItem && !selectedGroup) {
    elements.empty.querySelector("h3").textContent = "该物品暂无可合成配方";
    elements.empty.querySelector("p").textContent = "它是基础材料，或尚未收录为可制作成品。";
    elements.reset.textContent = "返回全部配方";
  } else {
    elements.empty.querySelector("h3").textContent = "没有找到匹配的配方";
    elements.empty.querySelector("p").textContent = "试试不同的物品名称、材料名称或物品代码。";
    elements.reset.textContent = "重置筛选";
  }
  elements.chips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.filter === state.mode));
}

function resetFilters() {
  state.query = ""; state.outputQuery = ""; state.selected = null; state.mode = "all";
  elements.search.value = ""; elements.outputFilter.value = "";
  clearItemHash();
  render();
}

async function initialize() {
  try {
    const [recipeResponse, itemResponse, iconResponse] = await Promise.all([fetch("./data.json"), fetch("./data.csv"), fetch("./item-icons.json")]);
    if (!recipeResponse.ok || !itemResponse.ok || !iconResponse.ok) throw new Error(`HTTP ${recipeResponse.status}/${itemResponse.status}/${iconResponse.status}`);
    const [data, itemCsv, iconPaths] = await Promise.all([recipeResponse.json(), itemResponse.text(), iconResponse.json()]);
    if (!Array.isArray(data.recipes)) throw new Error("Invalid recipe data");
    state.groups = buildGroups(data.recipes);
    state.items = buildItemIndex(data.recipes);
    state.itemData = buildItemData(parseCsv(itemCsv));
    state.itemIcons = new Map(Object.entries(iconPaths));
    const alternateCount = state.groups.filter((group) => group.recipes.length > 1).length;
    elements.footerStats.textContent = `${data.recipe_count} 条配方 · ${state.groups.length} 件成品 · ${alternateCount} 件替代路线 · ${state.itemData.size} 条物品资料 · ${state.itemIcons.size} 个图标`;
    selectFromHash();
  } catch (error) {
    console.error("Unable to load recipe data:", error);
    elements.resultsCount.textContent = "加载失败";
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
window.addEventListener("hashchange", selectFromHash);
initialize();
