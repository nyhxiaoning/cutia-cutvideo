# Agnes 视频生成 API 完整调用指南

> 本文件聚焦文生视频（Text-to-Video）和图生视频（Image-to-Video）两个核心接口，从 React 前端到 Python 服务端再到上游 AI API，完整梳理每一层调用的请求与响应。

---

## 目录

- [1. 架构概述](#1-架构概述)
- [2. 文生视频完整调用链](#2-文生视频完整调用链)
  - [2.1 前端调用（TypeScript）](#21-前端调用typescript)
  - [2.2 代理转发（Vite）](#22-代理转发vite)
  - [2.3 后端接收（FastAPI）](#23-后端接收fastapi)
  - [2.4 Prompt 编译](#24-prompt-编译)
  - [2.5 调用上游 AI API（提交任务）](#25-调用上游-ai-api提交任务)
  - [2.6 轮询视频结果 — 完整实现](#26-轮询视频结果--完整实现)
  - [2.7 返回结果给前端](#27-返回结果给前端)
  - [2.8 curl 完整示例](#28-curl-完整示例)
- [3. 图生视频完整调用链](#3-图生视频完整调用链)
  - [3.1 前端调用（TypeScript）](#31-前端调用typescript)
  - [3.2 代理转发（Vite）](#32-代理转发vite)
  - [3.3 后端接收（FastAPI）](#33-后端接收fastapi)
  - [3.4 图片处理与服务端调用](#34-图片处理与服务端调用)
  - [3.5 轮询视频结果](#35-轮询视频结果)
  - [3.6 curl 完整示例](#36-curl-完整示例)
- [4. 内部视频生成引擎](#4-内部视频生成引擎)
- [5. 参数详解](#5-参数详解)
  - [5.1 分辨率与宽高映射](#51-分辨率与宽高映射)
  - [5.2 帧数计算规则](#52-帧数计算规则)
  - [5.3 完整参数对照表](#53-完整参数对照表)
- [6. 错误处理与排查](#6-错误处理与排查)
- [7. 视频生成时序图](#7-视频生成时序图)

---

## 1. 架构概述

视频生成链路涉及三端：

```
React 前端 (浏览器)
    │  POST /agnes-api/text2video  (JSON)
    │  POST /agnes-api/image2video/with_image  (FormData)
    ▼
Vite Dev Server (开发代理)
    │  代理 /agnes-api/* → localhost:8765
    ▼
Python FastAPI Server (server.py)
    │  compila prompt → AgnesImageGenerator
    ▼
AgnesImageGenerator (api_client.py)
    │  1. POST {base_url}/videos → 获 video_id
    │  2. 轮询 {base_domain}/agnesapi?video_id=xxx → 得到视频 URL
    │  3. 下载视频到本地 → 返回本地路径
    ▼
上游 AI API (apihub.agnes-ai.com)
    异步视频生成
```

---

## 2. 文生视频完整调用链

### 2.1 前端调用（TypeScript）

**文件：** [webui/src/services/creator.ts](webui/src/services/creator.ts#L107-L117)

```typescript
export function textToVideo(data: {
  api_key: string;
  base_url: string;
  model: string;
  prompt: string;
  negative_prompt: string;
  resolution_preset: string;
  ratio: string;
  width?: number;
  height?: number;
  duration: number;
  frame_rate: number;
  num_frames?: number;
  seed?: number;
  steps: number;
  dim_values: string[];
}) {
  return http.post<any, { video: string; message: string }>(
    '/text2video', data, { timeout: 600000 }
  );
}
```

**实际调用示例**（来自 [Text2Video.tsx](webui/src/pages/creator/panels/Text2Video.tsx)）：

```typescript
const res = await textToVideo({
  api_key: "your-api-key",
  base_url: "https://apihub.agnes-ai.com/v1",
  model: "agnes-video-v2.0",
  prompt: "夕阳下的海浪拍打礁石，镜头缓慢推近",
  negative_prompt: "模糊、抖动",
  resolution_preset: "720p",
  ratio: "16:9",
  width: undefined,
  height: undefined,
  duration: 5,
  frame_rate: 24,
  num_frames: undefined,
  seed: undefined,
  steps: 50,
  dim_values: ["", "", "", "镜头缓慢推近", "", "", "", "", "", "", "", ""],
});
```

**Response 类型：** `{ video: string; message: string }`

> 前端超时设置为 600 秒（10 分钟），因为视频生成是异步的，后端需要等待上游 API 返回。

---

### 2.2 代理转发（Vite）

**Vite 配置通过 `vite.config.ts` 中的 proxy 将 `/agnes-api` 请求转发到 FastAPI：**

```
浏览器：POST http://localhost:5173/agnes-api/text2video
                         ↓ Vite proxy
后端：   POST http://localhost:8765/agnes-api/text2video
```

---

### 2.3 后端接收（FastAPI）

**文件：** [webui/server.py](webui/src/../server.py#L245-L278)

**路由：** `POST /agnes-api/text2video`

**接收到的请求体：**

```json
{
  "api_key": "your-api-key",
  "base_url": "https://apihub.agnes-ai.com/v1",
  "prompt": "夕阳下的海浪拍打礁石，镜头缓慢推近",
  "negative_prompt": "模糊、抖动",
  "ratio": "16:9",
  "resolution_preset": "720p",
  "duration": 5,
  "frame_rate": 24,
  "steps": 50,
  "dim_values": ["", "", "", "镜头缓慢推近", "", "", "", "", "", "", "", ""]
}
```

**后端处理步骤：**

```
1. 参数校验（api_key、prompt）
2. dim_values 与 videoDimKeys 按位置绑定
3. 调用 compile_video_prompt() 编译 prompt
4. 创建 AgnesImageGenerator 实例
5. 调用 gen.text_to_video() → 返回上游视频 URL
6. 调用 gen.download_video(url) → 下载到本地
7. 记录历史
8. 返回本地路径的 URL
```

---

### 2.4 Prompt 编译

**文件：** [prompt_builder.py](prompt_builder.py#L457-L479)

```python
# videoDimKeys 顺序：
# ["subject_tracking", "scene_dynamics", "style_consistency", "cinematography",
#  "dynamic_composition", "lighting_animation", "temporal", "weather_simulation",
#  "color_grading", "material_physics", "video_quality", "motion_effects"]

# dim_values 传入 ["", "", "", "镜头缓慢推近", "", "", "", "", "", "", "", ""]
# 对应 cinematography 维度选择了 "镜头缓慢推近"

# 编译结果：
final_prompt = "夕阳下的海浪拍打礁石，镜头缓慢推近, 镜头缓慢推近"
# (用户prompt + 维度片段列表)
```

> 如果 `dim_values` 全部为空，则 final_prompt = 用户原始 prompt。

---

### 2.5 调用上游 AI API（提交任务）

**文件：** [api_client.py](api_client.py#L173-L239)

`text_to_video()` 方法构建 payload：

```python
# 分辨率计算（resolution_preset = "720p" + ratio = "16:9"）
# RATIO_TO_SIZE["16:9"] = { "width": 1152, "height": 768 }
WIDTH = 1152, HEIGHT = 768

# 帧数计算（duration = 5, frame_rate = 24）
# target_frames = 5 × 24 = 120
# n = round((120 - 1) / 8) = round(14.875) = 15
# calculated_frames = 8 × 15 + 1 = 121
# max_frames(720p) = 409
NUM_FRAMES = min(max(121, 9), 409) = 121
```

**最终发给上游 AI API 的请求体：**

```json
POST https://apihub.agnes-ai.com/v1/videos
Headers:
  Authorization: Bearer your-api-key
  Content-Type: application/json

Body:
{
  "model": "agnes-video-v2.0",
  "prompt": "夕阳下的海浪拍打礁石，镜头缓慢推近, 镜头缓慢推近",
  "width": 1152,
  "height": 768,
  "num_frames": 121,
  "frame_rate": 24,
  "negative_prompt": "模糊、抖动",
  "num_inference_steps": 50
}
```

> 注意：`steps === 50` 时会被 `api_client.py` 忽略（`steps_val = None`），因为 50 是默认值。
> 只有传入非 50 的值时才会写入 `num_inference_steps`。

**上游 AI API 响应（成功）：**

```json
{
  "video_id": "v_abc123def456",
  "id": "v_abc123def456"
}
```

**失败时响应示例：**

```json
// 400 Bad Request
{
  "error": {
    "message": "Invalid parameter: num_frames exceeds maximum",
    "code": "400"
  }
}
```

---

### 2.6 轮询视频结果 — 完整实现

**文件：** [api_client.py](api_client.py#L400-L510)

视频生成是异步的：提交任务后立即获得 `video_id`，然后通过独立的轮询端点反复查询状态，直到视频生成完成或失败。下面是**完整实现**：

#### 步骤 1：提交视频生成任务

```python
url = f"{self.base_url}/videos"   # → https://apihub.agnes-ai.com/v1/videos
payload = {
    "model": "agnes-video-v2.0",
    "prompt": "夕阳下的海浪拍打礁石，镜头缓慢推近, 镜头缓慢推近",
    "width": 1152,
    "height": 768,
    "num_frames": 121,
    "frame_rate": 24,
    "negative_prompt": "模糊、抖动",
}
headers = {
    "Authorization": "Bearer your-api-key",
    "Content-Type": "application/json",
}

resp = requests.post(url, json=payload, headers=headers, timeout=300)  # 5分钟超时
```

**提交请求的 HTTP 报文：**

```
POST /v1/videos HTTP/1.1
Host: apihub.agnes-ai.com
Authorization: Bearer agnes-xxxxxxxxxxxx
Content-Type: application/json
Content-Length: 312

{
  "model": "agnes-video-v2.0",
  "prompt": "夕阳下的海浪拍打礁石，镜头缓慢推近, 镜头缓慢推近",
  "width": 1152,
  "height": 768,
  "num_frames": 121,
  "frame_rate": 24,
  "negative_prompt": "模糊、抖动"
}
```

**提交响应（成功 — HTTP 200）：**

```json
{
  "video_id": "v_abc123def456",
  "id": "v_abc123def456"
}
```

`video_id` 和 `id` 通常指向同一个值，代码中使用 `data.get("video_id") or data.get("id")` 容错处理。

#### 步骤 2：构造轮询 URL

提交响应拿到 `video_id` 后，需要构造轮询 URL：

```python
# base_url = "https://apihub.agnes-ai.com/v1"
# 去掉 "/v1" 后缀，得到基础域名
base_domain = "https://apihub.agnes-ai.com"  # self.base_url.replace("/v1", "")

# 拼接轮询 URL
poll_url = f"{base_domain}/agnesapi?video_id={video_id}"
# → https://apihub.agnes-ai.com/agnesapi?video_id=v_abc123def456
```

#### 步骤 3：轮询循环（完整 Python 实现）

```python
max_wait = 1800        # 最长等待 30 分钟
poll_interval = 5      # 默认每 5 秒查询一次
waited = 0             # 已等待秒数
retry_count = 0        # 连续失败重试次数

while waited < max_wait:
    try:
        # --- 发送轮询请求 ---
        status_resp = requests.get(
            poll_url,
            headers={"Authorization": "Bearer your-api-key"},
            timeout=30,          # 单次轮询超时 30 秒
        )
        status_resp.raise_for_status()    # 非 2xx 时抛出异常
        status_data = status_resp.json()

        # --- 重置重试计数器（成功一次就算） ---
        retry_count = 0

    except Exception as poll_err:
        # --- 轮询失败：指数退避重试 ---
        retry_count += 1
        if retry_count >= 10:
            # 连续失败 10 次，放弃
            raise gr.Error(f"查询视频状态失败，已重试10次: {poll_err}")

        wait_time = min(2 ** retry_count, 30)   # 2^1=2s, 2^2=4s, 2^3=8s, ... 最大30s
        print(f" 查询失败，{wait_time}秒后重试 ({retry_count}/10): {poll_err}")
        time.sleep(wait_time)
        waited += wait_time
        continue

    # --- 解析状态 ---
    status = status_data.get("status", "unknown")
    progress = status_data.get("progress", 0)
    print(f"  状态: {status} | 进度: {progress}% | 已等待: {waited//60}分钟")

    # --- 状态机 ---
    if status == "completed":
        # ✅ 成功：获取视频 URL
        video_url = (status_data.get("url")
                     or status_data.get("remixed_from_video_id"))
        if not video_url:
            raise gr.Error(f"视频生成完成但未找到 URL: {json.dumps(status_data)}")
        print(f" 视频生成完成: {video_url}")
        print(f" 时长: {status_data.get('seconds','未知')}秒, 分辨率: {status_data.get('size','未知')}")
        return video_url   # ← 返回给调用方

    if status == "failed":
        # ❌ 失败：获取错误信息并抛出
        error = status_data.get("error", {})
        error_msg = (error.get("message", str(error))
                     if isinstance(error, dict) else str(error))
        raise gr.Error(f"视频生成失败: {error_msg}")

    # ⏳ 仍在处理中：根据进度调整轮询间隔
    if progress == 0 and waited > 120:
        # 长时间无进度 → 降低轮询频率
        time.sleep(min(poll_interval * 2, 30))   # 最多 30 秒
        waited += min(poll_interval * 2, 30)
    else:
        time.sleep(poll_interval)
        waited += poll_interval

# ⏰ 超时
raise gr.Error(f"视频生成超时（超过 {max_wait//60} 分钟未返回结果）")
```

#### 轮询 GET 请求的 HTTP 报文

```
GET /agnesapi?video_id=v_abc123def456 HTTP/1.1
Host: apihub.agnes-ai.com
Authorization: Bearer agnes-xxxxxxxxxxxx
```

#### 轮询各阶段响应示例

**处理中（初期，进度 0%）：**

```json
{
  "status": "processing",
  "progress": 0,
  "video_id": "v_abc123def456"
}
```

**处理中（正常进度）：**

```json
{
  "status": "processing",
  "progress": 45,
  "video_id": "v_abc123def456"
}
```

**生成完成（包括实际时长和分辨率信息）：**

```json
{
  "status": "completed",
  "progress": 100,
  "url": "https://cdn.agnes-ai.com/videos/v_abc123def456.mp4",
  "video_id": "v_abc123def456",
  "seconds": 5.0,
  "size": "1280x720"
}
```

> `url` 字段是 CDN 视频地址，可直接播放或下载。`seconds` 和 `size` 是上游 API 返回的实际生成信息。

**生成失败：**

```json
{
  "status": "failed",
  "progress": 0,
  "video_id": "v_abc123def456",
  "error": {
    "message": "Content moderation triggered"
  }
}
```

**生成失败（另一种格式）：**

```json
{
  "status": "failed",
  "error": "API rate limit exceeded"
}
```

> 当 `error` 字段不是对象而是字符串时，`api_client.py` 的 `isinstance(error, dict)` 判断会走 else 分支，直接使用字符串文本。

#### 轮询状态机

```
                    ┌──────────┐
                    │ 提交任务  │
                    │ POST     │
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐    连续失败10次    ┌──────────┐
                    │  polling  │ ───────────────>  │ 抛出异常  │
                    │  轮询中   │                   │ 重试失败   │
                    └────┬─────┘                   └──────────┘
                         │
               ┌─────────┼──────────┐
               ▼                    ▼
        ┌──────────┐         ┌──────────┐
        │completed │         │  failed  │
        │ 生成完成  │         │ 生成失败  │
        └────┬─────┘         └────┬─────┘
             │                    │
             ▼                    ▼
        ┌──────────┐         ┌──────────┐
        │返回URL   │         │ 抛出异常  │
        │下载视频   │         │ 失败原因  │
        └──────────┘         └──────────┘
             │
             ▼
     waited >= 1800s?
     ┌────┴────┐
     │ 是       │ 否
     ▼          ▼
  抛出超时     继续轮询
```

#### 容错机制总结

| 条件 | 行为 |
|------|------|
| 轮询 HTTP 请求失败（网络错误、非 2xx） | 指数退避重试：2s → 4s → 8s → 16s → 30s（封顶），最多 10 次 |
| 连续失败超过 10 次 | 抛出 `gr.Error`，终止等待 |
| `progress === 0` 且已等待 > 120s | 轮询间隔从 5s 加倍到 10s（封顶 30s），减轻服务端压力 |
| 总等待时间超过 1800s（30 分钟） | 抛出 `gr.Error("视频生成超时")` |
| 轮询成功一次 | 重置 `retry_count = 0`（成功即清除连续失败计数） |

#### 使用 curl 复现完整提交 + 轮询流程

```bash
#!/bin/bash
# 完整视频生成流程：提交 → 获取 video_id → 轮询 → 下载

API_KEY="your-api-key"
BASE_URL="https://apihub.agnes-ai.com/v1"

# ==== 步骤 1：提交任务 ====
echo "=== 提交视频任务 ==="
SUBMIT_RESP=$(curl -s -X POST "${BASE_URL}/videos" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-video-v2.0",
    "prompt": "夕阳下的海浪拍打礁石，镜头缓慢推近",
    "width": 1152,
    "height": 768,
    "num_frames": 121,
    "frame_rate": 24,
    "negative_prompt": "模糊、抖动"
  }')

echo "提交响应: $SUBMIT_RESP"

# 提取 video_id（支持两种字段名）
VIDEO_ID=$(echo "$SUBMIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('video_id') or d.get('id'))" 2>/dev/null)

if [ -z "$VIDEO_ID" ]; then
  echo "错误: 未获取到 video_id"
  exit 1
fi

echo "video_id: $VIDEO_ID"

# ==== 步骤 2：构造轮询 URL ====
POLL_URL="${BASE_URL%%/v1}/agnesapi?video_id=${VIDEO_ID}"
echo "轮询 URL: $POLL_URL"

# ==== 步骤 3：轮询（最多 30 分钟） ====
echo "=== 开始轮询 ==="
MAX_WAIT=1800   # 30 分钟
INTERVAL=5      # 每 5 秒
WAITED=0
RETRIES=0

while [ $WAITED -lt $MAX_WAIT ]; do
  POLL_RESP=$(curl -s -G "${BASE_URL%%/v1}/agnesapi" \
    -H "Authorization: Bearer ${API_KEY}" \
    --data-urlencode "video_id=${VIDEO_ID}")

  STATUS=$(echo "$POLL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null)
  PROGRESS=$(echo "$POLL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('progress',0))" 2>/dev/null)

  echo "状态: $STATUS | 进度: ${PROGRESS}% | 已等待: $((WAITED / 60))分钟"

  if [ "$STATUS" = "completed" ]; then
    VIDEO_URL=$(echo "$POLL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url') or d.get('remixed_from_video_id',''))" 2>/dev/null)
    echo "=== 生成完成 ==="
    echo "视频 URL: $VIDEO_URL"

    # 可选：下载视频
    echo "正在下载视频..."
    curl -o "video_${VIDEO_ID}.mp4" "$VIDEO_URL"
    echo "已保存: video_${VIDEO_ID}.mp4"
    exit 0
  fi

  if [ "$STATUS" = "failed" ]; then
    ERROR_MSG=$(echo "$POLL_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin).get('error',{}); print(d.get('message',d) if isinstance(d,dict) else d)" 2>/dev/null)
    echo "=== 生成失败: $ERROR_MSG ==="
    exit 1
  fi

  sleep $INTERVAL
  WAITED=$((WAITED + INTERVAL))
done

echo "=== 超时: 超过 ${MAX_WAIT}秒 未生成完成 ==="
exit 1
```

将此脚本保存为 `generate_video.sh` 后执行：

```bash
chmod +x generate_video.sh
AGNES_API_KEY="your-key" ./generate_video.sh
```

---

### 2.7 返回结果给前端

上游 API 返回视频 URL 后，后端下载到本地再返回：

```python
# 1. 下载视频到本地
local_path = gen.download_video(video_url)
# → outputs/agnes_video_20260705_120000_123456.mp4

# 2. 写入历史
add_to_history(prompt, [local_path], "text2video", {"duration": 5, "ratio": "16:9"})

# 3. 转换成本地 URL 返回
return {
    "video": "/outputs/agnes_video_20260705_120000_123456.mp4",
    "message": "生成成功！时长: 5秒"
}
```

**前端最终收到：**

```json
{
  "video": "/outputs/agnes_video_20260705_120000_123456.mp4",
  "message": "生成成功！时长: 5秒"
}
```

后端通过 `_local_to_url()` 将绝对路径转换为相对于 `/outputs/` 的 URL，该目录已被 FastAPI 挂在静态文件服务上，前端 `<video>` 标签可直接播放。

---

### 2.8 curl 完整示例

#### 最基本调用（只传必填参数）

```bash
curl -X POST http://localhost:8765/agnes-api/text2video \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "prompt": "夕阳下的海浪拍打礁石，镜头缓慢推近"
  }'
```

#### 完整参数调用

```bash
curl -X POST http://localhost:8765/agnes-api/text2video \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "base_url": "https://apihub.agnes-ai.com/v1",
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

#### 自定义宽高和帧数

```bash
curl -X POST http://localhost:8765/agnes-api/text2video \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your-api-key",
    "prompt": "一只海豚跃出水面，慢动作",
    "width": 1280,
    "height": 720,
    "num_frames": 169,
    "frame_rate": 24,
    "seed": 42
  }'
```

> 当传递 `width` 和 `height` 时，`ratio` 和 `resolution_preset` 被忽略。
> 传递 `num_frames` 时，`duration` 和 `frame_rate` 不再用于计算帧数（但仍然传给 API 作为 `frame_rate`）。

---

## 3. 图生视频完整调用链

### 3.1 前端调用（TypeScript）

**文件：** [webui/src/services/creator.ts](webui/src/services/creator.ts#L119-L161)

图生视频使用 `multipart/form-data`（因需要上传文件）：

```typescript
export async function imageToVideo(
  apiKey: string,
  baseUrl: string,
  model: string,
  prompt: string,
  negativePrompt: string,
  imageUrl: string,
  resolutionPreset: string,
  ratio: string,
  width: number | undefined,
  height: number | undefined,
  duration: number,
  frameRate: number,
  numFrames: number | undefined,
  seed: number | undefined,
  steps: number,
  dimValues: string[],
  file?: File,
) {
  const form = new FormData();
  form.append('api_key', apiKey);
  form.append('base_url', baseUrl);
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('negative_prompt', negativePrompt);
  form.append('image_url', imageUrl);
  form.append('resolution_preset', resolutionPreset);
  form.append('ratio', ratio);
  if (width) form.append('width', String(width));
  if (height) form.append('height', String(height));
  form.append('duration', String(duration));
  form.append('frame_rate', String(frameRate));
  if (numFrames) form.append('num_frames', String(numFrames));
  if (seed) form.append('seed', String(seed));
  form.append('steps', String(steps));
  form.append('dim_values', JSON.stringify(dimValues));
  if (file) form.append('file', file);

  const res = await http.post('/image2video/with_image', form, {
    timeout: 600000,
  });
  return res as unknown as { video: string; message: string };
}
```

**前端 FormData 构造示例（图片 URL 方式）：**

| Key | Value |
|-----|-------|
| `api_key` | your-api-key |
| `base_url` | https://apihub.agnes-ai.com/v1 |
| `prompt` | 人物缓慢转身，头发随风飘动 |
| `negative_prompt` | （空字符串） |
| `image_url` | https://example.com/ref.png |
| `resolution_preset` | 720p |
| `ratio` | 16:9 |
| `duration` | 5 |
| `frame_rate` | 24 |
| `steps` | 50 |
| `dim_values` | `[]` |

**前端 FormData 构造示例（上传本地图片）：**

| Key | Value |
|-----|-------|
| `image_url` | （空字符串） |
| `file` | (binary file data) |
| ...其他同上 |

---

### 3.2 代理转发（Vite）

```
浏览器：POST http://localhost:5173/agnes-api/image2video/with_image
                         ↓ Vite proxy
后端：   POST http://localhost:8765/agnes-api/image2video/with_image
```

### 3.3 后端接收（FastAPI）

**文件：** [webui/server.py](webui/src/../server.py#L281-L345)

**路由：** `POST /agnes-api/image2video/with_image`

**路由定义：**

```python
@app.post("/agnes-api/image2video/with_image")
async def image2video_with_image(
    api_key: str = Form(...),
    base_url: str = Form(DEFAULT_BASE_URL),
    model: str = Form(DEFAULT_MODEL),
    prompt: str = Form(...),
    negative_prompt: str = Form(""),
    image_url: str = Form(""),
    resolution_preset: str = Form("720p"),
    ratio: str = Form("16:9"),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    duration: int = Form(5),
    frame_rate: int = Form(24),
    num_frames: Optional[int] = Form(None),
    seed: Optional[int] = Form(None),
    steps: int = Form(50),
    dim_values: str = Form("[]"),
    file: Optional[UploadFile] = File(None),
):
```

**后端处理步骤：**

```
1. 参数校验（api_key、prompt）
2. dim_values 从 JSON 字符串解析为数组
3. 调用 compile_video_prompt() 编译 prompt
4. 确定图片来源：
   a. image_url 不为空 → 直接使用
   b. 上传了 file → 保存到临时文件
   c. 都为空 → HTTP 400
5. 创建 AgnesImageGenerator
6. 调用 gen.image_to_video(image_path, ...) → 返回上游视频 URL
7. 下载视频到本地 → 返回本地路径
```

### 3.4 图片处理与服务端调用

**文件：** [api_client.py](api_client.py#L241-L330)

`image_to_video()` 方法：

```python
def image_to_video(self, image_path, prompt, ...):
    # 1. 读取图片文件
    with open(image_path, "rb") as f:
        image_data = f.read()

    # 2. Base64 编码
    b64 = base64.b64encode(image_data).decode("utf-8")

    # 3. 判断 MIME 类型
    ext = os.path.splitext(image_path)[1].lower()
    mime_type = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    }.get(ext, 'image/png')

    # 4. 构造 data URI
    image_data_uri = f"data:{mime_type};base64,{b64}"

    # 5. 检查大小（超过 1MB 告警）
    if len(b64) > 1000000:
        print(f"警告: 图片base64较大({len(b64)}字符)")

    # 6. 构建 payload 发送给上游 API
    payload = {
        "model": "agnes-video-v2.0",
        "prompt": "编译后的完整 prompt",
        "image": image_data_uri,       # ← data URI 格式
        "width": 1152,
        "height": 768,
        "num_frames": 121,
        "frame_rate": 24,
        ...
    }
```

**发给上游 AI API 的请求体：**

```json
POST https://apihub.agnes-ai.com/v1/videos

{
  "model": "agnes-video-v2.0",
  "prompt": "人物缓慢转身，头发随风飘动",
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
  "width": 1152,
  "height": 768,
  "num_frames": 121,
  "frame_rate": 24,
  "negative_prompt": "",
  "num_inference_steps": null
}
```

> 关键：`image` 字段是 `data:` URI 格式，上游 AI API 直接解码图片数据，**无需外发 HTTP 请求下载**。
> 这是为什么即使在国内服务器上部署，使用 data URI 也能正常工作。

### 3.5 轮询视频结果

图生视频与文生视频共用 `_generate_video()` 方法，轮询逻辑完全相同。

区别仅在于提交的 payload 多一个 `image` 字段，轮询阶段的请求/响应/容错逻辑完全一致。详见 [2.6 轮询视频结果](#26-轮询视频结果--完整实现)。

#### 步骤 5：下载视频与返回

```python
# 上游 API 返回视频 CDN URL
video_url = "https://cdn.agnes-ai.com/videos/v_abc123def456.mp4"

# 下载到本地
local_path = gen.download_video(video_url)
# → outputs/agnes_video_20260707_120000_654321.mp4

# 写入历史
add_to_history(compiled_prompt, [local_path], "image2video", {"duration": 5, "ratio": "16:9"})

# 转换为前端可访问的 URL
# _local_to_url() 将绝对路径转为 /outputs/xxx.mp4 相对路径
return {"video": "/outputs/agnes_video_20260707_120000_654321.mp4", "message": "生成成功！时长: 5秒"}
```

下载函数实现（`download_video`）：

```python
def download_video(self, url: str, prefix: str = "agnes_video") -> str:
    """下载视频到本地 outputs 目录"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{prefix}_{timestamp}.mp4"
    filepath = OUTPUT_DIR / filename

    response = requests.get(url, timeout=300, stream=True)
    response.raise_for_status()

    with open(filepath, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
    return str(filepath)
```

### 3.6 curl 完整示例

#### 上传本地图片

```bash
curl -X POST http://localhost:8765/agnes-api/image2video/with_image \
  -F "api_key=your-api-key" \
  -F "prompt=人物缓慢转身，头发随风飘动" \
  -F "file=@/path/to/reference.png" \
  -F "ratio=16:9" \
  -F "duration=5" \
  -F "frame_rate=24" \
  -F "steps=50" \
  -F "dim_values=[]"
```

#### 使用公网图片 URL

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

#### 完整参数

```bash
curl -X POST http://localhost:8765/agnes-api/image2video/with_image \
  -F "api_key=your-api-key" \
  -F "base_url=https://apihub.agnes-ai.com/v1" \
  -F "prompt=城堡在夕阳下，镜头缓慢推近" \
  -F "negative_prompt=模糊、抖动" \
  -F "image_url=https://example.com/castle.png" \
  -F "resolution_preset=1080p" \
  -F "ratio=16:9" \
  -F "duration=8" \
  -F "frame_rate=30" \
  -F "num_frames=241" \
  -F "seed=12345" \
  -F "steps=50" \
  -F "dim_values=[\"\",\"\",\"\",\"镜头缓慢推近\",\"\",\"\",\"\",\"\",\"\",\"\",\"\",\"\"]"
```

#### 超亮背景下的本地图片转 data URI（国内部署推荐）

如果后端在国内，无法访问公网图片 URL，**在前端先将图片转 base64 再传 `image_url` 字段**：

```javascript
// 前端 JavaScript
async function urlToDataUri(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

const dataUri = await urlToDataUri("https://raw.githubusercontent.com/xxx/cat.png");

// 然后将 dataUri 放入 image_url 字段
const form = new FormData();
form.append("api_key", "your-api-key");
form.append("prompt", "猫在窗台上晒太阳");
form.append("image_url", dataUri);  // ← data:image/png;base64,...
form.append("ratio", "16:9");
form.append("duration", "5");
form.append("frame_rate", "24");
form.append("dim_values", "[]");
```

对应的 curl：

```bash
# 先将图片转 base64
DATA_URI="data:image/png;base64,$(curl -s https://example.com/cat.png | base64)"

curl -X POST http://localhost:8765/agnes-api/image2video/with_image \
  -F "api_key=your-api-key" \
  -F "prompt=猫在窗台上晒太阳" \
  -F "image_url=$DATA_URI" \
  -F "ratio=16:9" \
  -F "duration=5" \
  -F "frame_rate=24" \
  -F "dim_values=[]"
```

---

## 4. 内部视频生成引擎

文生视频和图生视频最终都汇聚到同一个核心方法 `_generate_video()`：

```
text_to_video(prompt)
    │
    ├── 构建 payload（model, prompt, width, height, framerate, ...）
    │    └── 不包含 image 字段
    ▼
_generate_video(payload)
    │
    ├── POST {base_url}/videos           → video_id
    ├── 轮询 GET {base_domain}/agnesapi  → video URL
    ├── download_video(url)              → 本地 .mp4 文件
    └── 返回 { video: local_url, message: ... }
    ▲
    │
image_to_video(image_path, prompt)
    │
    ├── 读取图片 → base64 → data URI
    ├── 构建 payload（model, prompt, image: data_uri, ...）
    │    └── 比 text_to_video 多一个 image 字段
    └── _generate_video(payload)
```

**区别总结：**

| | 文生视频 | 图生视频 |
|---|---|---|
| 前端请求格式 | `application/json` | `multipart/form-data` |
| 请求字段 `image` | 不存在 | `data:image/png;base64,...` |
| 图片来源 | 无 | 上传文件或公网 URL |
| 前端超时 | 600s | 600s |
| 后端轮询 | 30分钟上限 | 30分钟上限 |

---

## 5. 参数详解

### 5.1 分辨率与宽高映射

当不传 `width`/`height` 时，根据 `ratio` 参数自动计算：

```python
RATIO_TO_SIZE = {
    "16:9": {"width": 1152, "height": 768},
    "9:16": {"width": 768,  "height": 1152},
    "1:1":  {"width": 768,  "height": 768},
    "4:3":  {"width": 1024, "height": 768},
    "3:4":  {"width": 768,  "height": 1024},
}
```

> `resolution_preset`（480p/720p/1080p）不会影响宽度和高度计算，仅在决定最大帧数上限时使用。
> 当 `width`/`height` 未提供时，始终使用 `RATIO_TO_SIZE` 的值（固定为 720p 水平分辨率）。

（当未来版本实现分辨率预设时，此行为将改变。）

### 5.2 帧数计算规则

**公式：**

```
target_frames = duration × frame_rate
n = round((target_frames - 1) / 8)
num_frames = min(max(8 × n + 1, 9), max_frames_by_resolution)
```

**常用预计算值（frame_rate = 24）：**

| 时长 | target_frames | n | 计算值 | 实际值 | 是否符合 8n+1 |
|------|--------------|---|--------|--------|:------------:|
| 3s | 72 | 9 | 73 | 73 | ✓ (8×9+1) |
| 5s | 120 | 15 | 121 | 121 | ✓ |
| 8s | 192 | 24 | 193 | 193 | ✓ |
| 10s | 240 | 30 | 241 | 241 | ✓ |
| 15s | 360 | 45 | 361 | 361 | ✓ |
| 18s | 432 | 54 | 433 | 433 | ✓ |

**不同分辨率的帧数上限：**

| 分辨率 | 最大帧数 | 最长时长（@24fps） |
|--------|---------|-------------------|
| 480p | 961 | ~40s |
| 720p | 409 | ~17s |
| 1080p | 169 | ~7s |

### 5.3 完整参数对照表

#### 文生图 `POST /agnes-api/text2video`

| 层级 | 参数 | 前端字段 | 后端接收 | 上游 API 字段 | 类型 |
|------|-----|---------|---------|--------------|------|
| 鉴权 | API Key | `api_key` | `req.api_key` | `Authorization` header | string |
| 鉴权 | Base URL | `base_url` | `req.base_url` | (拼接 URL) | string |
| 内容 | Prompt | `prompt` | `req.prompt` → `compiled_prompt` | `prompt` | string |
| 内容 | 负向 prompt | `negative_prompt` | `req.negative_prompt` → `compiled_negative` | `negative_prompt` | string |
| 视频 | 画面比例 | `ratio` | `req.ratio` | → `width`/`height` | string |
| 视频 | 分辨率预设 | `resolution_preset` | `req.resolution_preset` | → `max_frames` | string |
| 视频 | 自定义宽 | `width` | `req.width` | `width` | int |
| 视频 | 自定义高 | `height` | `req.height` | `height` | int |
| 视频 | 时长(秒) | `duration` | `req.duration` | → `num_frames` | int |
| 视频 | 帧率 | `frame_rate` | `req.frame_rate` | `frame_rate` | int |
| 视频 | 自定义帧数 | `num_frames` | `req.num_frames` | `num_frames` | int |
| 视频 | 随机种子 | `seed` | `req.seed` | `seed` | int |
| 视频 | 推理步数 | `steps` | `req.steps` | `num_inference_steps` (仅 ≠50 时) | int |
| 维度 | 精调维度 | `dim_values` | `req.dim_values` | → 编译入 prompt | string[] |

#### 图生视频 `POST /agnes-api/image2video/with_image`

| 层级 | 参数 | 前端字段 | 后端接收 | 上游 API 字段 | 类型 |
|------|-----|---------|---------|--------------|------|
| 鉴权 | API Key | `api_key` | `api_key` | `Authorization` header | Form string |
| 鉴权 | Base URL | `base_url` | `base_url` | (拼接 URL) | Form string |
| 内容 | Prompt | `prompt` | `prompt` → `compiled_prompt` | `prompt` | Form string |
| 内容 | 负向 prompt | `negative_prompt` | `negative_prompt` → `compiled_negative` | `negative_prompt` | Form string |
| 图片 | 参考图 URL | `image_url` | `image_url` | → data URI → `image` | Form string |
| 图片 | 上传文件 | `file` | `file` | → data URI → `image` | uploaded File |
| 视频 | 画面比例 | `resolution_preset` | `resolution_preset` | → `width`/`height` | Form string |
| 视频 | 分辨率预设 | `ratio` | `ratio` | → `max_frames` | Form string |
| 视频 | 自定义宽 | `width` | `width` | `width` | Form int |
| 视频 | 自定义高 | `height` | `height` | `height` | Form int |
| 视频 | 时长(秒) | `duration` | `duration` | → `num_frames` | Form int |
| 视频 | 帧率 | `frame_rate` | `frame_rate` | `frame_rate` | Form int |
| 视频 | 自定义帧数 | `num_frames` | `num_frames` | `num_frames` | Form int |
| 视频 | 随机种子 | `seed` | `seed` | `seed` | Form int |
| 视频 | 推理步数 | `steps` | `steps` | `num_inference_steps` | Form int |
| 维度 | 精调维度 | `dim_values` | `dim_values` (JSON string) | → 编译入 prompt | Form string |

---

## 6. 错误处理与排查

### 常见错误

| 错误信息 | 阶段 | 原因 | 解决 |
|----------|------|------|------|
| `请配置 API Key` | FastAPI 校验 | 请求未带 `api_key` | 检查请求参数 |
| `请输入视频描述` | FastAPI 校验 | `prompt` 为空或纯空白 | 填写 prompt |
| `视频提交失败: 401 ...` | 上游 API 调用 | API Key 无效 | 检查 API Key |
| `视频提交失败: ...Read timed out` | 上游 API 调用 | 上游 API 下载图片超时 | 使用 data URI 或国内图床 |
| `视频提交失败: ...Max retries exceeded` | 上游 API 调用 | 上游 API 无法连接图片 URL | 网络不可达，转为 data URI |
| `视频生成失败: ...` | 轮询阶段 | 上游 API 生成过程中报错 | 查看 error.message 具体原因 |
| `视频生成超时` | 轮询阶段 | 30 分钟未生成完成 | 调整参数（分辨率/帧数）后重试 |
| `查询视频状态失败，已重试10次` | 轮询阶段 | 轮询请求连续失败 | 检查网络/API 服务状态 |

### 图片 URL 的特别说明

**当后端在中国大陆部署时，以下图片 URL 通常无法被上游 API 访问：**

- `raw.githubusercontent.com`（GitHub）
- Google 存储、AWS S3 等境外服务

**解决方案（推荐使用 data URI）：**

1. **前端侧（推荐）**：前端 `fetch()` 图片 → `FileReader.readAsDataURL()` → data URI → 传给后端
2. **后端侧**：后端已支持 data URI，接收后直接传 upstream API
3. **图床**：将图片上传到国内 CDN（如又拍云、阿里云 OSS），使用公网 URL

### 调试技巧

开启 API 服务器的详细日志可以看到每一步的 payload：

```
 提交视频请求: https://apihub.agnes-ai.com/v1/videos
 payload: {"model":"agnes-video-v2.0","prompt":"夕阳...","width":1152,...}
 预期时长: 5.04秒 (121帧 @ 24fps)
 响应码: 200
 响应: {"video_id":"v_xxx","id":"v_xxx"}
 任务已创建: v_xxx，开始轮询...
  状态: processing | 进度: 0% | 已等待: 0分钟
  状态: processing | 进度: 30% | 已等待: 1分钟
```

---

## 7. 视频生成时序图

```
┌─────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────────────┐
│  React   │    │  Vite Proxy  │    │ FastAPI    │    │  Agnes AI API    │
│  前端     │    │  (dev only)  │    │  server.py │    │  (upstream)      │
└────┬────┘    └──────┬───────┘    └─────┬──────┘    └────────┬─────────┘
     │                │                  │                     │
     │ POST /agnes-api/text2video        │                     │
     │ (JSON)          │                  │                     │
     │───────────────>│                  │                     │
     │                │  localhost:8765   │                     │
     │                │─────────────────>│                     │
     │                │                  │                     │
     │                │                  │  POST /v1/videos    │
     │                │                  │  (JSON payload)     │
     │                │                  │────────────────────>│
     │                │                  │                     │
     │                │                  │  { video_id: "xxx"} │
     │                │                  │<────────────────────│
     │                │                  │                     │
     │                │                  │  ─── 轮询循环 ───   │
     │                │                  │                     │
     │                │                  │  GET /agnesapi?     │
     │                │                  │  video_id=xxx       │
     │                │                  │────────────────────>│
     │                │                  │  { status:"proc"}   │
     │                │                  │<────────────────────│
     │                │                  │  (每5秒重複...)     │
     │                │                  │                     │
     │                │                  │  GET /agnesapi?     │
     │                │                  │────────────────────>│
     │                │                  │  { status:"comp",   │
     │                │                  │    url:"cdn.mp4" }   │
     │                │                  │<────────────────────│
     │                │                  │                     │
     │                │                  │  下载视频到本地      │
     │                │                  │                     │
     │ { video:"/outputs/xxx.mp4",       │                     │
     │   message:"生成成功"}             │                     │
     │<───────────────│<─────────────────│                     │
```

对于图生视频，唯一区别在于前端发送 `multipart/form-data` + 后端将图片转为 `data:` URI 后放入 payload 的 `image` 字段。
