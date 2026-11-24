// Compatibility boundary for the retained, unreachable-from-public-routing legacy DO.
// Its JavaScript implementation remains covered by regression tests, not tsc.
export class GameRoom {
  constructor(ctx: DurableObjectState);
  fetch(request: Request): Promise<Response>;
  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void>;
  webSocketClose(ws: WebSocket, code: number): Promise<void>;
  webSocketError(ws: WebSocket): Promise<void>;
  alarm(): Promise<void>;
}
