import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ApiConfigProvider } from "@/components/api-config-provider";
import { AuthProvider } from "@/components/auth-provider";
import { CommandPaletteProvider } from "@/components/command-palette-provider";
import { ContentWidthProvider, useContentWidth } from "@/components/content-width-provider";
import { PrivateRoute } from "@/components/private-route";
import { AppSidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceHeader } from "@/components/workspace-header";
import { ThemeProvider } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import ChunkingPlaygroundPage from "./pages/ChunkingPlaygroundPage";
import CreateTablePage from "./pages/CreateTablePage";
import { LoginPage } from "./pages/LoginPage";
import TableDetailsPage from "./pages/TableDetailsPage";
import TablesListPage from "./pages/TablesListPage";
import { UsersPage } from "./pages/UsersPage";

function AppContent() {
  const [currentSection, setCurrentSection] = useState("indexes");
  const { contentWidth } = useContentWidth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <SidebarProvider>
              <AppSidebar currentSection={currentSection} onSectionChange={setCurrentSection} />
              <SidebarInset>
                <WorkspaceHeader />
                <div
                  className={cn(
                    "flex-1 p-4 transition-all",
                    contentWidth === "restricted" ? "container mx-auto max-w-7xl" : "w-full",
                  )}
                >
                  <Routes>
                    <Route path="/" element={<TablesListPage />} />
                    <Route path="/create" element={<CreateTablePage />} />
                    <Route
                      path="/tables/:tableName"
                      element={
                        <TableDetailsPage
                          currentSection={currentSection}
                          onSectionChange={setCurrentSection}
                        />
                      }
                    />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/playground/chunking" element={<ChunkingPlaygroundPage />} />
                  </Routes>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ApiConfigProvider>
        <AuthProvider>
          <ContentWidthProvider>
            <CommandPaletteProvider>
              <AppContent />
            </CommandPaletteProvider>
          </ContentWidthProvider>
        </AuthProvider>
      </ApiConfigProvider>
    </ThemeProvider>
  );
}

export default App;
