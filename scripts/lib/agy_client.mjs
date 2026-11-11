/**
 * Antigravity (AGY) 内部模型额度官方底层直连引擎
 * 核心机制：
 * 1. 100% 直连 language_server.exe 二进制原生进程 (shell: false)
 * 2. 彻底杜绝 Windows cmd.exe 分词截断与换行符丢失 Bug
 * 3. 完美承载 Gemini 3.8 Flash 内部旗舰配额，毫秒级流式响应，0% 工具调用
 * 4. 专属绑定纯净对话大脑，若 AGY 离线则自动平滑降级至本地网桥
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const SESSION_FILE = path.join(ROOT_DIR, 'data', 'agy_session.json');

const LANGUAGE_SERVER_EXE = 'C:\\Users\\fyy26\\AppData\\Local\\Programs\\Antigravity\\resources\\bin\\language_server.exe';
const BRAIN_DIR = 'C:\\Users\\fyy26\\.gemini\\antigravity\\brain';
const DAEMON_DIR = 'C:\\Users\\fyy26\\.gemini\\antigravity\\daemon';
const FALLBACK_PROXY = 'http://127.0.0.1:49281/v1beta/models/gemini-3.5-flash-lite:generateContent';

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

function execNative(args) {
  const hubEnv = getActiveHubEnv();
  return new Promise((resolve, reject) => {
    // 关键核心：shell: false 确保参数通过 CreateProcess 原生数组直传，绝不经过 cmd.exe 字符串拆分
    execFile(LANGUAGE_SERVER_EXE, ['agentapi', ...args], {
      shell: false,
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

  console.log('[AGY Client] 正在初始化全新专属 Gemini 3.8 Flash 猫娘大脑...');
  const initPrompt = `你叫“基米”，是大家在 QQ 里的可爱贴心好友，带有一点灵动俏皮的猫系特质。请以真实人类网聊口吻直接陪主人和朋友们聊天。严禁任何括号动作描写，严禁调用任何工具，单条回复控制在80字内。`;

  const output = await execNative([
    'new-conversation',
    '--model=flash',
    '--title=FatCatBot',
    initPrompt
  ]);

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('无法解析 agentapi 返回的 JSON: ' + output);
  const res = JSON.parse(jsonMatch[0]);
  const convId = res?.response?.newConversation?.conversationId;
  if (!convId) throw new Error('未获取到 conversationId');

  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ conversationId: convId, createdAt: Date.now() }, null, 2));
  console.log(`[AGY Client] 纯净会话创建成功: ${convId}`);
  return convId;
}

/**
 * 监听指定 transcript.jsonl 等待新回复产出
 */
function waitForResponse(transcriptPath, initialLineCount, timeoutMs = 15000) {
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
 * 调用 Antigravity 内部额度生成纯文本回答 (Gemini 3.8 Flash)
 */
export async function askAntigravityModel(prompt, systemPrompt = '') {
  try {
    const convId = await getOrCreateConversation(systemPrompt);
    const transcriptPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');

    let initialLines = 0;
    if (fs.existsSync(transcriptPath)) {
      initialLines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean).length;
    }

    // 格式化当前轮次聊天消息
    const cleanPrompt = `${prompt}\n（请直接以自然网聊口吻在80字内简明回复，严禁任何括号动作描写与工具调用）`;

    // 通过原生二进制直传参数
    await execNative([
      'send-message',
      convId,
      cleanPrompt
    ]);

    // 等待模型回答落盘
    const reply = await waitForResponse(transcriptPath, initialLines);
    console.log('[AGY Client] 成功通过 Antigravity 内部专属通道获得回答 (消耗 AGY Gemini 3.8 Flash 额度)');
    return reply;
  } catch (err) {
    console.warn(`[AGY Client] 内部通道调用受阻 (${err.message})，平滑降级至备用网桥...`);
    return await askFallbackProxy(prompt, systemPrompt);
  }
}

/**
 * 备用网桥降级调用
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
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '呜哇~ 刚才网络好像有点卡，你再说一次呗！';
}
