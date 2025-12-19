import { Bug, ChevronsUpDown, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import {
  enabledProducts,
  PRODUCTS,
  type Product,
  type ProductId,
  showProductSwitcher,
} from "@/config/products";
import { cn } from "@/lib/utils";

interface ProductSwitcherProps {
  currentProduct: ProductId;
  onProductChange: (product: ProductId) => void;
  collapsed?: boolean;
}

const ProductIcon = ({ product, className }: { product: ProductId; className?: string }) => {
  if (product === "termite") {
    return <Bug className={className} />;
  }
  return <Database className={className} />;
};

export function ProductSwitcher({
  currentProduct,
  onProductChange,
  collapsed,
}: ProductSwitcherProps) {
  const navigate = useNavigate();
  const current = PRODUCTS[currentProduct];

  // Don't render if only one product is enabled
  if (!showProductSwitcher) {
    return (
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <ProductIcon product={currentProduct} className="size-4" />
        </div>
        {!collapsed && (
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{current.name}</span>
            <span className="truncate text-xs text-muted-foreground">{current.description}</span>
          </div>
        )}
      </SidebarMenuButton>
    );
  }

  const handleProductSelect = (product: Product) => {
    onProductChange(product.id);
    navigate(product.defaultRoute);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ProductIcon product={currentProduct} className="size-4" />
          </div>
          {!collapsed && (
            <>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{current.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {current.description}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">Products</DropdownMenuLabel>
        {enabledProducts.map((productId) => {
          const product = PRODUCTS[productId];
          return (
            <DropdownMenuItem
              key={product.id}
              onClick={() => handleProductSelect(product)}
              className={cn("gap-2 p-2", currentProduct === product.id && "bg-accent")}
            >
              <div className="flex size-6 items-center justify-center rounded-sm border">
                <ProductIcon product={product.id} className="size-4 shrink-0" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{product.name}</span>
                <span className="text-xs text-muted-foreground">{product.description}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
