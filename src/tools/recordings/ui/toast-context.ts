"use client";

import { createContext, useContext } from "react";
import type { ActionResult } from "../types";

/** Shows a Recordings button's outcome in the page's toast (`Toaster`). */
export const ToastContext = createContext<(r: ActionResult) => void>(() => {});
export const useToast = () => useContext(ToastContext);
