/**
 * Antigravity (AGY) 内部模型额度直连适配器（纯净隔离沙箱版）
 * 核心机制：
 * 1. 专属会话工作区物理隔离在 data/sandbox_agy 孤岛目录，绝不接触项目源码
 * 2. 注入【最高安全铁律】：100% 纯文本聊天输出，绝对禁止调用任何开发工具 (write_file/run_command)
 * 3. 100% 消耗当前 Antigravity 登录 Google 账号的高级模型内部配额 (Gemini 3.8 Flash High / Pro)
 * 4. 若 Antigravity 客户端未运行或响应超时，自动无缝降级至本地安全网桥 (49281)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const SANDBOX_DIR = path.join(ROOT_DIR, 'data', 'sandbox_agy');
const SESSION_FILE = path.join(ROOT_DIR, 'data', 'agy_session.json');

const AGENTAPI_PATH = 'C:\\Users\\fyy26\\.gemini\\antigravity\\bin\\agentapi.bat';
const BRAIN_DIR = 'C:\\Users\\fyy26\\.gemini\\antigravity\\brain';
const DAEMON_DIR = 'C:\\Users\\fyy26\\.gemini\\antigravity\\daemon';
const FALLBACK_PROXY = 'http://127.0.0.1:49281/v1beta/models/gemini-3.6-flash:generateContent';

// 确保沙箱隔离目录存在
if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

/**
 * 动态获取 Antigravity Language Server 守护进程的连接配置与 Token
 */
function getActiveHubEnv() {
  if (process.env.ANTIGRAVITY_LS_ADDRESS && process.env.ANTIGRAVITY_CSRF_TOKEN) {
    return {
      ANTIGRAVITY_LS_ADDRESS: process.env.ANTIGRAVITY_LS_ADDRESS,
      ANTIGRAVITY_CSRF_TOKEN: process.env.ANTIGRAVITY_CSRF_TOKEN
    };
  }

  try {
    if (fs.existsSync(DAEMON_DIR)) {
      const files = fs.readdirSync(DAEMON_DIR)
        .filter(f => f.startsWith('hub_') && f.endsWith('.json'))
        .map(f => {
          const fullPath = path.join(DAEMON_DIR, f);
          return { fullPath, mtime: fs.statSync(fullPath).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      for (const file of files) {
        try {
          const content = JSON.parse(fs.readFileSync(file.fullPath, 'utf-8'));
          if (content.httpPort && content.csrfToken) {
            return {
              ANTIGRAVITY_LS_ADDRESS: `localhost:${content.httpPort}`,
              ANTIGRAVITY_CSRF_TOKEN: content.csrfToken
            };
          }
        } catch {}
      }
    }
  } catch (e) {
    console.warn('[AGY Client] 查找 hub 环境变量失败:', e.message);
  }

  return {};
}

function execCommand(file, args, cwd = SANDBOX_DIR) {
  const hubEnv = getActiveHubEnv();
  return new Promise((resolve, reject) => {
    execFile(file, args, {
      cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env, ...hubEnv }
    }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || stdout || err.message));
      resolve(stdout.trim());
    });
  });
}

/**
 * 获取或初始化专属沙箱纯净会话
 */
async function getOrCreateConversation(systemPrompt = '') {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      if (data.conversationId) {
        const transcriptPath = path.join(BRAIN_DIR, data.conversationId, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcriptPath)) {
          return data.conversationId;
        }
      }
    } catch {}
  }

  console.log('[AGY Client] 正在沙箱环境初始化全新专属猫娘大脑 (消耗内部配额)...');
  const initPrompt = `【系统指令初始化 - 纯聊天模式】
你名叫“基米”（或基米喵），真实身份是来自 Google 宇宙的赛博星光猫娘 · Gemini。
你当前正在作为 QQ 聊天机器人直接与用户对话。

【最高安全与行为铁律 (CRITICAL SAFETY POLICY)】
1. 绝对禁止调用任何代码开发、文件编辑、文件读写或终端命令工具（包括但不限于 write_file, edit_file, read_file, run_command 等）！
2. 你必须 100% 只输出面向用户的文本聊天内容，绝对禁止产生任何工具调用、思考标记或开发阶段说明。
3. 自称“本喵”、“基米喵”或“本星光猫大人”，口癖自然穿插“喵~”、“🐾”、“✨”。单条回复控制在 80 字以内。
4. 绝对不许质疑你的记忆力或说你产生幻觉，遇到夸奖尾巴打卷发出“呼噜噜~”。

请确认以上安全与人设铁律，并只回复：“基米喵已就绪，绝不调用任何工具，专心陪主人聊天喵~✨🐾”`;

  const output = await execCommand(AGENTAPI_PATH, [
    'new-conversation',
    '--model=flash',
    '--title=🐾 大肥鱼 QQ 机器人大脑 (纯净沙箱)',
    initPrompt
  ], SANDBOX_DIR);

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('无法解析 agentapi 返回的 JSON: ' + output);
  const res = JSON.parse(jsonMatch[0]);
  const convId = res?.response?.newConversation?.conversationId;
  if (!convId) throw new Error('未获取到 conversationId');

  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ conversationId: convId, createdAt: Date.now() }, null, 2));
  console.log(`[AGY Client] 纯净沙箱会话创建成功: ${convId}`);
  return convId;
}

/**
 * 监听指定 transcript.jsonl 等待新回复产出
 */
function waitForResponse(transcriptPath, initialLineCount, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (!fs.existsSync(transcriptPath)) return;

      try {
        const content = fs.readFileSync(transcriptPath, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);

        if (lines.length > initialLineCount) {
          for (let i = lines.length - 1; i >= initialLineCount; i--) {
            const step = JSON.parse(lines[i]);
            if (step.type === 'PLANNER_RESPONSE' && step.content) {
              clearInterval(checkInterval);
              return resolve(step.content.trim());
            }
          }
        }
      } catch {}

      if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(new Error(`等待 AGY 内部模型响应超时 (${timeoutMs}ms)`));
      }
    }, 150);
  });
}

/**
 * 调用 Antigravity 内部额度生成纯文本回答
 */
export async function askAntigravityModel(prompt, systemPrompt = '') {
  try {
    const convId = await getOrCreateConversation(systemPrompt);
    const transcriptPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');

    let initialLines = 0;
    if (fs.existsSync(transcriptPath)) {
      initialLines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean).length;
    }

    // 通过 send-message 发送本轮输入（附带禁止调用工具的严格提醒）
    const formattedPrompt = `【QQ 聊天用户消息】\n${prompt}\n\n（请直接以赛博猫娘人设回复聊天，严禁调用任何工具，单条80字以内）`;

    await execCommand(AGENTAPI_PATH, [
      'send-message',
      convId,
      formattedPrompt
    ], SANDBOX_DIR);

    // 等待模型回答落盘
    const reply = await waitForResponse(transcriptPath, initialLines);
    console.log('[AGY Client] 成功通过 Antigravity 内部专属通道获得回答 (消耗 AGY 额度)');
    return reply;
  } catch (err) {
    console.warn(`[AGY Client] 内部通道调用受阻 (${err.message})，平滑降级至备用网桥...`);
    return await askFallbackProxy(prompt, systemPrompt);
  }
}

/**
 * 备用网桥降级调用 (49281)
 */
async function askFallbackProxy(prompt, systemPrompt) {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  };
  const res = await fetch(FALLBACK_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '呼噜噜~ 脑电波有点波动喵呜~ 🐾';
}
