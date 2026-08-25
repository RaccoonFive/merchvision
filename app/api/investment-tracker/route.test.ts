import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/session", () => ({ getRequestSession: vi.fn() }));
vi.mock("@/lib/investmentTracker", () => ({
  getInvestmentTracker: vi.fn(),
  investmentItemExists: vi.fn(),
  parseInvestmentLotInput: vi.fn((value) => ({ data: value })),
  serializeInvestmentLot: vi.fn((lot) => ({ ...lot, createdAt: lot.createdAt.toISOString(), updatedAt: lot.updatedAt.toISOString() }))
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { investmentLot: { create: vi.fn() } }
}));

import { getInvestmentTracker, investmentItemExists, parseInvestmentLotInput, serializeInvestmentLot } from "@/lib/investmentTracker";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/session";

const mockedGetRequestSession = vi.mocked(getRequestSession);
const mockedGetInvestmentTracker = vi.mocked(getInvestmentTracker);
const mockedInvestmentItemExists = vi.mocked(investmentItemExists);
const mockedParseInput = vi.mocked(parseInvestmentLotInput);
const mockedSerializeInvestmentLot = vi.mocked(serializeInvestmentLot);
const mockedCreate = vi.mocked(prisma.investmentLot.create);

describe("/api/investment-tracker", () => {
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

  it("requires authentication for reads and creates", async () => {
    mockedGetRequestSession.mockResolvedValue(null);

    expect((await GET(new Request("http://localhost"))).status).toBe(401);
    expect((await POST(jsonRequest({ itemId: 1, quantity: 10, unitPricePaid: 5 }))).status).toBe(401);
  });

  it("returns only the current user's enriched tracker", async () => {
    mockedGetInvestmentTracker.mockResolvedValue({
      data: [],
      meta: {
        lotCount: 0,
        totalCost: 0,
        valuedCost: 0,
        currentNetValue: 0,
        currentProfit: 0,
        roi: null,
        unavailableLotCount: 0,
        isPartial: false,
        generatedAt: "2026-08-25T00:00:00.000Z"
      }
    });

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(200);
    expect(mockedGetInvestmentTracker).toHaveBeenCalledWith("user-1");
    expect(await response.json()).toMatchObject({ data: [], meta: { lotCount: 0 } });
  });

  it("rejects malformed JSON, invalid input, and unknown items", async () => {
    const malformed = await POST(new Request("http://localhost", { method: "POST", body: "{" }));
    expect(malformed.status).toBe(400);

    mockedParseInput.mockReturnValueOnce({ error: "Quantity must be a positive integer." });
    const invalid = await POST(jsonRequest({ itemId: 1, quantity: 0, unitPricePaid: 5 }));
    expect(invalid.status).toBe(400);

    mockedParseInput.mockReturnValueOnce({ data: { itemId: 99, quantity: 1, unitPricePaid: 5 } });
    mockedInvestmentItemExists.mockResolvedValueOnce(false);
    const unknown = await POST(jsonRequest({ itemId: 99, quantity: 1, unitPricePaid: 5 }));
    expect(unknown.status).toBe(404);
  });

  it("creates a separate user-owned investment lot", async () => {
    const createdAt = new Date("2026-08-25T00:00:00.000Z");
    mockedParseInput.mockReturnValue({ data: { itemId: 1, quantity: 10, unitPricePaid: 5 } });
    mockedInvestmentItemExists.mockResolvedValue(true);
    mockedCreate.mockResolvedValue({
      id: "lot-1",
      userId: "user-1",
      itemId: 1,
      quantity: 10,
      unitPricePaid: 5,
      createdAt,
      updatedAt: createdAt
    });

    const response = await POST(jsonRequest({ itemId: 1, quantity: 10, unitPricePaid: 5 }));

    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", itemId: 1, quantity: 10, unitPricePaid: 5 }
    });
    expect(await response.json()).toMatchObject({ data: { id: "lot-1", itemId: 1 } });
  });

  it("returns a safe error when loading fails", async () => {
    mockedGetInvestmentTracker.mockRejectedValue(new Error("database details"));
    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load investment tracker." });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/investment-tracker", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
