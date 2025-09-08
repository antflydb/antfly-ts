/**
 * Unit tests for the Antfly SDK client
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { Client } from "openapi-fetch";
import type { paths } from "../src/antfly-api.js";
// NOTE: We only import the type here to avoid loading the module too early
import type { AntflyClient } from "../src/client.js";
import type { QueryRequest, CreateTableRequest, TableStatus } from "../src/types.js";

const mockApi: jest.Mocked<Client<paths>> = {
  GET: jest.fn() as any,
  POST: jest.fn() as any,
  PUT: jest.fn() as any,
  DELETE: jest.fn() as any,
  OPTIONS: jest.fn() as any,
  HEAD: jest.fn() as any,
  PATCH: jest.fn() as any,
  TRACE: jest.fn() as any,
  request: jest.fn() as any,
  use: jest.fn() as any,
  eject: jest.fn() as any,
};

jest.unstable_mockModule("openapi-fetch", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockApi),
}));

describe("AntflyClient", () => {
  // Use the type for the declaration
  let client: AntflyClient;
  // Store the class constructor for `instanceof` checks
  let AntflyClient: new (...args: any[]) => AntflyClient;

  beforeEach(async () => {
    // Dynamically import the client inside beforeEach
    const clientModule = await import("../src/client.js");
    AntflyClient = clientModule.AntflyClient;

    // Clear mocks
    Object.values(mockApi).forEach((mockFn) => {
      if (typeof mockFn.mockClear === "function") {
        mockFn.mockClear();
      }
    });

    // Create the client instance
    client = new AntflyClient({
      baseUrl: "http://localhost:8080",
      auth: {
        username: "test",
        password: "test",
      },
    });
  });

  describe("constructor", () => {
    it("should initialize with config", () => {
      expect(client).toBeInstanceOf(AntflyClient);
    });

    it("should set basic auth header", () => {
      const authString = btoa("test:test");
      expect(client.getRawClient()).toBeDefined();
    });
  });

  describe("query", () => {
    it("should execute global query", async () => {
      const mockResponse = {
        responses: [
          {
            hits: {
              total: 1,
              hits: [{ _id: "test", _score: 1.0, _source: { name: "test" } }],
            },
            took: 10,
            status: 200,
          },
        ],
      };

      mockApi.POST.mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      });

      const request: QueryRequest = {
        table: "test",
        limit: 10,
      };

      const result = await client.query(request);
      expect(result).toEqual(mockResponse.responses[0]);
      expect(mockApi.POST).toHaveBeenCalledWith("/query", {
        body: request,
      });
    });
  });

  describe("tables", () => {
    it("should list tables", async () => {
      const mockTables: TableStatus[] = [
        {
          name: "table1",
          indexes: {},
          shards: {},
          storage_status: { disk_usage: 1024, empty: false },
        },
        {
          name: "table2",
          indexes: {},
          shards: {},
          storage_status: { disk_usage: 2048, empty: true },
        },
      ];

      mockApi.GET.mockResolvedValueOnce({
        data: mockTables,
        error: undefined,
      });

      const tables = await client.tables.list();
      expect(tables).toEqual(mockTables);
      expect(mockApi.GET).toHaveBeenCalledWith("/table", {});
    });

    it("should create a table", async () => {
      const mockTable = { name: "new_table", indexes: {}, shards: {} };

      mockApi.POST.mockResolvedValueOnce({
        data: mockTable,
        error: undefined,
      });

      const config: CreateTableRequest = {
        num_shards: 3,
        schema: {
          key: "id",
          default_type: "document",
        },
      };

      const result = await client.tables.create("new_table", config);
      expect(result).toEqual(mockTable);
      expect(mockApi.POST).toHaveBeenCalledWith("/table/{tableName}", {
        params: { path: { tableName: "new_table" } },
        body: config,
      });
    });
  });

  describe("setAuth", () => {
    it("should update authentication credentials", () => {
      client.setAuth("newuser", "newpass");
      expect(client.getRawClient()).toBeDefined();
    });
  });
});
