import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";

vi.mock("@/lib/session", () => ({ getRequestSession: vi.fn() }));
vi.mock("@/lib/investmentTracker", () => ({
  parseInvestmentLotUpdate: vi.fn((value) => ({ data: value })),
  serializeInvestmentLot: vi.fn((lot) => ({ ...lot, createdAt: lot.createdAt.toISOString(), updatedAt: lot.updatedAt.toISOString() }))
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    investmentLot: {
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

import { parseInvestmentLotUpdate, serializeInvestmentLot } from "@/lib/investmentTracker";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/session";

const mockedGetRequestSession = vi.mocked(getRequestSession);
const mockedParseUpdate = vi.mocked(parseInvestmentLotUpdate);
const mockedSerializeInvestmentLot = vi.mocked(serializeInvestmentLot);
const mockedFindFirst = vi.mocked(prisma.investmentLot.findFirst);
const mockedUpdate = vi.mocked(prisma.investmentLot.update);
const mockedDeleteMany = vi.mocked(prisma.investmentLot.deleteMany);
const context = (lotId: string) => ({ params: Promise.resolve({ lotId }) });

describe("/api/investment-tracker/[lotId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetRequestSession.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: { id: "user-1", name: "Trader", email: "trader@example.com" }
    } as never);
    mockedSerializeInvestmentLot.mockImplementation((lot) => ({
      id: lot.id,
      itemId: lot.itemId,
      quantity: lot.quantity,
      unitPricePaid: lot.unitPricePaid,
      createdAt: lot.createdAt.toISOString(),
      updatedAt: lot.updatedAt.toISOString()
    }));
  });

  it("requires authentication", async () => {
    mockedGetRequestSession.mockResolvedValue(null);

    expect((await PUT(jsonRequest({ quantity: 1, unitPricePaid: 5 }), context("lot-1"))).status).toBe(401);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context("lot-1"))).status).toBe(401);
  });

  it("validates ids, JSON, and update values", async () => {
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context(" "))).status).toBe(400);
    expect((await PUT(new Request("http://localhost", { method: "PUT", body: "{" }), context("lot-1"))).status).toBe(400);

    mockedParseUpdate.mockReturnValueOnce({ error: "Quantity must be a positive integer." });
    expect((await PUT(jsonRequest({ quantity: 0, unitPricePaid: 5 }), context("lot-1"))).status).toBe(400);
  });

  it("returns not found for another user's lot", async () => {
    mockedParseUpdate.mockReturnValue({ data: { quantity: 5, unitPricePaid: 10 } });
    mockedFindFirst.mockResolvedValue(null);
    mockedDeleteMany.mockResolvedValue({ count: 0 });

    expect((await PUT(jsonRequest({ quantity: 5, unitPricePaid: 10 }), context("other-lot"))).status).toBe(404);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context("other-lot"))).status).toBe(404);
    expect(mockedFindFirst).toHaveBeenCalledWith({ where: { id: "other-lot", userId: "user-1" } });
    expect(mockedDeleteMany).toHaveBeenCalledWith({ where: { id: "other-lot", userId: "user-1" } });
  });

  it("updates and removes only the current user's lot", async () => {
    const date = new Date("2026-08-25T00:00:00.000Z");
    const stored = {
      id: "lot-1",
      userId: "user-1",
      itemId: 1,
      quantity: 5,
      unitPricePaid: 10,
      createdAt: date,
      updatedAt: date
    };
    mockedParseUpdate.mockReturnValue({ data: { quantity: 5, unitPricePaid: 10 } });
    mockedFindFirst.mockResolvedValue(stored);
    mockedUpdate.mockResolvedValue(stored);
    mockedDeleteMany.mockResolvedValue({ count: 1 });

    const updateResponse = await PUT(jsonRequest({ quantity: 5, unitPricePaid: 10 }), context("lot-1"));
    const deleteResponse = await DELETE(new Request("http://localhost", { method: "DELETE" }), context("lot-1"));

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({ data: { id: "lot-1", quantity: 5 } });
    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: "lot-1" },
      data: { quantity: 5, unitPricePaid: 10 }
    });
    expect(await deleteResponse.json()).toEqual({ deleted: true });
  });

  it("returns safe server failures", async () => {
    mockedDeleteMany.mockRejectedValue(new Error("database details"));
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), context("lot-1"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to remove investment lot." });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/investment-tracker/lot-1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
