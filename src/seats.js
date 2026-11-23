// The host owns seat allocation. A connection object, never a client-supplied
// seat number, identifies each participant. Seat 0 always belongs to the host.
export class Seats {
  constructor() {this.members=new Map();this.locked=false;}
  admit(connection) {
    if(this.members.has(connection)) return {seat:this.members.get(connection)};
    if(this.locked) return {reason:'started'};
    const occupied=new Set(this.members.values());
    for(let seat=1;seat<6;seat++) if(!occupied.has(seat)) {
      this.members.set(connection,seat);
      return {seat};
    }
    return {reason:'full'};
  }
  release(connection) {
    // A disconnected player's seat cannot be taken over during a game.
    if(!this.locked) this.members.delete(connection);
  }
  lock() {this.locked=true;}
}
