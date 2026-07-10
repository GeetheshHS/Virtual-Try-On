import axios from "axios";

// Default local FastAPI backend URL
const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BACKEND_URL,
});

export const getFullUrl = (relativeUrl) => {
  if (!relativeUrl) return "";
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) {
    return relativeUrl;
  }
  return `${BACKEND_URL}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}`;
};

export const uploadPersonImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/upload/person", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const uploadClothImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/upload/cloth", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const generateTryOn = async (params) => {
  // Convert arguments to Form Data as expected by backend Form(...) bindings
  const formData = new FormData();
  formData.append("person_id", params.personId);
  formData.append("cloth_id", params.clothId);
  if (params.category) formData.append("category", params.category);
  if (params.prompt) formData.append("prompt", params.prompt);
  if (params.height) formData.append("height", params.height);
  if (params.width) formData.append("width", params.width);
  if (params.mode) formData.append("mode", params.mode);
  if (params.preserveArms !== undefined) formData.append("preserve_arms", params.preserveArms);

  const response = await api.post("/generate", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const cleanupSession = async (transactionId) => {
  const response = await api.delete(`/cleanup/${transactionId}`);
  return response.data;
};

export default api;
