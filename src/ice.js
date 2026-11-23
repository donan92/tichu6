// Manual signaling must not discard usable candidates when a STUN server stalls.
export const ICE_WAIT_MS = 8000;
export function candidateSummary(pc) {
  const lines = (pc.localDescription?.sdp || '').split(/\r?\n/).filter(line => line.startsWith('a=candidate:'));
  return {count: lines.length, publicAddress: lines.some(line => / typ (srflx|relay) /.test(line + ' '))};
}
export function gatherCandidates(pc, timeoutMs = ICE_WAIT_MS) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', change);
      pc.removeEventListener('connectionstatechange', change);
    };
    const finish = partial => {
      cleanup();
      const result = candidateSummary(pc);
      if (!result.count) reject(new Error('연결 주소를 찾지 못했습니다. 다른 브라우저나 네트워크에서 다시 시도해 주세요.'));
      else resolve({...result, partial});
    };
    const change = () => {
      if (pc.connectionState === 'closed') {cleanup(); reject(new Error('연결 준비가 취소되었습니다.'));}
      else if (pc.iceGatheringState === 'complete') finish(false);
    };
    pc.addEventListener('icegatheringstatechange', change);
    pc.addEventListener('connectionstatechange', change);
    timer = setTimeout(() => finish(true), timeoutMs);
    change();
  });
}
