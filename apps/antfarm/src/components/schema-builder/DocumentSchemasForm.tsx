import { zodResolver } from "@hookform/resolvers/zod";
import type React from "react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { JSONSchema, JSONSchemaProperty, TableSchema } from "../../api";
import JsonViewer from "../JsonViewer";
import SchemaEditor from "./SchemaEditor";

const antflyTypeEnum = z.enum([
  "boolean",
  "link",
  "text",
  "html",
  "numeric",
  "search_as_you_type",
  "keyword",
  "datetime",
  "geopoint",
  "geoshape",
  "embedding",
  "blob",
]);

const jsonSchemaPropertySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "integer", "boolean", "object", "array"]),
  description: z.string().optional(),
  "x-antfly-index": z.boolean().optional(),
  "x-antfly-types": z.array(antflyTypeEnum).optional(),
});

const documentSchemaSchema = z.object({
  name: z.string().min(1),
  properties: z.array(jsonSchemaPropertySchema),
  "x-antfly-include-in-all": z.array(z.string()).optional(),
});

const documentSchemasFormSchema = z.object({
  default_type: z.string().optional(),
  document_schemas: z.array(documentSchemaSchema),
});

type DocumentSchemasFormData = z.infer<typeof documentSchemasFormSchema>;

interface DocumentSchemasFormProps {
  onSubmit: (schema: Omit<TableSchema, "key"> & { key?: string }) => void;
  theme: string;
  initialSchema?: TableSchema | null;
  title?: string;
  renderAsForm?: boolean;
  tableName?: string;
}

interface JsonPayload {
  schema: TableSchema;
}

const DocumentSchemasForm: React.FC<DocumentSchemasFormProps> = ({
  onSubmit,
  initialSchema,
  title = "Edit Document Schemas",
  renderAsForm = true,
  tableName,
}) => {
  "use no memo";
  const [viewMode, setViewMode] = useState<"form" | "json">("form");
  const [jsonPayload, setJsonPayload] = useState<JsonPayload>({
    schema: initialSchema || { document_schemas: {} },
  });

  const form = useForm<DocumentSchemasFormData>({
    resolver: zodResolver(documentSchemasFormSchema),
    defaultValues: {
      default_type: initialSchema?.default_type || "",
      document_schemas: initialSchema
        ? Object.entries(initialSchema.document_schemas || {}).map(
            ([schemaName, schemaDetails]) => ({
              name: schemaName,
              "x-antfly-include-in-all": schemaDetails.schema["x-antfly-include-in-all"] || [],
              properties: Object.entries(schemaDetails.schema.properties || {}).map(
                ([propName, propDetails]) => {
                  const prop = propDetails as JSONSchemaProperty;
                  return {
                    name: propName,
                    type: prop.type,
                    description: prop.description,
                    "x-antfly-index": prop["x-antfly-index"],
                    "x-antfly-types": prop["x-antfly-types"],
                  };
                }
              ),
            })
          )
        : [],
    },
  });

  const { watch, reset } = form;
  const {
    fields: documentSchemaFields,
    append: appendDocumentSchema,
    remove: removeDocumentSchema,
  } = useFieldArray({
    control: form.control,
    name: "document_schemas",
  });

  const definedSchemaNames = watch("document_schemas")?.map((s) => s.name) || [];

  useEffect(() => {
    if (viewMode === "form") {
      const subscription = watch((data) => {
        const formattedSchema: TableSchema = {
          default_type: data.default_type,
          document_schemas: (data.document_schemas || []).reduce(
            (acc, schema) => {
              if (!schema || !schema.name) return acc;
              const jsonSchema: JSONSchema = {
                type: "object",
                properties: (schema.properties || []).reduce(
                  (propAcc, prop) => {
                    if (!prop || !prop.name) return propAcc;
                    const { name, ...rest } = prop;
                    propAcc[name] = rest as JSONSchemaProperty;
                    return propAcc;
                  },
                  {} as { [key: string]: JSONSchemaProperty }
                ),
              };

              // Add x-antfly-include-in-all if present and non-empty
              const includeInAll =
                schema["x-antfly-include-in-all"]?.filter(
                  (f): f is string => typeof f === "string"
                ) || [];
              if (includeInAll.length > 0) {
                jsonSchema["x-antfly-include-in-all"] = includeInAll;
              }

              acc[schema.name] = {
                schema: jsonSchema,
              };
              return acc;
            },
            {} as { [key: string]: { schema: JSONSchema } }
          ),
        };

        setJsonPayload({
          schema: formattedSchema,
        });
      });
      return () => subscription.unsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, watch]);

  const handleFormSubmit = (data: DocumentSchemasFormData) => {
    if (viewMode === "json") {
      onSubmit(jsonPayload.schema);
      return;
    }

    // Transform the array of schemas into the map format required by the API
    const formattedSchema: TableSchema = {
      default_type: data.default_type,
      document_schemas: data.document_schemas.reduce(
        (acc, schema) => {
          const jsonSchema: JSONSchema = {
            type: "object",
            properties: schema.properties.reduce(
              (propAcc, prop) => {
                const { name, ...rest } = prop;
                propAcc[name] = rest;
                return propAcc;
              },
              {} as { [key: string]: JSONSchemaProperty }
            ),
          };

          // Add x-antfly-include-in-all if present and non-empty
          const includeInAll =
            schema["x-antfly-include-in-all"]?.filter((f): f is string => typeof f === "string") ||
            [];
          if (includeInAll.length > 0) {
            jsonSchema["x-antfly-include-in-all"] = includeInAll;
          }

          acc[schema.name] = {
            schema: jsonSchema,
          };
          return acc;
        },
        {} as { [key: string]: { schema: JSONSchema } }
      ),
    };

    onSubmit(formattedSchema);
  };

  const handleViewChange = (checked: boolean) => {
    const newMode = checked ? "json" : "form";
    if (newMode === "form") {
      const { schema } = jsonPayload;

      if (schema) {
        const document_schemas = Object.entries(schema.document_schemas || {}).map(
          ([schemaName, schemaDetails]: [string, { schema: JSONSchema }]) => ({
            name: schemaName,
            "x-antfly-include-in-all": schemaDetails.schema["x-antfly-include-in-all"] || [],
            properties: Object.entries(schemaDetails.schema.properties || {}).map(
              ([propName, propDetails]) => {
                const prop = propDetails as JSONSchemaProperty;
                return {
                  name: propName,
                  type: prop.type,
                  description: prop.description,
                  "x-antfly-index": prop["x-antfly-index"],
                  "x-antfly-types": prop["x-antfly-types"],
                };
              }
            ),
          })
        );

        const newData: DocumentSchemasFormData = {
          default_type: schema.default_type || "",
          document_schemas: document_schemas,
        };

        reset(newData);
      }
    }
    setViewMode(newMode);
  };

  const content = (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        {renderAsForm && (
          <div className="flex items-center gap-2">
            <p>Raw JSON</p>
            <Switch checked={viewMode === "json"} onCheckedChange={handleViewChange} />
          </div>
        )}
      </div>
      {viewMode === "json" && renderAsForm ? (
        <JsonViewer json={jsonPayload.schema} />
      ) : (
        <>
          <h4 className="text-lg font-semibold mb-2">Document Schemas</h4>
          {documentSchemaFields.map((field, index) => (
            <SchemaEditor
              key={field.id}
              schemaIndex={index}
              onRemove={() => removeDocumentSchema(index)}
              tableName={tableName}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => appendDocumentSchema({ name: "", properties: [] })}
            className="mt-2 mb-4"
          >
            Add Schema Type
          </Button>

          {definedSchemaNames.length > 0 && (
            <FormField
              control={form.control}
              name="default_type"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Default Schema Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a default schema type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {definedSchemaNames
                        .filter((name) => name !== "")
                        .map((name: string) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </>
      )}

      {renderAsForm && (
        <div className="mt-6 flex gap-2">
          <Button type="submit" variant="default">
            Update Schema
          </Button>
        </div>
      )}
    </>
  );

  return renderAsForm ? (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)}>{content}</form>
    </Form>
  ) : (
    <Form {...form}>{content}</Form>
  );
};

export default DocumentSchemasForm;
