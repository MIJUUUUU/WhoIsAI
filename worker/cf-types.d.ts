// Cloudflare Workers 런타임 전용 최소 타입 선언.
// @cloudflare/workers-types 전체를 붙이면 Next.js가 쓰는 "dom" lib과 전역 타입이 충돌하므로,
// 이 프로젝트에서 실제로 쓰는 것만 직접 선언한다.
// (주의: 이 파일에 top-level import/export를 추가하면 "모듈"이 되어버려서,
//  아래 `declare module 'cloudflare:workers'`가 새 모듈 생성이 아니라
//  기존 모듈에 대한 증강으로 취급되며 동작하지 않는다. 반드시 스크립트 모드로 유지할 것.)

interface WebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

// Workers 전용 101 응답 확장 (표준 ResponseInit에는 없음)
interface ResponseInit {
  webSocket?: WebSocket | null;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  getAlarm(): Promise<number | null>;
  deleteAlarm(): Promise<void>;
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
  // Workers RPC: DO 클래스의 public 메서드가 stub에서 그대로 호출 가능해진다.
  // 이 프로젝트 규모에서는 각 RPC 메서드별 타입을 별도로 선언하기보다 동적으로 둔다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [rpcMethod: string]: any;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  newUniqueId(): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface ExportedHandler<Env = unknown> {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response;
}

declare module 'cloudflare:workers' {
  export class DurableObject<Env = unknown> {
    ctx: DurableObjectState;
    env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}
