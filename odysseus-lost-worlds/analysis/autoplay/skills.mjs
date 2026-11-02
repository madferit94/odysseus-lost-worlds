// Bot skill profiles. These are assumptions about players, not measurements.
// Every number changes only how the bot sees and presses keys; game numbers are untouched.
//
// reaction      [mean, sd] seconds before a new threat (projectile, warning circle, wind-up) is noticed
// missProb      share of threats never noticed at all
// lateProb      share of threats noticed late, by an extra lateExtra [min, max] seconds
// margin        [mean, sd] px added to the bot's guess of each hit box (negative = cuts it too close)
// shieldProb    share of blockable threats for which holding S is even considered
// decision      seconds between re-plans (between them the bot keeps doing the same thing)
// attackInterval [min, max] seconds between presses of A while an enemy is in reach
// aimNoise      sd in px of how far off the enemy's row the bot lines up
// healBelow/healUse   walks into a seen heal zone when HP < healBelow*max, for a healUse share of zones
// lifeCarrierBelow    targets green-heart enemies first when HP < this share (0 = never on purpose)
// guardRespect  share of Antinous counter stances the bot stops attacking into
// specials      'smart' (aims finishers at bosses or groups), 'whenFull' (presses soon after full if
//               something is in front), 'rare' (presses a random finisher key at a random late moment),
//               'never' (only the final Q against Antinous that the game asks for)
// specialDelay  [min, max] seconds after the bar fills before the rule above is applied
// finalDelay    [min, max] seconds to press Q once the game says "PRESS Q" against Antinous
// wanderRate/wanderDur  random walks per second and their length (not attacking while wandering)
// sticky        keeps hitting the same enemy instead of switching to the nearest
export const SKILLS = {
  expert: {
    reaction: [0.18, 0.03], missProb: 0.02, lateProb: 0.05, lateExtra: [0.10, 0.25], margin: [6, 3],
    shieldProb: 0.95, decision: 1 / 30, attackInterval: [0.08, 0.12], aimNoise: 0,
    healBelow: 0.8, healUse: 0.95, lifeCarrierBelow: 0.7, guardRespect: 0.98,
    specials: 'smart', specialDelay: [0, 0.5], finalDelay: [0.3, 0.8], wanderRate: 0, wanderDur: [0, 0], sticky: false,
  },
  average: {
    reaction: [0.30, 0.05], missProb: 0.12, lateProb: 0.20, lateExtra: [0.15, 0.40], margin: [0, 6],
    shieldProb: 0.5, decision: 1 / 15, attackInterval: [0.12, 0.25], aimNoise: 6,
    healBelow: 0.5, healUse: 0.6, lifeCarrierBelow: 0.4, guardRespect: 0.6,
    specials: 'whenFull', specialDelay: [1, 4], finalDelay: [1, 3], wanderRate: 0.05, wanderDur: [0.3, 0.8], sticky: false,
  },
  novice: {
    reaction: [0.50, 0.10], missProb: 0.45, lateProb: 0.30, lateExtra: [0.20, 0.50], margin: [-4, 8],
    shieldProb: 0.1, decision: 1 / 10, attackInterval: [0.18, 0.40], aimNoise: 14,
    healBelow: 0.35, healUse: 0.3, lifeCarrierBelow: 0, guardRespect: 0.2,
    specials: 'rare', specialDelay: [20, 60], finalDelay: [2, 6], wanderRate: 0.25, wanderDur: [0.4, 1.2], sticky: true,
  },
  // Reference only, not a player model: never dodges, blocks or looks for heal zones; just walks up and attacks.
  mash: {
    reaction: [0.50, 0.10], missProb: 1, lateProb: 0, lateExtra: [0, 0], margin: [0, 0],
    shieldProb: 0, decision: 1 / 10, attackInterval: [0.18, 0.40], aimNoise: 14,
    healBelow: 0, healUse: 0, lifeCarrierBelow: 0, guardRespect: 0,
    specials: 'rare', specialDelay: [20, 60], finalDelay: [2, 6], wanderRate: 0, wanderDur: [0, 0], sticky: true,
  },
};
// Two more references: the average bot with one tool taken away, to see what keeps it alive.
// 'never' still presses Q for the final Antinous blow, because the game cannot be finished without it.
SKILLS['average-noshield'] = {...SKILLS.average, shieldProb: 0};
SKILLS['average-nofinisher'] = {...SKILLS.average, specials: 'never'};
export const MAIN_SKILLS = ['expert', 'average', 'novice'];
export const REFERENCE_SKILLS = ['mash', 'average-noshield', 'average-nofinisher'];
export const DIFFICULTIES = ['ithaca', 'aegean', 'trial', 'wrath'];
