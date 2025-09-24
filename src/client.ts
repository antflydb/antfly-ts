/**
 * Antfly SDK Client
 * Provides a high-level interface for interacting with the Antfly API
 */

import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./antfly-api.js";
import type {
  AntflyConfig,
  QueryRequest,
  QueryResult,
  CreateTableRequest,
  BatchRequest,
  BackupRequest,
  RestoreRequest,
  IndexConfig,
  CreateUserRequest,
  Permission,
  ResourceType,
  TableSchema,
} from "./types.js";

export class AntflyClient {
  private client: Client<paths>;
  private config: AntflyConfig;

  constructor(config: AntflyConfig) {
    this.config = config;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Add basic auth if provided
    if (config.auth) {
      const auth = btoa(`${config.auth.username}:${config.auth.password}`);
      headers["Authorization"] = `Basic ${auth}`;
    }

    this.client = createClient<paths>({
      baseUrl: config.baseUrl,
      headers,
    });
  }

  /**
   * Update authentication credentials
   */
  setAuth(username: string, password: string) {
    this.config.auth = { username, password };
    const auth = btoa(`${username}:${password}`);

    this.client = createClient<paths>({
      baseUrl: this.config.baseUrl,
      headers: {
        ...this.config.headers,
        Authorization: `Basic ${auth}`,
      },
    });
  }

  /**
   * Global query operations
   */
  async query(request: QueryRequest): Promise<QueryResult | undefined> {
    const { data, error } = await this.client.POST("/query", {
      body: request,
    });

    if (error) {
      throw new Error(`Query failed: ${error.error}`);
    }

    // The global query returns QueryResponses, extract the first result
    return data?.responses?.[0];
  }

  /**
   * Table operations
   */
  tables = {
    /**
     * List all tables
     */
    list: async () => {
      const { data, error } = await this.client.GET("/table", {});
      if (error) throw new Error(`Failed to list tables: ${error.error}`);
      return data;
    },

    /**
     * Get table details and status
     */
    get: async (tableName: string) => {
      const { data, error } = await this.client.GET("/table/{tableName}", {
        params: { path: { tableName } },
      });
      if (error) throw new Error(`Failed to get table: ${error.error}`);
      return data;
    },

    /**
     * Create a new table
     */
    create: async (tableName: string, config: CreateTableRequest = {}) => {
      const { data, error } = await this.client.POST("/table/{tableName}", {
        params: { path: { tableName } },
        body: config,
      });
      if (error) throw new Error(`Failed to create table: ${error.error}`);
      return data;
    },

    /**
     * Drop a table
     */
    drop: async (tableName: string) => {
      const { error } = await this.client.DELETE("/table/{tableName}", {
        params: { path: { tableName } },
      });
      if (error) throw new Error(`Failed to drop table: ${error.error}`);
      return true;
    },

    /**
     * Update schema for a table
     */
    updateSchema: async (tableName: string, config: TableSchema = {}) => {
      const { data, error } = await this.client.PUT("/table/{tableName}/schema", {
        params: { path: { tableName } },
        body: config,
      });
      if (error) throw new Error(`Failed to update table schema: ${error.error}`);
      return data;
    },

    /**
     * Query a specific table
     */
    query: async (tableName: string, request: QueryRequest) => {
      const { data, error } = await this.client.POST("/table/{tableName}/query", {
        params: { path: { tableName } },
        body: request,
      });
      if (error) throw new Error(`Table query failed: ${error.error}`);
      return data;
    },

    /**
     * Perform batch operations on a table
     */
    batch: async (tableName: string, request: BatchRequest) => {
      const { data, error } = await this.client.POST("/table/{tableName}/batch", {
        params: { path: { tableName } },
        // @ts-expect-error Our BatchRequest type allows any object shape for inserts
        body: request,
      });
      if (error) throw new Error(`Batch operation failed: ${error.error}`);
      return data;
    },

    /**
     * Backup a table
     */
    backup: async (tableName: string, request: BackupRequest) => {
      const { data, error } = await this.client.POST("/table/{tableName}/backup", {
        params: { path: { tableName } },
        body: request,
      });
      if (error) throw new Error(`Backup failed: ${error.error}`);
      return data;
    },

    /**
     * Restore a table from backup
     */
    restore: async (tableName: string, request: RestoreRequest) => {
      const { data, error } = await this.client.POST("/table/{tableName}/restore", {
        params: { path: { tableName } },
        body: request,
      });
      if (error) throw new Error(`Restore failed: ${error.error}`);
      return data;
    },

    /**
     * Lookup a specific key in a table
     */
    lookup: async (tableName: string, key: string) => {
      const { data, error } = await this.client.GET("/table/{tableName}/key/{key}", {
        params: { path: { tableName, key } },
      });
      if (error) throw new Error(`Key lookup failed: ${error.error}`);
      return data;
    },
  };

  /**
   * Index operations
   */
  indexes = {
    /**
     * List all indexes for a table
     */
    list: async (tableName: string) => {
      const { data, error } = await this.client.GET("/table/{tableName}/index", {
        params: { path: { tableName } },
      });
      if (error) throw new Error(`Failed to list indexes: ${error.error}`);
      return data;
    },

    /**
     * Get index details
     */
    get: async (tableName: string, indexName: string) => {
      const { data, error } = await this.client.GET("/table/{tableName}/index/{indexName}", {
        params: { path: { tableName, indexName } },
      });
      if (error) throw new Error(`Failed to get index: ${error.error}`);
      return data;
    },

    /**
     * Create a new index
     */
    create: async (tableName: string, config: IndexConfig) => {
      const { error } = await this.client.POST("/table/{tableName}/index/{indexName}", {
        params: { path: { tableName, indexName: config.name } },
        body: config,
      });
      if (error) throw new Error(`Failed to create index: ${error.error}`);
      return true;
    },

    /**
     * Drop an index
     */
    drop: async (tableName: string, indexName: string) => {
      const { error } = await this.client.DELETE("/table/{tableName}/index/{indexName}", {
        params: { path: { tableName, indexName } },
      });
      if (error) throw new Error(`Failed to drop index: ${error.error}`);
      return true;
    },
  };

  /**
   * User management operations
   */
  users = {
    /**
     * Get user details
     */
    get: async (userName: string) => {
      const { data, error } = await this.client.GET("/user/{userName}", {
        params: { path: { userName } },
      });
      if (error) throw new Error(`Failed to get user: ${error.error}`);
      return data;
    },

    /**
     * Create a new user
     */
    create: async (userName: string, request: CreateUserRequest) => {
      const { data, error } = await this.client.POST("/user/{userName}", {
        params: { path: { userName } },
        body: request,
      });
      if (error) throw new Error(`Failed to create user: ${error.error}`);
      return data;
    },

    /**
     * Delete a user
     */
    delete: async (userName: string) => {
      const { error } = await this.client.DELETE("/user/{userName}", {
        params: { path: { userName } },
      });
      if (error) throw new Error(`Failed to delete user: ${error.error}`);
      return true;
    },

    /**
     * Update user password
     */
    updatePassword: async (userName: string, newPassword: string) => {
      const { data, error } = await this.client.PUT("/user/{userName}/password", {
        params: { path: { userName } },
        body: { new_password: newPassword },
      });
      if (error) throw new Error(`Failed to update password: ${error.error}`);
      return data;
    },

    /**
     * Get user permissions
     */
    getPermissions: async (userName: string) => {
      const { data, error } = await this.client.GET("/user/{userName}/permission", {
        params: { path: { userName } },
      });
      if (error) throw new Error(`Failed to get permissions: ${error.error}`);
      return data;
    },

    /**
     * Add permission to user
     */
    addPermission: async (userName: string, permission: Permission) => {
      const { data, error } = await this.client.POST("/user/{userName}/permission", {
        params: { path: { userName } },
        body: permission,
      });
      if (error) throw new Error(`Failed to add permission: ${error.error}`);
      return data;
    },

    /**
     * Remove permission from user
     */
    removePermission: async (userName: string, resource: string, resourceType: ResourceType) => {
      const { error } = await this.client.DELETE("/user/{userName}/permission", {
        params: {
          path: { userName },
          query: { resource, resourceType },
        },
      });
      if (error) throw new Error(`Failed to remove permission: ${error.error}`);
      return true;
    },
  };

  /**
   * Get the underlying OpenAPI client for advanced use cases
   */
  getRawClient() {
    return this.client;
  }
}
