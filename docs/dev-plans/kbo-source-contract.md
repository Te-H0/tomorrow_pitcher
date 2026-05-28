# KBO Source Contract

This note fixes the source boundary for crawler and manual verification work. Its purpose is to prove that the service can extract the needed values from the selected KBO public pages, not from portal/news mirrors.

## Allowed Sources

Use only these pages for starter/schedule verification unless the user explicitly approves a new source.

| Data | Source URL | Status |
|---|---|---|
| Schedule and game result status | `https://www.koreabaseball.com/Schedule/Schedule.aspx` | Selected, parser not finalized |
| Official announced starters | `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=YYYYMMDD&gameId={gameId}&section=PREVIEW` | Selected, DOM selector not finalized |
| Actual starters and pitcher appearances | `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=YYYYMMDD&gameId={gameId}&section=REVIEW` | Selected, starter selector implemented |
| Pitcher master/player ID | `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx` and pitcher detail pages | Selected, parser not finalized |
| Registration/de-registration | `https://www.koreabaseball.com/Player/Register.aspx` | Selected, parser not finalized |
| Movement detail context | `https://www.koreabaseball.com/Player/Trade.aspx` | Selected, parser not finalized |

## Disallowed For Verification

- Do not use Nate, Naver, Daum, news wires, blogs, community posts, or search snippets as starter/schedule verification sources.
- Do not use portal/news pages to fill official announced starters or actual starters.
- If a non-KBO source is useful as a human clue, record it as an unresolved note only after user approval; do not treat it as source data.
- Do not call KBO `/ws/` internal API paths.

## Current Implemented DOM Contract

Implemented in `scripts/extract-kbo-starters.mjs`.

Actual starter extraction:

```text
Page:
https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=YYYYMMDD&gameId={gameId}&section=REVIEW

Away pitcher table:
#tblAwayPitcher tbody tr

Home pitcher table:
#tblHomePitcher tbody tr

Starter row:
first table row under the relevant table whose rendered text contains "선발"

Starter pitcher name:
first td in that starter row
```

Current helper logic:

```text
readStarter(page, tableId)
→ page.locator(`#${tableId} tbody tr`, { hasText: "선발" }).first()
→ row.locator("td").first().innerText()
```

GameCenter `gameId` is currently derived as:

```text
YYYYMMDD + away team KBO code + home team KBO code + "0"
```

This may need extension for doubleheaders, suspended games, or rescheduled edge cases.

## DOM Contracts Still Needed

- `Schedule.aspx`: exact rendered selectors for date, time, away team, home team, stadium, score/status, and cancellation/result memo.
- GameCenter `PREVIEW`: exact rendered selectors for away/home official announced starter names.
- Pitcher master pages: exact selector for KBO `playerId`, pitcher name, team, handedness, and season stats.
- `Register.aspx`: exact selector for team/date registration and de-registration rows.
- `Trade.aspx`: exact selector for player-name search results and movement detail text.

## Scheduler Notes

Future scheduler design should use KST windows and keep the same source boundary.

- Official announced starter sync: after KBO publishes previews, with repeated checks before first pitch.
- Actual starter sync: after games are confirmed finished on `Schedule.aspx` or KBO scoreboard, then read GameCenter `REVIEW`.
- A practical manual-test reminder time is around 23:10 KST for 18:30 games, but production scheduling should check game status rather than assume all games ended.
- Rainout, cancelled, postponed, suspended, or no-game rows must not create `ACTUAL` starter records.
