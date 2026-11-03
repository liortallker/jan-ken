/* Jan-Ken referee: authoritative match logic shared by the browser (CPU practice)
   and the Node server (online duels). Sides are 'a' (host / you) and 'b' (guest / CPU). */
(function (root) {
  const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  const TIMING = { roundIntro: 2800, clash: 5000, reveal: 2700, roundEnd: 3000 };

  class Referee {
    constructor(send, timing) {
      this.send = send;
      this.t = Object.assign({}, TIMING, timing || {});
      this.timers = [];
      this.stopped = false;
    }
    later(fn, ms) {
      const id = setTimeout(() => {
        this.timers = this.timers.filter((x) => x !== id);
        if (!this.stopped) fn();
      }, ms);
      this.timers.push(id);
    }
    start() {
      this.roundWins = { a: 0, b: 0 };
      this.round = 0;
      this.over = false;
      this.nextRound();
    }
    nextRound() {
      this.round++;
      this.clashWins = { a: 0, b: 0 };
      this.clashNo = 0;
      this.send('round', { round: this.round, roundWins: { ...this.roundWins } });
      this.later(() => this.nextClash(), this.t.roundIntro);
    }
    nextClash() {
      this.clashNo++;
      this.picks = { a: null, b: null };
      this.open = true;
      this.send('clash', { round: this.round, clash: this.clashNo, clashWins: { ...this.clashWins }, duration: this.t.clash });
      this.later(() => this.reveal(), this.t.clash);
    }
    pick(side, choice) {
      if (!this.open || this.over || !BEATS[choice] || (side !== 'a' && side !== 'b') || this.picks[side]) return false;
      this.picks[side] = choice;
      this.send('locked', { side });
      return true;
    }
    reveal() {
      this.open = false;
      const { a, b } = this.picks;
      let winner;
      if (!a && !b) winner = 'draw';
      else if (!a) winner = 'b';
      else if (!b) winner = 'a';
      else if (a === b) winner = 'draw';
      else winner = BEATS[a] === b ? 'a' : 'b';
      if (winner !== 'draw') this.clashWins[winner]++;
      const roundOver = winner !== 'draw' && this.clashWins[winner] >= 2;
      this.send('reveal', { a, b, winner, clashWins: { ...this.clashWins } });
      this.later(() => (roundOver ? this.endRound(winner) : this.nextClash()), this.t.reveal);
    }
    endRound(w) {
      this.roundWins[w]++;
      const matchOver = this.roundWins[w] >= 2;
      this.send('roundEnd', { winner: w, roundWins: { ...this.roundWins }, matchOver });
      this.later(() => {
        if (matchOver) {
          this.over = true;
          this.send('matchEnd', { winner: w, roundWins: { ...this.roundWins } });
        } else this.nextRound();
      }, this.t.roundEnd);
    }
    forfeit(loser) {
      if (this.over) return;
      this.stop();
      this.over = true;
      const w = loser === 'a' ? 'b' : 'a';
      this.send('matchEnd', { winner: w, roundWins: { ...(this.roundWins || { a: 0, b: 0 }) }, forfeit: true });
    }
    stop() {
      this.stopped = true;
      this.timers.forEach(clearTimeout);
      this.timers = [];
      this.open = false;
    }
  }
  Referee.BEATS = BEATS;
  Referee.TIMING = TIMING;
  if (typeof module !== 'undefined' && module.exports) module.exports = Referee;
  else root.Referee = Referee;
})(typeof window !== 'undefined' ? window : globalThis);
