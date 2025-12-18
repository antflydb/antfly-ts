import type { TableStatus } from "@antfly/sdk";
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  Database,
  FileInput,
  FileText,
  LayoutList,
  PanelLeft,
  PanelLeftOpen,
  Plus,
  Scissors,
  Search,
  Shield,
  Sparkles,
  Table as TableIcon,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api";
import AntflyLogo from "@/components/antfly-logo";
import { SidebarUser } from "@/components/sidebar-user";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentSection?: string;
  onSectionChange?: (section: string) => void;
}

export function AppSidebar({ currentSection, onSectionChange, ...props }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state: sidebarState, toggleSidebar, isMobile } = useSidebar();
  const { hasPermission } = useAuth();

  // Extract tableName from pathname since useParams doesn't work outside Route context
  const tableName = React.useMemo(() => {
    const match = location.pathname.match(/^\/tables\/([^/]+)/);
    return match ? match[1] : undefined;
  }, [location.pathname]);

  const [tables, setTables] = React.useState<TableStatus[]>([]);
  const [overviewOpen, setOverviewOpen] = React.useState(true);
  const [dataOpen, setDataOpen] = React.useState(true);
  const [comboboxOpen, setComboboxOpen] = React.useState(false);
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleExpandClick = () => {
    toggleSidebar();
    setIsHovering(false);
  };

  React.useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await api.tables.list();
        setTables(response as TableStatus[]);
      } catch (e) {
        console.error("Failed to fetch tables:", e);
      }
    };
    fetchTables();
  }, []);

  const handleTableChange = (value: string) => {
    navigate(`/tables/${value}`);
  };

  const handleSectionClick = (section: string) => {
    if (onSectionChange) {
      onSectionChange(section);
    }
  };

  const isOnTablePage = location.pathname.startsWith("/tables/");

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Hover overlay expand button for collapsed state */}
      {sidebarState === "collapsed" && !isMobile && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Hover zone for tooltip trigger
        <div
          className="absolute top-4 left-2 z-40 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <TooltipProvider delayDuration={0}>
            <Tooltip open={isHovering}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="size-8 bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground pointer-events-auto cursor-e-resize transition-colors border-0"
                  onClick={handleExpandClick}
                >
                  <PanelLeftOpen className="size-4" />
                  <span className="sr-only">Open sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                Open sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      <SidebarHeader className="border-r border-b-0 group-data-[collapsible=icon]:border-r-0 gap-0 pb-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2">
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground shadow-none border-0"
              >
                {sidebarState === "collapsed" ? (
                  <div className="flex items-center justify-center min-w-8 h-8">
                    <AntflyLogo size={32} variant="auto" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-6">
                    <AntflyLogo size={24} variant="auto" />
                  </div>
                )}
                <div className="grid flex-1 text-left text-xl leading-tight group-data-[collapsible=icon]:hidden font-aeonik">
                  <span className="truncate font-semibold">
                    <span style={{ fontWeight: 400 }}>antfarm</span>
                  </span>
                </div>
              </SidebarMenuButton>
              {isMounted && (isMobile || sidebarState !== "collapsed") && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-7 shrink-0",
                          isMobile ? "cursor-pointer" : "cursor-w-resize",
                        )}
                        onClick={toggleSidebar}
                        onMouseEnter={() => setTooltipOpen(true)}
                        onMouseLeave={() => setTooltipOpen(false)}
                      >
                        {isMobile ? <X className="size-4" /> : <PanelLeft className="size-4" />}
                        <span className="sr-only">
                          {isMobile ? "Close sidebar" : "Collapse sidebar"}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center">
                      {isMobile ? "Close sidebar" : "Collapse sidebar"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="border-r border-t-0 group-data-[collapsible=icon]:border-r-0">
        {/* Table Selector - show when tables are available */}
        {tables.length > 0 && (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Table</SidebarGroupLabel>
            <SidebarGroupContent>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">{tableName || "Select a table..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search tables..." />
                    <CommandList>
                      <CommandEmpty>No table found.</CommandEmpty>
                      <CommandGroup>
                        {tables.map((table) => (
                          <CommandItem
                            key={table.name}
                            value={table.name}
                            onSelect={(currentValue) => {
                              handleTableChange(currentValue);
                              setComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                tableName === table.name ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {table.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Tables Link */}
              <Collapsible defaultOpen>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === "/" || location.pathname === "/create"}
                      tooltip="Tables"
                    >
                      <a
                        href="/"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate("/");
                        }}
                      >
                        <TableIcon className="size-4" />
                        <span>Tables</span>
                        <ChevronRight className="ml-auto size-4 transition-transform data-[state=open]:rotate-90" />
                      </a>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={location.pathname === "/create"}>
                          <a
                            href="/create"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate("/create");
                            }}
                          >
                            <Plus className="size-4" />
                            <span>Create</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Users Link - only show if user has admin permission */}
              {hasPermission("*", "*", "admin") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/users"}
                    tooltip="User Management"
                  >
                    <a
                      href="/users"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/users");
                      }}
                    >
                      <Shield className="size-4" />
                      <span>Users</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Overview Section - only show when on a table page */}
              {isOnTablePage && tableName && (
                <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Overview">
                        <LayoutList className="size-4" />
                        <span>Overview</span>
                        <ChevronRight
                          className={`ml-auto size-4 transition-transform ${overviewOpen ? "rotate-90" : ""}`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentSection === "indexes"}
                            onClick={() => handleSectionClick("indexes")}
                          >
                            <button type="button">
                              <Database className="size-4" />
                              <span>Indexes</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentSection === "chunking"}
                            onClick={() => handleSectionClick("chunking")}
                          >
                            <button type="button">
                              <Sparkles className="size-4" />
                              <span>Chunking</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentSection === "schema"}
                            onClick={() => handleSectionClick("schema")}
                          >
                            <button type="button">
                              <FileText className="size-4" />
                              <span>Schema</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {/* Data Section - only show when on a table page */}
              {isOnTablePage && tableName && (
                <Collapsible open={dataOpen} onOpenChange={setDataOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Data">
                        <Database className="size-4" />
                        <span>Data</span>
                        <ChevronRight
                          className={`ml-auto size-4 transition-transform ${dataOpen ? "rotate-90" : ""}`}
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentSection === "semantic"}
                            onClick={() => handleSectionClick("semantic")}
                          >
                            <button type="button">
                              <Search className="size-4" />
                              <span>Search</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentSection === "faceted"}
                            onClick={() => handleSectionClick("faceted")}
                          >
                            <button type="button">
                              <FileText className="size-4" />
                              <span>Component Builder</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentSection === "bulk"}
                            onClick={() => handleSectionClick("bulk")}
                          >
                            <button type="button">
                              <Upload className="size-4" />
                              <span>Upload</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={currentSection === "document-builder"}
                            onClick={() => handleSectionClick("document-builder")}
                          >
                            <button type="button">
                              <FileInput className="size-4" />
                              <span>Document Builder</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={location.pathname.startsWith("/playground")}
                      tooltip="Playgrounds"
                    >
                      <Wrench className="size-4" />
                      <span>Playgrounds</span>
                      <ChevronRight className="ml-auto size-4 transition-transform data-[state=open]:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={location.pathname === "/playground/chunking"}
                        >
                          <a
                            href="/playground/chunking"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate("/playground/chunking");
                            }}
                          >
                            <Scissors className="size-4" />
                            <span>Chunking</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-r group-data-[collapsible=icon]:border-r-0">
        <SidebarUser />
      </SidebarFooter>
    </Sidebar>
  );
}
