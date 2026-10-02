import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  acceptProposal as acceptProposalRequest,
  approveMilestone,
  createProject,
  downloadMilestoneSubmission,
  fundEscrow,
  getContracts,
  getConversation,
  getEscrow,
  getMe,
  getMessageContacts,
  getMyDisputes,
  getNotifications,
  getMyProjects,
  getMyProposals,
  getProjects,
  getMyReviews,
  getReviewsWrittenByMe,
  login,
  logout,
  markNotificationRead,
  openMilestoneSubmission,
  raiseDispute,
  register,
  rejectProposal as rejectProposalRequest,
  releaseMilestonePayment,
  requestMilestoneChanges,
  sendMessage as sendMessageRequest,
  submitMilestone,
  submitProposal,
  submitReview,
  updateProfile,
} from "./api";
import "./App.css";
import "./polish.css";

const STORAGE_KEYS = {
  session: "freelancehub-session",
};

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;


const toIdString = (value) => value == null ? "" : String(value);
const toNumber = (value, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const initialsFromName = (name) => {
  const safe = (name || "").trim();
  if (!safe) return "NA";
  const parts = safe.split(/\s+/).filter(Boolean);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
};

const firstInitial = (name) => {
  const safe = (name || "").trim();
  return safe ? safe.charAt(0).toUpperCase() : "U";
};

const roleLabelOf = (role) => {
  const normalized = String(role || "member").trim();
  if (!normalized) return "Member";
  const label = normalized.toLowerCase();
  if (label === "client") return "Client";
  if (label === "freelancer") return "Freelancer";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

const formatRoleValue = (role) => {
  if (!role) return "Client";
  return roleLabelOf(role);
};

const formatDateLabel = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const normalizeStatusLabel = (status, fallback = "Unknown") => {
  const normalized = String(status || "").trim().replace(/[_-]+/g, " ");
  if (!normalized) return fallback;
  return normalized.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
};

// The backend returns UPPER_SNAKE enum values while the UI renders title case.
// Every comparison goes through this key so COMPLETED / Completed / completed
// and NOT_FUNDED / Not Funded never diverge between the API and the screen.
const statusKey = (status) => String(status || "").trim().replace(/[\s_-]+/g, "_").toUpperCase();

const isStatus = (status, ...expected) => expected.map(statusKey).includes(statusKey(status));

const PROJECT_OPEN = "OPEN";
const PROJECT_IN_PROGRESS = "IN_PROGRESS";
const CONTRACT_ACTIVE = "ACTIVE";
const CONTRACT_COMPLETED = "COMPLETED";
const MILESTONE_RELEASED = "PAYMENT_RELEASED";
const MILESTONE_APPROVED = "APPROVED";
const MILESTONE_SUBMITTED = "WORK_SUBMITTED";
const MILESTONE_PENDING = "PENDING";
const MILESTONE_REJECTED = "NEEDS_CHANGES";
const PROPOSAL_ACCEPTED = "ACCEPTED";
const PROPOSAL_UNDER_REVIEW = "UNDER_REVIEW";

// Keep every profile field the backend returns so Profile/Settings/UserMenu
// render from the real authenticated account.
const normalizeSessionUser = (account = {}) => ({
  id: account.id == null ? "" : String(account.id),
  name: account.name || account.fullName || "",
  email: account.email || "",
  role: account.role ? String(account.role).toLowerCase() : "client",
  avatar: account.avatar || initialsFromName(account.name || account.fullName),
  phone: account.phone || "",
  country: account.country || "",
  city: account.city || "",
  companyName: account.companyName || "",
  professionalTitle: account.professionalTitle || "",
  skills: Array.isArray(account.skills) ? account.skills : [],
  experienceLevel: account.experienceLevel || "",
  hourlyRate: account.hourlyRate == null ? "" : account.hourlyRate,
  bio: account.bio || "",
  createdAt: account.createdAt || "",
});

const normalizeUser = (account = {}) => ({
  ...normalizeSessionUser(account),
  avatar: account.avatar || initialsFromName(account.name || account.fullName),
});

const normalizeProjectStatus = (status) => {
  return normalizeStatusLabel(status, "Open");
};
const normalizeProposalStatus = (status) => {
  const normalized = String(status || "UNDER_REVIEW").trim().replace(/[\s-]+/g, "_").toUpperCase();
  switch (normalized) {
    case "ACCEPTED":
      return "Accepted";
    case "PENDING":
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "UNDER REVIEW":
      return "Under Review";
    case "REJECTED":
      return "Rejected";
    default:
      return normalizeStatusLabel(normalized);
  }
};

const normalizeProject = (project = {}) => {
  const client = project.client || {};
  const clientName = client.name || project.clientName || "Client";
  const clientId = toIdString(project.clientId ?? client.id ?? "");

  return {
    id: toIdString(project.id),
    clientId,
    title: project.title || "Untitled project",
    description: project.description || "",
    category: project.category || "General",
    budget: toNumber(project.budget || project.amount || 0),
    deadline: project.deadline || "TBD",
    skills: Array.isArray(project.skills) ? project.skills : [],
    client: clientName,
    clientInitials: initialsFromName(clientName),
    proposals: toNumber(project.proposals || project.proposalCount || 0),
    status: normalizeProjectStatus(project.status),
  };
};

const normalizeProposal = (proposal = {}) => {
  const project = proposal.project || {};
  const client = proposal.client || project.client || {};
  const freelancer = proposal.freelancer || {};
  const projectId = toIdString(proposal.projectId ?? project.id ?? "");

  return {
    id: toIdString(proposal.id),
    projectId,
    clientId: toIdString(proposal.clientId ?? client.id ?? project.clientId ?? ""),
    freelancerId: toIdString(proposal.freelancerId ?? freelancer.id ?? ""),
    project: project.title || proposal.projectTitle || "Project",
    client: client.name || proposal.clientName || "Client",
    freelancer: freelancer.name || proposal.freelancerName || "Freelancer",
    price: toNumber(proposal.proposedAmount ?? proposal.bidAmount ?? proposal.price ?? 0),
    days: toNumber(proposal.estimatedDays ?? proposal.days ?? 7),
    status: normalizeProposalStatus(proposal.status),
    message: proposal.coverLetter || proposal.description || proposal.message || "",
    createdAt: proposal.createdAt || "",
    updatedAt: proposal.updatedAt || "",
  };
};

const normalizeContract = (contract = {}) => {
  const project = contract.project || {};
  const client = contract.client || {};
  const freelancer = contract.freelancer || {};

  return {
    id: toIdString(contract.id),
    clientId: toIdString(contract.clientId ?? client.id ?? ""),
    freelancerId: toIdString(contract.freelancerId ?? freelancer.id ?? ""),
    projectId: toIdString(contract.projectId ?? project.id ?? ""),
    contractAmount: toNumber(contract.contractAmount ?? contract.totalAmount ?? contract.amount ?? 0),
    status: normalizeStatusLabel(contract.status, "Active"),
    createdAt: contract.createdAt || new Date().toISOString(),
    milestones: Array.isArray(contract.milestones) ? contract.milestones.map((milestone) => ({
      id: toIdString(milestone.id),
      name: milestone.title || milestone.name || "Milestone",
      amount: toNumber(milestone.amount || 0),
      status: normalizeMilestoneStatus(milestone.status),
      submissionFileName: milestone.submissionFileName || "",
      submissionFileSize: toNumber(milestone.submissionFileSize),
      submissionNote: milestone.submissionNote || "",
      reviewFeedback: milestone.reviewFeedback || "",
    })) : [],
  };
};

const normalizeMilestoneStatus = (status) => {
  const normalized = String(status || "PENDING").trim().replace(/[\s-]+/g, "_").toUpperCase();
  switch (normalized) {
    case "PENDING": return "Pending";
    case "SUBMITTED":
    case "WORK_SUBMITTED": return "Work Submitted";
    case "APPROVED": return "Approved";
    case "REJECTED":
    case "NEEDS_CHANGES": return "Needs Changes";
    case "PAID":
    case "RELEASED":
    case "PAYMENT_RELEASED": return "Payment Released";
    default: return normalizeStatusLabel(normalized);
  }
};

const normalizeMessage = (message = {}) => ({
  id: toIdString(message.id),
  senderId: toIdString(message.senderId ?? message.sender?.id),
  receiverId: toIdString(message.receiverId ?? message.receiver?.id),
  text: message.text || "",
  createdAt: message.createdAt || "",
  read: Boolean(message.readFlag ?? message.read),
});

const normalizeNotification = (notification = {}) => ({
  id: toIdString(notification.id),
  userId: toIdString(notification.recipientId ?? notification.userId),
  text: notification.message || notification.text || "",
  createdAt: notification.createdAt || "",
  read: Boolean(notification.readFlag ?? notification.read),
});

const normalizeDispute = (dispute = {}) => ({
  id: toIdString(dispute.id),
  contractId: toIdString(dispute.contractId ?? dispute.contract?.id),
  project: dispute.contract?.project?.title || "Contract",
  subject: dispute.subject || "",
  description: dispute.description || "",
  status: normalizeStatusLabel(dispute.status, "Open"),
  createdAt: dispute.createdAt || "",
});

const normalizeReview = (review = {}) => ({
  id: toIdString(review.id),
  contractId: toIdString(review.contractId ?? review.contract?.id),
  revieweeId: toIdString(review.revieweeId ?? review.reviewee?.id),
  reviewer: review.reviewer?.name || "",
  reviewee: review.reviewee?.name || "",
  rating: toNumber(review.rating),
  comment: review.comment || "",
  createdAt: review.createdAt || "",
});

const emptyWorkspaceData = () => ({
  projects: [],
  proposals: [],
  contracts: [],
  users: [],
  conversations: [],
  escrows: {},
  notifications: [],
  disputes: [],
  reviewsWritten: [],
  reviewsReceived: [],
});

async function loadWorkspaceData(currentUserId) {
  const [projects, myProjects, rawProposals, rawContracts, messageContacts, rawNotifications, rawDisputes, rawReviews, rawReceivedReviews] = await Promise.all([
    getProjects(),
    getMyProjects(),
    getMyProposals(),
    getContracts(),
    getMessageContacts(),
    getNotifications(),
    getMyDisputes(),
    getReviewsWrittenByMe(),
    getMyReviews(),
  ]);

  const projectRecords = [
    ...(projects || []),
    ...(myProjects || []),
  ];

  const uniqueProjects = Array.from(
    new Map(projectRecords.map((project) => [String(normalizeProject(project).id), normalizeProject(project)])).values()
  );

  const proposals = (rawProposals || []).map(normalizeProposal);
  const contracts = (rawContracts || []).map(normalizeContract);
  const projectLookup = new Map(uniqueProjects.map((project) => [String(project.id), project]));

  proposals.forEach((proposal) => {
    const match = projectLookup.get(String(proposal.projectId));
    if (match) {
      proposal.project = match.title;
      proposal.clientId = match.clientId || proposal.clientId;
      proposal.client = match.client;
    }
  });
  uniqueProjects.forEach((project) => {
    project.proposals = proposals.filter((proposal) => proposal.projectId === project.id).length;
  });

  const userLookup = new Map();
  const addUser = (account) => {
    if (account?.id != null && String(account.id) !== currentUserId) {
      userLookup.set(String(account.id), normalizeUser(account));
    }
  };
  (messageContacts || []).forEach(addUser);
  (rawProposals || []).forEach((proposal) => {
    addUser(proposal.freelancer);
    addUser(proposal.project?.client);
  });
  (rawContracts || []).forEach((contract) => {
    addUser(contract.client);
    addUser(contract.freelancer);
  });

  const otherUsers = Array.from(userLookup.values());

  // Conversations and escrow balances are supporting data: one unavailable record
  // must not blank the whole workspace, so each lookup degrades to an empty value.
  const settle = async (run, fallback) => {
    try {
      return await run();
    } catch {
      return fallback;
    }
  };

  const [rawConversations, escrowResults] = await Promise.all([
    Promise.all(otherUsers.map(async (otherUser) => ({
      otherUserId: otherUser.id,
      messages: await settle(() => getConversation(otherUser.id), []),
    }))),
    Promise.all(contracts.map(async (contract) => [
      contract.id,
      await settle(() => getEscrow(contract.id), null),
    ])),
  ]);
  const conversations = rawConversations.map(({ otherUserId, messages }) => ({
    id: `${currentUserId}-${otherUserId}`,
    participants: [currentUserId, otherUserId],
    projectId: "",
    projectTitle: contracts.find((contract) => contract.clientId === otherUserId || contract.freelancerId === otherUserId)
      ? uniqueProjects.find((project) => project.id === contracts.find((contract) => contract.clientId === otherUserId || contract.freelancerId === otherUserId).projectId)?.title || ""
      : proposals.find((proposal) => proposal.clientId === otherUserId || proposal.freelancerId === otherUserId)?.project || "",
    messages: (messages || []).map(normalizeMessage),
  }));

  return {
    projects: uniqueProjects,
    proposals,
    contracts,
    users: otherUsers,
    conversations,
    escrows: Object.fromEntries(escrowResults.filter(([, account]) => account)),
    notifications: (rawNotifications || []).map(normalizeNotification),
    disputes: (rawDisputes || []).map(normalizeDispute),
    reviewsWritten: (rawReviews || []).map(normalizeReview),
    reviewsReceived: (rawReceivedReviews || []).map(normalizeReview),
  };
}
function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.session);
      return saved ? normalizeSessionUser(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });

  const [data, setData] = useState(emptyWorkspaceData);
  const [workspaceError, setWorkspaceError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedWorkspaceKey, setLoadedWorkspaceKey] = useState("");
  const currentUserId = user?.id;
  const workspaceKey = currentUserId ? `${currentUserId}:${reloadToken}` : "";
  // Loading is derived from which workspace snapshot is already on screen, so the
  // effect never has to flip a flag before it starts fetching.
  const isLoadingWorkspace = Boolean(workspaceKey) && loadedWorkspaceKey !== workspaceKey;

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.session);
    }
  }, [user]);

  useEffect(() => {
    const clearExpiredSession = () => {
      setUser(null);
      setData(emptyWorkspaceData());
      setLoadedWorkspaceKey("");
      localStorage.removeItem(STORAGE_KEYS.session);
    };
    window.addEventListener("freelancehub:unauthorized", clearExpiredSession);
    return () => window.removeEventListener("freelancehub:unauthorized", clearExpiredSession);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const liveData = await loadWorkspaceData(currentUserId);
    setData(liveData);
    setWorkspaceError("");
    return liveData;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    let active = true;

    (async () => {
      try {
        const liveData = await loadWorkspaceData(currentUserId);
        if (!active) return;
        setData(liveData);
        setWorkspaceError("");
      } catch (error) {
        if (!active) return;
        setWorkspaceError(error.message || "Workspace data could not be loaded. Please retry.");
      } finally {
        if (active) setLoadedWorkspaceKey(workspaceKey);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUserId, reloadToken, workspaceKey]);

  // Keep the session user in sync with the backend account (source of truth).
  useEffect(() => {
    if (!currentUserId) return;

    let active = true;
    (async () => {
      try {
        const account = await getMe();
        if (!active || !account) return;
        setUser((previous) => ({ ...previous, ...normalizeSessionUser(account) }));
      } catch (error) {
        // A 401 means the session already ended and was cleared; that is expected.
        if (error?.status === 401) return;
        console.warn("Could not refresh the authenticated profile.", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUserId]);

  const updateData = (updater) => {
    setData((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      return next;
    });
  };

  const signOut = () => {
    setData(emptyWorkspaceData());
    setUser(null);
    setWorkspaceError("");
    setLoadedWorkspaceKey("");
    localStorage.removeItem(STORAGE_KEYS.session);
    logout();
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthPage data={data} setUser={setUser} />} />
        <Route path="/register" element={<AuthPage mode="register" data={data} setUser={setUser} />} />
        <Route element={<ProtectedLayout user={user} signOut={signOut} workspaceError={workspaceError} isLoading={isLoadingWorkspace} onRetry={() => setReloadToken((previous) => previous + 1)} />}>
          <Route path="/dashboard" element={<Dashboard user={user} data={data} />} />
          <Route path="/projects" element={<BrowseProjects user={user} data={data} />} />
          <Route path="/projects/:projectId" element={<ProjectDetails user={user} data={data} updateData={updateData} />} />
          <Route path="/projects/:projectId/proposal" element={<SubmitProposal user={user} data={data} updateData={updateData} />} />
          <Route path="/create-project" element={<ClientOnly user={user}><CreateProject updateData={updateData} /></ClientOnly>} />
          <Route path="/proposals" element={<Proposals user={user} data={data} updateData={updateData} refreshWorkspace={refreshWorkspace} signOut={signOut} />} />
          <Route path="/contract" element={<ContractPageWithReview user={user} data={data} updateData={updateData} />} />
          <Route path="/milestones" element={<MilestonesPage user={user} data={data} updateData={updateData} />} />
          <Route path="/payments" element={<PaymentsPage user={user} data={data} updateData={updateData} />} />
          <Route path="/messages" element={<MessagesPage user={user} data={data} updateData={updateData} />} />
          <Route path="/disputes" element={<DisputesPage user={user} data={data} updateData={updateData} />} />
          <Route path="/reviews" element={<ReviewsPage data={data} />} />
          <Route path="/notifications" element={<NotificationsPage user={user} data={data} updateData={updateData} />} />
          <Route path="/profile" element={<ProfilePage user={user} setUser={setUser} />} />
          <Route path="/settings" element={<SettingsPage user={user} signOut={signOut} />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function Home() {
  return (
    <div className="landing">
      <nav className="landing-nav"><Link className="brand" to="/">Freelance<span>Hub</span></Link><div><Link to="/login" className="link-button">Log in</Link><Link to="/register" className="button primary">Get started</Link></div></nav>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow">THE FAIRER WAY TO FREELANCE</div><h1>Build great work.<br /><em>Keep every step clear.</em></h1><p>FreelanceHub connects clients and freelancers with proposals, milestone tracking, and a shared record of payment approvals.</p><div className="hero-actions"><Link to="/register" className="button primary">Start your journey <span>→</span></Link>        <Link to="/login" className="text-link">Log in <span>↗</span></Link></div><div className="social-proof"><div className="avatar-stack"><span>AK</span><span>RM</span><span>PS</span><span>+</span></div><div><strong>One shared workspace</strong><small>from first proposal to final milestone</small></div></div></div>        <div className="hero-visual"><div className="orb orb-one" /><div className="orb orb-two" /><div className="dashboard-preview"><div className="preview-top"><b>FreelanceHub</b><span>•••</span></div><div className="preview-label">PROJECT DELIVERY</div><h3>Clear work.<br />Clear milestones.</h3><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="preview-row"><span>Proposal review</span><strong>Client &amp; freelancer</strong></div><div className="preview-card"><span className="mini-icon">✦</span><div><b>Milestone workflow</b><small>Fund · Submit · Approve</small></div><strong>→</strong></div></div></div>
      </section>
      <section className="landing-stats"><div><strong>Projects</strong><span>Post briefs and budgets</span></div><div><strong>Proposals</strong><span>Compare project bids</span></div><div><strong>Milestones</strong><span>Track delivery status</span></div><div><strong>Messages</strong><span>Keep work discussions together</span></div></section>
      <section className="how"><div className="section-intro"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>Work confidently,<br /><span>from brief to delivery.</span></h2></div><div className="steps"><div><b>01</b><h3>Find your fit</h3><p>Browse open projects or post work that needs a specialist.</p></div><div><b>02</b><h3>Agree on milestones</h3><p>Review proposals and track deliverables against the contract.</p></div><div><b>03</b><h3>Record payment steps</h3><p>Track escrow ledger entries and milestone approvals. Payment processing is not yet connected.</p></div></div></section>
    </div>
  );
}

function AuthPage({ mode = "login", setUser }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => mode === "login" && Boolean(localStorage.getItem("freelancehub-remembered-email")));
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    email: mode === "login" ? localStorage.getItem("freelancehub-remembered-email") || "" : "",
    password: "",
    confirmPassword: "",
    phone: "",
    country: "",
    city: "",
    role: "CLIENT",
    companyName: "",
    professionalTitle: "",
    skills: "",
    experienceLevel: "",
    hourlyRate: "",
    bio: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: "" }));
    setError("");
  };

  const validateLogin = () => {
    const nextErrors = {};
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Please enter a valid email address.";
    if (!form.password) nextErrors.password = "Password is required.";
    setFieldErrors((previous) => ({ ...previous, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const validateRegister = (currentStep = step) => {
    const nextErrors = {};

    if (currentStep >= 1) {
      if (!form.fullName.trim()) nextErrors.fullName = "Full name is required.";
      if (!form.email.trim()) nextErrors.email = "Email is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Please enter a valid email address.";
      if (!form.password) nextErrors.password = "Password is required.";
      else if (form.password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
      if (!form.confirmPassword) nextErrors.confirmPassword = "Please confirm your password.";
      else if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (currentStep >= 2) {
      if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
      else if (!/^[0-9+\-()\s]{7,20}$/.test(form.phone.trim())) nextErrors.phone = "Please enter a valid phone number.";
      if (!form.country.trim()) nextErrors.country = "Country is required.";
      if (!form.city.trim()) nextErrors.city = "City is required.";
    }

    if (currentStep >= 3) {
      if (form.role === "CLIENT") {
        if (form.bio.trim() && form.bio.trim().length > 1000) nextErrors.bio = "Bio must be 1000 characters or fewer.";
      }

      if (form.role === "FREELANCER") {
        if (!form.professionalTitle.trim()) nextErrors.professionalTitle = "Professional title is required.";
        if (!form.skills.trim()) nextErrors.skills = "Please add at least one skill.";
        if (!form.experienceLevel.trim()) nextErrors.experienceLevel = "Experience level is required.";
        if (!form.hourlyRate || Number(form.hourlyRate) <= 0) nextErrors.hourlyRate = "Hourly rate must be a positive number.";
        if (form.bio.trim() && form.bio.trim().length > 1000) nextErrors.bio = "Bio must be 1000 characters or fewer.";
      }
    }

    setFieldErrors((previous) => ({ ...previous, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    if (!validateLogin()) return;

    setIsSubmitting(true);
    setError("");

    try {
      const authenticatedUser = await login(email, password);
      if (rememberMe) localStorage.setItem("freelancehub-remembered-email", email);
      else localStorage.removeItem("freelancehub-remembered-email");
      setUser(normalizeSessionUser(authenticatedUser));
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!validateRegister()) return;
    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role,
        phone: form.phone.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        companyName: form.companyName.trim(),
        professionalTitle: form.professionalTitle.trim(),
        skills: form.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        experienceLevel: form.experienceLevel.trim(),
        hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate),
        bio: form.bio.trim(),
      };
      await register(payload);
      navigate("/login");
    } catch (requestError) {
      setError(requestError.message || "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = (event) => {
    event.preventDefault();
    if (step === 1) {
      const valid = validateRegister();
      if (valid) setStep(2);
      return;
    }

    if (step === 2) {
      const valid = validateRegister();
      if (valid) setStep(3);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (mode === "login") {
      await handleLogin();
      return;
    }

    if (step < 3) {
      goNext(event);
      return;
    }

    await handleRegister();
  };

  const isRegisterMode = mode === "register";
  const stepTitles = ["Account", "Profile", "Role details"];

  return (
    <div className="auth-shell">
      <div className="auth-aside">
        <Link className="brand" to="/">Freelance<span>Hub</span></Link>
        <div>
          <div className="eyebrow">ONE WORKSPACE. EVERY MILESTONE.</div>
          <h1>Make work<br /><em>worth doing.</em></h1>
          <p>Everything you need to find meaningful projects, collaborate clearly, and get paid fairly.</p>
        </div>
        <span className="aside-footer">© 2026 FreelanceHub</span>
      </div>

      <main className="auth-main">
        <div className="auth-card">
          <div className="eyebrow">{isRegisterMode ? "CREATE YOUR WORKSPACE" : "WELCOME BACK"}</div>
          <h2>{isRegisterMode ? "Start building better work" : "Sign in to your workspace"}</h2>
          <p className="muted">{isRegisterMode ? "Join clients and freelancers working with confidence." : "Continue where you left off."}</p>

          {isRegisterMode && (
            <div className="auth-stepper" aria-label="Registration steps">
              {stepTitles.map((item, index) => (
                <div key={item} className={`step-pill ${index + 1 === step ? "active" : ""}`}>
                  <span>{index + 1}</span>
                  <small>{item}</small>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {isRegisterMode ? (
              <>
                {step === 1 && (
                  <>
                    <label className="field">
                      <span>Full Name</span>
                      <input value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Enter your full name" />
                      {fieldErrors.fullName && <small className="field-error">{fieldErrors.fullName}</small>}
                    </label>

                    <div className="field-row">
                      <label className="field">
                        <span>Email Address</span>
                        <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="you@example.com" />
                        {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
                      </label>
                      <label className="field">
                        <span>Account Role</span>
                        <select value={form.role} onChange={(event) => updateField("role", event.target.value)}>
                          <option value="CLIENT">Client</option>
                          <option value="FREELANCER">Freelancer</option>
                        </select>
                      </label>
                    </div>

                    <label className="field">
                      <span>Password</span>
                      <div className="password-field">
                        <input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder="Create a password" />
                        <button type="button" className="password-toggle" onClick={() => setShowPassword((previous) => !previous)}>
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
                    </label>

                    <label className="field">
                      <span>Confirm Password</span>
                      <input type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} placeholder="Re-enter your password" />
                      {fieldErrors.confirmPassword && <small className="field-error">{fieldErrors.confirmPassword}</small>}
                    </label>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="field-row">
                      <label className="field">
                        <span>Phone Number</span>
                        <input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+91 98765 43210" />
                        {fieldErrors.phone && <small className="field-error">{fieldErrors.phone}</small>}
                      </label>
                      <label className="field">
                        <span>Country</span>
                        <input value={form.country} onChange={(event) => updateField("country", event.target.value)} placeholder="India" />
                        {fieldErrors.country && <small className="field-error">{fieldErrors.country}</small>}
                      </label>
                    </div>

                    <label className="field">
                      <span>City</span>
                      <input value={form.city} onChange={(event) => updateField("city", event.target.value)} placeholder="Bengaluru" />
                      {fieldErrors.city && <small className="field-error">{fieldErrors.city}</small>}
                    </label>
                  </>
                )}

                {step === 3 && (
                  <>
                    {form.role === "CLIENT" ? (
                      <>
                        <label className="field">
                          <span>Company / Organization Name</span>
                          <input value={form.companyName} onChange={(event) => updateField("companyName", event.target.value)} placeholder="Your company or organization" />
                        </label>
                        <label className="field">
                          <span>About / Description</span>
                          <textarea value={form.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder="Tell us about your business and what you need." />
                          {fieldErrors.bio && <small className="field-error">{fieldErrors.bio}</small>}
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="field">
                          <span>Professional Title</span>
                          <input value={form.professionalTitle} onChange={(event) => updateField("professionalTitle", event.target.value)} placeholder="Senior Product Designer" />
                          {fieldErrors.professionalTitle && <small className="field-error">{fieldErrors.professionalTitle}</small>}
                        </label>

                        <div className="field-row">
                          <label className="field">
                            <span>Skills</span>
                            <input value={form.skills} onChange={(event) => updateField("skills", event.target.value)} placeholder="React, UI Design, Node.js" />
                            {fieldErrors.skills && <small className="field-error">{fieldErrors.skills}</small>}
                          </label>
                          <label className="field">
                            <span>Experience Level</span>
                            <select value={form.experienceLevel} onChange={(event) => updateField("experienceLevel", event.target.value)}>
                              <option value="">Select</option>
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                              <option value="Expert">Expert</option>
                            </select>
                            {fieldErrors.experienceLevel && <small className="field-error">{fieldErrors.experienceLevel}</small>}
                          </label>
                        </div>

                        <label className="field">
                          <span>Hourly Rate (₹)</span>
                          <input type="number" min="1" step="1" value={form.hourlyRate} onChange={(event) => updateField("hourlyRate", event.target.value)} placeholder="1500" />
                          {fieldErrors.hourlyRate && <small className="field-error">{fieldErrors.hourlyRate}</small>}
                        </label>

                        <label className="field">
                          <span>Short Bio / About</span>
                          <textarea value={form.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder="Tell clients about your background, experience, and how you work." />
                          {fieldErrors.bio && <small className="field-error">{fieldErrors.bio}</small>}
                        </label>
                      </>
                    )}
                  </>
                )}

                <div className="auth-actions">
                  {step > 1 && (
                    <button type="button" className="button secondary" onClick={() => setStep((previous) => previous - 1)}>
                      Back
                    </button>
                  )}
                  <button type="submit" className="button primary" disabled={isSubmitting}>
                    {isSubmitting ? "Please wait..." : step === 3 ? "Create account" : "Continue"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Email Address</span>
                  <input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="you@example.com" />
                  {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
                </label>

                <label className="field">
                  <span>Password</span>
                  <div className="password-field">
                    <input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => updateField("password", event.target.value)} placeholder="Your password" />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword((previous) => !previous)}>
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
                </label>

                <label className="checkbox-row">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                  <span>Remember me</span>
                </label>

                {error && <p className="form-error">{error}</p>}

                <button type="submit" className="button primary full" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </button>

                <p className="auth-switch">
                  Don&apos;t have an account? <Link to="/register">Sign up</Link>
                </p>
              </>
            )}

            {isRegisterMode && error && <p className="form-error">{error}</p>}
            {isRegisterMode && (
              <p className="auth-switch">
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return <div className="workspace-loading" role="status" aria-live="polite"><span className="loading-spinner" /><span>Loading your workspace</span></div>;
}

// Route-level role guard. The API rejects the wrong role anyway, but blocking the
// page keeps a freelancer from filling in a form that can never be submitted.
function RoleRoute({ user, role, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (String(user.role || "").toLowerCase() !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

function ClientOnly({ user, children }) {
  return <RoleRoute user={user} role="client">{children}</RoleRoute>;
}

function ProtectedLayout({ user, signOut, workspaceError, isLoading, onRetry }) {
  if (!user) return <Navigate to="/login" replace />;
  return <div className="app-shell"><Sidebar user={user} signOut={signOut} /><main className="main-shell"><Topbar user={user} signOut={signOut} />{workspaceError && <div className="form-error" role="alert">{workspaceError}{onRetry && <button type="button" className="button secondary" onClick={onRetry}>Retry</button>}</div>}{isLoading ? <LoadingScreen /> : <Outlet />}</main></div>;
}

function Sidebar({ user, signOut }) {
  const navigate = useNavigate();
  const isClient = user.role === "client";
  const links = [["/dashboard", "⌂", "Overview"], ["/projects", "◈", isClient ? "Your projects" : "Browse projects"], ["/proposals", "✎", "Proposals"], ["/contract", "□", "Contract"], ["/milestones", "◌", "Milestones"], ["/payments", "◆", "Escrow"], ["/messages", "◇", "Messages"], ["/disputes", "!", "Disputes"], ["/reviews", "★", "Reviews"]];
  return <aside className="sidebar"><Link className="brand" to="/dashboard">Freelance<span>Hub</span></Link><div className="workspace-switch"><span className="workspace-avatar">{user.avatar || user.name.slice(0, 2).toUpperCase()}</span><span><small>WORKSPACE</small><strong>{isClient ? "Client space" : "Freelancer space"}</strong></span></div><nav><small className="nav-label">WORKSPACE</small>{links.map(([to, icon, label]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><span>{icon}</span>{label}</NavLink>)}<small className="nav-label">ACCOUNT</small><NavLink to="/notifications" className="nav-link"><span>♢</span>Notifications</NavLink><NavLink to="/profile" className="nav-link"><span>◍</span>Profile</NavLink><NavLink to="/settings" className="nav-link"><span>⚙</span>Settings</NavLink><button type="button" className="nav-link logout-link" onClick={() => { navigate("/login"); signOut(); }}><span>⇠</span>Log out</button></nav></aside>;
}

function Topbar({ user, signOut }) { return <header className="topbar"><div><h1>{roleLabelOf(user.role)} workspace</h1><p>Projects, conversations, and delivery in one place.</p></div><div className="top-actions"><Link to="/notifications" className="icon-button notification" aria-label="Notifications">♢</Link><UserMenu user={user} signOut={signOut} /></div></header>; }

function UserMenu({ user, signOut }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const fullName = (user?.name || "User").trim() || "User";
  const roleLabel = formatRoleValue(user?.role);
  const initial = firstInitial(fullName);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    navigate("/login");
    signOut();
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className="user-avatar" aria-hidden="true">{initial}</span>
        <span className="user-meta">
          <strong>{fullName}</strong>
          <small>{roleLabel}</small>
        </span>
        <span className={`user-caret ${open ? "open" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 12 8" width="11" height="7" focusable="false">
            <path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <span className="user-avatar large" aria-hidden="true">{initial}</span>
            <div>
              <strong>{fullName}</strong>
              <small>{user?.email || roleLabel}</small>
            </div>
          </div>
          <div className="user-dropdown-links">
            <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
              <span className="user-dropdown-icon" aria-hidden="true">◍</span>Profile
            </Link>
            <Link to="/settings" role="menuitem" onClick={() => setOpen(false)}>
              <span className="user-dropdown-icon" aria-hidden="true">⚙</span>Settings
            </Link>
          </div>
          <div className="user-dropdown-links">
            <button type="button" role="menuitem" className="user-dropdown-logout" onClick={handleLogout}>
              <span className="user-dropdown-icon" aria-hidden="true">⇠</span>Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Page({ children, className = "" }) { return <div className={`page-content ${className}`}>{children}</div>; }
function PageHeader({ eyebrow, title, description, action }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>; }
function Status({ children, tone = "neutral" }) { return <span className={`status ${tone}`}>{children}</span>; }

function Dashboard({ user, data }) {
  const navigate = useNavigate();
  const isClient = user.role === "client";
  const myProjects = data.projects.filter((project) => project.clientId === user.id);
  const myContracts = data.contracts.filter((item) => item.clientId === user.id || item.freelancerId === user.id);
  const contract = myContracts[0];
  const primaryProjects = isClient ? myProjects : data.projects.filter((project) => isStatus(project.status, PROJECT_OPEN) && project.clientId !== user.id);
  const releasedAmount = myContracts.flatMap((item) => item.milestones)
    .filter((milestone) => isStatus(milestone.status, MILESTONE_RELEASED))
    .reduce((sum, milestone) => sum + milestone.amount, 0);
  const awaitingRelease = myContracts.flatMap((item) => item.milestones)
    .filter((milestone) => isStatus(milestone.status, MILESTONE_APPROVED))
    .reduce((sum, milestone) => sum + milestone.amount, 0);
  const reviewQueue = data.proposals.filter((item) => item.clientId === user.id && isStatus(item.status, PROPOSAL_UNDER_REVIEW)).length;
  const milestoneProgressWeight = {
    [MILESTONE_RELEASED]: 1,
    [MILESTONE_APPROVED]: 0.8,
    [MILESTONE_SUBMITTED]: 0.6,
    [MILESTONE_PENDING]: 0,
  };
  const contractProgress = contract && contract.milestones.length
    ? Math.round(
        contract.milestones.reduce((sum, milestone) => sum + (milestoneProgressWeight[statusKey(milestone.status)] || 0), 0)
          / contract.milestones.length * 100)
    : 0;
  const activity = [
    ...data.proposals.map((proposal) => ({
      id: `proposal-${proposal.id}`,
      icon: isStatus(proposal.status, PROPOSAL_ACCEPTED) ? "✓" : "✎",
      title: isStatus(proposal.status, PROPOSAL_ACCEPTED) ? "Proposal accepted" : isStatus(proposal.status, "REJECTED") ? "Proposal declined" : isClient ? "New proposal received" : "Proposal submitted",
      detail: `${proposal.project} · ${formatTimeAgo(proposal.updatedAt || proposal.createdAt)}`,
      tone: isStatus(proposal.status, PROPOSAL_ACCEPTED) ? "green" : "purple",
      date: new Date(proposal.updatedAt || proposal.createdAt || 0).getTime(),
    })),
    ...data.conversations.flatMap((conversation) => conversation.messages.map((message) => ({
      id: `message-${message.id}`,
      icon: "◇",
      title: `Message ${message.senderId === user.id ? "sent" : "received"}`,
      detail: `${data.users.find((contact) => contact.id === (message.senderId === user.id ? message.receiverId : message.senderId))?.name || "Contact"} · ${formatTimeAgo(message.createdAt)}`,
      tone: "blue",
      date: new Date(message.createdAt).getTime(),
    }))),
  ].sort((first, second) => second.date - first.date).slice(0, 3);
  const statCards = isClient ? [
    { label: "Total projects", value: String(myProjects.length), detail: "Across your workspace", icon: "◈", tone: "purple" },
    { label: "Active contracts", value: String(myContracts.length), detail: "In flight", icon: "↗", tone: "mint" },
    { label: "Review queue", value: String(reviewQueue), detail: "Proposals awaiting review", icon: "✓", tone: "blue" },
    { label: "Awaiting release", value: money(awaitingRelease), detail: "Approved milestone payments", icon: "◆", tone: "orange" },
  ] : [
    { label: "Available projects", value: String(primaryProjects.length), detail: "Open to proposals", icon: "◈", tone: "purple" },
    { label: "Active contracts", value: String(myContracts.length), detail: "In your pipeline", icon: "↗", tone: "mint" },
    { label: "Earnings released", value: money(releasedAmount), detail: "Across your contracts", icon: "₹", tone: "blue" },
    { label: "Awaiting release", value: money(awaitingRelease), detail: "Approved milestone payments", icon: "◆", tone: "orange" },
  ];

  const project = contract && data.projects.find((item) => item.id === contract.projectId);
  const completedMilestones = contract?.milestones.filter((milestone) => isStatus(milestone.status, MILESTONE_RELEASED)).length || 0;
  return <Page><div className="welcome-row"><div><div className="eyebrow">YOUR WORKSPACE</div><h2>{isClient ? `Welcome back, ${user.name}.` : `Welcome back, ${user.name}.`}</h2><p>{isClient ? "Manage your projects, proposals, and contracts." : "Discover work and keep your freelance commitments moving."}</p></div><button type="button" className="button primary" onClick={() => navigate(isClient ? "/create-project" : "/projects")}>{isClient ? "+ Post a project" : "Find projects"} <span>→</span></button></div><div className="stats-grid">{statCards.map((item) => <div key={item.label} className="stat-card"><span className={`stat-icon ${item.tone}`}>{item.icon}</span><div><small>{item.label}</small><strong>{item.value}</strong><p>{item.detail}</p></div></div>)}</div><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>{isClient ? "Recent projects" : "Open projects"}</h3><p>{isClient ? "Your latest project activity." : "Projects currently accepting proposals."}</p></div><Link to="/projects" className="text-link">View all →</Link></div>{primaryProjects.slice(0, 3).map((item) => <div className="list-project" key={item.id}><span className="list-project-icon">{item.title[0]}</span><div><Link to={`/projects/${item.id}`}><b>{item.title}</b></Link><small>{item.category} · {item.skills?.slice(0, 2).join(" · ")}</small></div><strong>{money(item.budget)}</strong><Status tone={isStatus(item.status, PROJECT_IN_PROGRESS) ? "purple" : isStatus(item.status, PROJECT_OPEN) ? "green" : "neutral"}>{item.status}</Status></div>)}{primaryProjects.length === 0 && <div className="empty-state">Nothing to show yet.</div>}</section><section className="panel contract-panel"><div className="panel-heading"><div><h3>Active contract</h3><p>Your most recent engagement.</p></div><Status tone={contract ? "green" : "neutral"}>{contract?.status || "None"}</Status></div><div className="contract-title"><span className="project-mark">◒</span><div><h3>{contract ? project?.title || "Contract project" : "No active contract"}</h3><p>{contract ? `${money(contract.contractAmount)} contract value` : "Start a project to begin"}</p></div></div><div className="progress-label"><span>Paid milestones</span><b>{contract ? `${completedMilestones} of ${contract.milestones.length}` : "0"}</b></div><div className="progress"><i style={{ width: `${contractProgress}%` }} /></div><div className="milestone-summary"><span>{contract ? `${completedMilestones} milestone${completedMilestones === 1 ? "" : "s"} paid` : "No milestones yet"}</span><Link to="/milestones">View details →</Link></div></section></div><section className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Updates from your actual projects and conversations.</p></div><Link to="/notifications" className="text-link">See all →</Link></div><div className="activity-list">{activity.length ? activity.map((item) => <Activity key={item.id} icon={item.icon} title={item.title} detail={item.detail} tone={item.tone} />) : <div className="empty-state">Activity will appear here as you work with clients and freelancers.</div>}</div></section></Page>;
}

function Activity({ icon, title, detail, tone }) { return <div className="activity"><span className={`activity-icon ${tone}`}>{icon}</span><div><b>{title}</b><small>{detail}</small></div><span className="activity-arrow">→</span></div>; }

function BrowseProjects({ user, data }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [budget, setBudget] = useState("Any budget");

  const visibleProjects = useMemo(() => {
    const source = user.role === "client"
      ? data.projects.filter((project) => project.clientId === user.id)
      : data.projects.filter((project) => isStatus(project.status, PROJECT_OPEN) && project.clientId !== user.id);
    return source.filter((project) => {
      const haystack = `${project.title} ${project.description} ${project.skills.join(" ")}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesCategory = category === "All categories" || project.category === category;
      const matchesBudget = budget === "Any budget" || (budget === "Under ₹20k" ? project.budget < 20000 : project.budget >= 20000);
      return matchesSearch && matchesCategory && matchesBudget;
    });
  }, [user, data, search, category, budget]);

  return <Page><PageHeader eyebrow="OPPORTUNITIES" title={user.role === "client" ? "Your projects" : "Find your next great project"} description={user.role === "client" ? "Review and manage the work you have posted." : "Explore work from clients who value good craft."} action={user.role === "client" ? <Link to="/create-project" className="button primary">Post a project</Link> : null} />{user.role !== "client" && <div className="filter-bar"><label className="search-input">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, description or skill" /></label><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option><option>Web Development</option><option>UI/UX Design</option><option>Data Science</option></select><select value={budget} onChange={(event) => setBudget(event.target.value)}><option>Any budget</option><option>Under ₹20k</option><option>₹20k and above</option></select></div> }<div className="results-line"><span>{visibleProjects.length} projects found</span></div><div className="project-grid">{visibleProjects.map((project) => <ProjectCard project={project} key={project.id} />)}</div>{visibleProjects.length === 0 && <div className="empty-state">{user.role === "client" ? "You haven’t posted a project yet." : "No open projects match your filters."}</div>}</Page>;
}

function ProjectCard({ project }) { return <Link to={`/projects/${project.id}`} className="project-card"><div className="project-card-top"><span className="category">{project.category}</span><Status tone={isStatus(project.status, PROJECT_OPEN) ? "green" : isStatus(project.status, PROJECT_IN_PROGRESS) ? "purple" : "neutral"}>{project.status}</Status></div><h3>{project.title}</h3><p>{project.description}</p><div className="tag-list">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="project-card-footer"><div><small>Budget</small><strong>{money(project.budget)}</strong></div><div><small>Deadline</small><strong>{project.deadline}</strong></div><div><small>Proposals</small><strong>{project.proposals}</strong></div></div></Link>; }

function ProjectDetails({ user, data }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = data.projects.find((item) => item.id === projectId);
  if (!project) return <Page><PageHeader eyebrow="PROJECT" title="Project not found" description="This project may have been removed or is no longer available." action={<Link to="/projects" className="button secondary">Back to projects</Link>} /></Page>;
  const isFreelancer = user.role === "freelancer";
  const acceptedProposal = data.proposals.find((proposal) => proposal.projectId === project.id && isStatus(proposal.status, PROPOSAL_ACCEPTED));
  const existingProposal = isFreelancer
    ? data.proposals.find((proposal) => proposal.projectId === project.id && proposal.freelancerId === user.id)
    : null;
  const isOwnProject = project.clientId === user.id;

  return <Page><button className="back-link" type="button" onClick={() => navigate("/projects")}>← Back to projects</button><div className="details-layout"><article className="panel details-main"><div className="project-card-top"><span className="category">{project.category}</span><Status tone={isStatus(project.status, PROJECT_OPEN) ? "green" : "neutral"}>{project.status}</Status></div><h2>{project.title}</h2><p className="lead">{project.description}</p><div className="detail-byline"><span className="avatar large">{project.clientInitials}</span><div><b>{project.client}</b></div></div><hr /><h3>Required skills</h3><div className="tag-list large-tags">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><h3>About the project</h3><p>{project.description}</p>{isOwnProject && acceptedProposal && <p className="status-line"><strong>Freelancer hired:</strong> {acceptedProposal.freelancer} - · {money(acceptedProposal.price)}</p>}</article><aside className="details-side"><div className="panel sticky-card"><div className="side-price"><small>PROJECT BUDGET</small><strong>{money(project.budget)}</strong><span>{project.proposals} proposals</span></div><div className="info-list"><div><span>Deadline</span><b>{project.deadline}</b></div><div><span>Category</span><b>{project.category}</b></div></div>{isFreelancer && isStatus(project.status, PROJECT_OPEN) && !existingProposal && <Link to={`/projects/${project.id}/proposal`} className="button primary full">Submit a proposal <span>→</span></Link>}{isFreelancer && existingProposal && <p className="safe-note">You already submitted a proposal: {existingProposal.status}.</p>}{isFreelancer && <p className="safe-note">◆ Payments are held in escrow and released when the client approves each milestone.</p>}{isOwnProject && <p className="safe-note">◆ Manage funding, milestones and releases from the Escrow and Milestones pages.</p>}</div></aside></div></Page>;
}

function SubmitProposal({ user, data, updateData }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = data.projects.find((item) => item.id === projectId);
  const existingProposal = data.proposals.find((proposal) => proposal.projectId === projectId && proposal.freelancerId === user.id);
  const [form, setForm] = useState(() => ({ message: "", price: project?.budget || "", days: 18 }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!project || !form.message.trim()) return;

    setSaving(true);
    setError("");
    try {
      const createdProposal = await submitProposal(project.id, {
        bidAmount: Number(form.price),
        estimatedDays: Number(form.days),
        coverLetter: form.message,
      });

      const normalizedProposal = normalizeProposal(createdProposal);
      updateData((previous) => ({
        ...previous,
        proposals: [normalizedProposal, ...previous.proposals.filter((proposal) => proposal.id !== normalizedProposal.id)],
      }));
      navigate("/proposals");
    } catch (error) {
      setError(error.message || "Your proposal could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  if (!project) return <Page><PageHeader eyebrow="PROPOSAL" title="Project not available" description="Return to the project board and choose an open project." action={<Link to="/projects" className="button secondary">Browse projects</Link>} /></Page>;
  if (existingProposal) return <Page><PageHeader eyebrow="PROPOSAL" title="Proposal already submitted" description={`Your existing proposal is ${existingProposal.status.toLowerCase()}.`} action={<Link to="/proposals" className="button secondary">View your proposals</Link>} /></Page>;
  return <Page><button className="back-link" type="button" onClick={() => navigate(`/projects/${project.id}`)}>← Back to project</button><div className="form-layout"><form className="panel form-panel" onSubmit={submit}><div className="eyebrow">YOUR PROPOSAL</div><h2>Tell them why you’re a great fit.</h2><label className="field"><span>Cover message</span><textarea rows="6" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required /></label><div className="form-two"><label className="field"><span>Your price</span><div className="input-prefix"><b>₹</b><input type="number" min="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></div></label><label className="field"><span>Delivery days</span><div className="input-suffix"><input type="number" min="1" value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} required /><b>days</b></div></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button primary" disabled={saving}>{saving ? "Submitting..." : "Submit proposal"} <span>→</span></button></form><aside className="panel proposal-summary"><small>APPLYING TO</small><h3>{project.title}</h3><div><span>Client budget</span><b>{money(project.budget)}</b></div><div><span>Deadline</span><b>{project.deadline}</b></div></aside></div></Page>;
}

function CreateProject({ updateData }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", category: "Web Development", budget: "", deadline: "", skills: "React, Node.js" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title || !form.description || !form.budget || !form.deadline) { setError("Please complete all required fields."); return; }

    const skills = form.skills.split(",").map((item) => item.trim()).filter(Boolean);

    setSaving(true);
    setError("");
    try {
      const createdProject = await createProject({
        title: form.title,
        description: form.description,
        category: form.category,
        budget: Number(form.budget),
        deadline: form.deadline,
        skills,
      });

      const normalizedProject = normalizeProject(createdProject);
      updateData((previous) => ({ ...previous, projects: [normalizedProject, ...previous.projects.filter((project) => project.id !== normalizedProject.id)] }));
      navigate("/projects");
    } catch (error) {
      setError(error.message || "Project could not be posted.");
    } finally {
      setSaving(false);
    }
  };

  return <Page><PageHeader eyebrow="NEW PROJECT" title="Post a project" description="Give great freelancers everything they need to do their best work." /><form className="panel create-form" onSubmit={submit}><label className="field"><span>Project title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label className="field"><span>Description</span><textarea rows="5" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label><div className="form-two"><label className="field"><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Web Development</option><option>UI/UX Design</option><option>Data Science</option></select></label><label className="field"><span>Skills</span><input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} /></label></div><div className="form-two"><label className="field"><span>Budget</span><div className="input-prefix"><b>₹</b><input type="number" min="1" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} required /></div></label><label className="field"><span>Deadline</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} required /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button secondary" onClick={() => navigate("/dashboard")}>Cancel</button><button type="submit" className="button primary" disabled={saving}>{saving ? "Posting..." : "Post project"} <span>→</span></button></div></form></Page>;
}

function Proposals({ user, data, updateData, refreshWorkspace, signOut }) {
  const myProposals = data.proposals.filter((proposal) => user.role === "client" ? proposal.clientId === user.id : proposal.freelancerId === user.id);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const updateProposalStatus = async (proposalId, action) => {
    const proposal = data.proposals.find((item) => item.id === proposalId);
    if (!proposal) return;
    setSavingId(proposalId);
    setError("");
    try {
      const savedProposal = action === "accept"
        ? await acceptProposalRequest(proposalId)
        : await rejectProposalRequest(proposalId);
      const normalized = normalizeProposal(savedProposal);
      updateData((previous) => ({
        ...previous,
        proposals: previous.proposals.map((item) => item.id === proposalId ? { ...item, ...normalized } : item),
        projects: action === "accept"
          ? previous.projects.map((project) => project.id === proposal.projectId ? { ...project, status: "In Progress" } : project)
          : previous.projects,
      }));
      if (action === "accept") {
        try {
          await refreshWorkspace();
        } catch {
          setError("Proposal accepted, but the updated contract could not be reloaded. Refresh the page to retry.");
        }
      }
    } catch (requestError) {
      setError(requestError.message || "Proposal could not be updated.");
    } finally {
      setSavingId("");
    }
  };

  const renderTable = () => {
    if (myProposals.length === 0) {
      return <div className="proposal-empty-panel"><div className="proposal-empty-state">No proposals in this view.</div></div>;
    }

    return (
      <div className="panel table-panel proposal-table-panel">
        <div className="table-head">
          <span>PROJECT</span>
          <span>{user.role === "client" ? "FREELANCER" : "CLIENT"}</span>
          <span>PRICE</span>
          <span>DELIVERY</span>
          <span>STATUS</span>
          <span />
        </div>
        {myProposals.map((proposal) => (
          <div className="table-row" key={proposal.id}>
            <div>
              <b>{proposal.project}</b>
              <small>{proposal.message.slice(0, 45)}{proposal.message.length > 45 ? "..." : ""}</small>
            </div>
            <span>{user.role === "client" ? proposal.freelancer : proposal.client}</span>
            <strong>{money(proposal.price)}</strong>
            <span>{proposal.days} days</span>
            <Status tone={isStatus(proposal.status, PROPOSAL_ACCEPTED) ? "green" : isStatus(proposal.status, PROPOSAL_UNDER_REVIEW) ? "orange" : "purple"}>{proposal.status}</Status>
            <div className="proposal-row-actions">
              {user.role === "client" && isStatus(proposal.status, PROPOSAL_UNDER_REVIEW) && (
                <>
                  <button type="button" className="row-action" aria-label={`Accept proposal from ${proposal.freelancer}`} disabled={Boolean(savingId)} onClick={() => updateProposalStatus(proposal.id, "accept")}>✓</button>
                  <button type="button" className="row-action" aria-label={`Reject proposal from ${proposal.freelancer}`} disabled={Boolean(savingId)} onClick={() => updateProposalStatus(proposal.id, "reject")}>×</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Page className="proposal-page-shell">
      <div className="proposal-page-header">
        <div>
          <h1>Proposals</h1>
          <p>Keep everything moving forward.</p>
        </div>
        <UserMenu user={user} signOut={signOut} />
      </div>

      <div className="proposal-section">
        <div className="proposal-eyebrow">YOUR PIPELINE</div>
        <h2>Proposals</h2>
        <p>Track every opportunity from first pitch to signed contract.</p>

        {error && <p className="form-error" role="alert">{error}</p>}
        {renderTable()}
      </div>
    </Page>
  );
}

function ContractPage({ user, data, children }) {
  const { contracts: userContracts, contract: activeContract, selectContract } = useUserContract(user, data);
  if (!activeContract) return <Page><PageHeader eyebrow="ACTIVE AGREEMENT" title="Contract" description="No contract exists yet." /><div className="empty-state">No contract has been created for this user yet.</div>{children}</Page>;

  const project = data.projects.find((item) => item.id === activeContract.projectId) || { title: "Project", deadline: "TBD" };
  const client = data.users.find((item) => item.id === activeContract.clientId) || user;
  const freelancer = data.users.find((item) => item.id === activeContract.freelancerId) || user;
  const escrow = data.escrows[activeContract.id] || { totalAmount: 0, availableAmount: 0, status: "NOT_FUNDED" };
  const released = activeContract.milestones
    .filter((item) => isStatus(item.status, MILESTONE_RELEASED))
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <Page>
      <PageHeader
        eyebrow={`${activeContract.status.toUpperCase()} AGREEMENT`}
        title="Contract"
        description="A shared source of truth for the work, terms and milestones."
        action={<ContractSelector contracts={userContracts} contract={activeContract} onChange={selectContract} />}
      />
      <div className="contract-layout">
        <section className="panel contract-document">
          <div className="contract-document-head">
            <div>
              <span className="project-mark big">◒</span>
              <div>
                <div className="eyebrow">CONTRACT #{activeContract.id.toUpperCase()}</div>
                <h2>{project.title}</h2>
                <p>Created {formatDateLabel(activeContract.createdAt)}</p>
              </div>
            </div>
          </div>
          <hr />
          <div className="parties">
            <div><small>CLIENT</small><b>{client.name}</b><span>{client.email || "—"}</span></div>
            <div><small>FREELANCER</small><b>{freelancer.name}</b><span>{freelancer.email || "—"}</span></div>
            <div><small>CONTRACT VALUE</small><b>{money(activeContract.contractAmount)}</b><span>Fixed price</span></div>
          </div>
          <h3>Milestone schedule</h3>
          <div className="contract-milestones">
            {activeContract.milestones.map((item, index) => (
              <div key={item.id}>
                <span className={`step ${isStatus(item.status, MILESTONE_RELEASED) ? "done" : ""}`}>{isStatus(item.status, MILESTONE_RELEASED) ? "✓" : index + 1}</span>
                <div><b>{item.name}</b><small>{money(item.amount)}</small></div>
                <strong>{money(item.amount)}</strong>
                <Status tone={isStatus(item.status, MILESTONE_RELEASED) ? "green" : isStatus(item.status, MILESTONE_APPROVED) ? "purple" : "neutral"}>{item.status}</Status>
              </div>
            ))}
          </div>
        </section>
        <aside className="panel contract-terms">
          <h3>Contract terms</h3>
          <div><span>Status</span><Status tone={isStatus(activeContract.status, CONTRACT_COMPLETED) ? "green" : "neutral"}>{activeContract.status}</Status></div>
          <div><span>Start date</span><b>{formatDateLabel(activeContract.createdAt)}</b></div>
          <div><span>End date</span><b>{project.deadline}</b></div>
          <div><span>Payment method</span><b>Escrow ledger</b></div>
          <div><span>Milestones</span><b>{activeContract.milestones.length}</b></div>
          <h3>Escrow ledger</h3>
          <div><span>Funded</span><b>{money(escrow.totalAmount)}</b></div>
          <div><span>Available</span><b>{money(escrow.availableAmount)}</b></div>
          <div><span>Released</span><b>{money(released)}</b></div>
          <div><span>Remaining</span><b>{money(Math.max(0, activeContract.contractAmount - released))}</b></div>
          <div><span>Ledger status</span><Status tone={isStatus(escrow.status, "RELEASED") ? "green" : "neutral"}>{normalizeStatusLabel(escrow.status, "Not Funded")}</Status></div>
          <p>Simulated payment ledger only. No money is transferred.</p>
        </aside>
      </div>
      {children}
    </Page>
  );
}

function ContractPageWithReview({ user, data, updateData }) {
  const { contract } = useUserContract(user, data);
  const hasReviewed = data.reviewsWritten.some((review) => review.contractId === contract?.id);
  const canReview = Boolean(contract) && isStatus(contract.status, CONTRACT_COMPLETED) && !hasReviewed;
  return (
    <ContractPage user={user} data={data}>
      {canReview && <ReviewForm contract={contract} updateData={updateData} />}
      {contract && isStatus(contract.status, CONTRACT_COMPLETED) && hasReviewed && (
        <p className="safe-note">You have already reviewed this contract.</p>
      )}
    </ContractPage>
  );
}

function ReviewForm({ contract, updateData }) {
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const savedReview = normalizeReview(await submitReview({
        contractId: contract.id,
        rating: Number(rating),
        comment: comment.trim(),
      }));
      updateData((previous) => ({ ...previous, reviewsWritten: [savedReview, ...previous.reviewsWritten] }));
    } catch (requestError) {
      setError(requestError.message || "Review could not be submitted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel create-form">
      <h3>Review this completed contract</h3>
        <form onSubmit={submit}>
          <label className="field">
            <span>Rating</span>
            <select value={rating} onChange={(event) => setRating(event.target.value)}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
            </select>
          </label>
          <label className="field">
            <span>Comment</span>
            <textarea rows="4" maxLength="2000" value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="button primary" disabled={saving}>{saving ? "Submitting..." : "Submit review"}</button>
        </form>
      </section>
  );
}

function ReviewsPage({ data }) {
  const reviews = [
    ...data.reviewsReceived.map((review) => ({ ...review, direction: "Received" })),
    ...data.reviewsWritten.map((review) => ({ ...review, direction: "Written" })),
  ].sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));

  return (
    <Page>
      <PageHeader eyebrow="CONTRACT FEEDBACK" title="Reviews" description="Reviews from completed contracts, persisted with their ratings and dates." />
      {reviews.length ? (
        <div className="review-list">
          {reviews.map((review) => (
            <article className="panel review-card" key={`${review.direction}-${review.id}`}>
              <div className="review-card-head">
                <Status tone={review.direction === "Received" ? "purple" : "neutral"}>{review.direction}</Status>
                <strong aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))} <span>{review.rating}/5</span></strong>
                <time>{formatDateLabel(review.createdAt)}</time>
              </div>
              <p>{review.comment || "No written comment."}</p>
              <small>{review.direction === "Received" ? `From ${review.reviewer || "Contract participant"}` : `To ${review.reviewee || "Contract participant"}`} · Contract #{review.contractId}</small>
            </article>
          ))}
        </div>
      ) : <div className="empty-state">There are no reviews for your account yet. Reviews become available after a contract is completed.</div>}
    </Page>
  );
}

function MilestonesPage({ user, data, updateData }) {
  const { contracts: userContracts, contract: activeContract, selectContract } = useUserContract(user, data);
  const [savingId, setSavingId] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  if (!activeContract) return <Page><PageHeader eyebrow="PROJECT DELIVERY" title="Milestones" description="No active milestone flow yet." /><div className="empty-state">No contract is active yet.</div></Page>;

  const escrow = data.escrows[activeContract.id] || { availableAmount: 0 };

  const changeMilestone = async (milestoneId, action, file, note, reason) => {
    setSavingId(milestoneId);
    setError("");
    try {
      const result = action === "submit"
        ? await submitMilestone(milestoneId, file, note)
        : action === "approve"
          ? await approveMilestone(milestoneId)
          : action === "request-changes"
            ? await requestMilestoneChanges(milestoneId, reason)
            : await releaseMilestonePayment(milestoneId);
      const milestone = action === "release" ? result.milestone : result;
      let updatedEscrow = null;
      let refreshError = "";
      if (action === "release") {
        try {
          updatedEscrow = await getEscrow(activeContract.id);
        } catch {
          refreshError = "Milestone payment was released, but the escrow balance could not be refreshed.";
        }
      }
      const status = normalizeMilestoneStatus(milestone?.status || (action === "release" ? "PAID" : ""));
      updateData((previous) => ({
        ...previous,
        contracts: previous.contracts.map((contract) => {
          if (contract.id !== activeContract.id) return contract;
          const milestones = contract.milestones.map((item) => item.id === milestoneId ? {
            ...item,
            status,
            submissionFileName: milestone?.submissionFileName || item.submissionFileName,
            submissionFileSize: toNumber(milestone?.submissionFileSize, item.submissionFileSize),
            submissionNote: milestone?.submissionNote || item.submissionNote,
            reviewFeedback: milestone?.reviewFeedback || "",
          } : item);
          const completed = milestones.length > 0 && milestones.every((item) => isStatus(item.status, MILESTONE_RELEASED));
          return { ...contract, milestones, status: completed ? "Completed" : contract.status };
        }),
        projects: previous.projects.map((project) => {
          const updatedContract = previous.contracts.find((item) => item.id === activeContract.id);
          const allReleased = updatedContract?.milestones.length > 0
            && updatedContract.milestones.every((item) => item.id === milestoneId || isStatus(item.status, MILESTONE_RELEASED));
          return project.id === activeContract.projectId && allReleased ? { ...project, status: "Completed" } : project;
        }),
        escrows: updatedEscrow ? { ...previous.escrows, [activeContract.id]: updatedEscrow } : previous.escrows,
      }));
      if (refreshError) setError(refreshError);
      return true;
    } catch (requestError) {
      setError(requestError.message || "Milestone could not be updated.");
      return false;
    } finally {
      setSavingId("");
    }
  };

  const getAction = (milestone) => {
    const isClient = user.role === "client";
    if (isStatus(milestone.status, MILESTONE_PENDING, MILESTONE_REJECTED) && !isClient && escrow.availableAmount >= milestone.amount) return <form className="milestone-submission-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.elements.namedItem("file").files?.[0];
      if (!file) {
        setError("Choose a deliverable file before submitting your work.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Deliverable files must be 10 MB or smaller.");
        return;
      }
      const succeeded = await changeMilestone(milestone.id, "submit", file, form.elements.namedItem("note").value);
      if (succeeded) form.reset();
    }}><label className="field"><span>{isStatus(milestone.status, MILESTONE_REJECTED) ? "Upload your revised deliverable (max 10 MB)" : "Attach your deliverable (max 10 MB)"}</span><input type="file" name="file" required disabled={Boolean(savingId)} /></label><label className="field"><span>Notes for the client (optional)</span><textarea name="note" rows="2" maxLength="2000" disabled={Boolean(savingId)} /></label><button type="submit" className="button small-action" disabled={Boolean(savingId)}>{savingId === milestone.id ? "Uploading..." : isStatus(milestone.status, MILESTONE_REJECTED) ? "Resubmit work" : "Submit work"} <span>→</span></button></form>;
    if (isStatus(milestone.status, MILESTONE_PENDING, MILESTONE_REJECTED) && !isClient) return <Link className="button small-action" to="/payments">Client must fund escrow first</Link>;
    if (isStatus(milestone.status, MILESTONE_SUBMITTED) && isClient) return <div className="milestone-review-actions"><button type="button" className="button primary small-action" disabled={Boolean(savingId)} onClick={() => changeMilestone(milestone.id, "approve")}>Approve work</button><button type="button" className="button secondary small-action" disabled={Boolean(savingId)} onClick={() => setReviewingId(milestone.id)}>Request changes</button>{reviewingId === milestone.id && <form className="milestone-review-form" onSubmit={(event) => {
      event.preventDefault();
      const reason = event.currentTarget.elements.namedItem("reason").value.trim();
      if (!reason) {
        setError("Explain what needs to change before sending the work back.");
        return;
      }
      changeMilestone(milestone.id, "request-changes", null, null, reason).then((succeeded) => {
        if (succeeded) setReviewingId("");
      });
    }}><label className="field"><span>What needs to change?</span><textarea name="reason" rows="3" maxLength="2000" required disabled={Boolean(savingId)} placeholder="Describe the updates needed so the freelancer can revise the work." /></label><div className="milestone-review-form-actions"><button type="button" className="button secondary" disabled={Boolean(savingId)} onClick={() => setReviewingId("")}>Cancel</button><button type="submit" className="button primary" disabled={Boolean(savingId)}>{savingId === milestone.id ? "Sending..." : "Send feedback"}</button></div></form>}</div>;
    if (isStatus(milestone.status, MILESTONE_APPROVED) && isClient) return <button type="button" className="button small-action" disabled={Boolean(savingId)} onClick={() => changeMilestone(milestone.id, "release")}>Release payment <span>→</span></button>;
    return null;
  };

  return <Page><PageHeader eyebrow="PROJECT DELIVERY" title="Milestones" description="Small, clear steps keep the project moving and payments fair." action={<ContractSelector contracts={userContracts} contract={activeContract} onChange={selectContract} />} />{error && <p className="form-error" role="alert">{error}</p>}{downloadError && <p className="form-error" role="alert">{downloadError}</p>}<div className="milestone-list">{activeContract.milestones.map((milestone, index) => <div className="milestone-card panel" key={milestone.id}><div className={`milestone-number ${isStatus(milestone.status, MILESTONE_RELEASED) ? "complete" : ""}`}>{isStatus(milestone.status, MILESTONE_RELEASED) ? "✓" : `0${index + 1}`}</div><div className="milestone-content"><div className="milestone-card-head"><div><h3>{milestone.name}</h3><p>{money(milestone.amount)}</p></div><Status tone={isStatus(milestone.status, MILESTONE_RELEASED) ? "green" : isStatus(milestone.status, MILESTONE_APPROVED) ? "purple" : isStatus(milestone.status, MILESTONE_SUBMITTED) ? "orange" : isStatus(milestone.status, MILESTONE_REJECTED) ? "orange" : "neutral"}>{milestone.status}</Status></div><div className="progress"><i style={{ width: isStatus(milestone.status, MILESTONE_RELEASED) ? "100%" : isStatus(milestone.status, MILESTONE_APPROVED) ? "82%" : isStatus(milestone.status, MILESTONE_SUBMITTED) ? "65%" : isStatus(milestone.status, MILESTONE_REJECTED) ? "38%" : "8%" }} /></div>{milestone.reviewFeedback && <div className="milestone-review-feedback"><strong>Changes requested</strong><p>{milestone.reviewFeedback}</p></div>}{milestone.submissionFileName && <div className="milestone-deliverable"><div><strong>Submitted deliverable</strong><span>{milestone.submissionFileName} · {(milestone.submissionFileSize / (1024 * 1024)).toFixed(2)} MB</span>{milestone.submissionNote && <p>{milestone.submissionNote}</p>}</div><div className="milestone-file-actions"><button type="button" className="button secondary" onClick={async () => {
      setDownloadError("");
      try {
        await openMilestoneSubmission(milestone.id, milestone.submissionFileName);
      } catch (downloadRequestError) {
        setDownloadError(downloadRequestError.message || "The deliverable could not be opened.");
      }
    }}>Open document</button><button type="button" className="button secondary" onClick={async () => {
      setDownloadError("");
      try {
        await downloadMilestoneSubmission(milestone.id, milestone.submissionFileName);
      } catch (downloadRequestError) {
        setDownloadError(downloadRequestError.message || "The deliverable could not be downloaded.");
      }
    }}>Download</button></div></div>}{getAction(milestone)}</div></div>)}</div></Page>;
}

function PaymentsPage({ user, data, updateData }) {
  const { contracts: userContracts, contract: activeContract, selectContract } = useUserContract(user, data);
  const [fundAmount, setFundAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!activeContract) return <Page><PageHeader eyebrow="SECURE PAYMENTS" title="Escrow & payments" description="No payments are active yet." /><div className="empty-state">No contract is available to manage escrow.</div></Page>;

  const escrow = data.escrows[activeContract.id] || { totalAmount: 0, availableAmount: 0, status: "NOT_FUNDED" };
  const held = toNumber(escrow.availableAmount);
  const released = activeContract.milestones.filter((item) => isStatus(item.status, MILESTONE_RELEASED)).reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(0, activeContract.contractAmount - toNumber(escrow.totalAmount));
  const pending = remaining;

  const onFund = async (event) => {
    event.preventDefault();
    const amount = Number(fundAmount || remaining);
    if (!amount || amount <= 0) return;
    setSaving(true);
    setError("");
    try {
      const updatedEscrow = await fundEscrow(activeContract.id, amount);
      updateData((previous) => ({ ...previous, escrows: { ...previous.escrows, [activeContract.id]: updatedEscrow } }));
      setFundAmount("");
    } catch (requestError) {
      setError(requestError.message || "Escrow could not be funded.");
    } finally {
      setSaving(false);
    }
  };

  return <Page><PageHeader eyebrow="SECURE PAYMENTS" title="Escrow & payments" description="Track escrow ledger balances and milestone approvals. Payment processing is not connected." action={<ContractSelector contracts={userContracts} contract={activeContract} onChange={selectContract} />} /><div className="payment-stats"><div className="stat-card"><span className="stat-icon purple">₹</span><div><small>Total contract</small><strong>{money(activeContract.contractAmount)}</strong><p>Fixed price</p></div></div><div className="stat-card"><span className="stat-icon orange">◆</span><div><small>Escrow available</small><strong>{money(held)}</strong><p>Ready for approved milestones</p></div></div><div className="stat-card"><span className="stat-icon green">✓</span><div><small>Released</small><strong>{money(released)}</strong><p>Approved payouts</p></div></div><div className="stat-card"><span className="stat-icon blue">◌</span><div><small>Not yet funded</small><strong>{money(pending)}</strong><p>Remaining contract balance</p></div></div></div>{user.role === "client" && remaining > 0 && <form className="panel create-form" onSubmit={onFund}><h3>Fund contract escrow</h3><p>Funding is recorded in the escrow ledger. Connect a payment provider before accepting real money.</p><label className="field"><span>Amount to fund (up to {money(remaining)})</span><div className="input-prefix"><b>₹</b><input type="number" min="0.01" max={remaining} step="0.01" value={fundAmount} onChange={(event) => setFundAmount(event.target.value)} placeholder={String(remaining)} required /></div></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button primary" disabled={saving}>{saving ? "Recording..." : "Fund escrow"}</button></form>}</Page>;
}

function useUserContract(user, data) {
  const [searchParams, setSearchParams] = useSearchParams();
  const contracts = data.contracts.filter((contract) => contract.clientId === user.id || contract.freelancerId === user.id);
  const requestedId = searchParams.get("contract");
  const contract = contracts.find((item) => item.id === requestedId) || contracts[0];
  const selectContract = (contractId) => setSearchParams(contractId ? { contract: contractId } : {});
  return { contracts, contract, selectContract };
}

function ContractSelector({ contracts, contract, onChange }) {
  if (contracts.length < 2) return null;
  return <label className="field contract-selector"><span>Contract</span><select value={contract.id} onChange={(event) => onChange(event.target.value)}>{contracts.map((item) => <option key={item.id} value={item.id}>{item.id} · {money(item.contractAmount)}</option>)}</select></label>;
}

function MessagesPage({ user, data, updateData }) {
  const conversations = (data.conversations || []).filter((conversation) => conversation.participants.includes(user.id));
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedContactId = searchParams.get("contact");
  const requestedConversationId = conversations.find((conversation) =>
    requestedContactId && conversation.participants.includes(requestedContactId) && requestedContactId !== user.id
  )?.id;
  const [selectedId, setSelectedId] = useState(requestedConversationId || conversations[0]?.id || null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const activeSelectedId = requestedConversationId
    || (conversations.some((conversation) => conversation.id === selectedId) ? selectedId : conversations[0]?.id);
  const selectedConversation = conversations.find((conversation) => conversation.id === activeSelectedId) || conversations[0];
  const otherUserId = selectedConversation?.participants.find((id) => id !== user.id);
  const otherUser = (data.users || []).find((person) => person.id === otherUserId) || { name: "Unknown user", avatar: "??" };

  const sendMessage = async () => {
    if (!selectedConversation || !draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const receiverId = selectedConversation.participants.find((id) => id !== user.id);
      if (!receiverId) throw new Error("This conversation has no recipient.");
      const savedMessage = normalizeMessage(await sendMessageRequest(receiverId, draft.trim()));
      updateData((previous) => ({
        ...previous,
        conversations: previous.conversations.map((conversation) => conversation.id === selectedConversation.id
          ? { ...conversation, messages: [...conversation.messages, savedMessage] }
          : conversation),
      }));
      setDraft("");
    } catch (requestError) {
      setError(requestError.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return <Page><PageHeader eyebrow="COMMUNICATION" title="Messages" description="Keep each client-freelancer conversation separate and on-topic." /><div className="message-layout"><aside className="panel conversation-list">{conversations.length === 0 ? <div className="empty-state">No contacts yet. Start a project or proposal to open a conversation.</div> : conversations.map((conversation) => { const participantId = conversation.participants.find((id) => id !== user.id); const participant = (data.users || []).find((person) => person.id === participantId) || { name: "User", avatar: "U" }; const lastMessage = conversation.messages[conversation.messages.length - 1]; const unreadCount = conversation.messages.filter((message) => message.senderId !== user.id && !message.read).length; return <button key={conversation.id} type="button" className={`conversation-item ${activeSelectedId === conversation.id ? "active" : ""}`} onClick={() => { setSelectedId(conversation.id); if (participantId) setSearchParams({ contact: participantId }); }}><span className="avatar small">{participant.avatar || participant.name.slice(0, 2).toUpperCase()}</span><div className="conversation-meta"><div className="conversation-head"><strong>{participant.name}</strong><time>{lastMessage ? formatTimeAgo(lastMessage.createdAt) : "No messages"}</time></div><div className="conversation-bottom"><span>{conversation.projectTitle || "Conversation"}</span>{unreadCount > 0 && <em>{unreadCount}</em>}</div></div></button>; })}</aside><section className="panel chat-panel">{selectedConversation ? <><div className="chat-header"><div className="chat-user"><span className="avatar small">{otherUser.avatar || otherUser.name.slice(0, 2).toUpperCase()}</span><div><b>{otherUser.name}</b><small>{selectedConversation.projectTitle || "FreelanceHub conversation"}</small></div></div></div><div className="message-thread">{selectedConversation.messages.map((message) => <div key={message.id} className={`message-row ${message.senderId === user.id ? "mine" : ""}`}><div className="message-bubble"><p>{message.text}</p><small>{message.senderId === user.id ? "You" : otherUser.name} · {formatTimeAgo(message.createdAt)}</small></div></div>)}{selectedConversation.messages.length === 0 && <div className="empty-state">Start the conversation with {otherUser.name}.</div>}</div><div className="chat-compose"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Type a message..." /><button type="button" className="button primary" disabled={sending || !draft.trim()} onClick={sendMessage}>{sending ? "Sending..." : "Send"}</button></div>{error && <p className="form-error" role="alert">{error}</p>}</> : <div className="empty-state">No conversation selected.</div>}</section></div></Page>;
}

function DisputesPage({ user, data, updateData }) {
  const { contracts, contract, selectContract } = useUserContract(user, data);
  const activeContracts = contracts.filter((item) => isStatus(item.status, CONTRACT_ACTIVE));
  const activeContract = activeContracts.find((item) => item.id === contract?.id) || activeContracts[0];
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!activeContract) return;
    setSaving(true);
    setError("");
    try {
      const dispute = normalizeDispute(await raiseDispute({
        contractId: activeContract.id,
        subject: subject.trim(),
        description: description.trim(),
      }));
      updateData((previous) => ({ ...previous, disputes: [dispute, ...previous.disputes] }));
      setSubject("");
      setDescription("");
    } catch (requestError) {
      setError(requestError.message || "Dispute could not be filed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader eyebrow="CONTRACT SUPPORT" title="Disputes" description="Record a contract issue and notify the other participant." action={activeContract ? <ContractSelector contracts={activeContracts} contract={activeContract} onChange={selectContract} /> : null} />
      {activeContract ? (
        <form className="panel create-form" onSubmit={submit}>
          <h3>Raise a dispute</h3>
          <label className="field">
            <span>Subject</span>
            <input maxLength="255" value={subject} onChange={(event) => setSubject(event.target.value)} required />
          </label>
          <label className="field">
            <span>Describe the issue</span>
            <textarea rows="5" maxLength="4000" value={description} onChange={(event) => setDescription(event.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="button primary" disabled={saving}>{saving ? "Submitting..." : "Submit dispute"}</button>
        </form>
      ) : <div className="empty-state">A contract is required before you can file a dispute.</div>}
      <section className="notification-list">
        <h3>Contract dispute history</h3>
        {data.disputes.length ? data.disputes.map((dispute) => (
          <article key={dispute.id} className="notification-item panel dispute-item">
            <div className="dispute-copy"><div className="dispute-heading"><Status tone={isStatus(dispute.status, "OPEN") ? "orange" : "neutral"}>{dispute.status}</Status><b>{dispute.subject}</b></div><small>{dispute.project} · {formatTimeAgo(dispute.createdAt)}</small><p>{dispute.description}</p></div>
            {(() => {
              const relatedContract = contracts.find((item) => item.id === dispute.contractId);
              const otherParticipantId = relatedContract
                ? relatedContract.clientId === user.id ? relatedContract.freelancerId : relatedContract.clientId
                : "";
              return otherParticipantId
                ? <Link className="button secondary dispute-message-link" to={`/messages?contact=${encodeURIComponent(otherParticipantId)}`}>Open conversation</Link>
                : null;
            })()}
          </article>
        )) : <div className="empty-state">No disputes have been raised for your contracts.</div>}
      </section>
    </Page>
  );
}

function NotificationsPage({ user, data, updateData }) {
  const items = (data.notifications || []).filter((notification) => notification.userId === user.id);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const markRead = async (item) => {
    if (item.read) return;
    setSavingId(item.id);
    setError("");
    try {
      const savedNotification = normalizeNotification(await markNotificationRead(item.id));
      updateData((previous) => ({
        ...previous,
        notifications: previous.notifications.map((notification) => notification.id === item.id ? savedNotification : notification),
      }));
    } catch (requestError) {
      setError(requestError.message || "Notification could not be marked as read.");
    } finally {
      setSavingId("");
    }
  };

  return <Page><PageHeader eyebrow="UPDATES" title="Notifications" description="Updates from proposal, escrow, message, and milestone activity." />{error && <p className="form-error" role="alert">{error}</p>}<div className="notification-list">{items.length > 0 ? items.map((item) => <div key={item.id} className={`notification-item panel ${item.read ? "read" : ""}`}><span className="notification-dot" /><div><b>{item.text}</b><small>{formatTimeAgo(item.createdAt)}</small></div>{!item.read && <button type="button" className="button secondary" disabled={Boolean(savingId)} onClick={() => markRead(item)}>{savingId === item.id ? "Saving..." : "Mark read"}</button>}</div>) : <div className="empty-state">No notifications right now.</div>}</div></Page>;
}

function ProfilePage({ user, setUser }) {
  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    country: user?.country || "",
    city: user?.city || "",
    companyName: user?.companyName || "",
    professionalTitle: user?.professionalTitle || "",
    skills: Array.isArray(user?.skills) ? user.skills.join(", ") : "",
    experienceLevel: user?.experienceLevel || "",
    hourlyRate: user?.hourlyRate ?? "",
    bio: user?.bio || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) {
    return <Page><PageHeader eyebrow="ACCOUNT" title="Profile" description="No user is currently signed in." /><div className="empty-state">Please sign in to view your profile.</div></Page>;
  }

  const isClient = String(user.role || "").toLowerCase() === "client";

  const handleFieldChange = (field, value) => {
    setProfileForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
        country: profileForm.country.trim(),
        city: profileForm.city.trim(),
        companyName: profileForm.companyName.trim(),
        professionalTitle: profileForm.professionalTitle.trim(),
        skills: profileForm.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        experienceLevel: profileForm.experienceLevel.trim(),
        hourlyRate: profileForm.hourlyRate === "" ? null : Number(profileForm.hourlyRate),
        bio: profileForm.bio.trim(),
      };

      const savedUser = await updateProfile(payload);
      setUser((previous) => ({ ...previous, ...normalizeSessionUser(savedUser) }));
      setIsEditing(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const profileAvatar = firstInitial(user.name || "User");

  return (
    <Page>
      <PageHeader
        eyebrow={isClient ? "CLIENT PROFILE" : "FREELANCER PROFILE"}
        title={user.name || "Profile"}
        description={user.bio || (isClient ? "Client workspace details." : "Freelancer workspace details.")}
        action={
          <button type="button" className="button secondary" onClick={() => {
            if (!isEditing) {
              setProfileForm({
                name: user.name || "",
                email: user.email || "",
                phone: user.phone || "",
                country: user.country || "",
                city: user.city || "",
                companyName: user.companyName || "",
                professionalTitle: user.professionalTitle || "",
                skills: Array.isArray(user.skills) ? user.skills.join(", ") : "",
                experienceLevel: user.experienceLevel || "",
                hourlyRate: user.hourlyRate ?? "",
                bio: user.bio || "",
              });
            }
            setIsEditing((previous) => !previous);
          }}>
            {isEditing ? "Cancel" : "Edit Profile"}
          </button>
        }
      />

      {!isEditing ? (
        <div className="profile-shell">
          <div className="panel profile-panel">
            <div className="profile-header-row">
              <div className="profile-avatar">{profileAvatar}</div>
              <div>
                <h3>{user.name || "User"}</h3>
                <p>{isClient ? "Client" : "Freelancer"}</p>
              </div>
            </div>

            <div className="profile-grid">
              <div className="profile-meta"><span>Full Name</span><strong>{user.name || "—"}</strong></div>
              <div className="profile-meta"><span>Email</span><strong>{user.email || "—"}</strong></div>
              <div className="profile-meta"><span>Phone</span><strong>{user.phone || "—"}</strong></div>
              <div className="profile-meta"><span>Country</span><strong>{user.country || "—"}</strong></div>
              <div className="profile-meta"><span>City</span><strong>{user.city || "—"}</strong></div>
              <div className="profile-meta"><span>Role</span><strong>{formatRoleValue(user.role)}</strong></div>
            </div>

            {isClient ? (
              <>
                <div className="profile-section">
                  <h4>About</h4>
                  <p>{user.bio || "No company overview added yet."}</p>
                </div>
                <div className="profile-section">
                  <h4>Company / Organization</h4>
                  <p>{user.companyName || "Not provided"}</p>
                </div>
              </>
            ) : (
              <>
                <div className="profile-section">
                  <h4>Professional Title</h4>
                  <p>{user.professionalTitle || "Not provided"}</p>
                </div>
                <div className="profile-section">
                  <h4>About / Bio</h4>
                  <p>{user.bio || "No bio added yet."}</p>
                </div>
                <div className="profile-section">
                  <h4>Skills</h4>
                  <p>{user.skills && user.skills.length ? user.skills.join(", ") : "No skills added yet."}</p>
                </div>
                <div className="profile-meta"><span>Experience Level</span><strong>{user.experienceLevel || "—"}</strong></div>
                <div className="profile-meta"><span>Hourly Rate</span><strong>{user.hourlyRate ? `₹${Number(user.hourlyRate).toLocaleString("en-IN")}` : "—"}</strong></div>
              </>
            )}

            <div className="profile-grid compact">
              <div className="profile-meta"><span>Email</span><strong>{user.email || "—"}</strong></div>
              <div className="profile-meta"><span>Phone</span><strong>{user.phone || "—"}</strong></div>
              <div className="profile-meta"><span>Member since</span><strong>{formatDateLabel(user.createdAt)}</strong></div>
              <div className="profile-meta"><span>Account type</span><strong>{formatRoleValue(user.role)}</strong></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel profile-panel">
          <form onSubmit={handleProfileSave} className="profile-form" noValidate>
            <div className="field-row">
              <label className="field">
                <span>Full Name</span>
                <input value={profileForm.name} onChange={(event) => handleFieldChange("name", event.target.value)} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={profileForm.email} onChange={(event) => handleFieldChange("email", event.target.value)} />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Phone</span>
                <input value={profileForm.phone} onChange={(event) => handleFieldChange("phone", event.target.value)} />
              </label>
              <label className="field">
                <span>Country</span>
                <input value={profileForm.country} onChange={(event) => handleFieldChange("country", event.target.value)} />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>City</span>
                <input value={profileForm.city} onChange={(event) => handleFieldChange("city", event.target.value)} />
              </label>
              <label className="field">
                <span>Role</span>
                <input value={formatRoleValue(user.role)} disabled />
              </label>
            </div>

            {isClient ? (
              <>
                <label className="field">
                  <span>Company / Organization Name</span>
                  <input value={profileForm.companyName} onChange={(event) => handleFieldChange("companyName", event.target.value)} />
                </label>
                <label className="field">
                  <span>About / Description</span>
                  <textarea value={profileForm.bio} onChange={(event) => handleFieldChange("bio", event.target.value)} />
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Professional Title</span>
                  <input value={profileForm.professionalTitle} onChange={(event) => handleFieldChange("professionalTitle", event.target.value)} />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Skills</span>
                    <input value={profileForm.skills} onChange={(event) => handleFieldChange("skills", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Experience Level</span>
                    <select value={profileForm.experienceLevel} onChange={(event) => handleFieldChange("experienceLevel", event.target.value)}>
                      <option value="">Select</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Hourly Rate (₹)</span>
                  <input type="number" min="1" step="1" value={profileForm.hourlyRate} onChange={(event) => handleFieldChange("hourlyRate", event.target.value)} />
                </label>
                <label className="field">
                  <span>Short Bio / About</span>
                  <textarea value={profileForm.bio} onChange={(event) => handleFieldChange("bio", event.target.value)} />
                </label>
              </>
            )}

            {error && <p className="form-error">{error}</p>}
            <div className="auth-actions">
              <button type="button" className="button secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button type="submit" className="button primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </div>
      )}
    </Page>
  );
}

function SettingsPage({ user, signOut }) {
  const navigate = useNavigate();
  const handleLogout = () => {
    navigate("/login");
    signOut();
  };

  return (
    <Page>
      <PageHeader eyebrow="ACCOUNT" title="Settings" description="Manage your account and saved profile details." />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h3>Account</h3>
          <div className="settings-row"><span>Signed in as</span><strong>{user?.name || "User"}</strong></div>
          <div className="settings-row"><span>Email</span><strong>{user?.email || "—"}</strong></div>
          <div className="settings-row"><span>Role</span><strong>{formatRoleValue(user?.role)}</strong></div>
        </section>

        <section className="panel settings-panel">
          <h3>Profile</h3>
          <Link to="/profile" className="settings-link">Edit Profile</Link>
        </section>

        <section className="panel settings-panel">
          <h3>Notifications</h3>
          <Link to="/notifications" className="settings-link">View workspace updates</Link>
        </section>

        <section className="panel settings-panel">
          <h3>Session</h3>
          <button type="button" className="settings-action danger" onClick={handleLogout}>Log out</button>
        </section>
      </div>
    </Page>
  );
}

function formatTimeAgo(value) {
  if (!value) return "just now";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default App;
