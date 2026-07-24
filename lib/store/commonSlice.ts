import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { OpenProjectStatus } from "@/lib/types";

type RequestStatus = "idle" | "loading" | "succeeded" | "failed";

interface CommonState {
  statuses: OpenProjectStatus[] | null;
  statusesStatus: RequestStatus;
  statusesError: string | null;
}

const initialState: CommonState = {
  statuses: null,
  statusesStatus: "idle",
  statusesError: null,
};

async function parseJsonOrThrow(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export const fetchStatuses = createAsyncThunk<OpenProjectStatus[]>("common/fetchStatuses", async () => {
  const res = await fetch("/api/openproject/statuses");
  const data = await parseJsonOrThrow(res);
  return data.statuses as OpenProjectStatus[];
});

const commonSlice = createSlice({
  name: "common",
  initialState,
  reducers: {
    clearCommon(state) {
      state.statuses = null;
      state.statusesStatus = "idle";
      state.statusesError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStatuses.pending, (state) => {
        state.statusesStatus = "loading";
        state.statusesError = null;
      })
      .addCase(fetchStatuses.fulfilled, (state, action) => {
        state.statusesStatus = "succeeded";
        state.statuses = action.payload;
      })
      .addCase(fetchStatuses.rejected, (state, action) => {
        state.statusesStatus = "failed";
        state.statusesError = action.error.message ?? "Failed to load statuses";
      });
  },
});

export const { clearCommon } = commonSlice.actions;
export default commonSlice.reducer;
