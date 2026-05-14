import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useState } from "react";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import TokensPage from "@/pages/tokens";
import ASTPage from "@/pages/ast";
import AnalysisPage from "@/pages/analysis";
import OptimizerPage from "@/pages/optimizer";
import IRPage from "@/pages/ir";
import ReportPage from "@/pages/report";
import type { CompileResult } from "@workspace/api-client-react";

const queryClient = new QueryClient();

function App() {
  const [result, setResult] = useState<CompileResult | null>(null);
  const [currentCode, setCurrentCode] = useState<string>("");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppLayout result={result}>
              <Switch>
                <Route path="/" component={() => <Dashboard setResult={setResult} result={result} currentCode={currentCode} setCurrentCode={setCurrentCode} />} />
                <Route path="/tokens" component={() => <TokensPage result={result} />} />
                <Route path="/ast" component={() => <ASTPage result={result} />} />
                <Route path="/analysis" component={() => <AnalysisPage result={result} />} />
                <Route path="/optimizer" component={() => <OptimizerPage result={result} currentCode={currentCode} />} />
                <Route path="/ir" component={() => <IRPage result={result} />} />
                <Route path="/report" component={() => <ReportPage result={result} />} />
                <Route component={NotFound} />
              </Switch>
            </AppLayout>
          </WouterRouter>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
