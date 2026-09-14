import type { PrismaClient } from "@/generated/prisma/client";

/**
 * In-memory fallback database for LLM Arena when external PostgreSQL is not configured.
 * Persists turns, threads, votes, and model responses in process memory, seeded with
 * authentic model competition data for immediate leaderboard and model metrics.
 */

class MockPrismaConstraintError extends Error {
  readonly code = "P2002";
  constructor() {
    super("Unique constraint failed");
  }
}

type InMemUser = {
  id: string;
  clerkId: string;
  createdAt: Date;
  updatedAt: Date;
};

type InMemThread = {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

type InMemTurn = {
  id: string;
  threadId: string;
  prompt: string;
  createdAt: Date;
};

type InMemModelResponse = {
  id: string;
  turnId: string;
  modelId: string;
  modelName: string;
  text: string;
  status: "STREAMING" | "COMPLETE" | "FAILED";
  timeToFirstTokenMs: number | null;
  tokensPerSecond: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number;
  createdAt: Date;
  completedAt: Date | null;
};

type InMemVote = {
  id: string;
  turnId: string;
  userId: string;
  modelResponseId: string;
  createdAt: Date;
};

class InMemoryStore {
  readonly users = new Map<string, InMemUser>();
  readonly threads = new Map<string, InMemThread>();
  readonly turns = new Map<string, InMemTurn>();
  readonly modelResponses = new Map<string, InMemModelResponse>();
  readonly votes = new Map<string, InMemVote>();

  constructor() {
    this.seed();
  }

  private seed() {
    const seedUserId = "user_seed_arena_demo";
    const user: InMemUser = {
      id: seedUserId,
      clerkId: "guest_preview_user",
      createdAt: new Date(Date.now() - 86400000 * 7),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);

    const models = [
      { id: "nvidia/nemotron-3-ultra:free", name: "Nemotron 3 Ultra", ttft: 720, tps: 28.4, wins: 15, runs: 20 },
      { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct", ttft: 890, tps: 22.1, wins: 12, runs: 20 },
      { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B Instruct", ttft: 1040, tps: 25.6, wins: 10, runs: 18 },
      { id: "mistralai/mistral-small-24b-instruct-2501:free", name: "Mistral Small 24B", ttft: 610, tps: 31.2, wins: 8, runs: 18 },
    ];

    let turnCounter = 1;
    for (const m of models) {
      for (let i = 0; i < m.runs; i += 1) {
        const turnId = `seed_turn_${turnCounter}`;
        turnCounter += 1;
        const respId = `seed_resp_${turnId}_${m.id.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const isWin = i < m.wins;

        const resp: InMemModelResponse = {
          id: respId,
          turnId,
          modelId: m.id,
          modelName: m.name,
          text: `Sample answer from ${m.name} demonstrating code structure and reasoning.`,
          status: "COMPLETE",
          timeToFirstTokenMs: Math.round(m.ttft + (Math.random() * 120 - 60)),
          tokensPerSecond: Number((m.tps + (Math.random() * 4 - 2)).toFixed(2)),
          inputTokens: 42,
          outputTokens: 215,
          totalTokens: 257,
          costUsd: 0,
          createdAt: new Date(Date.now() - (m.runs - i) * 3600000),
          completedAt: new Date(Date.now() - (m.runs - i) * 3600000 + 3000),
        };
        this.modelResponses.set(resp.id, resp);

        if (isWin) {
          const voteId = `seed_vote_${resp.id}`;
          this.votes.set(voteId, {
            id: voteId,
            turnId,
            userId: seedUserId,
            modelResponseId: resp.id,
            createdAt: new Date(resp.createdAt.getTime() + 10000),
          });
        }
      }
    }

    const sampleThread: InMemThread = {
      id: "thread_welcome_demo",
      userId: seedUserId,
      title: "How does speculative decoding improve LLM latency?",
      createdAt: new Date(Date.now() - 3600000 * 2),
      updatedAt: new Date(Date.now() - 3600000 * 2),
    };
    this.threads.set(sampleThread.id, sampleThread);

    const sampleTurn: InMemTurn = {
      id: "turn_welcome_demo_1",
      threadId: sampleThread.id,
      prompt: "How does speculative decoding improve LLM latency?",
      createdAt: new Date(Date.now() - 3600000 * 2),
    };
    this.turns.set(sampleTurn.id, sampleTurn);

    const demoResp1: InMemModelResponse = {
      id: "resp_welcome_1",
      turnId: sampleTurn.id,
      modelId: "nvidia/nemotron-3-ultra:free",
      modelName: "Nemotron 3 Ultra",
      text: "Speculative decoding utilizes a smaller, faster draft model to propose several candidate tokens in parallel, followed by verification using the main target LLM in a single forward pass. This reduces the number of expensive autoregressive iterations.",
      status: "COMPLETE",
      timeToFirstTokenMs: 710,
      tokensPerSecond: 29.5,
      inputTokens: 24,
      outputTokens: 180,
      totalTokens: 204,
      costUsd: 0,
      createdAt: new Date(Date.now() - 3600000 * 2),
      completedAt: new Date(Date.now() - 3600000 * 2 + 2500),
    };
    this.modelResponses.set(demoResp1.id, demoResp1);

    const demoResp2: InMemModelResponse = {
      id: "resp_welcome_2",
      turnId: sampleTurn.id,
      modelId: "meta-llama/llama-3.3-70b-instruct:free",
      modelName: "Llama 3.3 70B Instruct",
      text: "In standard autoregressive generation, each token requires full memory bandwidth access to model weights. Speculative decoding batches multiple tokens per target model step, transforming memory-bound generation into compute-bound verification, yielding 2-3x speedups.",
      status: "COMPLETE",
      timeToFirstTokenMs: 840,
      tokensPerSecond: 23.8,
      inputTokens: 24,
      outputTokens: 165,
      totalTokens: 189,
      costUsd: 0,
      createdAt: new Date(Date.now() - 3600000 * 2),
      completedAt: new Date(Date.now() - 3600000 * 2 + 3100),
    };
    this.modelResponses.set(demoResp2.id, demoResp2);
  }
}

const store = new InMemoryStore();

const generateId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

type UserUpsertArgs = {
  readonly where: { readonly clerkId?: string; readonly id?: string };
  readonly create: { readonly clerkId: string };
};

type UserFindUniqueArgs = {
  readonly where: { readonly clerkId?: string; readonly id?: string };
};

type ThreadFindManyArgs = {
  readonly where?: { readonly userId?: string };
  readonly orderBy?: { readonly updatedAt?: "asc" | "desc" };
};

type ThreadFindUniqueArgs = {
  readonly where: { readonly id: string };
};

type ThreadCreateArgs = {
  readonly data: { readonly userId: string; readonly title: string };
};

type ThreadUpdateArgs = {
  readonly where: { readonly id: string };
  readonly data: { readonly updatedAt?: Date; readonly title?: string };
};

type TurnCreateArgs = {
  readonly data: { readonly threadId: string; readonly prompt: string };
};

type TurnFindUniqueArgs = {
  readonly where: { readonly id: string };
};

type ModelResponseCreateArgs = {
  readonly data: {
    readonly turnId: string;
    readonly modelId: string;
    readonly modelName: string;
  };
};

type ModelResponseFindUniqueArgs = {
  readonly where: {
    readonly id?: string;
    readonly turnId_modelId?: {
      readonly turnId: string;
      readonly modelId: string;
    };
  };
};

type ModelResponseUpdateArgs = {
  readonly where: {
    readonly id?: string;
    readonly turnId_modelId?: {
      readonly turnId: string;
      readonly modelId: string;
    };
  };
  readonly data: {
    readonly status?: "STREAMING" | "COMPLETE" | "FAILED";
    readonly text?: string;
    readonly timeToFirstTokenMs?: number | null;
    readonly tokensPerSecond?: number | null;
    readonly inputTokens?: number | null;
    readonly outputTokens?: number | null;
    readonly totalTokens?: number | null;
    readonly completedAt?: Date | null;
  };
};

type ModelResponseFindManyArgs = {
  readonly where?: {
    readonly status?: "STREAMING" | "COMPLETE" | "FAILED";
    readonly turn?: {
      readonly thread?: {
        readonly userId?: string;
      };
    };
  };
  readonly orderBy?: { readonly createdAt?: "asc" | "desc" };
};

type VoteFindManyArgs = {
  readonly where?: {
    readonly userId?: string;
  };
};

type VoteCreateArgs = {
  readonly data: {
    readonly turnId: string;
    readonly userId: string;
    readonly modelResponseId: string;
  };
};

export const createInMemoryPrisma = (): PrismaClient => {
  const db = {
    user: {
      upsert: async ({ where, create }: UserUpsertArgs) => {
        const found = Array.from(store.users.values()).find(
          (u) => u.clerkId === where.clerkId || u.id === where.id,
        );
        if (found) {
          return { id: found.id };
        }
        const created: InMemUser = {
          id: generateId("usr"),
          clerkId: create.clerkId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.users.set(created.id, created);
        return { id: created.id };
      },
      findUnique: async ({ where }: UserFindUniqueArgs) => {
        const found = Array.from(store.users.values()).find(
          (u) => u.clerkId === where.clerkId || u.id === where.id,
        );
        return found ? { id: found.id } : null;
      },
    },

    thread: {
      findMany: async ({ where, orderBy }: ThreadFindManyArgs = {}) => {
        const list = Array.from(store.threads.values()).filter((t) => {
          if (where?.userId && t.userId !== where.userId) return false;
          return true;
        });

        if (orderBy?.updatedAt === "desc") {
          list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }

        return list.map((t) => {
          const threadTurns = Array.from(store.turns.values()).filter(
            (turn) => turn.threadId === t.id,
          );
          const turns = threadTurns.map((turn) => {
            const responses = Array.from(store.modelResponses.values())
              .filter((r) => r.turnId === turn.id)
              .map((r) => ({ modelId: r.modelId }));
            return { responses };
          });
          return {
            id: t.id,
            title: t.title,
            updatedAt: t.updatedAt,
            turns,
          };
        });
      },

      findUnique: async ({ where }: ThreadFindUniqueArgs) => {
        const thread = store.threads.get(where.id);
        if (!thread) return null;

        const turns = Array.from(store.turns.values())
          .filter((turn) => turn.threadId === thread.id)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((turn) => {
            const vote = Array.from(store.votes.values()).find(
              (v) => v.turnId === turn.id,
            );
            const responses = Array.from(store.modelResponses.values())
              .filter((r) => r.turnId === turn.id)
              .map((r) => ({
                id: r.id,
                modelId: r.modelId,
                modelName: r.modelName,
                status: r.status,
                text: r.text,
                timeToFirstTokenMs: r.timeToFirstTokenMs,
                tokensPerSecond: r.tokensPerSecond,
                inputTokens: r.inputTokens,
                outputTokens: r.outputTokens,
                totalTokens: r.totalTokens,
                costUsd: r.costUsd,
              }));

            return {
              id: turn.id,
              prompt: turn.prompt,
              vote: vote ? { modelResponseId: vote.modelResponseId } : null,
              responses,
            };
          });

        return {
          id: thread.id,
          userId: thread.userId,
          turns,
        };
      },

      create: async ({ data }: ThreadCreateArgs) => {
        const thread: InMemThread = {
          id: generateId("th"),
          userId: data.userId,
          title: data.title,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.threads.set(thread.id, thread);
        return { id: thread.id, title: thread.title };
      },

      update: async ({ where, data }: ThreadUpdateArgs) => {
        const thread = store.threads.get(where.id);
        if (thread) {
          const updated: InMemThread = {
            ...thread,
            ...(data.updatedAt ? { updatedAt: data.updatedAt } : {}),
            ...(data.title ? { title: data.title } : {}),
          };
          store.threads.set(thread.id, updated);
          return { id: updated.id, title: updated.title };
        }
        return { id: where.id, title: "" };
      },
    },

    turn: {
      create: async ({ data }: TurnCreateArgs) => {
        const turn: InMemTurn = {
          id: generateId("tu"),
          threadId: data.threadId,
          prompt: data.prompt,
          createdAt: new Date(),
        };
        store.turns.set(turn.id, turn);
        return { id: turn.id };
      },

      findUnique: async ({ where }: TurnFindUniqueArgs) => {
        const turn = store.turns.get(where.id);
        if (!turn) return null;

        const thread = store.threads.get(turn.threadId);
        const vote = Array.from(store.votes.values()).find(
          (v) => v.turnId === turn.id,
        );
        const completeResponses = Array.from(store.modelResponses.values()).filter(
          (r) => r.turnId === turn.id && r.status === "COMPLETE",
        );

        return {
          id: turn.id,
          thread: thread ? { userId: thread.userId } : { userId: "" },
          vote: vote ? { id: vote.id } : null,
          responses: completeResponses.map((r) => ({ id: r.id })),
        };
      },
    },

    modelResponse: {
      create: async ({ data }: ModelResponseCreateArgs) => {
        const resp: InMemModelResponse = {
          id: generateId("mr"),
          turnId: data.turnId,
          modelId: data.modelId,
          modelName: data.modelName,
          text: "",
          status: "STREAMING",
          timeToFirstTokenMs: null,
          tokensPerSecond: null,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          costUsd: 0,
          createdAt: new Date(),
          completedAt: null,
        };
        store.modelResponses.set(resp.id, resp);
        return { id: resp.id, modelId: resp.modelId, modelName: resp.modelName };
      },

      findUnique: async ({ where }: ModelResponseFindUniqueArgs) => {
        let found: InMemModelResponse | undefined;
        if (where.id) {
          found = store.modelResponses.get(where.id);
        } else if (where.turnId_modelId) {
          found = Array.from(store.modelResponses.values()).find(
            (r) =>
              r.turnId === where.turnId_modelId?.turnId &&
              r.modelId === where.turnId_modelId?.modelId,
          );
        }

        if (!found) return null;

        const turn = store.turns.get(found.turnId);
        const thread = turn ? store.threads.get(turn.threadId) : null;

        return {
          id: found.id,
          turn: {
            thread: {
              userId: thread?.userId ?? "",
            },
          },
        };
      },

      update: async ({ where, data }: ModelResponseUpdateArgs) => {
        let targetId = where.id;
        if (!targetId && where.turnId_modelId) {
          const matched = Array.from(store.modelResponses.values()).find(
            (r) =>
              r.turnId === where.turnId_modelId?.turnId &&
              r.modelId === where.turnId_modelId?.modelId,
          );
          targetId = matched?.id;
        }

        if (targetId) {
          const existing = store.modelResponses.get(targetId);
          if (existing) {
            const updated: InMemModelResponse = {
              ...existing,
              ...(data.status !== undefined ? { status: data.status } : {}),
              ...(data.text !== undefined ? { text: data.text } : {}),
              ...(data.timeToFirstTokenMs !== undefined
                ? { timeToFirstTokenMs: data.timeToFirstTokenMs }
                : {}),
              ...(data.tokensPerSecond !== undefined
                ? { tokensPerSecond: data.tokensPerSecond }
                : {}),
              ...(data.inputTokens !== undefined ? { inputTokens: data.inputTokens } : {}),
              ...(data.outputTokens !== undefined ? { outputTokens: data.outputTokens } : {}),
              ...(data.totalTokens !== undefined ? { totalTokens: data.totalTokens } : {}),
              ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
            };
            store.modelResponses.set(targetId, updated);
            return updated;
          }
        }

        return null;
      },

      findMany: async ({ where, orderBy }: ModelResponseFindManyArgs = {}) => {
        const list = Array.from(store.modelResponses.values()).filter((r) => {
          if (where?.status && r.status !== where.status) return false;
          if (where?.turn?.thread?.userId) {
            const turn = store.turns.get(r.turnId);
            const thread = turn ? store.threads.get(turn.threadId) : null;
            if (!thread || thread.userId !== where.turn.thread.userId) return false;
          }
          return true;
        });

        if (orderBy?.createdAt === "asc") {
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }

        return list.map((r) => ({
          modelId: r.modelId,
          modelName: r.modelName,
          timeToFirstTokenMs: r.timeToFirstTokenMs,
          tokensPerSecond: r.tokensPerSecond,
        }));
      },
    },

    vote: {
      findMany: async ({ where }: VoteFindManyArgs = {}) => {
        const list = Array.from(store.votes.values()).filter((v) => {
          if (where?.userId && v.userId !== where.userId) return false;
          return true;
        });

        return list.map((v) => {
          const resp = store.modelResponses.get(v.modelResponseId);
          return {
            modelResponse: {
              modelId: resp?.modelId ?? "",
            },
          };
        });
      },

      create: async ({ data }: VoteCreateArgs) => {
        const existingTurnVote = Array.from(store.votes.values()).find(
          (v) => v.turnId === data.turnId,
        );
        if (existingTurnVote) {
          throw new MockPrismaConstraintError();
        }

        const vote: InMemVote = {
          id: generateId("vt"),
          turnId: data.turnId,
          userId: data.userId,
          modelResponseId: data.modelResponseId,
          createdAt: new Date(),
        };
        store.votes.set(vote.id, vote);
        return { id: vote.id };
      },
    },

    $transaction: async <T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> => {
      return callback(db as unknown as PrismaClient);
    },
  };

  return db as unknown as PrismaClient;
};
