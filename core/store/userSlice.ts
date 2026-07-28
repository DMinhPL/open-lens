import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { OpenProjectProjectSummary, OpenProjectUser } from "@/core/domain/types";

type RequestStatus = "idle" | "loading" | "succeeded" | "failed";

interface UserState {
  info: OpenProjectUser | null;
  infoStatus: RequestStatus;
  infoError: string | null;
  projects: OpenProjectProjectSummary[] | null;
  projectsStatus: RequestStatus;
  projectsError: string | null;
}

const initialState: UserState = {
  info: null,
  infoStatus: "idle",
  infoError: null,
  projects: null,
  projectsStatus: "idle",
  projectsError: null,
};

async function parseJsonOrThrow(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export const fetchCurrentUser = createAsyncThunk<OpenProjectUser>("user/fetchCurrentUser", async () => {
  const res = await fetch("/api/openproject/me");
  return parseJsonOrThrow(res);
});

export const fetchUserProjects = createAsyncThunk<OpenProjectProjectSummary[], number>(
  "user/fetchUserProjects",
  async (userId) => {
    const res = await fetch(`/api/openproject/projects?principal=${userId}`);
    const data = await parseJsonOrThrow(res);
    return data.projects as OpenProjectProjectSummary[];
  },
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearUser(state) {
      state.info = null;
      state.infoStatus = "idle";
      state.infoError = null;
      state.projects = null;
      state.projectsStatus = "idle";
      state.projectsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.infoStatus = "loading";
        state.infoError = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.infoStatus = "succeeded";
        state.info = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.infoStatus = "failed";
        state.infoError = action.error.message ?? "Failed to load current user";
      })
      .addCase(fetchUserProjects.pending, (state) => {
        state.projectsStatus = "loading";
        state.projectsError = null;
      })
      .addCase(fetchUserProjects.fulfilled, (state, action) => {
        state.projectsStatus = "succeeded";
        state.projects = action.payload;
      })
      .addCase(fetchUserProjects.rejected, (state, action) => {
        state.projectsStatus = "failed";
        state.projectsError = action.error.message ?? "Failed to load projects";
      });
  },
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
