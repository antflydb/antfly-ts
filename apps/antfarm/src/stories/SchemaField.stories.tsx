import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { fn } from "storybook/test";
import SchemaField from "../components/schema-builder/SchemaField";

const meta: Meta<typeof SchemaField> = {
  title: "SchemaBuilder/SchemaField",
  component: SchemaField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const methods = useForm({
        defaultValues: {
          document_schemas: [
            {
              properties: [
                {
                  name: "product_id",
                  type: "string",
                  description: "Unique identifier",
                  "x-antfly-index": true,
                  "x-antfly-types": [],
                },
                {
                  name: "name",
                  type: "string",
                  description: "Product name",
                  "x-antfly-index": true,
                  "x-antfly-types": [],
                },
              ],
            },
          ],
        },
      });
      return (
        <FormProvider {...methods}>
          <div className="w-[1000px]">
            <Story />
          </div>
        </FormProvider>
      );
    },
  ],
  args: {
    onRemove: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    schemaIndex: 0,
    fieldIndex: 0,
  },
};

export const WithError: Story = {
  decorators: [
    (Story) => {
      const methods = useForm({
        mode: "onChange",
        defaultValues: {
          document_schemas: [
            {
              properties: [
                {
                  name: "_id",
                  type: "string",
                  description: "Unique identifier",
                  "x-antfly-index": true,
                  "x-antfly-types": [],
                },
              ],
            },
          ],
        },
      });
      React.useEffect(() => {
        methods.trigger();
      }, [methods]);
      return (
        <FormProvider {...methods}>
          <div className="w-[1000px]">
            <Story />
          </div>
        </FormProvider>
      );
    },
  ],
  args: {
    schemaIndex: 0,
    fieldIndex: 0,
  },
};
