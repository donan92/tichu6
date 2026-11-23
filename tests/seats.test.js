import test from 'node:test';
import assert from 'node:assert/strict';
import {Seats} from '../src/seats.js';
test('one host plus five guests fills the table; seventh player is rejected',()=>{
 const seats=new Seats();
 for(let i=1;i<=5;i++) assert.deepEqual(seats.admit({}),{seat:i});
 assert.deepEqual(seats.admit({}),{reason:'full'});assert.equal(seats.members.size,5);
});
test('simultaneous arrivals cannot allocate the same seat or exceed six players',async()=>{
 const seats=new Seats();const results=await Promise.all(Array.from({length:20},()=>Promise.resolve().then(()=>seats.admit({}))));
 assert.deepEqual(results.filter(r=>r.seat).map(r=>r.seat),[1,2,3,4,5]);assert.equal(results.filter(r=>r.reason==='full').length,15);
});
test('lobby departures free a seat; duplicate requests do not consume seats',()=>{
 const seats=new Seats(),a={},b={};assert.equal(seats.admit(a).seat,1);assert.equal(seats.admit(a).seat,1);seats.admit(b);seats.release(a);assert.equal(seats.admit({}).seat,1);assert.equal(seats.members.size,2);
});
test('game start locks admission even if a participant disconnects',()=>{
 const seats=new Seats(),a={};seats.admit(a);seats.lock();seats.release(a);assert.equal(seats.members.size,1);assert.deepEqual(seats.admit({}),{reason:'started'});
});
