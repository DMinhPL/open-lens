"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { fetchCurrentUser, fetchUserProjects } from "@/lib/store/userSlice";

/**
 * Loads the current OpenProject user (and their project memberships) into Redux
 * exactly once, the first time the user enters the app shell. Renders nothing;
 * mount it once inside the (app) layout.
 */
export function UserBootstrap() {
  const dispatch = useAppDispatch();
  const { info: currentUser, infoStatus, projectsStatus } = useAppSelector((state) => state.user);

  useEffect(() => {
    if (infoStatus === "idle") {
      dispatch(fetchCurrentUser());
    }
  }, [infoStatus, dispatch]);

  useEffect(() => {
    if (currentUser && projectsStatus === "idle") {
      dispatch(fetchUserProjects(currentUser.id));
    }
  }, [currentUser, projectsStatus, dispatch]);

  return null;
}
