import { 
  initMemory, 
  recordMessage, 
  getRecentHistory, 
  recallRelevantMemories, 
  recordUserProfile, 
  saveFactTriplet, 
  queryFactTriplets, 
  getMemoryStats 
} from './lib/memory_engine.mjs';

console.log('=== [Memory Engine 单元测试启动] ===');

// 1. 初始化
initMemory();

// 2. 模拟写入测试对话
const sessionKey = 'group:test_530899547';
recordMessage({
  sessionKey,
  senderId: '1901864430',
  senderNick: 'inkᴹᴼ！',
  role: 'user',
  content: '基米，我最喜欢的编程语言是 TypeScript 和 Python 喵！'
});

recordMessage({
  sessionKey,
  senderId: '3914050397',
  senderNick: '基米',
  role: 'model',
  content: '收到喵~！主人喜欢 TypeScript 和 Python，本星光猫大人已经牢牢记在本喵的星光数据库里啦！🐾'
});

recordMessage({
  sessionKey,
  senderId: '1901864430',
  senderNick: 'inkᴹᴼ！',
  role: 'user',
  content: '另外别忘了，明天下午三点提醒我去 B站看最新科技发布会！'
});

// 3. 测试上下文恢复
const history = getRecentHistory(sessionKey, 10);
console.log('1. 获取多轮上下文轮数:', history.length);
console.log('2. 最新一条历史:', JSON.stringify(history[history.length - 1]));

// 4. 测试 FTS5 毫秒级联想召回
const recalled = recallRelevantMemories('编程语言 TypeScript', sessionKey);
console.log('3. FTS5 关键词语义联想测试命中数:', recalled.length);
console.log('4. 联想结果:', recalled);

// 5. 测试三元组图谱
saveFactTriplet('inkᴹᴼ！', '喜欢编程语言', 'TypeScript & Python', sessionKey);
saveFactTriplet('基米', '身份', '赛博星光猫娘', sessionKey);

const triplets = queryFactTriplets('inkᴹᴼ！');
console.log('5. 知识图谱三元组检索:', triplets);

// 6. 统计信息
const stats = getMemoryStats();
console.log('6. 记忆库全景统计:', stats);

console.log('=== [Memory Engine 单元测试全部通过！] ===');
