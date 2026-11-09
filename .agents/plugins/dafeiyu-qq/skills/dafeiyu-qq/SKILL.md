---
name: dafeiyu-qq
description: 指导智能体通过 OneBot v11 MCP 协议与 SnowLuma 配合，操控 QQ 执行发消息、查群组、点赞与戳一戳等操作。当用户要求在 QQ 发消息、查群聊或与 QQ 互动时激活此技能。
---

# 大肥鱼 QQ 操控技能指南

此技能为智能体提供了在 Antigravity 中操控 QQ 的标准动作流程与工具调用规范。

---

## 常用工具与操作指南

### 1. 检查连接与登录状态
* **工具**：`get_login_info`
* **用法**：无参数。在首次执行或排查故障时调用，获取当前登录的 QQ 号码与机器人昵称。

### 2. 发送群聊消息
* **工具**：`send_group_msg`
* **参数**：
  * `group_id` (数字/字符串): 目标 QQ 群号
  * `message` (字符串): 发送的消息文本
* **规范**：遵循大肥鱼人设与 QQ 聊天气泡规范，避免长篇大论与 `#` 符号。

### 3. 发送私聊消息
* **工具**：`send_private_msg`
* **参数**：
  * `user_id` (数字/字符串): 目标好友 QQ 号
  * `message` (字符串): 发送的私聊内容

### 4. 社交互动操作
* **群戳一戳**：`send_group_poke`（传入 `group_id` 与目标成员 `user_id`）
* **好友主页点赞**：`send_like`（传入 `user_id` 与点赞次数 `times`，默认 10 次）

### 5. 全网自媒体情报侦察 (新增)
* **B站热门视频排行**：`get_bilibili_hot`（可选参数 `limit`，默认 10）
* **知乎全站实时热榜**：`get_zhihu_hot`（可选参数 `limit`，默认 10）
* **微博实时热搜榜单**：`get_weibo_hot`（可选参数 `limit`，默认 10）

### 6. 四层无界记忆库管理 (新增)
* **查询记忆全景统计**：`get_memory_stats`（无参数，返回流水数、群友档案数、三元组图谱数与磁盘占用）
* **FTS5 关键词毫秒级语义联想召回**：`recall_memory`（传入 `keyword` 与可选 `limit`）

### 7. 底层原生动作扩展
* **工具**：`invoke_onebot_action`
* **用途**：当需要执行 OneBot v11 的进阶接口（如获取单条消息内容 `get_msg`、撤回消息 `delete_msg` 等）时直接调用。

---

## 异常处理与诊断

* 若工具返回 `connection_error`：
  1. 说明本地 SnowLuma 未启动或 OneBot HTTP 接口未配置；
  2. 引导用户进入 `http://127.0.0.1:5099` 确认 OneBot HTTP 监听端口是否与 `ONEBOT_HTTP_ENDPOINT` 一致。
