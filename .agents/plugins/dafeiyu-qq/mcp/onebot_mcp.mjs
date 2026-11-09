#!/usr/bin/env node
import readline from 'node:readline';
import { 
  getBilibiliHotList, 
  getZhihuHotList, 
  getWeiboHotSearch 
} from '../../../../scripts/lib/intel_scout.mjs';
import { 
  getMemoryStats, 
  recallRelevantMemories 
} from '../../../../scripts/lib/memory_engine.mjs';

const ENDPOINT = (process.env.ONEBOT_HTTP_ENDPOINT || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TOKEN = process.env.ONEBOT_ACCESS_TOKEN || '2KLZUoF6jBpV0OkMEu44wPMSogEX4I0cWqRm8p2Z5LY';

const TOOLS = [
  {
    name: 'send_group_msg',
    description: '向指定的 QQ 群发送群聊消息（支持纯文本与表情）',
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: ['number', 'string'],
          description: '目标 QQ 群号'
        },
        message: {
          type: 'string',
          description: '发送的消息内容'
        }
      },
      required: ['group_id', 'message']
    }
  },
  {
    name: 'send_private_msg',
    description: '向指定 QQ 好友发送私聊消息',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: ['number', 'string'],
          description: '目标好友的 QQ 账号'
        },
        message: {
          type: 'string',
          description: '发送的私聊内容'
        }
      },
      required: ['user_id', 'message']
    }
  },
  {
    name: 'get_login_info',
    description: '获取当前登录机器人的 QQ 号与昵称状态',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_group_list',
    description: '获取机器人当前已加入的 QQ 群聊列表',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_friend_list',
    description: '获取机器人的 QQ 好友列表',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'send_group_poke',
    description: '在指定群聊中执行“戳一戳”群友操作',
    inputSchema: {
      type: 'object',
      properties: {
        group_id: {
          type: ['number', 'string'],
          description: '目标群号'
        },
        user_id: {
          type: ['number', 'string'],
          description: '被戳的群友 QQ 号'
        }
      },
      required: ['group_id', 'user_id']
    }
  },
  {
    name: 'send_like',
    description: '给指定 QQ 好友主页点赞',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: ['number', 'string'],
          description: '目标 QQ 号'
        },
        times: {
          type: 'number',
          description: '点赞次数（默认 10）'
        }
      },
      required: ['user_id']
    }
  },
  {
    name: 'invoke_onebot_action',
    description: '直接调用底层任意原生 OneBot v11 API 动作（如 get_msg、delete_msg 等）',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'OneBot 动作名称（如 get_msg）'
        },
        params: {
          type: 'object',
          description: '调用参数字典'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'get_bilibili_hot',
    description: '获取哔哩哔哩 (B站) 实时全站热门视频排行 Top 榜单',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '获取条数（默认 10）'
        }
      }
    }
  },
  {
    name: 'get_zhihu_hot',
    description: '获取知乎全站实时热榜榜单与热点描述',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '获取条数（默认 10）'
        }
      }
    }
  },
  {
    name: 'get_weibo_hot',
    description: '获取新浪微博实时热搜榜',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '获取条数（默认 10）'
        }
      }
    }
  },
  {
    name: 'get_memory_stats',
    description: '查询大肥鱼（基米）持久化记忆库全景统计指标（流水数、群友档案数、三元组图谱数、磁盘占用）',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'recall_memory',
    description: '根据关键词在基米历史长河对话记忆库中执行毫秒级 FTS5 语义联想召回',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '需要联想召回的关键词或主题短语'
        },
        limit: {
          type: 'number',
          description: '召回条数（默认 5）'
        }
      },
      required: ['keyword']
    }
  }
];

async function callOneBot(action, params = {}) {
  const url = `${ENDPOINT}/${action}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        status: 'failed',
        http_code: res.status,
        error: data || 'HTTP request failed'
      };
    }
    return data;
  } catch (err) {
    return {
      status: 'connection_error',
      message: `无法连接到 OneBot 接口 (${ENDPOINT})。请检查 SnowLuma 是否已启动并开启了 OneBot HTTP 服务。`,
      details: err.message
    };
  }
}

async function handleToolCall(name, args) {
  if (name === 'get_bilibili_hot') {
    const list = await getBilibiliHotList(args.limit || 10);
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  }
  if (name === 'get_zhihu_hot') {
    const list = await getZhihuHotList(args.limit || 10);
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  }
  if (name === 'get_weibo_hot') {
    const list = await getWeiboHotSearch(args.limit || 10);
    return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
  }
  if (name === 'get_memory_stats') {
    const stats = getMemoryStats();
    return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
  }
  if (name === 'recall_memory') {
    const recalled = recallRelevantMemories(args.keyword, '', args.limit || 5);
    return { content: [{ type: 'text', text: JSON.stringify(recalled, null, 2) }] };
  }

  let action = name;
  let params = { ...args };

  if (name === 'invoke_onebot_action') {
    action = args.action;
    params = args.params || {};
  } else if (name === 'send_group_poke') {
    action = 'group_poke';
  }

  const result = await callOneBot(action, params);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

function sendResponse(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    return;
  }

  const { id, method, params } = request;

  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'dafeiyu-onebot-mcp',
          version: '1.0.0'
        }
      }
    });
  } else if (method === 'notifications/initialized') {
    // notification, no response required
  } else if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS
      }
    });
  } else if (method === 'tools/call') {
    try {
      const toolResult = await handleToolCall(params.name, params.arguments || {});
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: toolResult
      });
    } catch (err) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message
        }
      });
    }
  } else if (id !== undefined) {
    sendResponse({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });
  }
});
