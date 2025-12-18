import { Cross2Icon } from "@radix-ui/react-icons";
import { Info } from "lucide-react";
import { InputData, jsonInputForTargetLanguage, quicktype } from "quicktype-core";
import type React from "react";
import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import MultiSelect from "../MultiSelect";
import { ImportJsonDialog } from "./ImportJsonDialog";
import SchemaField from "./SchemaField";

interface SchemaEditorProps {
  schemaIndex: number;
  onRemove: () => void;
}

interface SchemaProperty {
  name: string;
  type: string;
  description?: string;
  "x-antfly-index"?: boolean;
  "x-antfly-types"?: string[];
}

const SchemaEditor: React.FC<SchemaEditorProps> = ({ schemaIndex, onRemove }) => {
  const { control, setValue, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `document_schemas.${schemaIndex}.properties`,
  });

  const [isImportDialogOpen, setImportDialogOpen] = useState(false);

  // Watch the properties to get field names for the include-in-all selector
  const properties = watch(`document_schemas.${schemaIndex}.properties`) || [];

  async function handleImport(jsonString: string) {
    if (!jsonString.trim()) {
      return;
    }
    try {
      const lines = jsonString.trim().split("\n");
      let samples = [jsonString];
      if (lines.length > 1) {
        try {
          for (const line of lines) {
            JSON.parse(line);
          }
          samples = lines;
        } catch (e) {
          // Not a valid jsonl, treat as a single json blob
          console.warn("Input is not valid JSONL, treating as single JSON blob.", e);
        }
      }
      const jsonInput = jsonInputForTargetLanguage("json-schema");
      await jsonInput.addSource({
        name: "Root",
        samples: samples,
      });

      const inputData = new InputData();
      inputData.addInput(jsonInput);

      const { lines: schemaLines } = await quicktype({
        inputData,
        lang: "json-schema",
        indentation: "  ",
      });

      const schema = JSON.parse(schemaLines.join("\n"));
      let properties = schema.properties;

      if (schema.type === "array" && schema.items?.properties) {
        properties = schema.items.properties;
      } else if (schema.definitions) {
        const firstDefinitionKey = Object.keys(schema.definitions)[0];
        if (firstDefinitionKey) {
          properties = schema.definitions[firstDefinitionKey].properties;
        }
      }

      if (!properties) {
        console.warn('Could not find "properties" in the generated schema.');
        return;
      }

      const reservedFieldNames = new Set([`_type`, `_id`, `_embeddings`, `_summaries`]);
      const newFields = Object.keys(properties)
        .filter((key) => {
          if (reservedFieldNames.has(key)) {
            console.warn(`Skipping reserved field name "${key}" from imported JSON.`);
            return false;
          }
          return true;
        })
        .map((key) => {
          const prop = properties[key];
          return {
            name: key,
            type: prop.type,
            description: prop.description || "",
            "x-antfly-index": true,
            "x-antfly-types": [],
          };
        });

      setValue(`document_schemas.${schemaIndex}.properties`, newFields);
    } catch (error) {
      console.error("Failed to import from JSON:", error);
    }
  }

  return (
    <div className="p-4 border border-gray-300 rounded-md mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4">
          <FormField
            control={control}
            name={`document_schemas.${schemaIndex}.name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Schema Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Required: Schema Name" />
                </FormControl>
                <FormDescription>Required: Name of this Document Schema.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`document_schemas.${schemaIndex}.key`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Document Key</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Optional: Document Key" />
                </FormControl>
                <FormDescription>Optional: Field to use as Document Key.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button onClick={onRemove} aria-label="delete schema" variant="ghost" size="icon">
          <Cross2Icon />
        </Button>
      </div>

      <FormField
        control={control}
        name={`document_schemas.${schemaIndex}.x-antfly-include-in-all`}
        defaultValue={[]}
        render={({ field }) => {
          // Get text-based field names for the selector
          const textBasedFields = properties
            .filter((prop: SchemaProperty) => {
              if (!prop?.name) return false;
              // Only include text-based fields (text, html, keyword, search_as_you_type, link)
              const antflyTypes = prop["x-antfly-types"] || [];
              const hasTextTypes = antflyTypes.some((t: string) =>
                ["text", "html", "keyword", "search_as_you_type", "link"].includes(t),
              );
              // If no x-antfly-types specified, check if it's a string type (defaults to text)
              const isStringType = prop.type === "string" && antflyTypes.length === 0;
              return hasTextTypes || isStringType;
            })
            .map((prop: SchemaProperty) => prop.name);

          return (
            <FormItem className="mb-4">
              <FormLabel>Include in _all Field</FormLabel>
              <FormControl>
                <MultiSelect
                  options={textBasedFields.map((name: string) => ({
                    label: name,
                    value: name,
                  }))}
                  value={field.value || []}
                  onChange={field.onChange}
                  placeholder="Select fields to include in _all"
                />
              </FormControl>
              <FormDescription>
                Select text-based fields to include in the _all search field for full-text search
                across multiple fields.
              </FormDescription>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      <h4 className="text-lg font-semibold mb-2">Fields</h4>
      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>
          The _type field is reserved and will be used to determine the document type on upload.
        </AlertDescription>
      </Alert>
      {fields.map((field, index) => (
        <SchemaField
          key={field.id}
          schemaIndex={schemaIndex}
          fieldIndex={index}
          onRemove={() => remove(index)}
        />
      ))}
      <div className="flex gap-2 mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({
              name: "",
              type: "string",
              description: "",
              "x-antfly-index": true,
            })
          }
        >
          Add Field
        </Button>
        <Button type="button" variant="outline" onClick={() => setImportDialogOpen(true)}>
          Import from JSON
        </Button>
      </div>
      <ImportJsonDialog
        open={isImportDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
};

export default SchemaEditor;
