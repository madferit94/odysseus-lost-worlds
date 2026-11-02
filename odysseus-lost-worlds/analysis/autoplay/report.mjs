// Writes REPORT.md (English) and REPORT.ko.md (Korean) from summary.json.
// Every number in the reports comes from the summary; the fixed text explains how to read it.
import fs from 'node:fs';
import path from 'node:path';
import {STAGES, STAGE_SHORT, BOSSES, BOSS_STAGES} from './run.mjs';
import {MAIN_SKILLS, REFERENCE_SKILLS} from './skills.mjs';

const BOSS_NAME = {polyphemus: 'Polyphemus', poseidon: 'Poseidon', caocao: 'Cao Cao', antinous: 'Antinous'};
const BOSS_KO = {polyphemus: '폴리페모스', poseidon: '포세이돈', caocao: '조조', antinous: '안티노오스'};
const STAGE_KO = ['프롤로그 트로이', 'G1 키클롭스 폐허', 'G2 폴리페모스', 'G3 포세이돈', 'E1 황건 마을', 'E2 대나무 숲', 'E3 불타는 요새', 'E4 조조', '최종장 이타카', '안티노오스', '에필로그'];
const DIFF = {ithaca: ['Ithaca (easy)', '이타카 (쉬움)'], aegean: ['Aegean (normal)', '에게해 (보통)'], trial: ['Trial (hard)', '시련 (어려움)'], wrath: ['Wrath (extreme)', '분노 (최상)']};
const SKILL = {expert: ['expert', '숙련'], average: ['average', '보통'], novice: ['novice', '초보'], mash: ['no-defence reference', '무방어 기준'], 'average-noshield': ['average, no shield', '보통, 방패 없음'], 'average-nofinisher': ['average, no finishers', '보통, 필살기 없음']};

export function writeReports(summary, outDir) {
  fs.writeFileSync(path.join(outDir, 'REPORT.md'), build(summary, 0));
  fs.writeFileSync(path.join(outDir, 'REPORT.ko.md'), build(summary, 1));
}

function build(S, L) {
  const t = (en, ko) => L ? ko : en;
  const pct = x => x === null || x === undefined ? '–' : (100 * x).toFixed(x > 0 && x < 0.01 ? 1 : 0) + '%';
  const ci = w => w.p === null ? '–' : `${pct(w.p)} (${pct(w.lo)}–${pct(w.hi)})`;
  const num = (x, d = 0) => x === null || x === undefined ? '–' : Number(x).toFixed(d);
  const stageName = s => L ? STAGE_KO[s] : STAGE_SHORT[s];
  const bossName = b => L ? BOSS_KO[b] : BOSS_NAME[b];
  const D = S.difficulties, skills = S.skills, main = skills.filter(s => MAIN_SKILLS.includes(s)), refs = skills.filter(s => REFERENCE_SKILLS.includes(s)), cell = (d, s) => S.cells[d + '/' + s];
  const diffName = d => DIFF[d]?.[L] ?? d, skillName = s => SKILL[s]?.[L] ?? s;
  const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '|' + head.map((_, i) => i ? ' ---: ' : ' --- ').join('|') + '|', ...rows.map(r => '| ' + r.join(' | ') + ' |')].join('\n');
  const out = [];
  const P = (...x) => { for (const i of x) out.push(i, ''); };

  // ---------- facts used in the summary sentences
  const lost = skills.flatMap(s => D.map(d => [s, d, cell(d, s)])).filter(([, , c]) => c.outcomes.clear < c.n);
  const allRuns = skills.reduce((a, s) => a + D.reduce((b, d) => b + cell(d, s).n, 0), 0);
  let endsEarly = 0, endsTotal = 0;
  for (const s of skills) for (const d of D) for (const st of cell(d, s).stages) { endsTotal += st.endedHere; if (st.stage <= 3) endsEarly += st.endedHere; }
  const deathsBy = (s, from, to) => D.reduce((a, d) => a + cell(d, s).stages.filter(st => st.stage >= from && st.stage <= to).reduce((b, st) => b + st.deaths, 0), 0);
  const stuck = skills.reduce((a, s) => a + D.reduce((b, d) => b + cell(d, s).outcomes.stuck + cell(d, s).outcomes.timeout, 0), 0);

  P(t('# Autoplay balance report', '# 자동 플레이 밸런스 보고서'),
    t('**English** · [한국어](REPORT.ko.md)', '[English](REPORT.md) · **한국어**'),
    t(`Bots played the real game code (v17 \`game.js\` and friends, unchanged) **${allRuns.toLocaleString('en')} times**: ${D.length} difficulties × ${skills.length} bot skill levels × ${S.meta.runsPerCell} seeds each. Every run is a full journey with 3 lives and the game's own "continue" after a death, exactly like the page. The goal is to see *where* the game is hard, not to replace real players.`,
      `봇이 실제 게임 코드(v17 \`game.js\` 등, 수정 없음)를 **${allRuns.toLocaleString('en')}판** 플레이했습니다: 난이도 ${D.length}개 × 봇 실력 ${skills.length}단계 × 시드 ${S.meta.runsPerCell}개. 한 판은 목숨 3개로 처음부터 끝까지 진행하며, 죽으면 페이지와 똑같이 게임의 "이어하기"로 재도전합니다. 목적은 실제 플레이어를 대신하는 것이 아니라 *어디가* 어려운지 보는 것입니다.`));

  // ---------- key findings
  P(t('## Key findings', '## 핵심 결과'));
  const f = [];
  const full = main.filter(s => D.every(d => cell(d, s).clearRate.p === 1));
  if (full.length) f.push(t(`**${full.map(skillName).join(' and ')} bots cleared every run on every difficulty.** For a player who reacts in about 0.3 s and makes the average bot's share of mistakes, no difficulty is hard enough to end a run.`,
    `**${full.map(skillName).join(', ')} 봇은 모든 난이도에서 모든 판을 클리어했습니다.** 반응 약 0.3초에 보통 봇만큼 실수하는 플레이어라면, 어느 난이도도 판을 끝낼 만큼 어렵지 않습니다.`));
  for (const s of main.filter(s => !full.includes(s))) {
    const worst = D.map(d => [d, cell(d, s).clearRate]).sort((a, b) => a[1].p - b[1].p)[0];
    f.push(t(`**${skillName(s)} bots** clear ${D.map(d => `${diffName(d)} ${pct(cell(d, s).clearRate.p)}`).join(', ')}. The lowest is ${diffName(worst[0])}: ${ci(worst[1])}.`,
      `**${skillName(s)} 봇** 클리어율: ${D.map(d => `${diffName(d)} ${pct(cell(d, s).clearRate.p)}`).join(', ')}. 가장 낮은 곳은 ${diffName(worst[0])}: ${ci(worst[1])}.`));
  }
  if (endsTotal) f.push(t(`**${pct(endsEarly / endsTotal)} of all lost runs (${endsEarly} of ${endsTotal}) ended in the first three fighting stages** (G1 Cyclops Ruins, Polyphemus, Poseidon).`,
    `**실패한 판의 ${pct(endsEarly / endsTotal)}(${endsTotal}판 중 ${endsEarly}판)가 처음 세 전투 스테이지**(G1 키클롭스 폐허, 폴리페모스, 포세이돈)에서 끝났습니다.`));
  for (const s of main) {
    const early = deathsBy(s, 1, 3), late = deathsBy(s, 4, 10);
    if (early + late === 0) continue;
    f.push(t(`For **${skillName(s)}** bots, ${early} deaths happened in G1–G3 and ${late} in all later stages together. The player gains +8% attack per stage and +20 max HP per boss, so the later stages get easier for the same bot.`,
      `**${skillName(s)}** 봇의 사망은 G1–G3에서 ${early}번, 그 뒤 모든 스테이지를 합쳐 ${late}번이었습니다. 플레이어는 스테이지마다 공격력 +8%, 보스마다 최대 HP +20을 얻기 때문에 같은 봇에게 후반이 더 쉬워집니다.`));
  }
  const worstBoss = [];
  for (const s of main) for (const d of D) for (const b of BOSSES) { const x = cell(d, s).bosses[b]; if (x.attempts && x.deaths) worstBoss.push([s, d, b, x]); }
  worstBoss.sort((a, b) => b[3].deathPerAttempt.p - a[3].deathPerAttempt.p);
  if (worstBoss.length) { const [s, d, b, x] = worstBoss[0]; f.push(t(`**Deadliest boss:** ${bossName(b)} for ${skillName(s)} bots on ${diffName(d)}: ${ci(x.deathPerAttempt)} of lives that entered the fight were lost there (${x.deaths} of ${x.attempts}).`,
    `**가장 위험한 보스:** ${diffName(d)}의 ${skillName(s)} 봇에게 ${bossName(b)}. 전투에 들어간 목숨의 ${ci(x.deathPerAttempt)}를 잃었습니다(${x.attempts}번 중 ${x.deaths}번).`)); }
  const ex = main.includes('expert') ? D.map(d => cell(d, 'expert').damagePerRun) : [];
  if (ex.length) f.push(t(`**Expert bots lose almost no HP** (${ex.map(x => num(x)).join(' / ')} HP per whole journey on ${D.map(diffName).join(' / ')}). They hold S toward bosses, which blocks every boss attack including water bombs and arrow rain, and they fire a finisher whenever a boss or a group is in reach.`,
    `**숙련 봇은 HP를 거의 잃지 않습니다** (${D.map(diffName).join(' / ')}에서 한 판 전체 ${ex.map(x => num(x)).join(' / ')} HP). 보스를 향해 S를 눌러 물폭탄·화살비까지 포함한 모든 보스 공격을 막고, 보스나 무리가 닿으면 곧바로 필살기를 쓰기 때문입니다.`));
  if (skills.includes('mash') && skills.includes('novice')) {
    const m = D.map(d => cell(d, 'mash').clearRate.p), n = D.map(d => cell(d, 'novice').clearRate.p);
    if (D.some((_, i) => m[i] > n[i])) f.push(t(`**A bot that never dodges at all cleared more often than the novice bot** on ${D.filter((_, i) => m[i] > n[i]).map(diffName).join(', ')} (${D.map((d, i) => m[i] > n[i] ? `${pct(m[i])} vs ${pct(n[i])}` : null).filter(Boolean).join(', ')}). Killing fast and stealing life seems to protect more than late, half-hearted dodging and wandering.`,
      `**전혀 피하지 않는 봇이 초보 봇보다 더 자주 클리어했습니다**: ${D.filter((_, i) => m[i] > n[i]).map(diffName).join(', ')} (${D.map((d, i) => m[i] > n[i] ? `${pct(m[i])} 대 ${pct(n[i])}` : null).filter(Boolean).join(', ')}). 늦고 어설픈 회피와 헤매기보다 빨리 처치하고 흡혈하는 쪽이 더 안전한 것으로 보입니다.`));
  }
  if (skills.includes('average-nofinisher') && skills.includes('average')) {
    const a = D.map(d => cell(d, 'average')), nf = D.map(d => cell(d, 'average-nofinisher')), ns = D.map(d => skills.includes('average-noshield') ? cell(d, 'average-noshield') : null);
    const last = D.length - 1;
    f.push(t(`**Finishers are what keep the average bot alive, more than the shield.** On ${diffName(D[last])}, the average bot loses ${num(a[last].damagePerRun)} HP per journey; without finishers ${num(nf[last].damagePerRun)} HP (${num(nf[last].deathsPerRun, 2)} deaths per run)${ns[last] ? `; without the shield ${num(ns[last].damagePerRun)} HP` : ''}. It used about ${num(a[last].specialsPerRun)} finishers per journey: the bar fills in a few seconds of hitting, and each one freezes every enemy for 2.7 s, makes the player untouchable and wipes all arrows and warning circles.`,
      `**보통 봇을 살리는 것은 방패보다 필살기입니다.** ${diffName(D[last])}에서 보통 봇은 한 판에 ${num(a[last].damagePerRun)} HP를 잃는데, 필살기가 없으면 ${num(nf[last].damagePerRun)} HP(판당 사망 ${num(nf[last].deathsPerRun, 2)})${ns[last] ? `, 방패가 없으면 ${num(ns[last].damagePerRun)} HP` : ''}를 잃습니다. 한 판에 필살기를 약 ${num(a[last].specialsPerRun)}번 썼습니다. 몇 초만 때려도 게이지가 차고, 한 번 쓸 때마다 모든 적이 2.7초 멈추고 플레이어는 무적이 되며 화살과 경고 원이 모두 사라집니다.`));
  }
  if (stuck) f.push(t(`${stuck} runs hit the time cap or got stuck; they count as not cleared.`, `${stuck}판은 시간 제한에 걸리거나 멈춰서 클리어 실패로 셌습니다.`));
  else f.push(t('No run got stuck or hit the 60-minute game-time cap.', '멈추거나 60분 게임 시간 제한에 걸린 판은 없었습니다.'));
  P(f.map(x => '- ' + x).join('\n'));

  // ---------- skill definitions
  P(t('## The bot skill levels', '## 봇 실력 단계'),
    t('Bots read the game state the way a player reads the screen and act only by pressing the game\'s keys (arrows, A, S, Q/W/E/R, Enter). Skill changes only *how* they see and press, never a game number. All bots keep the default bronze sword and never jump. These are **assumptions**, not measured human data.',
      '봇은 플레이어가 화면을 보듯 게임 상태를 읽고, 게임 키(방향키, A, S, Q/W/E/R, Enter)를 누르는 것으로만 행동합니다. 실력은 *보고 누르는 방식*만 바꾸며 게임 숫자는 건드리지 않습니다. 모든 봇은 기본 청동검을 쓰고 점프하지 않습니다. 아래 값은 실제 사람을 잰 것이 아니라 **가정**입니다.'));
  const prof = s => S.profiles[s];
  const rows = [
    [t('Reaction to a new attack', '새 공격에 대한 반응'), s => `${num(prof(s).reaction[0] * 1000)} ± ${num(prof(s).reaction[1] * 1000)} ms`],
    [t('Attacks never noticed', '아예 못 본 공격'), s => pct(prof(s).missProb)],
    [t('Attacks noticed late', '늦게 본 공격'), s => `${pct(prof(s).lateProb)} (+${num(prof(s).lateExtra[0] * 1000)}–${num(prof(s).lateExtra[1] * 1000)} ms)`],
    [t('Hit-box guess error', '판정 범위 추정 오차'), s => `${prof(s).margin[0] >= 0 ? '+' : ''}${prof(s).margin[0]} ± ${prof(s).margin[1]} px`],
    [t('Thinks of the shield (S)', '방패(S)를 떠올림'), s => pct(prof(s).shieldProb)],
    [t('Re-plans every', '판단 간격'), s => `${num(prof(s).decision * 1000)} ms`],
    [t('Time between A presses', 'A 누르는 간격'), s => `${num(prof(s).attackInterval[0] * 1000)}–${num(prof(s).attackInterval[1] * 1000)} ms`],
    [t('Lines up off the enemy row by', '적 줄에서 어긋남'), s => `± ${prof(s).aimNoise} px`],
    [t('Heal zone', '힐 존'), s => prof(s).healUse ? t(`${pct(prof(s).healUse)} of zones when HP < ${pct(prof(s).healBelow)}`, `HP < ${pct(prof(s).healBelow)}일 때 ${pct(prof(s).healUse)}`) : t('never', '안 감')],
    [t('Goes for green-heart enemies', '초록 하트 적 우선'), s => prof(s).lifeCarrierBelow ? t(`when HP < ${pct(prof(s).lifeCarrierBelow)}`, `HP < ${pct(prof(s).lifeCarrierBelow)}일 때`) : t('no', '아니오')],
    [t('Stops hitting into Antinous\'s counter', '안티노오스 반격 자세 때 공격 멈춤'), s => pct(prof(s).guardRespect)],
    [t('Finishers (Q/W/E/R)', '필살기 (Q/W/E/R)'), s => ({smart: t('aimed at bosses or groups', '보스나 무리에 조준'), whenFull: t(`soon after full (${prof(s).specialDelay.join('–')} s) if an enemy is in front`, `가득 찬 뒤 곧(${prof(s).specialDelay.join('–')}초), 앞에 적이 있으면`), rare: t(`random key ${prof(s).specialDelay.join('–')} s after full`, `가득 찬 뒤 ${prof(s).specialDelay.join('–')}초에 아무 키나`)})[prof(s).specials]],
    [t('Random wandering', '무작위로 헤매기'), s => prof(s).wanderRate ? t(`${prof(s).wanderRate} per s, ${prof(s).wanderDur.join('–')} s each`, `초당 ${prof(s).wanderRate}회, 한 번에 ${prof(s).wanderDur.join('–')}초`) : t('no', '없음')],
  ];
  P(table([t('Setting', '설정'), ...main.map(skillName)], rows.map(([label, fn]) => [label, ...main.map(fn)])));
  P(t('- **expert**: close to the best this bot design can do; blocks almost everything blockable and aims finishers.\n- **average**: reacts in about 250–350 ms, misses or mistimes some attacks, uses the shield half the time and presses a finisher soon after the bar fills.\n- **novice**: slow, misses almost half of the attacks, rarely shields, wanders, uses finishers late and at random.\n\nReference bots (not player models), to see what matters:\n- **no-defence reference**: same speed as the novice, but walks up and attacks only; never dodges, blocks or looks for heal zones. It shows how far pure attacking gets.\n- **average, no shield**: the average bot that never holds S.\n- **average, no finishers**: the average bot that never uses Q/W/E/R, except the one Q the game asks for to finish Antinous.',
    '- **숙련**: 이 봇 설계로 낼 수 있는 최선에 가깝습니다. 막을 수 있는 공격은 거의 다 막고 필살기를 조준해서 씁니다.\n- **보통**: 약 250–350ms에 반응하고, 일부 공격은 못 보거나 타이밍을 놓치며, 방패는 절반쯤 쓰고, 게이지가 차면 곧 필살기를 누릅니다.\n- **초보**: 느리고, 공격의 절반 가까이를 못 보며, 방패를 거의 안 쓰고, 헤매고, 필살기를 늦게 아무렇게나 씁니다.\n\n무엇이 중요한지 보려고 돌린 기준 봇(플레이어 모델 아님):\n- **무방어 기준**: 초보와 같은 속도지만 걸어가서 공격만 합니다. 피하기·막기·힐 존 찾기를 전혀 하지 않습니다. 공격만으로 어디까지 가는지 보여 줍니다.\n- **보통, 방패 없음**: S를 전혀 누르지 않는 보통 봇.\n- **보통, 필살기 없음**: Q/W/E/R을 쓰지 않는 보통 봇. 단, 안티노오스를 끝내려고 게임이 요구하는 Q 한 번은 누릅니다.'));

  // ---------- 1. clear rate
  P(t('## 1. Clear rate by difficulty and skill', '## 1. 난이도·실력별 클리어율'),
    t('Share of runs that reached the ending. In brackets: 95% confidence interval (Wilson). "No death" = cleared without losing a single life.',
      '엔딩까지 간 판의 비율입니다. 괄호 안은 95% 신뢰구간(Wilson)입니다. "무사망"은 목숨을 하나도 잃지 않고 클리어한 비율입니다.'));
  P(table([t('Skill', '실력'), ...D.map(diffName)], skills.map(s => [skillName(s), ...D.map(d => `${ci(cell(d, s).clearRate)}<br>${t('no death', '무사망')} ${pct(cell(d, s).noDeathClearRate.p)}`)])));
  P(table([t('Skill', '실력'), ...D.map(diffName)], skills.map(s => [skillName(s), ...D.map(d => { const c = cell(d, s); return t(`${num(c.deathsPerRun, 2)} deaths · ${num(c.damagePerRun)} HP lost · ${num(c.specialsPerRun, 1)} finishers · ${num(c.medianClearSeconds)} s`, `사망 ${num(c.deathsPerRun, 2)} · HP ${num(c.damagePerRun)} 잃음 · 필살기 ${num(c.specialsPerRun, 1)} · ${num(c.medianClearSeconds)}초`); })])));
  P(t('Second table: averages per run; the time is the median game time of cleared runs (cut-scenes included).', '두 번째 표: 한 판 평균값. 시간은 클리어한 판의 게임 시간 중앙값(컷신 포함)입니다.'));

  // ---------- 1b. reference bots
  if (refs.length) {
    P(t('## What keeps the player alive (reference bots)', '## 무엇이 플레이어를 살리나 (기준 봇)'),
      t('Each cell: clear rate · deaths per run · HP lost per run · deadliest boss (deaths per attempt). Compare each reference bot with the average bot it is based on.',
        '각 칸: 클리어율 · 판당 사망 · 판당 잃은 HP · 가장 위험한 보스(도전 1회당 사망률). 기준 봇을 바탕이 된 보통 봇과 비교해 보세요.'));
    const deadliest = c => { const b = BOSSES.map(b => [b, c.bosses[b].deathPerAttempt.p || 0]).sort((x, y) => y[1] - x[1])[0]; return b[1] ? `${bossName(b[0])} ${pct(b[1])}` : t('none', '없음'); };
    P(table([t('Bot', '봇'), ...D.map(diffName)], ['average', 'novice', ...refs].filter(s => skills.includes(s)).map(s => [skillName(s), ...D.map(d => { const c = cell(d, s); return `${pct(c.clearRate.p)} · ${num(c.deathsPerRun, 2)} · ${num(c.damagePerRun)} HP · ${deadliest(c)}`; })])));
  }

  // ---------- 2. funnel
  P(t('## 2. Where runs end', '## 2. 어디서 판이 끝나는가'),
    t('Each cell: share of runs that **entered** the stage, then how many runs **ended** there (last life lost). Player-model bots only; skills with no lost run get one line.',
      '각 칸: 그 스테이지에 **들어간** 판의 비율, 그리고 거기서 **끝난**(마지막 목숨을 잃은) 판 수입니다. 플레이어 모델 봇만 보여 주며, 실패한 판이 없는 실력은 한 줄로 적었습니다.'));
  const losing = main.filter(s => D.some(d => cell(d, s).outcomes.clear < cell(d, s).n));
  for (const s of main.filter(s => !losing.includes(s))) P(t(`- **${skillName(s)}**: all runs cleared on every difficulty; no stage ended a run.`, `- **${skillName(s)}**: 모든 난이도에서 전부 클리어, 판이 끝난 스테이지 없음.`));
  for (const s of losing) {
    P(`**${skillName(s)}**`);
    P(table([t('Stage', '스테이지'), ...D.map(diffName)], Array.from({length: STAGES}, (_, st) => [stageName(st), ...D.map(d => { const c = cell(d, s), x = c.stages[st]; return `${pct(x.reached / c.n)}${x.endedHere ? ` · **${t('ended', '끝남')} ${x.endedHere}**` : ''}`; })])));
  }

  // ---------- 3. boss deaths per attempt
  P(t('## 3. Deaths per boss attempt', '## 3. 보스 도전 1회당 사망률'),
    t('An attempt is one life that enters the boss fight (the first entry or a continue). The rate is lives lost at that boss ÷ attempts, with the 95% interval and the raw counts. Attempts within one run are not fully independent, so read the interval as approximate.',
      '도전 1회는 보스전에 들어간 목숨 하나입니다(처음 입장 또는 이어하기). 비율 = 그 보스에서 잃은 목숨 ÷ 도전 횟수이며, 95% 구간과 실제 횟수를 함께 적었습니다. 한 판 안의 도전들은 완전히 독립이 아니므로 구간은 대략적인 값으로 보세요.'));
  for (const s of main) {
    const any = D.some(d => BOSSES.some(b => cell(d, s).bosses[b].deaths));
    if (!any) { P(t(`- **${skillName(s)}**: no deaths at any boss on any difficulty.`, `- **${skillName(s)}**: 어느 난이도, 어느 보스에서도 사망 없음.`)); continue; }
    P(`**${skillName(s)}**`);
    P(table([t('Boss', '보스'), ...D.map(diffName)], BOSSES.map(b => [bossName(b), ...D.map(d => { const x = cell(d, s).bosses[b]; return x.attempts ? `${ci(x.deathPerAttempt)} · ${x.deaths}/${x.attempts}` : '–'; })])));
  }

  // ---------- 4. boss fight time
  P(t('## 4. Median boss fight time', '## 4. 보스전 시간 (중앙값)'),
    t('Seconds of game time from entering the fight to the boss falling, added up over every life used, for fights that were won. In brackets: 90th percentile.',
      '이긴 보스전에서, 전투에 들어간 순간부터 보스가 쓰러질 때까지의 게임 시간(초)을 사용한 모든 목숨에 걸쳐 더한 값입니다. 괄호 안은 90번째 백분위수입니다.'));
  P(table([t('Boss', '보스'), t('Skill', '실력'), ...D.map(diffName)], BOSSES.flatMap(b => main.map(s => [bossName(b), skillName(s), ...D.map(d => { const x = cell(d, s).bosses[b]; return x.won ? `${num(x.medianFightSeconds, 1)} (${num(x.p90FightSeconds, 1)})` : '–'; })]))));

  // ---------- 5. damage per stage
  P(t('## 5. HP lost and close calls per stage', '## 5. 스테이지별 잃은 HP와 아슬아슬했던 비율'),
    t('Mean HP lost in the stage (all lives) · share of runs whose HP fell below 25% there (or died). Only runs that entered the stage count. Late stages have more max HP (+20 per boss), so the same HP loss is a smaller share.',
      '그 스테이지에서 잃은 HP 평균(모든 목숨 합) · HP가 25% 아래로 떨어졌거나 죽은 판의 비율. 그 스테이지에 들어간 판만 셉니다. 후반에는 최대 HP가 늘어나므로(보스마다 +20) 같은 HP 손실이라도 비중이 작습니다.'));
  for (const s of main.filter(s => s !== 'expert')) {
    P(`**${skillName(s)}**`);
    P(table([t('Stage', '스테이지'), ...D.map(diffName)], Array.from({length: STAGES}, (_, st) => [stageName(st), ...D.map(d => { const x = cell(d, s).stages[st]; return x.reached ? `${num(x.meanDamage)} · ${pct(x.nearDeath.p)}` : '–'; })])));
  }
  if (main.includes('expert')) P(t(`Expert bots lost at most ${num(Math.max(...D.flatMap(d => cell(d, 'expert').stages.map(x => x.meanDamage || 0))), 1)} HP on average in any stage, so their table is left out.`,
    `숙련 봇은 어느 스테이지에서도 평균 ${num(Math.max(...D.flatMap(d => cell(d, 'expert').stages.map(x => x.meanDamage || 0))), 1)} HP 이하만 잃어서 표를 생략했습니다.`));

  // ---------- 6. hardest spikes
  P(t('## 6. Hardest spots', '## 6. 가장 어려운 지점'),
    t('Stages ranked by deaths per 100 runs that entered them, pooled over the four difficulties (ties broken by close calls, then HP lost). Top 3 per skill.',
      '네 난이도를 합쳐, 그 스테이지에 들어간 100판당 사망 수로 순위를 매겼습니다(같으면 아슬아슬 비율, 그다음 잃은 HP 순). 실력별 상위 3개입니다.'));
  for (const s of main) {
    const top = S.spikes[s].slice(0, 3);
    if (!top.some(x => x.deathsPer100 || x.nearDeath.k)) { P(t(`- **${skillName(s)}**: nothing stands out (no deaths and no run below 25% HP in any stage).`, `- **${skillName(s)}**: 눈에 띄는 곳 없음 (어느 스테이지에서도 사망 없고 HP 25% 미만으로 떨어진 판 없음).`)); continue; }
    P(`**${skillName(s)}**`);
    P(table(['#', t('Stage', '스테이지'), t('Deaths / 100 runs', '100판당 사망'), t('HP < 25%', 'HP 25% 미만'), t('Mean HP lost', '평균 잃은 HP'), t('By difficulty (deaths / 100)', '난이도별 (100판당 사망)')],
      top.map((x, i) => [i + 1, stageName(x.stage), num(x.deathsPer100, 1), ci(x.nearDeath), num(x.meanDamage), D.map(d => `${diffName(d).split(' ')[0]} ${num(x.byDifficulty[d]?.deathsPer100, 1)}`).join(' · ')])));
  }

  // ---------- 7. candidates
  P(t('## 7. Candidates to look at (not decisions)', '## 7. 살펴볼 후보 (결정 아님)'),
    t('These are places where the numbers stand out. They are questions for play-testing with people, not proven fixes; no number change is suggested here as fact.',
      '숫자가 눈에 띄는 곳입니다. 사람과 함께 플레이 테스트로 확인할 질문이지 검증된 해결책이 아니며, 여기서 숫자 변경을 사실로 제안하지 않습니다.'));
  const cand = [];
  const nov = main.includes('novice') ? 'novice' : main[main.length - 1];
  {
    const early = deathsBy(nov, 1, 3), late = deathsBy(nov, 4, 10), dm = D.map(d => cell(d, nov).stages[1].meanDamage), dl = D.map(d => cell(d, nov).stages[8].meanDamage);
    cand.push(t(`**Early difficulty spike (G1–G3).** ${skillName(nov)} bots: ${early} deaths in G1–G3 vs ${late} afterwards. Mean HP lost in G1 Cyclops Ruins (${dm.map(x => num(x)).join(' / ')}) is higher than in the Final Act Ithaca waves (${dl.map(x => num(x)).join(' / ')}) on every difficulty. In the code, attack grows +8% per stage and max HP +20 per boss, so the opening is fought with the weakest Odysseus. Question: is the first real fight meant to be the hardest wall?`,
      `**초반 난이도 급상승 (G1–G3).** ${skillName(nov)} 봇: G1–G3 사망 ${early}번, 그 뒤 ${late}번. G1 키클롭스 폐허에서 잃은 HP 평균(${dm.map(x => num(x)).join(' / ')})이 모든 난이도에서 최종장 이타카 웨이브(${dl.map(x => num(x)).join(' / ')})보다 큽니다. 코드상 공격력은 스테이지마다 +8%, 최대 HP는 보스마다 +20 늘어나므로, 오프닝은 가장 약한 오디세우스로 싸웁니다. 질문: 첫 실전 전투가 가장 높은 벽이 되도록 의도한 것인가?`));
  }
  if (worstBoss.length) {
    const byBoss = BOSSES.map(b => [b, D.map(d => cell(d, nov).bosses[b].deathPerAttempt.p)]);
    cand.push(t(`**Poseidon and Polyphemus on the harder difficulties.** ${skillName(nov)} bot deaths per attempt (${D.map(diffName).join(' / ')}): ${byBoss.map(([b, v]) => `${bossName(b)} ${v.map(pct).join(' / ')}`).join('; ')}. The two Greek bosses come before most of the attack and HP growth.`,
      `**어려운 난이도의 포세이돈과 폴리페모스.** ${skillName(nov)} 봇의 도전 1회당 사망률(${D.map(diffName).join(' / ')}): ${byBoss.map(([b, v]) => `${bossName(b)} ${v.map(pct).join(' / ')}`).join('; ')}. 두 그리스 보스는 공격력·HP 성장 대부분이 오기 전에 나옵니다.`));
  }
  if (skills.includes('average-nofinisher') && skills.includes('average')) {
    const a = D.map(d => cell(d, 'average').damagePerRun), nf = D.map(d => cell(d, 'average-nofinisher').damagePerRun), sp = D.map(d => cell(d, 'average').specialsPerRun);
    const ns = skills.includes('average-noshield') ? D.map(d => cell(d, 'average-noshield').damagePerRun) : null;
    cand.push(t(`**Finishers as a defence.** HP lost per journey (${D.map(diffName).join(' / ')}): average bot ${a.map(x => num(x)).join(' / ')}; without finishers ${nf.map(x => num(x)).join(' / ')}${ns ? `; without the shield ${ns.map(x => num(x)).join(' / ')}` : ''}. The average bot used ${sp.map(x => num(x)).join(' / ')} finishers per journey. In the code a hit gives 8 energy (12 on a boss), a kill 13 and a third combo hit 10, and each finisher stops the world for 2.7 s, gives 3 s of invulnerability and clears every projectile and hazard. Question: are finishers meant to be this frequent, and this protective?`,
      `**방어 수단으로서의 필살기.** 한 판에 잃은 HP(${D.map(diffName).join(' / ')}): 보통 봇 ${a.map(x => num(x)).join(' / ')}, 필살기 없이 ${nf.map(x => num(x)).join(' / ')}${ns ? `, 방패 없이 ${ns.map(x => num(x)).join(' / ')}` : ''}. 보통 봇은 한 판에 필살기를 ${sp.map(x => num(x)).join(' / ')}번 썼습니다. 코드상 한 번 때리면 에너지 8(보스는 12), 처치하면 13, 콤보 세 번째 타격이면 10을 얻고, 필살기 한 번에 세상이 2.7초 멈추며 3초 무적이 되고 모든 투사체와 위험 지역이 사라집니다. 질문: 필살기가 이렇게 자주 나오고 이렇게 강하게 지켜 주는 것이 의도인가?`));
  }
  if (main.includes('expert')) {
    const bd = D.map(d => BOSSES.reduce((a, b) => a + (cell(d, 'expert').bosses[b].meanDamage || 0), 0));
    cand.push(t(`**The shield against bosses.** Expert bots lose ${bd.map(x => num(x, 1)).join(' / ')} HP in all four boss stages together. In the code, every boss attack (\`bossAttack\` hazards, dashes, projectiles) is blocked when S is held facing the boss, including area attacks that fall from above. For the average bot the shield matters much less than finishers (see above). Question: should some boss attacks need a dodge instead of a block?`,
      `**보스전의 방패.** 숙련 봇은 네 보스 스테이지를 합쳐 ${bd.map(x => num(x, 1)).join(' / ')} HP만 잃습니다. 코드상 보스를 향해 S를 누르고 있으면 위에서 떨어지는 범위 공격까지 포함해 모든 보스 공격(\`bossAttack\` 위험 지역, 돌진, 투사체)이 막힙니다. 보통 봇에게는 방패가 필살기보다 훨씬 덜 중요했습니다(위 참고). 질문: 일부 보스 공격은 막기 대신 회피가 필요해야 하는가?`));
  }
  if (main.includes('average')) {
    const a = D.map(d => cell(d, 'average').clearRate.p), w = D.map(d => cell(d, 'average').damagePerRun);
    cand.push(t(`**How far apart the difficulties are.** The average bot clears ${a.map(pct).join(' / ')} and loses ${w.map(x => num(x)).join(' / ')} HP per journey on ${D.map(diffName).join(' / ')}. Enemy numbers go from ×0.85 to ×1.3–1.35, while healing (life steal, green hearts, heal zones, +12 HP between waves, +20 max HP per boss) stays the same. Question: should "extreme" be a real threat for a steady, average player?`,
      `**난이도 간 차이.** 보통 봇은 ${D.map(diffName).join(' / ')}에서 ${a.map(pct).join(' / ')} 클리어하고 한 판에 ${w.map(x => num(x)).join(' / ')} HP를 잃습니다. 적 수치는 ×0.85에서 ×1.3–1.35까지 오르지만 회복(흡혈, 초록 하트, 힐 존, 웨이브 사이 +12 HP, 보스마다 최대 HP +20)은 그대로입니다. 질문: "최상"이 꾸준한 보통 실력 플레이어에게 진짜 위협이어야 하는가?`));
  }
  if (main.includes('novice')) {
    const late = D.map(d => cell(d, 'novice').stages.slice(4, 11).reduce((a, x) => a + x.deaths, 0));
    cand.push(t(`**Later stages for weaker players.** Novice bot deaths from E1 to the end: ${late.join(' / ')} (${D.map(diffName).join(' / ')}). Once past Poseidon, almost everyone finishes. Question: does the second half still feel tense?`,
      `**약한 플레이어에게 후반.** 초보 봇의 E1부터 끝까지 사망 수: ${late.join(' / ')} (${D.map(diffName).join(' / ')}). 포세이돈을 넘으면 거의 모두 끝까지 갑니다. 질문: 후반부가 여전히 긴장감이 있는가?`));
  }
  P(cand.map((x, i) => `${i + 1}. ${x}`).join('\n'));

  // ---------- 8. limits
  P(t('## 8. What this can and cannot tell us', '## 8. 이 결과로 알 수 있는 것과 없는 것'),
    t(`**Can:** compare stages, bosses and difficulties with each other *for the same bot*; show where damage and deaths pile up; show how much each difficulty step changes the outcome; repeat exactly after a balance change (same seeds give the same runs).

**Cannot:**
- **Bots are not people.** They know exactly where every hit box is (with a set error), never get confused by the screen, never panic, never learn, and never quit out of boredom. People also jump and switch weapons; these bots never do.
- **The skill levels are assumptions.** Reaction times and mistake rates were chosen by hand, not measured. A different but equally reasonable choice could move the clear rates a lot. Treat the numbers as **relative** (which stage is harder than which), not as "X% of players will clear".
- **No real player data backs this yet.** The live site has about 110 page views and no finished run, which is too little to check the bots against.
- The page itself is not drawn (no rendering), and the game runs at a fixed 60 steps per second. Game rules are unchanged, but rendering normally uses the random number generator for screen shake, so a seed here does not match a seed in a browser.
- Confidence intervals cover only the randomness of the runs, not the uncertainty in the bot models.`,
      `**알 수 있는 것:** *같은 봇* 기준으로 스테이지·보스·난이도를 서로 비교하기, 피해와 사망이 어디에 몰리는지, 난이도 한 단계가 결과를 얼마나 바꾸는지, 밸런스를 바꾼 뒤 똑같이 다시 재 보기(같은 시드는 같은 판을 만듭니다).

**알 수 없는 것:**
- **봇은 사람이 아닙니다.** 봇은 정해진 오차 안에서 모든 판정 범위를 정확히 알고, 화면에 헷갈리지 않고, 당황하지 않고, 배우지 않고, 지루해서 그만두지도 않습니다. 사람은 점프하고 무기를 바꾸기도 하지만 이 봇들은 그러지 않습니다.
- **실력 단계는 가정입니다.** 반응 시간과 실수 비율은 직접 정한 값이지 잰 값이 아닙니다. 똑같이 그럴듯한 다른 값을 고르면 클리어율이 크게 달라질 수 있습니다. 숫자는 "플레이어의 X%가 클리어한다"가 아니라 **상대 비교**(어느 스테이지가 더 어려운가)로 보세요.
- **아직 실제 플레이어 데이터로 확인하지 못했습니다.** 라이브 사이트는 페이지 뷰 약 110회에 끝까지 간 판이 없어 봇과 비교하기에 너무 적습니다.
- 화면은 그리지 않고(렌더링 없음), 게임은 초당 60스텝 고정으로 돌립니다. 게임 규칙은 그대로지만 브라우저에서는 화면 흔들림에도 난수를 쓰므로, 여기의 시드와 브라우저의 판은 일치하지 않습니다.
- 신뢰구간은 판마다의 무작위성만 반영하며, 봇 모델 자체의 불확실성은 반영하지 않습니다.`));

  // ---------- 9. how to run
  P(t('## 9. How to run', '## 9. 실행 방법'),
    t('Use Node.js 24 or later inside the game folder (`odysseus-lost-worlds/odysseus-lost-worlds`). No `npm install` is needed.', '게임 폴더(`odysseus-lost-worlds/odysseus-lost-worlds`) 안에서 Node.js 24 이상을 쓰세요. `npm install`은 필요 없습니다.'),
    '```sh\n' + [
      t('node analysis/autoplay/simulate.mjs                  # full batch (200 seeds per cell), rewrites results/', 'node analysis/autoplay/simulate.mjs                  # 전체 배치 (칸마다 시드 200개), results/ 다시 씀'),
      t('node analysis/autoplay/simulate.mjs --runs 20        # quick look', 'node analysis/autoplay/simulate.mjs --runs 20        # 빠르게 보기'),
      t('node analysis/autoplay/simulate.mjs --one wrath novice 7   # one run as JSON', 'node analysis/autoplay/simulate.mjs --one wrath novice 7   # 한 판을 JSON으로'),
      t('node analysis/autoplay/simulate.mjs --report-only    # rebuild the reports from summary.json', 'node analysis/autoplay/simulate.mjs --report-only    # summary.json으로 보고서만 다시 만들기'),
      t('node --test analysis/autoplay/check.mjs              # simulator checks', 'node --test analysis/autoplay/check.mjs              # 시뮬레이터 점검'),
    ].join('\n') + '\n```',
    t('Other options: `--difficulties ithaca,wrath`, `--skills expert,novice`, `--seed 1000` (first seed), `--workers 4`, `--out some/folder`. Bot profiles are in `skills.mjs`; the bot itself is `bot.js`. After any change to the game numbers, run the batch again and compare `summary.json`.',
      '다른 옵션: `--difficulties ithaca,wrath`, `--skills expert,novice`, `--seed 1000`(첫 시드), `--workers 4`, `--out 폴더`. 봇 실력 값은 `skills.mjs`, 봇 본체는 `bot.js`에 있습니다. 게임 숫자를 바꾼 뒤에는 배치를 다시 돌려 `summary.json`을 비교하세요.'));

  // ---------- run details
  const m = S.meta;
  P(t('## Run details', '## 실행 정보'),
    table([t('Item', '항목'), t('Value', '값')], [
      [t('Runs', '판 수'), `${m.totalRuns} (${m.runsPerCell} ${t('per difficulty × skill', '난이도 × 실력마다')}, ${t('seeds', '시드')} ${m.seeds[0]}–${m.seeds[1]})`],
      [t('Wall time', '실제 걸린 시간'), `${m.wallSeconds} s · ${m.workers} ${t('worker threads', '워커 스레드')} · Node ${m.node}`],
      [t('Game time played', '플레이한 게임 시간'), `${num(m.gameSecondsPlayed / 3600, 1)} h`],
      [t('Time step', '시간 간격'), m.frameStep],
      [t('Safety caps', '안전 제한'), t(`${m.maxGameSeconds / 60} min game time → timeout; no progress for ${m.stuckSeconds} s → stuck`, `게임 시간 ${m.maxGameSeconds / 60}분 → timeout, ${m.stuckSeconds}초 동안 진행 없음 → stuck`)],
      [t('Weapon', '무기'), t(m.weapon, '청동검 (기본, 바꾸지 않음)')],
      [t('Files', '파일'), t('`runs.csv` one row per run · `summary.json` all tables above', '`runs.csv` 한 판에 한 줄 · `summary.json` 위 표 전부')],
    ]));
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
