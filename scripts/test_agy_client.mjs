import { askAntigravityModel } from './lib/agy_client.mjs';

async function test() {
  console.log('=== [Antigravity 内部额度调用测试开始] ===');
  const systemPrompt = `你叫“基米”，是大家在 QQ 里的可爱贴心好友，带有一点灵动俏皮的猫系特质。请以真实人类网聊口吻直接陪主人和朋友们聊天。严禁任何括号动作描写，严禁调用任何工具，单条回复控制在80字内。`;
  const userPrompt = '基米，今天晚上吃啥好呀？有什么推荐的吗';

  const reply = await askAntigravityModel(userPrompt, systemPrompt);
  console.log('\n[模型最终回复]:\n', reply);
  console.log('\n=== [测试成功完成！] ===');
}

test();
