import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import { useNotificationStore } from "../store/notificationStore";
import { api } from "../lib/api";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  FileSpreadsheet,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  ClipboardList,
  ExternalLink,
} from "lucide-react";

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { toasts, removeToast } = useToastStore();
  const {
    notifications,
    unreadCount,
    setNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get("/notifications");
        setNotifications(response.data.data);
      } catch {
        console.error("Failed to load notifications");
      }
    };
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, setNotifications]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Proceed with local logout
    }
    logout();
    navigate("/login");
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      markRead(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      markAllRead();
    } catch (err) {
      console.error(err);
    }
  };

  const navLinks = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      roles: ["SUPER_ADMIN", "AIRPORT_MGR", "STAFF", "REQUESTER", "AUDITOR"],
    },
    {
      name: "Inventory Ledger",
      path: "/inventory",
      icon: Boxes,
      roles: ["SUPER_ADMIN", "AIRPORT_MGR", "STAFF", "REQUESTER", "AUDITOR"],
    },
    {
      name: "Procurement",
      path: "/purchase-orders",
      icon: ShoppingCart,
      roles: ["SUPER_ADMIN", "AIRPORT_MGR", "STAFF", "AUDITOR"],
    },
    {
      name: "Requisitions",
      path: "/requisitions",
      icon: ClipboardList,
      roles: ["SUPER_ADMIN", "AIRPORT_MGR", "STAFF", "REQUESTER", "AUDITOR"],
    },
    {
      name: "Audit Reports",
      path: "/reports",
      icon: FileSpreadsheet,
      roles: ["SUPER_ADMIN", "AIRPORT_MGR", "STAFF", "AUDITOR"],
    },
    {
      name: "Administration",
      path: "/admin",
      icon: Users,
      roles: ["SUPER_ADMIN", "AUDITOR"],
    },
  ];

  const activeLink = navLinks.find((link) => link.path === location.pathname);
  const filteredLinks = navLinks.filter((link) =>
    link.roles.includes(user?.role || ""),
  );

  return (
    <div className="flex flex-col min-h-screen bg-aai-dark">
      <a href="#main-content" className="gov-skip-link">
        Skip to main content
      </a>

      {/* Official government header strip */}
      <header className="bg-aai-header text-white" role="banner">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-1.5 text-xs border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="font-medium opacity-90">
                Government of India
              </span>
              <span className="opacity-40" aria-hidden="true">
                |
              </span>
              <span className="opacity-80">Airport Authority of India</span>
            </div>
            <a
              href="https://www.aai.aero"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 opacity-80 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
            >
              www.aai.aero
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(opens in new tab)</span>
            </a>
          </div>

          <div className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex-shrink-0 w-10 h-10 bg-white/10 border border-white/20 rounded flex items-center justify-center"
                aria-hidden="true"
              >
                <Boxes className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-base sm:text-lg leading-tight text-white truncate">
                  AeroStock Portal
                </h1>
                <p className="text-xs text-white/70 truncate">
                  Inventory &amp; Asset Management System
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded relative"
                  aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                  aria-expanded={isNotifOpen}
                  aria-haspopup="true"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-1 right-1 h-4 min-w-4 px-0.5 bg-aai-accent text-[10px] font-bold text-white flex items-center justify-center rounded-full"
                      aria-hidden="true"
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div
                    className="absolute right-0 mt-1 w-80 bg-white border border-aai-border rounded shadow-gov z-50 overflow-hidden"
                    role="dialog"
                    aria-label="Notifications"
                  >
                    <div className="p-3 border-b border-aai-border flex justify-between items-center bg-aai-surface">
                      <span className="font-semibold text-sm text-aai-foreground">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllAsRead}
                          className="text-xs font-semibold text-aai-blue hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <ul
                      className="max-h-64 overflow-y-auto divide-y divide-aai-border"
                      role="list"
                    >
                      {notifications.length === 0 ? (
                        <li className="p-6 text-center text-xs text-aai-muted">
                          No recent notifications.
                        </li>
                      ) : (
                        notifications.map((notif) => (
                          <li
                            key={notif.id}
                            className={`p-3 text-xs ${notif.isRead ? "opacity-70" : "bg-aai-blue/5"}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-semibold text-aai-foreground">
                                {notif.title}
                              </span>
                              {!notif.isRead && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsRead(notif.id)}
                                  className="text-[10px] text-aai-blue hover:underline font-semibold flex-shrink-0"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                            <p className="text-aai-muted mt-1 leading-relaxed">
                              {notif.message}
                            </p>
                            <time
                              className="text-[10px] text-aai-muted block mt-1.5"
                              dateTime={notif.createdAt}
                            >
                              {new Date(notif.createdAt).toLocaleDateString()}{" "}
                              at{" "}
                              {new Date(notif.createdAt).toLocaleTimeString(
                                [],
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </time>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2 border-l border-white/20 pl-4">
                <div
                  className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center font-semibold text-xs text-white border border-white/20"
                  aria-hidden="true"
                >
                  {user?.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-white/70 mt-0.5">
                    {user?.airport
                      ? `${user.airport.name} (${user.airport.code})`
                      : "Central Headquarters"}
                  </p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    <LogOut className="h-3 w-3" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded"
                aria-label="Open navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Primary navigation */}
        <nav
          className="bg-aai-navy border-t border-white/10 hidden md:block"
          aria-label="Main navigation"
        >
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
            <ul className="flex flex-wrap gap-0" role="list">
              {filteredLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 ${
                        isActive
                          ? "border-white text-white bg-white/5"
                          : "border-transparent text-white/75 hover:text-white hover:bg-white/5"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {link.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </header>

      {/* Toast notifications */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full"
        role="region"
        aria-label="System messages"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            onClick={() => removeToast(toast.id)}
            onKeyDown={(e) => e.key === "Enter" && removeToast(toast.id)}
            tabIndex={0}
            className={`p-4 rounded border flex justify-between items-center cursor-pointer ${
              toast.type === "success"
                ? "bg-white border-aai-success/40 text-aai-success"
                : toast.type === "error"
                  ? "bg-white border-aai-error/40 text-aai-error"
                  : toast.type === "warning"
                    ? "bg-white border-aai-accent/40 text-aai-accent"
                    : "bg-white border-aai-border text-aai-foreground"
            } shadow-gov`}
          >
            <div className="flex items-center gap-2">
              {toast.type === "warning" && (
                <AlertTriangle
                  className="h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="ml-3 opacity-60 hover:opacity-100"
              aria-label="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-1 max-w-[1600px] mx-auto w-full">
        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="px-4 sm:px-6 py-3 bg-white border-b border-aai-border lg:hidden">
            <h2 className="text-sm font-semibold text-aai-foreground">
              {activeLink ? activeLink.name : "AAI Inventory Management"}
            </h2>
          </div>

          <main id="main-content" className="flex-1 p-4 sm:p-6" tabIndex={-1}>
            <Outlet />
          </main>

          <footer
            className="px-4 sm:px-6 py-4 border-t border-aai-border bg-white text-xs text-aai-muted"
            role="contentinfo"
          >
            <p>
              &copy; {new Date().getFullYear()} Airport Authority of India. All
              rights reserved.
            </p>
            <p className="mt-1">
              For technical assistance, contact your regional IT helpdesk.
            </p>
          </footer>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className="fixed inset-0 bg-black/40"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-white border-r border-aai-border h-full z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-aai-border bg-aai-header">
              <span className="font-semibold text-white text-sm">
                Navigation
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-white/80 hover:text-white rounded"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Mobile navigation">
              <ul className="py-2" role="list">
                {filteredLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <li key={link.path}>
                      <Link
                        to={link.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium ${
                          isActive
                            ? "bg-aai-blue/10 text-aai-blue border-l-4 border-aai-blue"
                            : "text-aai-foreground hover:bg-aai-surface"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {link.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-auto p-4 border-t border-aai-border">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-aai-error hover:bg-red-50 rounded"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
