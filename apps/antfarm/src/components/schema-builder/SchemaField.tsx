import { Cross2Icon } from "@radix-ui/react-icons";
import type React from "react";
import { get, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AntflyType } from "../../api";
import MultiSelect from "../MultiSelect";

interface SchemaFieldProps {
  schemaIndex: number;
  fieldIndex: number;
  onRemove: () => void;
}

const antflyTypes: AntflyType[] = [
  "search_as_you_type",
  "geopoint",
  "geoshape",
  "keyword",
  "embedding",
  "link",
  "blob",
  "numeric",
  "text",
  "datetime",
  "boolean",
];

const SchemaField: React.FC<SchemaFieldProps> = ({ schemaIndex, fieldIndex, onRemove }) => {
  const {
    control,
    formState: { errors },
    watch,
  } = useFormContext();

  const fieldName = `document_schemas.${schemaIndex}.properties.${fieldIndex}.name`;
  const isIndexed = watch(
    `document_schemas.${schemaIndex}.properties.${fieldIndex}.x-antfly-index`,
  );
  const fieldError = get(errors, fieldName);

  return (
    <div className="flex gap-4 items-center mb-4 p-4 border border-gray-200 rounded-md">
      <FormField
        control={control}
        name={fieldName}
        rules={{
          required: "Field name is required",
          validate: (value) =>
            ![`_type`, `_id`, `_embeddings`, `_summaries`].includes(value) ||
            `Field name cannot be one of _type, _id, _embeddings, or _summaries`,
        }}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel>Field Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Enter field name"
                color={fieldError ? "red" : undefined}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`document_schemas.${schemaIndex}.properties.${fieldIndex}.type`}
        defaultValue="string"
        render={({ field }) => (
          <FormItem className="min-w-32">
            <FormLabel>Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="integer">Integer</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="object">Object</SelectItem>
                <SelectItem value="array">Array</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`document_schemas.${schemaIndex}.properties.${fieldIndex}.description`}
        render={({ field }) => (
          <FormItem className="flex-1 min-w-48">
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Enter description" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`document_schemas.${schemaIndex}.properties.${fieldIndex}.x-antfly-index`}
        defaultValue={true}
        render={({ field }) => (
          <FormItem className="mt-5">
            <div className="flex items-center gap-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel>Index?</FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {isIndexed && (
        <FormField
          control={control}
          name={`document_schemas.${schemaIndex}.properties.${fieldIndex}.x-antfly-types`}
          defaultValue={[]}
          render={({ field }) => (
            <FormItem className="flex-1 min-w-32">
              <FormLabel>Antfly Types</FormLabel>
              <FormControl>
                <MultiSelect
                  options={antflyTypes.map((type) => ({
                    label: type,
                    value: type,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select Antfly types"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <Button
        onClick={onRemove}
        aria-label="delete field"
        variant="ghost"
        size="icon"
        className="mt-5"
      >
        <Cross2Icon />
      </Button>
    </div>
  );
};

export default SchemaField;
