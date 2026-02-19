import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ApiConfigProvider } from "@/components/api-config-provider";
import { AuthProvider } from "@/components/auth-provider";
import { CommandPaletteProvider } from "@/components/command-palette-provider";
import { ConnectionStatusBanner } from "@/components/connection-status-banner";
import { ContentWidthProvider, useContentWidth } from "@/components/content-width-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { PrivateRoute } from "@/components/private-route";
import { AppSidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WorkspaceHeader } from "@/components/workspace-header";
import {
  defaultProduct,
  getDefaultRoute,
  isProductEnabled,
  type ProductId,
} from "@/config/products";
import { ThemeProvider } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import ChunkingPlaygroundPage from "./pages/ChunkingPlaygroundPage";
import CreateTablePage from "./pages/CreateTablePage";
import EvalsPlaygroundPage from "./pages/EvalsPlaygroundPage";
import KnowledgeGraphPlaygroundPage from "./pages/KnowledgeGraphPlaygroundPage";
import { LoginPage } from "./pages/LoginPage";
import ModelsPage from "./pages/ModelsPage";
import NERPlaygroundPage from "./pages/NERPlaygroundPage";
import QuestionPlaygroundPage from "./pages/QuestionPlaygroundPage";
import RagPlaygroundPage from "./pages/RagPlaygroundPage";
import TableDetailsPage from "./pages/TableDetailsPage";
import TablesListPage from "./pages/TablesListPage";
import { SecretsPage } from "./pages/SecretsPage";
import { UsersPage } from "./pages/UsersPage";

function AppContent() {
  const [currentSection, setCurrentSection] = useState("indexes");
  const [currentProduct, setCurrentProduct] = useState<ProductId>(defaultProduct);
  const { contentWidth } = useContentWidth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <SidebarProvider>
              <AppSidebar
                currentSection={currentSection}
                onSectionChange={setCurrentSection}
                currentProduct={currentProduct}
                onProductChange={setCurrentProduct}
              />
              <SidebarInset>
                <WorkspaceHeader />
                <ConnectionStatusBanner />
                <div
                  className={cn(
                    "flex-1 p-4 transition-all",
                    contentWidth === "restricted" ? "container mx-auto max-w-7xl" : "w-full"
                  )}
                >
                  <Routes>
                    {/* Antfly routes */}
                    {isProductEnabled("antfly") && (
                      <>
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
                        <Route path="/secrets" element={<SecretsPage />} />
                      </>
                    )}

                    {/* Termite routes */}
                    {isProductEnabled("termite") && (
                      <>
                        <Route path="/models" element={<ModelsPage />} />
                        <Route path="/playground/chunking" element={<ChunkingPlaygroundPage />} />
                        <Route path="/playground/recognize" element={<NERPlaygroundPage />} />
                        <Route path="/playground/question" element={<QuestionPlaygroundPage />} />
                        <Route path="/playground/kg" element={<KnowledgeGraphPlaygroundPage />} />
                        <Route path="/playground/evals" element={<EvalsPlaygroundPage />} />
                        <Route path="/playground/rag" element={<RagPlaygroundPage />} />
                      </>
                    )}

                    {/* Default redirect based on enabled products */}
                    <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
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
      <ErrorBoundary>
        <ApiConfigProvider>
          <AuthProvider>
            <ContentWidthProvider>
              <CommandPaletteProvider>
                <AppContent />
              </CommandPaletteProvider>
            </ContentWidthProvider>
          </AuthProvider>
        </ApiConfigProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
