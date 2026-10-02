const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "freelancehub-token";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(API_BASE_URL + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...options.headers,
    },
  });

  const responseText = await response.text();
  let body = null;
  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch (parseError) {
      if (response.ok) {
        throw new Error("The server returned an invalid response. Please try again.", { cause: parseError });
      }
    }
  }
  if (!response.ok) {
    // A stateless JWT setup answers 401 for a missing/expired token and 403 for a
    // real permission failure. Only 401 ends the session.
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("freelancehub:unauthorized"));
    }
    const detail = body?.details && typeof body.details === "object"
      ? Object.values(body.details).join(" ")
      : "";
    const error = new Error([body?.message, body?.error, detail].filter(Boolean).join(" ")
      || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function login(email, password) {
  const result = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export async function register(payload) {
  const result = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export async function getMe() {
  return apiRequest("/auth/me");
}

export async function updateProfile(payload) {
  return apiRequest("/auth/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getProjects() {
  return apiRequest("/projects");
}

export async function getProject(projectId) {
  return apiRequest("/projects/" + projectId);
}

export async function getMyProjects() {
  return apiRequest("/projects/me");
}

export async function createProject(payload) {
  return apiRequest("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyProposals() {
  return apiRequest("/proposals/me");
}

export async function submitProposal(projectId, payload) {
  return apiRequest("/proposals/projects/" + projectId, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function acceptProposal(proposalId) {
  return apiRequest("/proposals/" + proposalId + "/accept", {
    method: "POST",
  });
}

export async function rejectProposal(proposalId) {
  return apiRequest("/proposals/" + proposalId + "/reject", {
    method: "POST",
  });
}

export async function getContracts() {
  return apiRequest("/contracts");
}

export async function getNotifications() {
  return apiRequest("/notifications/me");
}

export async function getMyDisputes() {
  return apiRequest("/disputes/me");
}

export async function raiseDispute(payload) {
  return apiRequest("/disputes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getReviewsWrittenByMe() {
  return apiRequest("/reviews/written-by-me");
}

export async function getMyReviews() {
  return apiRequest("/reviews/me");
}

export async function submitReview(payload) {
  return apiRequest("/reviews", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markNotificationRead(notificationId) {
  return apiRequest("/notifications/" + notificationId + "/read", {
    method: "PATCH",
  });
}

export async function getEscrow(contractId) {
  return apiRequest("/escrow/contracts/" + contractId);
}

export async function fundEscrow(contractId, amount) {
  return apiRequest("/escrow/fund", {
    method: "POST",
    body: JSON.stringify({ contractId, amount }),
  });
}

export async function submitMilestone(milestoneId, file, note) {
  const formData = new FormData();
  formData.append("file", file);
  if (note) formData.append("note", note);
  return apiRequest("/escrow/milestones/" + milestoneId + "/submit", {
    method: "POST",
    body: formData,
  });
}

export async function downloadMilestoneSubmission(milestoneId, fileName) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}/escrow/milestones/${milestoneId}/submission`, {
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Download failed (${response.status}).`);
  }
  const fileUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = fileUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
}

export async function openMilestoneSubmission(milestoneId, fileName) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    throw new Error("Allow pop-ups to open the shared document.");
  }
  previewWindow.opener = null;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(`${API_BASE_URL}/escrow/milestones/${milestoneId}/submission`, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || body?.error || `Document could not be opened (${response.status}).`);
    }
    const file = await response.blob();
    const extension = fileName?.split(".").pop()?.toLowerCase();
    const previewTypes = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      txt: "text/plain",
      csv: "text/csv",
    };
    const fileUrl = URL.createObjectURL(new Blob([file], { type: previewTypes[extension] || file.type }));
    previewWindow.location.replace(fileUrl);
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}

export async function approveMilestone(milestoneId) {
  return apiRequest("/escrow/milestones/" + milestoneId + "/approve", {
    method: "POST",
  });
}

export async function requestMilestoneChanges(milestoneId, reason) {
  return apiRequest("/escrow/milestones/" + milestoneId + "/request-changes", {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function releaseMilestonePayment(milestoneId) {
  return apiRequest("/escrow/milestones/" + milestoneId + "/release", {
    method: "POST",
  });
}

export async function getMessageContacts() {
  return apiRequest("/messages/contacts");
}

export async function getConversation(otherUserId) {
  return apiRequest("/messages/conversation/" + otherUserId);
}

export async function sendMessage(receiverId, text) {
  return apiRequest("/messages", {
    method: "POST",
    body: JSON.stringify({ receiverId, text }),
  });
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}
