const BASE = "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

// Projects
export const api = {
  projects: {
    list: () => req("/projects"),
    get: (id: string) => req(`/projects/${id}`),
    create: (data: { name: string; description?: string; domain?: string }) =>
      req("/projects", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      req(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      req(`/projects/${id}`, { method: "DELETE" }),
  },

  references: {
    list: (projectId: string, stage?: number) =>
      req(`/projects/${projectId}/references${stage ? `?stage=${stage}` : ""}`),
    create: (projectId: string, data: object) =>
      req(`/projects/${projectId}/references`, { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => req(`/references/${id}`, { method: "DELETE" }),
  },

  facts: {
    list: (projectId: string) => req(`/projects/${projectId}/facts`),
    create: (projectId: string, data: { content: string; reference_id?: string }) =>
      req(`/projects/${projectId}/facts`, { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => req(`/facts/${id}`, { method: "DELETE" }),
  },

  fiveWhys: {
    list: (projectId: string) => req(`/projects/${projectId}/five-whys`),
    create: (projectId: string, data: object) =>
      req(`/projects/${projectId}/five-whys`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      req(`/five-whys/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => req(`/five-whys/${id}`, { method: "DELETE" }),
  },

  framework: {
    get: (projectId: string) => req(`/projects/${projectId}/framework`),
    upsert: (projectId: string, data: { structure: string; notes?: string }) =>
      req(`/projects/${projectId}/framework`, { method: "POST", body: JSON.stringify(data) }),
  },

  sequences: {
    list: (projectId: string) => req(`/projects/${projectId}/sequences`),
    create: (projectId: string, data: object) =>
      req(`/projects/${projectId}/sequences`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      req(`/sequences/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => req(`/sequences/${id}`, { method: "DELETE" }),
  },

  insights: {
    list: (projectId: string) => req(`/projects/${projectId}/insights`),
    create: (projectId: string, data: object) =>
      req(`/projects/${projectId}/insights`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      req(`/insights/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => req(`/insights/${id}`, { method: "DELETE" }),
  },

  concepts: {
    list: (projectId: string) => req(`/projects/${projectId}/concepts`),
    create: (projectId: string, data: object) =>
      req(`/projects/${projectId}/concepts`, { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      req(`/concepts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => req(`/concepts/${id}`, { method: "DELETE" }),
  },

  system: {
    ollamaStatus: () => req<{ status: string }>("/system/ollama/status"),
    ollamaStart: () => req<{ status: string; message?: string }>("/system/ollama/start", { method: "POST" }),
    ollamaStop: () => req<{ status: string; message?: string }>("/system/ollama/stop", { method: "POST" }),
  },

  crawl: {
    smart: (data: { natural_query: string; stage: number; project_id: string; save?: boolean }) =>
      req("/crawl/smart", { method: "POST", body: JSON.stringify(data) }),
    news: (data: { keyword: string; domain?: string; stage: number; project_id: string; save?: boolean }) =>
      req("/crawl/news", { method: "POST", body: JSON.stringify(data) }),
    search: (data: { keyword: string; stage: number; project_id: string; save?: boolean }) =>
      req("/crawl/search", { method: "POST", body: JSON.stringify(data) }),
    url: (data: { url: string; project_id: string; stage: number; save?: boolean }) =>
      req("/crawl/url", { method: "POST", body: JSON.stringify(data) }),
  },
};
