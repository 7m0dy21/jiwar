import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Dashboard from "../Dashboard";

// Mocks — avoid hitting Supabase and heavy child components.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));
vi.mock("@/components/dashboard/CustomerDashboard", () => ({
  default: () => <div data-testid="customer-dashboard">CUSTOMER</div>,
}));
vi.mock("@/components/dashboard/MerchantDashboard", () => ({
  default: () => <div data-testid="merchant-dashboard">MERCHANT</div>,
}));

import { useAuth } from "@/hooks/useAuth";

const mockedUseAuth = vi.mocked(useAuth);

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<div data-testid="admin-dashboard">ADMIN</div>} />
        <Route path="/auth" element={<div data-testid="auth-page">AUTH</div>} />
      </Routes>
    </MemoryRouter>
  );

const fakeUser = { id: "user-1" } as any;

beforeEach(() => {
  mockedUseAuth.mockReset();
});

describe("Dashboard routing guard", () => {
  it("redirects admins to /admin and NEVER renders CustomerDashboard", () => {
    mockedUseAuth.mockReturnValue({
      user: fakeUser, session: null, loading: false, role: "admin",
      roleError: null, retryRole: vi.fn(), signOut: vi.fn(),
    } as any);

    renderDashboard();

    expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("merchant-dashboard")).not.toBeInTheDocument();
  });

  it("shows loading spinner (NOT customer) while role is still resolving", () => {
    mockedUseAuth.mockReturnValue({
      user: fakeUser, session: null, loading: true, role: null,
      roleError: null, retryRole: vi.fn(), signOut: vi.fn(),
    } as any);

    renderDashboard();

    expect(screen.getByText("جارٍ تجهيز حسابك...")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-dashboard")).not.toBeInTheDocument();
  });

  it("shows loading (NOT customer) when loading=false but role is still null and no error", () => {
    mockedUseAuth.mockReturnValue({
      user: fakeUser, session: null, loading: false, role: null,
      roleError: null, retryRole: vi.fn(), signOut: vi.fn(),
    } as any);

    renderDashboard();

    expect(screen.getByText("جارٍ تجهيز حسابك...")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-dashboard")).not.toBeInTheDocument();
  });

  it("shows error screen (NOT customer) when role fetch fails", () => {
    mockedUseAuth.mockReturnValue({
      user: fakeUser, session: null, loading: false, role: null,
      roleError: {
        correlationId: "ERR-ABCD-1234",
        code: "PGRST301",
        message: "network unreachable",
        attempts: 3,
      },
      retryRole: vi.fn(), signOut: vi.fn(),
    } as any);

    renderDashboard();

    expect(screen.getByTestId("role-error-screen")).toBeInTheDocument();
    expect(screen.getByTestId("error-correlation-id")).toHaveTextContent("ERR-ABCD-1234");
    expect(screen.queryByTestId("customer-dashboard")).not.toBeInTheDocument();
  });

  it("renders MerchantDashboard when role=merchant", () => {
    mockedUseAuth.mockReturnValue({
      user: fakeUser, session: null, loading: false, role: "merchant",
      roleError: null, retryRole: vi.fn(), signOut: vi.fn(),
    } as any);

    renderDashboard();

    expect(screen.getByTestId("merchant-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-dashboard")).not.toBeInTheDocument();
  });

  it("renders CustomerDashboard only when role=customer explicitly", () => {
    mockedUseAuth.mockReturnValue({
      user: fakeUser, session: null, loading: false, role: "customer",
      roleError: null, retryRole: vi.fn(), signOut: vi.fn(),
    } as any);

    renderDashboard();

    expect(screen.getByTestId("customer-dashboard")).toBeInTheDocument();
  });

  it("redirects to /auth when there is no user", () => {
    mockedUseAuth.mockReturnValue({
      user: null, session: null, loading: false, role: null,
      roleError: null, retryRole: vi.fn(), signOut: vi.fn(),
    } as any);

    renderDashboard();

    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    expect(screen.queryByTestId("customer-dashboard")).not.toBeInTheDocument();
  });
});
