import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.resolve(__dirname, '../../data/memory');
const DB_PATH = path.join(DB_DIR, 'dafeiyu_memory.sqlite');

let db = null;

/**
 * 初始化持久化记忆数据库并构建完整索引与 FTS5 引擎
 */
export function initMemory() {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new DatabaseSync(DB_PATH);

  // 开启 WAL 模式加速并发写入
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  } catch (err) {
    console.warn('[Memory Engine] PRAGMA 配置警报:', err.message);
  }

  // 1. 结构化对话历史流水表 (L2 情节记忆底座)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      sender_id TEXT,
      sender_nick TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      image_tags TEXT DEFAULT '',
      is_reply_to_bot INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_chat_session_time 
    ON chat_messages(session_key, timestamp);
  `);

  // 2. FTS5 全文检索引擎 (支持历史对话全文即时联想召回)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chat_fts USING fts5(
      content,
      sender_nick,
      session_key,
      content='chat_messages',
      content_rowid='id'
    );
  `);

  // 3. FTS5 自动同步触发器
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_chat_insert AFTER INSERT ON chat_messages BEGIN
      INSERT INTO chat_fts(rowid, content, sender_nick, session_key)
      VALUES (new.id, new.content, new.sender_nick, new.session_key);
    END;
  `);

  // 4. 用户画像与偏好表 (L3 语义记忆: 用户实体)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      nickname TEXT,
      bio TEXT DEFAULT '',
      preferences_json TEXT DEFAULT '{}',
      interaction_count INTEGER DEFAULT 1,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
  `);

  // 5. 实体知识图谱三元组表 (L3 语义记忆: 关系网络)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_triplets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object TEXT NOT NULL,
      source_session TEXT DEFAULT '',
      confidence REAL DEFAULT 1.0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_triplets_sub_pred 
    ON knowledge_triplets(subject, predicate);
  `);

  console.log(`[Memory Engine] 持久化记忆数据库已成功挂载: ${DB_PATH}`);
  return db;
}

/**
 * 记录单条消息并触发画像统计更新
 */
export function recordMessage({
  sessionKey,
  senderId = '',
  senderNick = '',
  role = 'user',
  content = '',
  imageTags = '',
  isReplyToBot = false,
  timestamp = Date.now()
}) {
  const database = initMemory();

  const insertStmt = database.prepare(`
    INSERT INTO chat_messages (
      session_key, sender_id, sender_nick, role, content, image_tags, is_reply_to_bot, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    sessionKey,
    String(senderId),
    senderNick,
    role,
    content,
    imageTags,
    isReplyToBot ? 1 : 0,
    timestamp
  );

  // 若为人类用户发言，自动更新用户画像热度
  if (role === 'user' && senderId) {
    recordUserProfile(senderId, senderNick, timestamp);
  }
}

/**
 * 获取指定会话最新的多轮上下文 (直接兼容 Google Gemini API 格式)
 */
export function getRecentHistory(sessionKey, maxTurns = 30) {
  const database = initMemory();
  const limit = maxTurns * 2; // user + model

  const stmt = database.prepare(`
    SELECT role, sender_nick, content, image_tags 
    FROM chat_messages 
    WHERE session_key = ? 
    ORDER BY timestamp DESC, id DESC 
    LIMIT ?
  `);

  const rows = stmt.all(sessionKey, limit);
  rows.reverse(); // 恢复时间正序

  const contents = [];
  for (const row of rows) {
    const parts = [];
    if (row.role === 'user') {
      const speaker = row.sender_nick ? `[${row.sender_nick}]: ` : '';
      parts.push({ text: `${speaker}${row.content}` });
      if (row.image_tags) {
        parts.push({ text: row.image_tags });
      }
    } else {
      parts.push({ text: row.content });
    }
    contents.push({ role: row.role, parts });
  }

  return contents;
}

/**
 * 基于 FTS5 引擎在历史长河中联想召回最相关的过去对话事实
 */
export function recallRelevantMemories(queryText, currentSessionKey = '', limit = 4) {
  if (!queryText || queryText.trim().length < 2) return [];
  const database = initMemory();

  // 清理关键词符号，仅保留搜索词
  const sanitized = queryText
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .join(' OR ');

  if (!sanitized) return [];

  try {
    const stmt = database.prepare(`
      SELECT m.sender_nick, m.content, m.timestamp, m.session_key
      FROM chat_fts f
      JOIN chat_messages m ON f.rowid = m.id
      WHERE chat_fts MATCH ? AND m.role = 'user'
      ORDER BY bm25(chat_fts) ASC, m.timestamp DESC
      LIMIT ?
    `);

    const results = stmt.all(sanitized, limit);
    return results.map(r => ({
      sender: r.sender_nick || '未知群友',
      content: r.content,
      time: new Date(r.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      isSameSession: r.session_key === currentSessionKey
    }));
  } catch (err) {
    return [];
  }
}

/**
 * 更新或创建用户画像
 */
export function recordUserProfile(userId, nickname = '', timestamp = Date.now()) {
  const database = initMemory();
  const strId = String(userId);

  const getStmt = database.prepare('SELECT * FROM user_profiles WHERE user_id = ?');
  const existing = getStmt.get(strId);

  if (existing) {
    const updateStmt = database.prepare(`
      UPDATE user_profiles 
      SET interaction_count = interaction_count + 1,
          last_seen = ?,
          nickname = CASE WHEN ? != '' THEN ? ELSE nickname END
      WHERE user_id = ?
    `);
    updateStmt.run(timestamp, nickname, nickname, strId);
  } else {
    const insertStmt = database.prepare(`
      INSERT INTO user_profiles (user_id, nickname, first_seen, last_seen, interaction_count)
      VALUES (?, ?, ?, ?, 1)
    `);
    insertStmt.run(strId, nickname, timestamp, timestamp);
  }
}

/**
 * 写入实体事实三元组 (L3 语义图谱)
 */
export function saveFactTriplet(subject, predicate, object, sourceSession = '', confidence = 1.0) {
  const database = initMemory();
  const now = Date.now();

  const stmt = database.prepare(`
    INSERT INTO knowledge_triplets (subject, predicate, object, source_session, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(subject.trim(), predicate.trim(), object.trim(), sourceSession, confidence, now, now);
}

/**
 * 查询指定实体关联的所有知识三元组
 */
export function queryFactTriplets(entity, limit = 10) {
  const database = initMemory();
  const stmt = database.prepare(`
    SELECT subject, predicate, object, confidence 
    FROM knowledge_triplets 
    WHERE subject LIKE ? OR object LIKE ?
    ORDER BY confidence DESC, updated_at DESC
    LIMIT ?
  `);

  const pattern = `%${entity.trim()}%`;
  return stmt.all(pattern, pattern, limit);
}

/**
 * 清除特定会话的历史上下文 (支持 /reset 或 重置记忆 指令)
 */
export function clearSessionHistory(sessionKey) {
  const database = initMemory();
  const stmt = database.prepare('DELETE FROM chat_messages WHERE session_key = ?');
  stmt.run(sessionKey);
  console.log(`[Memory Engine] 会话上下文已安全重置: ${sessionKey}`);
}

/**
 * 获取记忆数据库宏观统计数据
 */
export function getMemoryStats() {
  const database = initMemory();

  const msgCount = database.prepare('SELECT COUNT(*) as count FROM chat_messages').get().count;
  const userCount = database.prepare('SELECT COUNT(*) as count FROM user_profiles').get().count;
  const tripletCount = database.prepare('SELECT COUNT(*) as count FROM knowledge_triplets').get().count;

  let fileSizeMb = 0;
  if (fs.existsSync(DB_PATH)) {
    const stat = fs.statSync(DB_PATH);
    fileSizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  }

  return {
    totalMessages: msgCount,
    totalProfiles: userCount,
    totalTriplets: tripletCount,
    dbSizeBytes: fileSizeMb + ' MB'
  };
}
