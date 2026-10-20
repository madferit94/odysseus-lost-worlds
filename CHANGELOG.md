# Changelog

[Back to README](README.md) · [한국어](CHANGELOG.ko.md)

## What's new in v17 · A larger playfield display

- Removed the desktop width cap and made the control guide collapsible.
- Fullscreen hides the surrounding page and fits the game to the monitor. The 16:9 aspect ratio is preserved, with letterboxing on other screen shapes.
- Language, sound and controls remain accessible in fullscreen. Opening controls or leaving fullscreen pauses the game; close the guide and resume explicitly.
- `Esc` closes an open guide first, then exits fullscreen. Outside fullscreen it still pauses/resumes the game.
- Browsers that deny fullscreen use an expanded in-window view instead.
- World boundaries, difficulty, combat balance, rankings and optional analytics are unchanged. New analytics sessions are labeled `v17` to distinguish them from earlier sessions.

This change is merged into the repository only; the public link stays on v16 until a separate deployment. It responds to screen-size feedback, not a measured improvement in satisfaction or completion rate.

### v17 maintenance fixes · not yet deployed

These fixes are in the repository only. The public game (v16) does not have them yet.

- Old play-analytics records are cleaned up correctly. Before, an old journey whose events arrived later could block cleanup, and new opt-in recording then failed to start.
- A ranking submission with an empty (`null`) body is now refused as an invalid request instead of being reported as a server outage.
- When the network is down, the rankings show "Online rankings are unavailable. Please try again." instead of a raw browser error.
- The page no longer asks for a missing site icon, which removes a browser console error.
- The page language switches to Korean when KOR is selected, so screen readers and translation tools read it correctly.
- Documents now follow one naming rule: `X.md` is English and `X.ko.md` is Korean. Broken links between them were fixed.

## What's new in v16 · Optional play analytics

Opt in above the game before starting a new journey to record difficulty, stage progress, boss attempts, deaths, retries, finisher readiness/use and outcomes. Analytics is off by default; you can play without it. v15 gameplay balance is unchanged.

- Each journey uses a new random ID. Analytics tables do not store names, emails, IP addresses or full referring URLs. Rankings and hosting access logs are separate.
- Uncheck to stop future collection. Previously sent records remain under the retention policy.
- Only the operator can read raw events and export CSVs. Test records are excluded by default.
- An unknown outcome is not treated as failure. Exports cover the last 90 days; older raw records are cleaned on subsequent collection requests.

[Collection definitions, limitations and operator export guide](odysseus-lost-worlds/TELEMETRY-v16.md)

109 automated checks passed, and test events were verified in the live database. Browser start checks and automated combat simulations are distinguished; these are not findings from real players.

## What's new in v15

### Four difficulty levels

| Difficulty | Regular enemy HP / damage | Boss HP / damage |
| --- | --- | --- |
| Ithaca's Path · Easy | 85% / 85% | 85% / 85% |
| Aegean Voyage · Normal | 100% / 100% | 100% / 100% |
| Trial of the Gods · Hard | 115% / 115% | 120% / 115% |
| Poseidon's Wrath · Extreme | 130% / 130% | 135% / 130% |

Percentages are relative to v14 stats. Health and damage values are rounded to integers. **Aegean Voyage** is the default. Difficulty stays fixed during a run; a new selection takes effect when you start a new game.

### Two-bar finisher gauge

Store up to **2 energy bars**. Q, W, and E each require 1 bar; R, Zeus, requires 2 bars. Only the energy spent is deducted.

### Previous updates

- **v14:** Reduced boss health and damage by approximately 5%. These adjustments remain in v15.
- **v13:** Added three lives and randomly appearing boss-fight healing zones. If you have lives remaining, you can retry the fight after falling.
