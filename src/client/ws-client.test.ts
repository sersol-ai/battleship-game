import { describe, expect, it } from "vitest";
import { createWsClient } from "./ws-client.ts";
import { FakeWebSocket, fakeFactory } from "./fake-websocket.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    void setTimeout(done, ms);
  });
}

function lastSocket(): FakeWebSocket {
  const last = FakeWebSocket.instances.at(-1);
  if (last === undefined) throw new Error("no fake socket created yet");
  return last;
}

describe("ws client", () => {
  it("queues while connecting and flushes on open", async (): Promise<void> => {
    const client = createWsClient({
      url: "ws://fake/ws",
      onOpen: () => {},
      onMessage: (msg) => {
        void msg;
      },
      onState: (state) => {
        void state;
      },
      createSocket: fakeFactory,
    });
    client.send({ t: "create" });
    client.send({ t: "rematch" });
    const socket = lastSocket();
    expect(socket.sent).toEqual([]);
    socket.serverOpen();
    expect(socket.sent).toEqual(['{"t":"create"}', '{"t":"rematch"}']);
  });

  it("reconnect delays follow the backoff", async (): Promise<void> => {
    const client = createWsClient({
      url: "ws://fake/ws",
      onOpen: () => {},
      onMessage: (msg) => {
        void msg;
      },
      onState: (state) => {
        void state;
      },
      createSocket: fakeFactory,
      backoffMs: [500, 1000],
    });
    const first = lastSocket();
    first.serverOpen();
    first.serverClose();
    const baseline = FakeWebSocket.instances.length;
    const started = Date.now();
    while (FakeWebSocket.instances.length <= baseline && Date.now() - started < 3_000) {
      await sleep(10);
    }
    const firstDelay = Date.now() - started;
    expect(firstDelay >= 500).toBe(true);
    expect(firstDelay < 1_000).toBe(true);
    const second = lastSocket();
    second.serverClose();
    const secondStart = Date.now();
    while (FakeWebSocket.instances.length <= baseline + 1 && Date.now() - secondStart < 3_000) {
      await sleep(10);
    }
    const secondDelay = Date.now() - secondStart;
    expect(secondDelay >= 1_000).toBe(true);
    void client;
  });

  it("close() stops reconnecting", async (): Promise<void> => {
    const client = createWsClient({
      url: "ws://fake/ws",
      onOpen: () => {},
      onMessage: (msg) => {
        void msg;
      },
      onState: (state) => {
        void state;
      },
      createSocket: fakeFactory,
      backoffMs: [5],
    });
    const socket = lastSocket();
    const baseline = FakeWebSocket.instances.length;
    client.close();
    await sleep(50);
    expect(FakeWebSocket.instances.length).toBe(baseline);
    expect(socket.readyState).toBe(3);
  });

  it("malformed frames are ignored", async (): Promise<void> => {
    let seen = 0;
    const client = createWsClient({
      url: "ws://fake/ws",
      onOpen: () => {},
      onMessage: (msg) => {
        void msg;
        seen += 1;
      },
      onState: (state) => {
        void state;
      },
      createSocket: fakeFactory,
    });
    const socket = lastSocket();
    socket.serverOpen();
    socket.onmessage?.({ data: "not json" });
    socket.onmessage?.({ data: "null" });
    socket.onmessage?.({ data: '{"nope":1}' });
    socket.serverSend({ t: "joined", room: "ABCDEF", me: "p1", token: "tok" });
    expect(seen).toBe(1);
    void client;
  });
});
