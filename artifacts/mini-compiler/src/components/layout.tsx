import { Link, useLocation } from "wouter";
import type { CompileResult } from "@workspace/api-client-react";
import {
  LayoutDashboard, FileText, Network, SearchCode,
  Zap, Binary, BarChart3, Cpu
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarTrigger
} from "./ui/sidebar";
import { Badge } from "./ui/badge";

export function AppLayout({ children, result }: { children: React.ReactNode; result: CompileResult | null }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, always: true },
    { href: "/tokens", label: "Token Stream", icon: FileText, badge: result ? String(result.tokens.length) : null },
    { href: "/ast", label: "AST Explorer", icon: Network, badge: null },
    { href: "/analysis", label: "Static Analysis", icon: SearchCode, badge: result ? String((result.analysis.semanticWarnings?.length ?? 0) + (result.analysis.staticIssues?.length ?? 0)) : null },
    { href: "/optimizer", label: "Optimizer", icon: Zap, badge: result ? String(result.optimization.passes.filter(p => p.applied).length) : null },
    { href: "/ir", label: "IR Code", icon: Binary, badge: result ? String(result.ir.instructions.length) : null },
    { href: "/report", label: "Full Report", icon: BarChart3, badge: null },
  ];

  const hasResult = !!result;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15 border border-primary/30">
              <Cpu className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-mono font-bold text-sm text-foreground tracking-tight">mini_cc</div>
              <div className="text-xs text-muted-foreground">Compiler Pipeline</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const disabled = !item.always && !hasResult;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href}
                        disabled={disabled}
                      >
                        <Link href={disabled ? "#" : item.href} className="flex items-center gap-2 w-full">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-sm">{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0 h-5 min-w-[1.5rem] text-center">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {result && (
            <div className="px-3 pb-3 mt-auto">
              <div className="rounded border border-border bg-card p-3 space-y-2">
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Last Run</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Score</span>
                  <span className={`text-xs font-mono font-bold ${result.maintainabilityScore >= 75 ? "text-green-400" : result.maintainabilityScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {result.maintainabilityScore}/100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total time</span>
                  <span className="text-xs font-mono text-foreground">{result.totalTimeMs.toFixed(1)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Errors</span>
                  <span className={`text-xs font-mono ${result.errors.length > 0 ? "text-red-400" : "text-green-400"}`}>
                    {result.errors.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </SidebarContent>
      </Sidebar>

      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        <div className="border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <div className="text-xs text-muted-foreground font-mono">
            {navItems.find(n => n.href === location)?.label ?? "mini_cc"}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
