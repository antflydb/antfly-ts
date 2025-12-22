import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeEmbeddings, TermiteClient } from "../src/index.js";

describe("TermiteClient", () => {
  it("should create a client with base config", () => {
    const client = new TermiteClient({
      baseUrl: "http://localhost:8080/api",
    });
    expect(client).toBeDefined();
    expect(client.getRawClient).toBeDefined();
  });

  it("should create a client with custom headers", () => {
    const client = new TermiteClient({
      baseUrl: "http://localhost:8080/api",
      headers: {
        "X-Custom-Header": "test-value",
      },
    });
    expect(client).toBeDefined();
  });

  it("should have all expected methods", () => {
    const client = new TermiteClient({
      baseUrl: "http://localhost:8080/api",
    });

    expect(typeof client.embed).toBe("function");
    expect(typeof client.embedBinary).toBe("function");
    expect(typeof client.chunk).toBe("function");
    expect(typeof client.rerank).toBe("function");
    expect(typeof client.listModels).toBe("function");
    expect(typeof client.getVersion).toBe("function");
    expect(typeof client.getRawClient).toBe("function");
  });

  it("should expose raw client for advanced usage", () => {
    const client = new TermiteClient({
      baseUrl: "http://localhost:8080/api",
    });

    const rawClient = client.getRawClient();
    expect(rawClient).toBeDefined();
    expect(typeof rawClient.GET).toBe("function");
    expect(typeof rawClient.POST).toBe("function");
  });

  it("should strip trailing slash from baseUrl", () => {
    const client = new TermiteClient({
      baseUrl: "http://localhost:8080/api/",
    });
    expect(client).toBeDefined();
  });
});

describe("TermiteClient with mock fetch", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  describe("embed (JSON response)", () => {
    it("should request JSON format and parse response", async () => {
      const mockResponse = {
        model: "bge-small-en-v1.5",
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      };

      // openapi-fetch uses global fetch internally
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
        headers: new Headers({ "Content-Type": "application/json" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      const result = await client.embed("bge-small-en-v1.5", ["hello", "world"]);

      expect(result.model).toBe("bge-small-en-v1.5");
      expect(result.embeddings).toHaveLength(2);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
      expect(result.embeddings[1]).toEqual([0.4, 0.5, 0.6]);

      // Verify fetch was called (openapi-fetch uses global fetch)
      expect(fetch).toHaveBeenCalled();
    });

    it("should handle embed errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid model" }),
        text: () => Promise.resolve(JSON.stringify({ error: "Invalid model" })),
        headers: new Headers({ "Content-Type": "application/json" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      await expect(client.embed("invalid-model", ["test"])).rejects.toThrow();
    });
  });

  describe("embedBinary (binary response)", () => {
    it("should request binary format and deserialize response", async () => {
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];
      const binaryData = serializeEmbeddings(embeddings);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(binaryData),
        headers: new Headers({ "Content-Type": "application/octet-stream" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      const result = await client.embedBinary("bge-small-en-v1.5", ["hello", "world"]);

      expect(result).toHaveLength(2);
      expect(result[0][0]).toBeCloseTo(0.1);
      expect(result[0][1]).toBeCloseTo(0.2);
      expect(result[0][2]).toBeCloseTo(0.3);
      expect(result[1][0]).toBeCloseTo(0.4);
      expect(result[1][1]).toBeCloseTo(0.5);
      expect(result[1][2]).toBeCloseTo(0.6);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe("http://localhost:8080/api/embed");
      expect(options?.method).toBe("POST");
      expect(options?.headers).toBeDefined();
      const headers = options?.headers as Record<string, string>;
      expect(headers.Accept).toBe("application/octet-stream");
    });

    it("should handle empty embeddings in binary response", async () => {
      const binaryData = serializeEmbeddings([]);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(binaryData),
        headers: new Headers({ "Content-Type": "application/octet-stream" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      const result = await client.embedBinary("bge-small-en-v1.5", []);
      expect(result).toEqual([]);
    });

    it("should handle binary embed errors", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Invalid model"),
        headers: new Headers({ "Content-Type": "text/plain" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      await expect(client.embedBinary("invalid-model", ["test"])).rejects.toThrow(
        "Embed failed: 400 Invalid model"
      );
    });

    it("should handle high-dimensional embeddings in binary format", async () => {
      // Simulate 384-dimension BGE embeddings
      const dimension = 384;
      const embeddings: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const vector: number[] = [];
        for (let j = 0; j < dimension; j++) {
          vector.push((Math.random() - 0.5) * 2);
        }
        embeddings.push(vector);
      }
      const binaryData = serializeEmbeddings(embeddings);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(binaryData),
        headers: new Headers({ "Content-Type": "application/octet-stream" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      const result = await client.embedBinary("bge-small-en-v1.5", ["a", "b", "c"]);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveLength(384);
      expect(result[1]).toHaveLength(384);
      expect(result[2]).toHaveLength(384);

      // Verify values match (within float32 precision)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < dimension; j++) {
          expect(result[i][j]).toBeCloseTo(embeddings[i][j], 5);
        }
      }
    });

    it("should pass truncate option in request body", async () => {
      const binaryData = serializeEmbeddings([[0.1, 0.2]]);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(binaryData),
        headers: new Headers({ "Content-Type": "application/octet-stream" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      await client.embedBinary("bge-small-en-v1.5", ["test"], { truncate: true });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(options?.body as string);
      expect(body.truncate).toBe(true);
      expect(body.model).toBe("bge-small-en-v1.5");
      expect(body.input).toEqual(["test"]);
    });
  });

  describe("JSON vs Binary format comparison", () => {
    it("should return equivalent results from both formats", async () => {
      const embeddings = [
        [0.123, -0.456, 0.789],
        [-0.321, 0.654, -0.987],
      ];

      const jsonResponse = {
        model: "test-model",
        embeddings,
      };

      const binaryData = serializeEmbeddings(embeddings);

      // First call returns JSON
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonResponse),
        headers: new Headers({ "Content-Type": "application/json" }),
      } as Response);

      // Second call returns binary
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(binaryData),
        headers: new Headers({ "Content-Type": "application/octet-stream" }),
      } as Response);

      const client = new TermiteClient({
        baseUrl: "http://localhost:8080/api",
      });

      const jsonResult = await client.embed("test-model", ["a", "b"]);
      const binaryResult = await client.embedBinary("test-model", ["a", "b"]);

      // JSON response includes model, binary does not
      expect(jsonResult.model).toBe("test-model");
      expect(jsonResult.embeddings.length).toBe(binaryResult.length);

      // Verify embeddings are equivalent (within float32 precision)
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = 0; j < embeddings[i].length; j++) {
          expect(jsonResult.embeddings[i][j]).toBeCloseTo(binaryResult[i][j], 5);
        }
      }
    });
  });
});
