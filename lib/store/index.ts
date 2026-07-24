import { configureStore } from "@reduxjs/toolkit";
import userReducer from "@/lib/store/userSlice";
import commonReducer from "@/lib/store/commonSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    common: commonReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
