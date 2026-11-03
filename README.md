# Jan-Ken

A non-violent martial arts rock-paper-scissors duel game for the web. You pick a fighter, wager coins, and play best-of-3 rounds. Each round is best of 3 clashes, and every pick stays hidden until the 5-second timer hits 00.

## Run it

Requires Node 18 or newer. There are no dependencies to install.

```
npm start
```

Open http://localhost:3000. To test an online duel, open the game in two different browsers, or in one normal window and one private window, so each has its own purse.

## Put it online

Deploy the folder to any Node host that supports WebSockets, such as Render, Railway, Fly.io or a VPS. The start command is `npm start`, and the server reads `PORT` from the environment. The WhatsApp invite link is built from whatever address the game is served from, for example `https://your-domain/?room=JK-8821`. That link opens the lobby with the room code already filled in.

## Files

| File | What it does |
|---|---|
| `public/index.html` | All six screens and the styling |
| `public/game.js` | Screen flow, wallet, CPU opponent, networking, combat animation |
| `public/fighters.js` | The 8 anime-style fighters: rig, ink outlines, cel shading, faces, hair and cloth motion |
| `public/art.js` | The 8 painted arenas and their particle effects |
| `public/referee.js` | Match rules, shared by the browser (practice) and the server (online) |
| `server.js` | Static hosting plus duel rooms, with a server-side timer and hidden picks |
| `ws-lite.js` | Small built-in WebSocket implementation, so no npm packages are needed |

## Rules as built

- **Purse:** each new player starts with 400 coins, stored in localStorage. A duel costs 100 coins, the prize pool is 200, and the winner takes all of it (+100 net).
- **Practice vs CPU:** free, with no coins at stake. The CPU sometimes counters your most frequent pick.
- **Match structure:** best of 3 rounds, and each round is best of 3 clashes. A draw replays the clash. Each lost clash takes away 50% of a fighter's stability bar.
- **Picks:** a player who doesn't pick before 00 loses that clash, and if neither picks it counts as a draw. Your rival only sees "LOCKED IN", never your choice.
- **Leaving:** leaving or disconnecting mid-duel forfeits it to the other player.
- **Unlocks:** 4 fighters are open from the start (Hikari, Kagero, Tetsuo, Hayato). Shin, Gonta, Daigo and Yuki unlock one by one, after 1, 2, 3 and 4 online duel wins against a real player. CPU wins don't count. Three extra arenas (Raked Stone Garden, Moonlit Castle Keep, Snowfall Mountain Shrine) unlock after 3, 6 and 10 rounds won in any mode. Progress is stored in the browser, like the purse. The thresholds are the `unlock` values in `fighters.js` and `art.js`.
- **Low purse:** if your purse drops below 100, a "Refill" link resets it to 400.
- **Purses are local:** they live in each player's own browser and nothing is checked on the server, so treat coins as play money. Server-side accounts would be the next step.
