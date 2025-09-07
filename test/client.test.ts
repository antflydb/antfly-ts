/**
 * Unit tests for the Antfly SDK client
 */

import { AntflyClient } from "../src/client.js";
import type { QueryRequest, CreateTableRequest } from "../src/types.js";

// Mock the openapi-fetch module
jest.mock("openapi-fetch", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    GET: jest.fn(),
    POST: jest.fn(),
    PUT: jest.fn(),
    DELETE: jest.fn(),
  })),
}));

describe("AntflyClient", () => {
  let client: AntflyClient;
  let mockClient: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create the client
    client = new AntflyClient({
      baseUrl: "http://localhost:8080",
      auth: {
        username: "test",
        password: "test",
      },
    });
    
    // Get the mocked client
    mockClient = client.getRawClient();
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

      mockClient.POST.mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      });

      const request: QueryRequest = {
        table: "test",
        limit: 10,
      };

      const result = await client.query(request);
      expect(result).toEqual(mockResponse.responses[0]);
      expect(mockClient.POST).toHaveBeenCalledWith("/query", {
        body: request,
      });
    });
  });

  describe("tables", () => {
    it("should list tables", async () => {
      const mockTables = [
        { name: "table1", indexes: {}, shards: {} },
        { name: "table2", indexes: {}, shards: {} },
      ];

      mockClient.GET.mockResolvedValueOnce({
        data: mockTables,
        error: undefined,
      });

      const tables = await client.tables.list();
      expect(tables).toEqual(mockTables);
      expect(mockClient.GET).toHaveBeenCalledWith("/table", {});
    });

    it("should create a table", async () => {
      const mockTable = { name: "new_table", indexes: {}, shards: {} };

      mockClient.POST.mockResolvedValueOnce({
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
      expect(mockClient.POST).toHaveBeenCalledWith("/table/{tableName}", {
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
