/**
 * Unit tests for the Antfly SDK client using Vitest
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { paths } from '../src/antfly-api.js';
import type { QueryRequest, CreateTableRequest, TableStatus } from '../src/types.js';

// Mock openapi-fetch at the top level
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('openapi-fetch', () => ({
  default: vi.fn(() => ({
    GET: mockGet,
    POST: mockPost,
    PUT: mockPut,
    DELETE: mockDelete,
    OPTIONS: vi.fn(),
    HEAD: vi.fn(),
    PATCH: vi.fn(),
    TRACE: vi.fn(),
    request: vi.fn(),
    use: vi.fn(),
    eject: vi.fn(),
  })),
}));

// Import client after mocking
const { AntflyClient } = await import('../src/client.js');

describe('AntflyClient', () => {
  let client: AntflyClient;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Create the client instance
    client = new AntflyClient({
      baseUrl: 'http://localhost:8080',
      auth: {
        username: 'test',
        password: 'test',
      },
    });
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(client).toBeInstanceOf(AntflyClient);
    });

    it('should have access to raw client', () => {
      expect(client.getRawClient()).toBeDefined();
    });
  });

  describe('query', () => {
    it('should execute global query', async () => {
      const mockResponse = {
        responses: [
          {
            hits: {
              total: 1,
              hits: [{ _id: 'test', _score: 1.0, _source: { name: 'test' } }],
            },
            took: 10,
            status: 200,
          },
        ],
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      });

      const request: QueryRequest = {
        table: 'test',
        limit: 10,
      };

      const result = await client.query(request);
      expect(result).toEqual(mockResponse.responses[0]);
      expect(mockPost).toHaveBeenCalledWith('/query', {
        body: request,
      });
    });

    it('should handle query with Bleve full_text_search', async () => {
      const mockResponse = {
        responses: [
          {
            hits: {
              total: 2,
              hits: [
                { _id: '1', _score: 1.5, _source: { name: 'laptop' } },
                { _id: '2', _score: 1.2, _source: { name: 'notebook' } },
              ],
            },
            took: 15,
            status: 200,
          },
        ],
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      });

      const request: QueryRequest = {
        table: 'products',
        full_text_search: {
          match: 'laptop',
          field: 'name',
        },
        limit: 10,
      };

      const result = await client.query(request);
      expect(result?.hits?.total).toBe(2);
      expect(mockPost).toHaveBeenCalledWith('/query', {
        body: request,
      });
    });
  });

  describe('tables', () => {
    it('should list tables', async () => {
      const mockTables: TableStatus[] = [
        {
          name: 'table1',
          indexes: {},
          shards: {},
          storage_status: { disk_usage: 1024, empty: false },
        },
        {
          name: 'table2',
          indexes: {},
          shards: {},
          storage_status: { disk_usage: 2048, empty: true },
        },
      ];

      mockGet.mockResolvedValueOnce({
        data: mockTables,
        error: undefined,
      });

      const tables = await client.tables.list();
      expect(tables).toEqual(mockTables);
      expect(mockGet).toHaveBeenCalledWith('/tables', {
        params: undefined,
      });
    });

    it('should create a table', async () => {
      const mockTable = { name: 'new_table', indexes: {}, shards: {} };

      mockPost.mockResolvedValueOnce({
        data: mockTable,
        error: undefined,
      });

      const config: CreateTableRequest = {
        num_shards: 3,
        schema: {
          version: 0,
          key: 'id',
          default_type: 'document',
        },
      };

      const result = await client.tables.create('new_table', config);
      expect(result).toEqual(mockTable);
      expect(mockPost).toHaveBeenCalledWith('/tables/{tableName}', {
        params: { path: { tableName: 'new_table' } },
        body: config,
      });
    });

    it('should query a specific table', async () => {
      const mockResponse = {
        responses: [
          {
            hits: {
              total: 1,
              hits: [{ _id: 'prod1', _score: 1.0, _source: { name: 'Product 1' } }],
            },
            took: 20,
            status: 200,
          },
        ],
      };

      mockPost.mockResolvedValueOnce({
        data: mockResponse,
        error: undefined,
      });

      const request: QueryRequest = {
        full_text_search: {
          query: 'laptop',
        },
        limit: 10,
      };

      const result = await client.tables.query('products', request);
      expect(result).toEqual(mockResponse);
      expect(mockPost).toHaveBeenCalledWith('/tables/{tableName}/query', {
        params: { path: { tableName: 'products' } },
        body: request,
      });
    });
  });

  describe('setAuth', () => {
    it('should update authentication credentials', () => {
      client.setAuth('newuser', 'newpass');
      expect(client.getRawClient()).toBeDefined();
      // In a real implementation, you'd verify the auth header was updated
    });
  });

  describe('error handling', () => {
    it('should throw error when query fails', async () => {
      const mockError = {
        error: 'Table not found',
      };

      mockPost.mockResolvedValueOnce({
        data: undefined,
        error: mockError as any,
      });

      const request: QueryRequest = {
        table: 'nonexistent',
        limit: 10,
      };

      await expect(client.query(request)).rejects.toThrow('Query failed: Table not found');
    });
  });
});
