import { configureStore } from "@reduxjs/toolkit";
import userReducer from "@/core/store/userSlice";
import commonReducer from "@/core/store/commonSlice";
import { openLensApi } from "@/core/api/api-slice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    common: commonReducer,
    [openLensApi.reducerPath]: openLensApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(openLensApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
