"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";
import { store } from "@/core/store";

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  // Enables RTK Query's refetchOnFocus/refetchOnReconnect behavior for its queries.
  useEffect(() => setupListeners(store.dispatch), []);

  return <Provider store={store}>{children}</Provider>;
}
