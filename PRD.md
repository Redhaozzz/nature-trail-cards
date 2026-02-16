# 自然探索卡片 Web App — PRD

## 产品概述
一个帮助家长在徒步前"备课"的 Web App。家长选择步道 → 查看当地常见物种 → 挑选感兴趣的 → 生成适合3岁孩子的亲子知识卡片 → 导出为图片/PDF打印。

## 技术栈
- **框架**: Next.js 14+ (App Router, TypeScript)
- **样式**: Tailwind CSS
- **地图**: Mapbox GL JS（免费额度足够MVP）或 react-map-gl
- **数据源**: iNaturalist API v1（免费，无需key）
- **LLM**: OpenAI API (gpt-4o-mini，便宜够用)
- **图片导出**: html-to-image 库
- **包管理**: pnpm

## 用户流程

### Step 1: 选择地点
- 打开App，看到一个地图（默认定位到用户位置，fallback到Coquitlam）
- 地图上方有搜索框，可以输入步道名/公园名
- 用户点击地图某处 或 搜索选择一个地点
- 选中后显示地点名称，进入下一步

### Step 2: 浏览物种列表
- 调用 iNaturalist API：`/v1/observations/species_counts?lat=X&lng=Y&radius=5&quality_grade=research&month=当前月份&per_page=50`
- 展示物种网格/列表：
  - 每个物种卡片：照片缩略图 + 中英文名 + 类别图标（🐦🌿🐿️🦎🐛） + 观测次数
  - 可以按类别筛选（全部/鸟类/哺乳/植物/昆虫/其他）
- 用户勾选想要的物种（建议5-12个）
- 底部浮动栏显示"已选X个，生成卡片"按钮

### Step 3: 生成卡片
- 点击"生成卡片"后：
  - 对每个选中的物种，调用 LLM 生成中文亲子知识卡内容
  - Prompt 模板（参考）：
    ```
    你是一个儿童自然教育专家。请为以下物种生成一张适合3岁中国孩子的亲子知识卡片。
    
    物种：{common_name} ({scientific_name})
    类别：{iconic_taxon_name}
    Wikipedia简介：{wikipedia_summary}
    地点：{place_name}
    月份：{current_month}月
    
    请按以下格式输出（中文）：
    1. 怎么认出它：用孩子能懂的视觉特征描述，2-3句话
    2. 有趣的秘密：这个物种最独特/有趣的习性，用生动有画面感的方式描述，3-4句话
    3. 跟宝宝说：家长可以直接对孩子说的一段话，自然口语，1-2句话，包含一个互动引导（比如"看看能不能找到""我们来比赛"）
    
    要求：语气温暖有趣，多用拟人化和比喻，适合3岁理解力。
    ```
  - 显示生成进度（逐张出现）

### Step 4: 预览和导出
- 卡片以上下滚动的方式展示（类似示例 sample-cards.html 的设计）
- 每张卡片：大照片 + 物种名 + 学名 + 三段内容 + 地点/月份标注
- 顶部操作栏：
  - "保存为图片"：每张卡片单独导出为 PNG（保存到手机相册）
  - "保存全部为PDF"：所有卡片合成一个 PDF 下载（方便打印）
  - "重新选择"：返回物种列表

## 卡片视觉设计
参考 `../sample-cards.html` 的设计：
- 白色卡片 + 圆角 + 柔和阴影
- 顶部大照片（来自 iNaturalist）
- 三段内容用彩色标签区分（绿色=怎么认、橙色=有趣秘密、粉色=跟宝宝说）
- 底部标注地点+观测频次
- 适配手机屏幕宽度（卡片宽度100%，最大400px）

## API 接口

### iNaturalist（无需key）
- 物种列表：`GET https://api.inaturalist.org/v1/observations/species_counts?lat={}&lng={}&radius=5&quality_grade=research&month={}&per_page=50`
- 物种详情（含Wikipedia）：`GET https://api.inaturalist.org/v1/taxa/{taxon_id}`
- 照片：直接用返回的 `taxon.default_photo.medium_url` 或 `large_url`

### OpenAI
- 用 gpt-4o-mini 生成卡片文案
- API key 通过环境变量 OPENAI_API_KEY

## 页面结构
- 单页应用，4个状态切换：
  1. 选地点（地图+搜索）
  2. 选物种（网格+筛选）
  3. 生成中（loading）
  4. 预览+导出（卡片列表）

## MVP 不做
- 用户账号/登录
- 历史记录保存
- 多语言（只做中文）
- 步道详情/路线显示
- eBird API 集成（后续）
- 离线支持

## 环境变量
```
NEXT_PUBLIC_MAPBOX_TOKEN=xxx
OPENAI_API_KEY=xxx
```

## 部署
- Vercel（azplaylab.com 域名下）
