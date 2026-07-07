# Agnes Creator API 文档

## 目录

- [1. 模型说明](#1-模型说明)
- [2. 服务器配置](#2-服务器配置)
- [3. REST API 端点](#3-rest-api-端点)
  - [3.1 配置](#31-配置)
  - [3.2 文生图](#32-文生图)
  - [3.3 图生图](#33-图生图)
  - [3.4 文生视频](#34-文生视频)
  - [3.5 图生视频](#35-图生视频)
  - [3.6 多图视频 / 关键帧](#36-多图视频--关键帧)
  - [3.7 批量文生图](#37-批量文生图)
  - [3.8 历史记录](#38-历史记录)
  - [3.9 健康检查](#39-健康检查)
- [4. 上游 AI API 调用模式](#4-上游-ai-api-调用模式)
- [5. Prompt 工程](#5-prompt-工程)
  - [5.1 图片维度](#51-图片维度)
  - [5.2 视频维度](#52-视频维度)
- [6. 前端集成规范](#6-前端集成规范)
- [7. 错误处理](#7-错误处理)
- [8. 附录：GraphQL 备用端点](#8-附录graphql-备用端点)

---

## 1. 模型说明

| 模型 | 用途 | 来源 |
|------|------|------|
| `agnes-image-2.1-flash` | 文生图、图生图 | `config.py:T2I_MODEL` / `IMG2IMG_MODEL` |
| `agnes-video-v2.0` | 文生视频、图生视频、多图视频、关键帧 | `config.py:VIDEO_MODEL` |

模型在 `config.py` 中定义，可通过 API Key 的 Base URL 切换不同端点。

## 2. 服务器配置

### 本地启动

```bash
# 1. 启动 Python API 服务器（端口 8765）
cd webui && python3 server.py
# 或
cd webui && uv run python server.py

# 2. 启动 React 开发服务器（端口 5173，自动代理 API 请求）
cd webui && pnpm dev
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGNES_API_PORT` | `8765` | API 服务器端口 |
| `AGNES_API_KEY` | — | API Key（也可在运行时配置） |

### 代理配置（Vite）

开发模式下 `/agnes-api/*` 请求被 Vite 代理到 `http://localhost:8765`，见 `vite.config.ts`。

生产部署时需配置反向代理将 `/agnes-api/*` 指向 FastAPI 服务器。

---

## 3. REST API 端点

> 所有端点都以 `/agnes-api/` 为前缀。
> 请求 Content-Type：`application/json`（普通请求）或 `multipart/form-data`（文件上传）。

### 3.1 配置

#### `GET /agnes-api/config/options`

获取所有可选的配置选项（尺寸、比例、维度等）。

**响应示例：**

```json
{
  "imageSizeOptions": ["1024x1024", "1024x1792", "1792x1024"],
  "videoRatioOptions": ["16:9", "9:16", "1:1", "4:3", "3:4"],
  "videoDurationChoices": [3, 5, 8, 10, 15, 18],
  "videoFrameRateChoices": [12, 24, 30, 60],
  "videoModeOptions": ["ti2vid", "keyframes"],
  "videoResolutionChoices": ["480p", "720p", "1080p"],
  "imageDimensions": [{ "key": "subject", "label": "🧑 主体", "options": [["不指定", ""], ...] }],
  "videoDimensions": [{ "key": "subject_tracking", "label": "🎯 主体跟踪", "options": [...] }],
  "imagePanels": [{ "title": "...", "keys": ["subject", "scene", ...] }],
  "videoPanels": [{ "title": "...", "keys": ["subject_tracking", ...] }],
  "imageDimKeys": ["subject", "scene", "style", "camera", ...],
  "videoDimKeys": ["subject_tracking", "scene_dynamics", ...]
}
```

#### `POST /agnes-api/config/save`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | API Key |
| `image_base_url` | string | 否 | 图片 API Base URL，默认 `https://apihub.agnes-ai.com/v1` |
| `image_model` | string | 否 | 图片模型 |
| `video_base_url` | string | 否 | 视频 API Base URL |
| `video_model` | string | 否 | 视频模型 |

**响应：** `{ "status": "ok", "message": "配置已保存" }`

#### `GET /agnes-api/config/load`

加载已保存的配置。响应与 `save` 请求体结构相同。

---

### 3.2 文生图

#### `POST /agnes-api/text2image`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | API Key |
| `base_url` | string | 否 | Base URL，默认 `https://apihub.agnes-ai.com/v1` |
| `prompt` | string | 是 | 提示词 |
| `negative_prompt` | string | 否 | 负面提示词 |
| `size` | string | 否 | 尺寸，默认 `1024x1024`，支持 `1024x1792`、`1792x1024` |
| `n` | int | 否 | 生成数量，1-4 |
| `dim_values` | string[] | 否 | 维度配置值数组，顺序对应 `imageDimKeys` |

**响应：**

```json
{
  "images": ["/outputs/agnes_20260705_120000_123456.png", ...],
  "source_urls": ["https://..."],
  "message": "生成成功！共 1 张图片"
}
```

> `images` 返回的是本地文件路径，`source_urls` 是原始 AI API 返回的 CDN URL。

**curl 示例：**

```bash
curl -X POST http://localhost:8765/agnes-api/text2image \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "prompt": "一只可爱的橘猫坐在窗台上，阳光明媚",
    "negative_prompt": "模糊、低质量",
    "size": "1024x1024",
    "n": 1,
    "dim_values": ["", "", "电影感，电影级画面", "", "", "", "", "", "", "", "4K超高清", ""]
  }'
```

> `dim_values` 可选，每个元素对应 `imageDimKeys` 中的一个维度。值为 `""` 表示不指定，传递非空字符串会作为 prompt 片段拼接到最终 prompt 中。详见 [Prompt 工程](#5-prompt-工程)。

---

### 3.3 图生图

#### `POST /agnes-api/image2image/upload`

**Content-Type:** `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | API Key |
| `base_url` | string | 否 | Base URL |
| `model` | string | 否 | 模型名 |
| `prompt` | string | 是 | 风格描述 |
| `negative_prompt` | string | 否 | 负面提示词 |
| `size` | string | 否 | 尺寸 |
| `strength` | float | 否 | 重绘强度，0.1-1.0，默认 0.7 |
| `dim_values` | string | 否 | JSON 字符串，如 `["","","",""]` |
| `file` | File | 是 | 参考图片文件 |

**响应：** 同文生图，`{ images: string[], message: string }`

**curl 示例：**

```bash
curl -X POST http://localhost:8765/agnes-api/image2image/upload \
  -F "api_key=your-api-key" \
  -F "prompt=油画风格，印象派，温暖色调" \
  -F "size=1024x1024" \
  -F "strength=0.7" \
  -F "dim_values=[]" \
  -F "file=@/path/to/reference.png"
```

> 上传的图片会在服务端转为 base64 后以 `data:image/png;base64,...` 格式发送给上游 AI API。

---

### 3.4 文生视频

#### `POST /agnes-api/text2video`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | API Key |
| `base_url` | string | 否 | Base URL |
| `prompt` | string | 是 | 视频描述 |
| `negative_prompt` | string | 否 | 负面提示词 |
| `ratio` | string | 否 | 画面比例，默认 `16:9` |
| `resolution_preset` | string | 否 | 分辨率档位，`480p`/`720p`/`1080p`，默认 `720p` |
| `width` | int | 否 | 自定义宽度（设置后将忽略 resolution_preset） |
| `height` | int | 否 | 自定义高度 |
| `duration` | int | 否 | 时长（秒），可选 `[3, 5, 8, 10, 15, 18]`，默认 `5` |
| `frame_rate` | int | 否 | 帧率，可选 `[12, 24, 30, 60]`，默认 `24` |
| `num_frames` | int | 否 | 自定义总帧数（覆盖 duration 计算，需满足 `8n+1` ≤ 最大帧数） |
| `seed` | int | 否 | 随机种子 |
| `steps` | int | 否 | 推理步数，10-100，默认 50 |
| `dim_values` | string[] | 否 | 视频维度值数组，顺序对应 `videoDimKeys` |

**响应：**

```json
{
  "video": "/outputs/agnes_video_20260705_120000_123456.mp4",
  "message": "生成成功！时长: 5秒"
}
```

**帧数计算规则（`api_client.py`）：**
- 默认按 `duration × frame_rate` 计算目标帧数，取最近的 `8n+1` 值
- 各分辨率最大帧数：1080p = 169, 720p = 409, 480p = 961
- 视频生成采用**提交任务 + 轮询模式**，后端最长等待 30 分钟

**curl 示例：**

```bash
curl -X POST http://localhost:8765/agnes-api/text2video \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "prompt": "夕阳下的海浪拍打礁石，镜头缓慢推近",
    "negative_prompt": "模糊、抖动",
    "ratio": "16:9",
    "resolution_preset": "720p",
    "duration": 5,
    "frame_rate": 24,
    "steps": 50,
    "dim_values": ["", "", "", "镜头缓慢推近", "", "", "", "", "", "", "", ""]
  }'
```

---

### 3.5 图生视频

#### `POST /agnes-api/image2video/with_image`

**Content-Type:** `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | API Key |
| `base_url` | string | 否 | Base URL |
| `prompt` | string | 是 | 视频描述 |
| `negative_prompt` | string | 否 | 负面提示词 |
| `image_url` | string | 否 | 图片 URL（优先使用） |
| `file` | File | 否 | 本地图片文件（image_url 为空时使用） |
| `resolution_preset` | string | 否 | 分辨率，默认 `720p` |
| `ratio` | string | 否 | 比例，默认 `16:9` |
| `width` / `height` | int | 否 | 自定义宽高 |
| `duration` | int | 否 | 时长，默认 `5` |
| `frame_rate` | int | 否 | 帧率，默认 `24` |
| `num_frames` | int | 否 | 自定义帧数 |
| `seed` | int | 否 | 随机种子 |
| `steps` | int | 否 | 推理步数 |
| `dim_values` | string | 否 | JSON 字符串，视频维度值数组 |

**curl 示例（使用图片 URL）：**

```bash
curl -X POST http://localhost:8765/agnes-api/image2video/with_image \
  -F "api_key=your-api-key" \
  -F "prompt=人物缓慢转身，头发随风飘动" \
  -F "image_url=https://example.com/reference.png" \
  -F "ratio=16:9" \
  -F "duration=5" \
  -F "frame_rate=24" \
  -F "dim_values=[]"
```

**curl 示例（上传本地图片）：**

```bash
curl -X POST http://localhost:8765/agnes-api/image2video/with_image \
  -F "api_key=your-api-key" \
  -F "prompt=人物缓慢转身，头发随风飘动" \
  -F "file=@/path/to/image.png" \
  -F "ratio=16:9" \
  -F "duration=5" \
  -F "frame_rate=24"
```

> 上传的图片会在服务端转为 `data:` URI（最大 1MB，超过会告警）。
> 优先使用 `image_url` 参数（公网 URL）。不提供 `image_url` 时才使用上传的 `file`。

---

### 3.6 多图视频 / 关键帧

#### `POST /agnes-api/multi_image_video`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | API Key |
| `base_url` | string | 否 | Base URL |
| `prompt` | string | 是 | 视频描述 |
| `negative_prompt` | string | 否 | 负面提示词 |
| `image_urls` | string[] | 是 | 图片 URL 列表（支持 data URI） |
| `mode` | string | 否 | 模式：`ti2vid`（默认，单图/文生视频）或 `keyframes`（关键帧动画） |
| `ratio` | string | 否 | 画面比例 |
| `resolution_preset` | string | 否 | 分辨率 |
| `width` / `height` | int | 否 | 自定义宽高 |
| `duration` | int | 否 | 时长 |
| `frame_rate` | int | 否 | 帧率 |
| `num_frames` | int | 否 | 自定义帧数 |
| `seed` | int | 否 | 随机种子 |
| `steps` | int | 否 | 推理步数 |
| `dim_values` | string[] | 否 | 视频维度值数组 |

**curl 示例（ti2vid 模式，1 张图）：**

```bash
curl -X POST http://localhost:8765/agnes-api/multi_image_video \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "prompt": "人物缓慢转身",
    "image_urls": ["https://example.com/image1.png"],
    "mode": "ti2vid",
    "ratio": "16:9",
    "duration": 5,
    "frame_rate": 24
  }'
```

**curl 示例（keyframes 模式，多张图）：**

```bash
curl -X POST http://localhost:8765/agnes-api/multi_image_video \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "prompt": "在两张图片之间生成平滑过渡",
    "image_urls": [
      "data:image/png;base64,iVBORw0KGgo...",
      "data:image/png;base64,/9j/4AAQ..."
    ],
    "mode": "keyframes",
    "ratio": "16:9",
    "duration": 5,
    "frame_rate": 24
  }'
```

> **重要：** `ti2vid` 模式最多支持 1 张图片。多张图片请使用 `keyframes` 模式。
> 如果使用 data URI（base64），图片会直接传给上游 AI API（无需外发 HTTP 请求下载），对**国内服务器**部署特别有用。
> 前端 `MultiImageVideo` 面板已实现自动将远程 URL 下载并转为 data URI 再发送。

---

### 3.7 批量文生图

#### `POST /agnes-api/batch`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `api_key` | string | 是 | API Key |
| `base_url` | string | 否 | Base URL |
| `prompts` | string[] | 是 | 提示词列表 |
| `size` | string | 否 | 尺寸，默认 `1024x1024` |

**响应：**

```json
{
  "images": ["/outputs/agnes_xxx.png", "/outputs/agnes_yyy.png"],
  "message": "批量生成完成！共 2 张图片"
}
```

> 每个提示词生成 1 张图片（调用 `n=1`），不支持在每个提示词内多图。

**curl 示例：**

```bash
curl -X POST http://localhost:8765/agnes-api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "prompts": ["一只猫", "一只狗", "一座山"],
    "size": "1024x1024"
  }'
```

---

### 3.8 历史记录

#### `GET /agnes-api/history`

获取历史生成记录。

**响应：**

```json
{
  "history": [
    {
      "time": "2026-07-05 12:00:00",
      "mode": "text2image",
      "prompt": "一只可爱的橘猫...",
      "images": ["https://...", "/outputs/xxx.png"],
      "extra": { "source_urls": ["https://..."], "strength": 0.7 }
    }
  ]
}
```

> `images` 优先返回原始 API URL（`extra.source_urls`），不存在时返回本地路径转换后的 URL。

#### `POST /agnes-api/history/delete`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `index` | int | 是 | 要删除的记录索引（从 0 开始） |

**响应：** `{ "status": "ok", "history_count": 99 }`

**curl 示例：**

```bash
curl -X POST http://localhost:8765/agnes-api/history/delete \
  -H "Content-Type: application/json" \
  -d '{"index": 0}'
```

---

### 3.9 健康检查

#### `GET /agnes-api/health`

```json
{ "status": "ok" }
```

`GET /api/health` 同样可用。

---

## 4. 上游 AI API 调用模式

本服务是**中间层代理**，自身不执行文生图/视频，而是将请求转发到 Agnes AI 的 OpenAI 兼容 API。

### 图片生成

**端点：** `POST {base_url}/images/generations`

**请求体结构（`api_client.py`）：**

```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "用户编译后的完整 prompt",
  "size": "1024x1024",
  "n": 1,
  "negative_prompt": "",
  "extra_body": {
    "image": ["data:image/png;base64,..."],
    "strength": 0.7,
    "negative_prompt": ""
  }
}
```

- `extra_body` 仅用于图生图，不用于文生图
- 图片以 `data:` URI 格式传递，上游 API 直接解码，无需外发 HTTP 下载

### 视频生成

**端点：** `POST {base_url}/videos`

**请求体结构（`api_client.py`）：**

```json
{
  "model": "agnes-video-v2.0",
  "prompt": "用户编译后的完整 prompt",
  "width": 1152,
  "height": 768,
  "num_frames": 121,
  "frame_rate": 24,
  "negative_prompt": "",
  "seed": null,
  "num_inference_steps": null,
  "image": "data:image/png;base64,...",
  "extra_body": {
    "image": ["data:...", "data:..."],
    "mode": "keyframes"
  }
}
```

- `image` 用于单图生视频（`image_to_video`）
- `extra_body.image` 用于多图/关键帧（`multi_image_video`）
- 视频生成采用**异步提交 + 轮询**模式：
  1. POST 提交 → 返回 `video_id`
  2. GET `{base_domain}/agnesapi?video_id={id}` 轮询状态（每 5 秒）
  3. `status = "completed"` → 返回视频 URL
  4. `status = "failed"` → 抛出错误
  5. 最长等待 30 分钟

---

## 5. Prompt 工程

系统内置了 12 个**图片维度**和 12 个**视频维度**的精调配置，见 `prompt_builder.py`。

### 工作原理

1. 用户输入基础 prompt（如"一只橘猫坐在窗台上"）
2. 从各维度选择具体选项（如风格="电影感"，质量="4K超高清"）
3. 系统将选中的维度片段编译到最终 prompt：

```
一只橘猫坐在窗台上, 电影感，电影级画面, 4K超高清
```

4. 编译后的 prompt 发送给 AI API

### 5.1 图片维度

| # | 维度 | key | 示例片段 |
|---|------|-----|----------|
| 1 | 主体 | `subject` | 单主体、人物特写、半身人像 |
| 2 | 场景 | `scene` | 室内场景、自然风光、科幻空间 |
| 3 | 风格 | `style` | 写实摄影、电影感、二次元动漫 |
| 4 | 镜头语言 | `camera` | 广角镜头、浅景深、俯视视角 |
| 5 | 构图 | `composition` | 三分法构图、中心构图、对称构图 |
| 6 | 灯光 | `lighting` | 黄金时刻、轮廓光、体积光 |
| 7 | 时间 | `time` | 白天、黄昏、清晨 |
| 8 | 天气 | `weather` | 晴天、雨天、雾天 |
| 9 | 色彩 | `color` | 冷色调、暖色调、赛博朋克 |
| 10 | 材质 | `material` | 金属质感、玻璃质感、皮肤质感 |
| 11 | 质量 | `quality` | 4K超清、超写实、HDR |
| 12 | 附加效果 | `effects` | 光晕、动态模糊、发光效果 |

### 5.2 视频维度

| # | 维度 | key |
|---|------|-----|
| 1 | 主体跟踪 | `subject_tracking` |
| 2 | 场景动态 | `scene_dynamics` |
| 3 | 风格一致性 | `style_consistency` |
| 4 | 镜头运动 | `cinematography` |
| 5 | 动态构图 | `dynamic_composition` |
| 6 | 灯光动画 | `lighting_animation` |
| 7 | 时间维度 | `temporal` |
| 8 | 天气模拟 | `weather_simulation` |
| 9 | 色彩变化 | `color_grading` |
| 10 | 材质物理 | `material_physics` |
| 11 | 视频质量 | `video_quality` |
| 12 | 动态效果 | `motion_effects` |

### 直接编译 prompt（Python）

```python
from prompt_builder import compile_image_prompt, compile_video_prompt

# 图片 prompt 编译
final_prompt, final_negative = compile_image_prompt(
    "一只橘猫",
    "模糊",
    subject="人物特写",
    style="电影感，电影级画面",
    quality="4K超高清"
)
# → "一只橘猫, 人物特写, 电影感，电影级画面, 4K超高清"

# 视频 prompt 编译
final_prompt, final_negative = compile_video_prompt(
    "夕阳下的海浪",
    "",
    cinematography="镜头缓慢推近"
)
```

> 直接调用 API 时，可以自行编译 prompt 后传给 `prompt` 字段，也可以传原始 prompt 并在 `dim_values` 中指定各维度。框架会自动编译。

---

## 6. 前端集成规范

### HTTP 客户端（`http.ts`）

- **Base URL:** `/agnes-api`（开发环境通过 Vite proxy 代理到 `localhost:8765`）
- **超时:** 默认 120s，各端点独立覆盖
  - 图生图上传：180s
  - 文生视频、图生视频、多图视频：600s（10 分钟）
- **Content-Type:** 自动处理，JSON 请求为 `application/json`，`FormData` 请求删除默认 Content-Type 让浏览器自动设置 `boundary`
- **GET 请求:** 自动添加 `_t` 防缓存参数

### 请求拦截

Axios 拦截器自动处理：
- `401` → 清除 token 并跳转登录
- 网络错误 → 提示"无法连接到 API 服务"
- 服务端错误 → 展示错误详情（优先取 `data.detail` → `data.message`）

### 文件上传

图片上传（图生图/图生视频）使用 `multipart/form-data`（`FormData`），文件字段为 `file`。

---

## 7. 错误处理

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 400 | 参数校验失败（缺少必填参数、空 prompt 等） |
| 500 | 服务端处理异常（AI API 调用失败、下载超时等） |

### 错误响应格式

```json
{
  "detail": "文生图失败: 401 - {\"error\":{\"message\":\"Invalid API key\"}}"
}
```

> 后端使用 `HTTPException(500, detail)` 统一包装错误信息。

### 常见错误排查

| 错误信息 | 原因 | 解决 |
|----------|------|------|
| `请配置 API Key` | 请求缺少 `api_key` | 确保传递了 API Key |
| `Download image URL failed` | AI API 服务器无法下载图片 | 使用 data URI（base64）替代远程 URL |
| `Network is unreachable` | 国内服务器无法访问境外图片地址 | 在前端预下载转 data URI，或使用国内图床 |
| `ti2vid supports at most 1 image` | 多图模式下用了 ti2vid | 使用 `keyframes` 模式 |
| `404 Not Found` | API 服务器未启动或端口不对 | 确认 `server.py` 已在运行 |

---
