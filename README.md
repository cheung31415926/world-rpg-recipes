# World RPG 配方典藏

一个零依赖的静态配方浏览站点。页面直接读取根目录的 `data.json`、`data.csv` 和 `item-icons.json`：前者用于合成路线，后两者用于展示物品品质、类别、属性说明和图标。按可制作物品聚合配方，并将同一成品的多条记录展示为替代合成路线；原始数据不会被修改。

仓库同时保留用于复现数据与图标的 `data/`、`txt/`、提取脚本和 `generate_item_icons.py`。大型地图二进制及可重新生成的转换中间文件不会提交。

## 本地运行

由于浏览器安全策略，不能直接双击 `index.html` 打开；请在此目录启动一个 HTTP 服务器：

```powershell
python -m http.server 8000
```

随后访问 <http://localhost:8000>。若系统没有 Python，也可使用任意静态文件服务器（例如 VS Code 的 Live Server 扩展）。

## 部署

将 `index.html`、`styles.css`、`app.js`、`data.json`、`data.csv`、`item-icons.json` 与整个 `assets/items/` 目录保持在同一目录结构后，上传到任意静态托管服务即可。无需安装依赖或执行构建步骤。

## 更新图标

`assets/items/` 与 `item-icons.json` 是从地图提取物生成的静态 PNG 网站资源。地图物品图标变更时，在安装 Pillow 的 Python 环境中执行：

```powershell
python generate_item_icons.py "C:\Users\Cheung\Documents\Warcraft III\Maps\Download\000世界RPGv0.92c0.1"
```

## 功能

- 搜索成品、材料名称和物品代码
- 从“装备目录”按成品浏览并二次筛选
- 每个成品与材料都可点击并跳转至其可分享的物品链接；基础材料会显示暂无合成配方
- 非主頁的物品详情卡提供浏览器式的“上一个物品”、“回主頁”和“下一个物品”导航
- 展示材料数量，以及同一成品的替代合成路线
- 提供多路线、三种及以上材料的快速筛选
- 响应式双栏/移动端布局，以及搜索无结果与数据加载失败提示
