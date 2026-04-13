import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

type ChatUser = {
  id: string;
  fullName: string | null;
  phone: string;
  role: "ADMIN" | "EMPLOYEE" | "CUSTOMER";
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

type ApiClient = {
  request<T>(url: string, init?: RequestInit): Promise<T>;
};

function parseAdminCandidatesFromFile(filePath: string): Array<{ phone: string; password: string }> {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const rows = content.split(/\r?\n/);
  const candidates: Array<{ phone: string; password: string }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    // Accept loose formats like: "Admin: 0799... / Password123!"
    const phoneMatch = row.match(/07\d{8}/);
    const passwordMatch = row.match(/\/\s*([^\s]+)$/);
    if (!phoneMatch || !passwordMatch) {
      // Also accept block format:
      // admin:
      // 0799......
      // Password123!
      const current = row.trim().toLowerCase();
      const next = rows[i + 1]?.trim() ?? "";
      const next2 = rows[i + 2]?.trim() ?? "";
      const isAdminHeader = current.startsWith("admin");
      const blockPhoneMatch = next.match(/^07\d{8}$/);
      const blockPasswordMatch = next2.match(/^\S{8,}$/);
      if (isAdminHeader && blockPhoneMatch && blockPasswordMatch) {
        candidates.push({ phone: blockPhoneMatch[0], password: blockPasswordMatch[0] });
        i += 2;
      }
      continue;
    }
    candidates.push({ phone: phoneMatch[0], password: passwordMatch[1] });
  }

  return candidates;
}

function createApiClient(baseUrl: string): ApiClient {
  let cookieHeader = "";

  return {
    async request<T>(url: string, init?: RequestInit): Promise<T> {
      const headers = new Headers(init?.headers ?? {});
      headers.set("Content-Type", "application/json");
      if (cookieHeader) {
        headers.set("Cookie", cookieHeader);
      }

      const response = await fetch(`${baseUrl}${url}`, {
        ...init,
        headers
      });

      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        const firstCookie = setCookie.split(";")[0]?.trim();
        if (firstCookie) {
          cookieHeader = firstCookie;
        }
      }

      const json = (await response.json()) as ApiEnvelope<T>;
      if (!response.ok || !json.success || !json.data) {
        throw new Error(
          `HTTP ${response.status} ${url} failed: ${
            json.error?.message ?? json.error?.code ?? "Unknown API error"
          }`
        );
      }

      return json.data;
    }
  };
}

test("admin can chat with all active customers and employees", async () => {
  const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const adminFileCandidates = parseAdminCandidatesFromFile(path.resolve(process.cwd(), "admin.txt"));
  const adminCandidates = [
    ...(process.env.TEST_ADMIN_PHONE && process.env.TEST_ADMIN_PASSWORD
      ? [{ phone: process.env.TEST_ADMIN_PHONE, password: process.env.TEST_ADMIN_PASSWORD }]
      : []),
    ...adminFileCandidates
  ];

  assert.ok(adminCandidates.length > 0, "No admin credentials found. Set TEST_ADMIN_PHONE/TEST_ADMIN_PASSWORD.");

  const api = createApiClient(baseUrl);
  let adminLoginError = "";
  for (const candidate of adminCandidates) {
    try {
      await api.request<{ user: { id: string; role: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(candidate)
      });
      adminLoginError = "";
      break;
    } catch (error) {
      adminLoginError = String(error);
    }
  }

  assert.equal(adminLoginError, "", `Unable to log in with available admin credentials: ${adminLoginError}`);

  const customersData = await api.request<{ items: ChatUser[] }>("/api/chat/users?role=CUSTOMER&take=50");
  const employeesData = await api.request<{ items: ChatUser[] }>("/api/chat/users?role=EMPLOYEE&take=50");

  const customers = customersData.items;
  const employees = employeesData.items;

  // Ensure center chat participants include every active employee.
  const centerBefore = await api.request<{ conversationId: string; participants: Array<{ userId: string }> }>(
    "/api/chat/center/participants"
  );
  const beforeSet = new Set(centerBefore.participants.map((participant) => participant.userId));

  for (const employee of employees) {
    if (beforeSet.has(employee.id)) {
      continue;
    }
    await api.request<{ conversationId: string }>("/api/chat/center/participants", {
      method: "POST",
      body: JSON.stringify({ userId: employee.id })
    });
  }

  const centerAfter = await api.request<{ conversationId: string; participants: Array<{ userId: string }> }>(
    "/api/chat/center/participants"
  );
  const afterSet = new Set(centerAfter.participants.map((participant) => participant.userId));
  for (const employee of employees) {
    assert.equal(afterSet.has(employee.id), true, `Employee ${employee.phone} missing from center chat.`);
  }

  const centerProbe = `[TEST] Admin center check ${Date.now()}`;
  await api.request<{ item: { id: string; conversationId: string; content: string } }>("/api/chat/messages", {
    method: "POST",
    body: JSON.stringify({
      conversationId: centerAfter.conversationId,
      type: "TEXT",
      content: centerProbe
    })
  });

  const centerMessages = await api.request<{ messages: Array<{ content: string }> }>(
    `/api/chat/messages?conversationId=${encodeURIComponent(centerAfter.conversationId)}&take=10`
  );
  assert.equal(
    centerMessages.messages.some((message) => message.content === centerProbe),
    true,
    "Center chat probe message not found."
  );

  // Ensure one support conversation + successful message for each customer.
  for (const customer of customers) {
    const supportThread = await api.request<{ item: { id: string } }>("/api/chat/threads", {
      method: "POST",
      body: JSON.stringify({
        type: "SUPPORT",
        customerUserId: customer.id
      })
    });

    const probe = `[TEST] Admin support check for ${customer.phone} ${Date.now()}`;
    await api.request<{ item: { id: string; conversationId: string; content: string } }>("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: supportThread.item.id,
        type: "TEXT",
        content: probe
      })
    });

    const messages = await api.request<{ messages: Array<{ content: string }> }>(
      `/api/chat/messages?conversationId=${encodeURIComponent(supportThread.item.id)}&take=10`
    );
    assert.equal(
      messages.messages.some((message) => message.content === probe),
      true,
      `Support probe message not found for customer ${customer.phone}.`
    );
  }
});
