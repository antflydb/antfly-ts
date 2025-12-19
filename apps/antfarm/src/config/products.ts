// Product configuration for conditional builds
// Set VITE_PRODUCTS environment variable to control which products are enabled
// Examples:
//   VITE_PRODUCTS=termite          - Termite-only build
//   VITE_PRODUCTS=antfly           - Antfly-only build
//   VITE_PRODUCTS=antfly,termite   - Full antfarm (default)

export type ProductId = "antfly" | "termite";

export interface Product {
  id: ProductId;
  name: string;
  description: string;
  defaultRoute: string;
}

export const PRODUCTS: Record<ProductId, Product> = {
  antfly: {
    id: "antfly",
    name: "Antfly",
    description: "Vector database management",
    defaultRoute: "/",
  },
  termite: {
    id: "termite",
    name: "Termite",
    description: "ML inference playgrounds",
    defaultRoute: "/playground/chunking",
  },
};

// Parse enabled products from environment variable
const parseEnabledProducts = (): ProductId[] => {
  const envValue = import.meta.env.VITE_PRODUCTS as string | undefined;

  if (!envValue) {
    // Default: enable all products
    return ["antfly", "termite"];
  }

  const products = envValue
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is ProductId => p === "antfly" || p === "termite");

  // If no valid products found, enable all
  return products.length > 0 ? products : ["antfly", "termite"];
};

export const enabledProducts = parseEnabledProducts();

export const isProductEnabled = (product: ProductId): boolean => enabledProducts.includes(product);

export const showProductSwitcher = enabledProducts.length > 1;

// Get the default product (first enabled one)
export const defaultProduct: ProductId = enabledProducts[0];

// Get the default route based on enabled products
export const getDefaultRoute = (): string => {
  return PRODUCTS[defaultProduct].defaultRoute;
};
