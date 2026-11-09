/**
 * 基米夜间自主反思与认知演化引擎 (Nightly Reflection Engine)
 * 职责：
 * 1. 扫描 SQLite 中未被反思的最新交互流水
 * 2. 聚类分析群友讨论热点、被纠正的事实与新知识
 * 3. 自动提炼结构化实体三元组并持久化至图谱表
 * 4. 生成规范的《基米认知演化报告》归档至 data/reflection_reports/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  initMemory, 
  saveFactTriplet, 
  getMemoryStats 
} from './lib/memory_engine.mjs';
import { askAntigravityModel } from './lib/agy_client.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORT_DIR = path.resolve(__dirname, '../data/reflection_reports');

export async function runReflection() {
  console.log('======================================================');
  console.log('   ★ 基米夜间自主反思与认知演化批处理开始 ★');
  console.log('======================================================');

  const db = initMemory();
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // 1. 获取过去 24 小时未归纳的对话流水
  const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
  const stmt = db.prepare(`
    SELECT sender_nick, role, content, timestamp, session_key 
    FROM chat_messages 
    WHERE timestamp >= ? 
    ORDER BY timestamp ASC
    LIMIT 200
  `);
  const recentChats = stmt.all(cutoffTime);

  console.log(`[反思引擎] 扫描到过去 24 小时有效交互流水: ${recentChats.length} 条`);

  if (recentChats.length === 0) {
    console.log('[反思引擎] 今日尚无新的对话流水，生成常规健康巡检报告...');
  }

  // 2. 组装提炼提示词
  const chatSnippets = recentChats.map(c => `[${c.sender_nick || c.role}]: ${c.content}`).join('\n');
  const reflectionPrompt = `你是一个终极智能体认知架构师。这是赛博星光猫娘·基米过去 24 小时内的所有对话记录流水：
\`\`\`text
${chatSnippets || '（今日暂无群聊流水记录）'}
\`\`\`

请执行以下深度反思任务：
1. 【事实提炼】：抽取对话中群友提及的关键事实或偏好（例如：[某群友, 喜欢, 某事物]、[某群友, 身份/职业, 某内容]）。
2. 【人设自省】：检查基米的回答是否严格遵守赛博星光猫娘口吻（灵动傲娇、百万Token记忆自豪、气泡短句）。
3. 【演化总结】：总结今天群友关注的核心主题与基米的认知沉淀。

请输出规范的 Markdown 反思报告，如果提取到新的实体三元组，请在报告末尾以 JSON 代码块输出结构化三元组数组，格式如下：
\`\`\`json
[
  { "subject": "实体名", "predicate": "关系", "object": "对象/属性", "confidence": 0.95 }
]
\`\`\`
`;

  let reportContent = '';
  try {
    reportContent = await askAntigravityModel(reflectionPrompt, '你是一个终极智能体认知架构师与知识图谱专家。');
  } catch (err) {
    reportContent = `反思引擎调用异常: ${err.message}，已记录本地日志。`;
  }

  // 3. 解析并沉淀三元组至数据库
  try {
    const jsonMatch = /```json\s*([\s\S]*?)\s*```/.exec(reportContent);
    if (jsonMatch) {
      const triplets = JSON.parse(jsonMatch[1]);
      if (Array.isArray(triplets)) {
        for (const t of triplets) {
          if (t.subject && t.predicate && t.object) {
            saveFactTriplet(t.subject, t.predicate, t.object, 'nightly_reflection', t.confidence || 1.0);
            console.log(`[图谱结晶] 成功沉淀三元组: (${t.subject}) -[${t.predicate}]-> (${t.object})`);
          }
        }
      }
    }
  } catch (parseErr) {
    console.warn('[反思引擎] 三元组解析跳过:', parseErr.message);
  }

  // 4. 生成今日报告文件
  const dateStr = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPORT_DIR, `reflection_${dateStr}.md`);
  const stats = getMemoryStats();

  const finalMarkdown = `# 🐾 基米赛博星光认知演化日记 (${dateStr})

> 生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}  
> 运行模式: Nightly Cognitive Reflection (Cordis/DSH 闭环)  
> 当前记忆库统计: 流水 ${stats.totalMessages} 条 | 档案 ${stats.totalProfiles} 个 | 知识三元组 ${stats.totalTriplets} 个

---

${reportContent}

---
*本报告由 FatCat 自主演化引擎自动生成并受 Git 版本保护。*
`;

  fs.writeFileSync(reportPath, finalMarkdown, 'utf-8');
  console.log(`[反思引擎] 今日演化报告已归档至: ${reportPath}`);
  return reportPath;
}

// 支持直接命令行执行测试
if (process.argv[1] && process.argv[1].endsWith('run_reflection.mjs')) {
  runReflection().then(() => process.exit(0));
}
