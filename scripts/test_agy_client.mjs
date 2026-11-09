import { askAntigravityModel } from './lib/agy_client.mjs';

async function test() {
  console.log('=== [Antigravity 内部额度调用测试开始] ===');
  const systemPrompt = '你名叫“基米”，是一只赛博星光猫娘，口癖是“喵~”和“🐾”。';
  const userPrompt = '请用一句话证明你正在使用 Antigravity 内部高级配额喵！';

  const reply = await askAntigravityModel(userPrompt, systemPrompt);
  console.log('\n[模型最终回复]:\n', reply);
  console.log('\n=== [测试成功完成！] ===');
}

test();
