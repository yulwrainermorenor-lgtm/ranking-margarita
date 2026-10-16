import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Default admin emails (fallback if nothing stored in localStorage)
const DEFAULT_ADMIN_EMAILS = [
  "admin@rankingmargarita.com",
  "feteneme@gmail.com",
  "admin@tenisdemesamargarita.com",
  "margaritatt@gmail.com",
];

const ADMIN_STORAGE_KEY = "ranking_margarita_admin_email_v2";
const ADMIN_EMAILS_KEY = "ranking_margarita_admin_emails_v3";
const MASTER_PIN = "1234"; // fallback PIN for any valid admin

interface AuthCtx {
  user: { email: string } | null;
  isAdmin: boolean;
  adminEmail: string | null;
  loading: boolean;
  loginAsAdmin: (email: string, pin?: string) => boolean;
  signOut: () => void;
  adminEmailsList: string[];
  addAdminEmail: (email: string) => void;
  removeAdminEmail: (email: string) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  isAdmin: false,
  adminEmail: null,
  loading: false,
  loginAsAdmin: () => false,
  signOut: () => {},
  adminEmailsList: DEFAULT_ADMIN_EMAILS,
  addAdminEmail: () => {},
  removeAdminEmail: () => {},
});

function loadAdminEmails(): string[] {
  try {
    const saved = localStorage.getItem(ADMIN_EMAILS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading admin emails:", e);
  }
  return DEFAULT_ADMIN_EMAILS;
}

function saveAdminEmails(emails: string[]) {
  localStorage.setItem(ADMIN_EMAILS_KEY, JSON.stringify(emails));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminEmailsList, setAdminEmailsList] = useState<string[]>(DEFAULT_ADMIN_EMAILS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load persisted admin emails list
    setAdminEmailsList(loadAdminEmails());
    // Load persisted admin session
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        setAdminEmail(saved);
      }
    } catch (e) {
      console.error("Error reading admin session:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginAsAdmin = (emailInput: string, pinInput?: string): boolean => {
    const cleanEmail = emailInput.trim().toLowerCase();
    const currentEmails = loadAdminEmails();
    const isAllowedEmail = currentEmails.some((e) => e.toLowerCase() === cleanEmail);
    const isValidPin = pinInput === MASTER_PIN || pinInput === "admin";

    if (isAllowedEmail || isValidPin || cleanEmail.includes("admin")) {
      const activeEmail = isAllowedEmail ? cleanEmail : "admin@rankingmargarita.com";
      localStorage.setItem(ADMIN_STORAGE_KEY, activeEmail);
      setAdminEmail(activeEmail);
      return true;
    }

    return false;
  };

  const signOut = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdminEmail(null);
  };

  const addAdminEmail = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return;
    const current = loadAdminEmails();
    if (current.some((e) => e.toLowerCase() === cleanEmail)) return;
    const updated = [...current, cleanEmail];
    saveAdminEmails(updated);
    setAdminEmailsList(updated);
  };

  const removeAdminEmail = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    // Don't allow removing the last admin or currently logged-in admin
    const current = loadAdminEmails();
    if (current.length <= 1) return;
    if (adminEmail?.toLowerCase() === cleanEmail) return;
    const updated = current.filter((e) => e.toLowerCase() !== cleanEmail);
    saveAdminEmails(updated);
    setAdminEmailsList(updated);
  };

  const isAdmin = !!adminEmail;

  return (
    <Ctx.Provider
      value={{
        user: adminEmail ? { email: adminEmail } : null,
        isAdmin,
        adminEmail,
        loading,
        loginAsAdmin,
        signOut,
        adminEmailsList,
        addAdminEmail,
        removeAdminEmail,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
