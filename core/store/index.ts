import { configureStore } from "@reduxjs/toolkit";
import userReducer from "@/core/store/userSlice";
import commonReducer from "@/core/store/commonSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    common: commonReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
