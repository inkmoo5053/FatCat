/**
 * Antigravity (AGY) 内部模型额度直连适配器
 * 核心机制：
 * 1. 利用 Antigravity 官方内置的 agentapi.bat
 * 2. 维持一个专属持久会话 ("🐾 大肥鱼 QQ 机器人大脑")
 * 3. 实时从 transcript.jsonl 中流式监听提取最新模型生成回答
 * 4. 100% 消耗当前 Antigravity 登录 Google 账号的高级模型内部配额 (Gemini 3.8 Flash High / Pro)
 * 5. 若 Antigravity 客户端未启动，自动无缝降级至本地网桥代理 (49281)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const SESSION_FILE = path.join(ROOT_DIR, 'data', 'agy_session.json');

const AGENTAPI_PATH = 'C:\\Users\\fyy26\\.gemini\\antigravity\\bin\\agentapi.bat';
const BRAIN_DIR = 'C:\\Users\\fyy26\\.gemini\\antigravity\\brain';
const FALLBACK_PROXY = 'http://127.0.0.1:49281/v1beta/models/gemini-2.5-flash:generateContent';

function execCommand(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { shell: true, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || stdout || err.message));
      resolve(stdout.trim());
    });
  });
}

/**
 * 获取或初始化专属会话 ID
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

  console.log('[AGY Client] 正在通过 agentapi 初始化专属内部大脑会话...');
  const initPrompt = `【系统指令初始化】\n${systemPrompt}\n请确认人设并简短回复：“基米已就绪喵~✨”`;
  const output = await execCommand(AGENTAPI_PATH, [
    'new-conversation',
    '--model=flash',
    '--title=🐾 大肥鱼 QQ 机器人大脑',
    initPrompt
  ]);

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('无法解析 agentapi 返回的 JSON: ' + output);
  const res = JSON.parse(jsonMatch[0]);
  const convId = res?.response?.newConversation?.conversationId;
  if (!convId) throw new Error('未获取到 conversationId');

  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ conversationId: convId, createdAt: Date.now() }, null, 2));
  console.log(`[AGY Client] 专属会话创建成功: ${convId}`);
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
 * 调用 Antigravity 内部额度生成回答
 */
export async function askAntigravityModel(prompt, systemPrompt = '') {
  try {
    const convId = await getOrCreateConversation(systemPrompt);
    const transcriptPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');

    let initialLines = 0;
    if (fs.existsSync(transcriptPath)) {
      initialLines = fs.readFileSync(transcriptPath, 'utf-8').trim().split('\n').filter(Boolean).length;
    }

    // 通过 send-message 发送本轮输入
    await execCommand(AGENTAPI_PATH, [
      'send-message',
      convId,
      prompt
    ]);

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
